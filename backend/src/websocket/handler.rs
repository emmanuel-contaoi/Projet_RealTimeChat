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
    events::{ClientEvent, ServerEvent},
};
use crate::state::AppState;
use crate::utils::jwt::Claims;
use crate::modules::servers::models::Message as ChatMessage;
use jsonwebtoken::{decode, DecodingKey, Validation};

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    let claims = validate_token(&query.token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    println!("WebSocket auth réussie pour user: {}", claims.sub);

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, claims)))
}

fn validate_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "super-secret-key-change-this-in-production".to_string());

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}

async fn handle_socket(socket: WebSocket, state: AppState, claims: Claims) {
    let user_id = claims.sub.clone();
    // Unique connection ID to avoid collisions when same user has multiple connections
    let conn_id = Uuid::new_v4().to_string();
    println!("WebSocket connecté: user {} (conn {})", user_id, conn_id);

    let username = sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE id = $1")
        .bind(uuid::Uuid::parse_str(&user_id).unwrap_or_default())
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "Unknown".to_string());

    println!("Username résolu: {}", username);

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    state.add_connection(conn_id.clone(), tx).await;

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
                            println!("JSON invalide: {}", e);
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
                Message::Close(_) => {
                    println!("Connexion fermée: {} (conn {})", user_id_clone, conn_id_clone);
                    break;
                }
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

    state.remove_connection(&conn_id).await;
    println!("Déconnecté: user {} (conn {})", user_id, conn_id);
}

async fn handle_client_event(event: ClientEvent, user_id: &str, conn_id: &str, username: &str, state: &AppState) {
    match event {
        ClientEvent::MessageSend { channel_id, content } => {
            println!("Message de {} pour channel {}: {}", username, channel_id, content);

            let created_at = chrono::Utc::now().to_rfc3339();
            let msg_id = Uuid::new_v4().to_string();

            let collection = state.mongo.database("chat").collection::<ChatMessage>("messages");
            let new_message = ChatMessage {
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                content: content.clone(),
                username: username.to_string(),
                created_at: Some(created_at.clone()),
            };

            if let Err(e) = collection.insert_one(new_message, None).await {
                println!("Erreur persistance MongoDB: {:?}", e);
            }

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

            let connected_event = ServerEvent::UserConnected {
                user_id: user_id.to_string(),
                username: username.to_string(),
            };

            if let Ok(json) = connected_event.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(conn_id)).await;
            }
        }

        ClientEvent::LeaveChannel { channel_id } => {
            state.room_manager.lock().await.leave_room(&channel_id, conn_id).await;

            let disconnected_event = ServerEvent::UserDisconnected {
                user_id: user_id.to_string(),
            };

            if let Ok(json) = disconnected_event.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(conn_id)).await;
            }
        }
    }
}
