use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, State, Query},
    response::Response,
    http::StatusCode,
};
use futures::{sink::SinkExt, stream::StreamExt};
use tokio::sync::mpsc;
use serde::Deserialize;
use uuid::Uuid;

use crate::websocket::{
    events::{ClientEvent, ServerEvent, ChannelUser},
};
use crate::state::AppState;
use crate::utils::jwt::{Claims, validate_token_claims};
use crate::modules::servers::models::Message as ChatMessage;
use crate::repositories::channel_repository::ChannelRepository;

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    let claims = validate_token_claims(&query.token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, claims)))
}

async fn handle_socket(socket: WebSocket, state: AppState, claims: Claims) {
    let user_id = claims.sub.clone();
    // ID unique pour gerer plusieurs connexions du meme utilisateur
    let conn_id = Uuid::new_v4().to_string();

    let username = sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE id = $1")
        .bind(uuid::Uuid::parse_str(&user_id).unwrap_or_default())
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "Unknown".to_string());

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    state.add_connection(conn_id.clone(), tx).await;
    state.register_user(&conn_id, &user_id, &username).await;

    // On previent tout le monde que l'utilisateur est en ligne
    let connected_event = ServerEvent::UserConnected {
        user_id: user_id.clone(),
        username: username.clone(),
    };
    if let Ok(json) = connected_event.to_json() {
        state.broadcast_all(Message::Text(json.into()), Some(&conn_id)).await;
    }

    let state_clone = state.clone();
    let conn_id_clone = conn_id.clone();
    let user_id_clone = user_id.clone();
    let username_clone = username.clone();

    // Task d'envoi
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Task de réception
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    match serde_json::from_str::<ClientEvent>(&text) {
                        Ok(event) => {
                            handle_client_event(event, &user_id_clone, &conn_id_clone, &username_clone, &state_clone).await;
                        }
                        Err(e) => {
                            let error = ServerEvent::Error {
                                message: format!("JSON invalide: {}", e),
                            };
                            if let Ok(json) = error.to_json() {
                                let _ = state_clone.connections
                                    .read()
                                    .await
                                    .get(&conn_id_clone)
                                    .map(|sender| sender.send(Message::Text(json.into())));
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                Message::Ping(data) => {
                    if let Some(sender) = state_clone.connections.read().await.get(&conn_id_clone) {
                        let _ = sender.send(Message::Pong(data));
                    }
                }
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // Deconnexion : on previent les autres si c'etait sa derniere connexion
    if let Some((uid, _)) = state.unregister_user(&conn_id).await {
        if !state.is_user_online(&uid).await {
            let evt = ServerEvent::UserDisconnected { user_id: uid };
            if let Ok(json) = evt.to_json() {
                state.broadcast_all(Message::Text(json.into()), None).await;
            }
        }
    }

    state.remove_connection(&conn_id).await;
}

async fn handle_client_event(event: ClientEvent, user_id: &str, conn_id: &str, username: &str, state: &AppState) {
    match event {
        ClientEvent::MessageSend { channel_id, content } => {
            // Vérifie que l'utilisateur est toujours membre du serveur (protège contre les kickés)
            let channel_uuid = match Uuid::parse_str(&channel_id) {
                Ok(id) => id,
                Err(_) => return,
            };
            let user_uuid = match Uuid::parse_str(user_id) {
                Ok(id) => id,
                Err(_) => return,
            };
            let membership = ChannelRepository::get_member_role(&state.pool, channel_uuid, user_uuid).await;
            if membership.map(|m| m.is_none()).unwrap_or(true) {
                return; // Pas membre → on ignore le message silencieusement
            }

            // On s'assure que l'envoyeur est bien dans la room
            state.room_manager.lock().await.join_room(&channel_id, conn_id).await;

            let created_at = chrono::Utc::now().to_rfc3339();

            let collection = state.mongo.database("chat").collection::<ChatMessage>("messages");
            let new_message = ChatMessage {
                id: None,
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                content: content.clone(),
                username: username.to_string(),
                created_at: Some(created_at.clone()),
            };

            let msg_id = match collection.insert_one(new_message, None).await {
                Ok(result) => result.inserted_id
                    .as_object_id()
                    .map(|oid| oid.to_hex())
                    .unwrap_or_default(),
                Err(_) => return,
            };

            let response = ServerEvent::MessageNew {
                id: msg_id,
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                username: username.to_string(),
                content: content.clone(),
                created_at,
            };

            if let Ok(json) = response.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), None).await;
            }
        }

        ClientEvent::TypingStart { channel_id } => {
            let typing_event = ServerEvent::UserTyping {
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                username: username.to_string(),
            };

            if let Ok(json) = typing_event.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(conn_id)).await;
            }
        }

        ClientEvent::TypingStop { .. } => {}

        ClientEvent::JoinChannel { channel_id } => {
            state.room_manager.lock().await.join_room(&channel_id, conn_id).await;

            // On envoie la liste des utilisateurs connectes au channel
            let conn_ids = state.room_manager.lock().await.get_room_connections(&channel_id).await;
            let user_info = state.user_info.read().await;
            let mut seen = std::collections::HashSet::new();
            let mut users = Vec::new();
            for cid in &conn_ids {
                if let Some((uid, uname)) = user_info.get(cid) {
                    if seen.insert(uid.clone()) {
                        users.push(ChannelUser {
                            user_id: uid.clone(),
                            username: uname.clone(),
                        });
                    }
                }
            }
            drop(user_info);

            let channel_users_event = ServerEvent::ChannelUsers {
                channel_id: channel_id.clone(),
                users,
            };
            if let Ok(json) = channel_users_event.to_json() {
                if let Some(sender) = state.connections.read().await.get(conn_id) {
                    let _ = sender.send(Message::Text(json.into()));
                }
            }
        }

        ClientEvent::LeaveChannel { channel_id } => {
            state.room_manager.lock().await.leave_room(&channel_id, conn_id).await;
        }
    }
}
