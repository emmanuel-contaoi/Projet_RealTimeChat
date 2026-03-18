use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::StatusCode,
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::modules::servers::models::Message as ChatMessage;
use crate::repositories::channel_repository::ChannelRepository;
use crate::state::AppState;
use crate::utils::jwt::{validate_token_claims, Claims};
use crate::websocket::events::{ChannelUser, ClientEvent, ServerEvent};

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    let claims = validate_token_claims(&query.token).map_err(|_| StatusCode::UNAUTHORIZED)?;

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
        state
            .broadcast_all(Message::Text(json.into()), Some(&conn_id))
            .await;
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
                Message::Text(text) => match serde_json::from_str::<ClientEvent>(&text) {
                    Ok(event) => {
                        handle_client_event(
                            event,
                            &user_id_clone,
                            &conn_id_clone,
                            &username_clone,
                            &state_clone,
                        )
                        .await;
                    }
                    Err(e) => {
                        let error = ServerEvent::Error {
                            message: format!("JSON invalide: {}", e),
                        };
                        if let Ok(json) = error.to_json() {
                            let _ = state_clone
                                .connections
                                .read()
                                .await
                                .get(&conn_id_clone)
                                .map(|sender| sender.send(Message::Text(json.into())));
                        }
                    }
                },
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

async fn handle_client_event(
    event: ClientEvent,
    user_id: &str,
    conn_id: &str,
    username: &str,
    state: &AppState,
) {
    match event {
        ClientEvent::MessageSend {
            channel_id,
            content,
        } => {
            // Vérifie que l'utilisateur est toujours membre du serveur (protège contre les kickés)
            let channel_uuid = match Uuid::parse_str(&channel_id) {
                Ok(id) => id,
                Err(_) => return,
            };
            let user_uuid = match Uuid::parse_str(user_id) {
                Ok(id) => id,
                Err(_) => return,
            };

            // 1. On vérifie d'abord si l'utilisateur a un rôle dans ce salon (Serveur)
            let membership = ChannelRepository::get_member_role(&state.pool, channel_uuid, user_uuid).await;
            let mut is_authorized = membership.unwrap_or(None).is_some();

            // 2. Si ce n'est pas un serveur, on vérifie si c'est un Message Privé (DM)
            if !is_authorized {
                let is_dm = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM dm_channels WHERE id = $1 AND (user1_id = $2 OR user2_id = $2))"
                )
                .bind(channel_uuid)
                .bind(user_uuid)
                .fetch_one(&state.pool)
                .await
                .unwrap_or(false);

                is_authorized = is_dm;
            }

            // 3. Si ce n'est ni un serveur ni un DM valide, on bloque le message silencieusement
            if !is_authorized {
                return; 
            }

            // On s'assure que l'envoyeur est bien dans la room
            state
                .room_manager
                .lock()
                .await
                .join_room(&channel_id, conn_id)
                .await;

            let created_at = chrono::Utc::now().to_rfc3339();

            let collection = state
                .mongo
                .database("chat")
                .collection::<ChatMessage>("messages");
            let new_message = ChatMessage {
                id: None,
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                content: content.clone(),
                username: username.to_string(),
                created_at: Some(created_at.clone()),
                reactions: Vec::new(),
            };

            let msg_id = match collection.insert_one(new_message).await {
                Ok(result) => result
                    .inserted_id
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
                reactions: Vec::new(),
            };

            if let Ok(json) = response.to_json() {
                state
                    .broadcast_to_channel(&channel_id, Message::Text(json.into()), None)
                    .await;
            }
        }

        ClientEvent::TypingStart { channel_id } => {
            let typing_event = ServerEvent::UserTyping {
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                username: username.to_string(),
            };

            if let Ok(json) = typing_event.to_json() {
                state
                    .broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(conn_id))
                    .await;
            }
        }

        ClientEvent::TypingStop { .. } => {}

        ClientEvent::JoinChannel { channel_id } => {
            state
                .room_manager
                .lock()
                .await
                .join_room(&channel_id, conn_id)
                .await;

            // On envoie la liste des utilisateurs connectes au channel
            let conn_ids = state
                .room_manager
                .lock()
                .await
                .get_room_connections(&channel_id)
                .await;
            let user_info = state.user_info.read().await;
            let users = collect_channel_users(&conn_ids, &user_info);
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
            state
                .room_manager
                .lock()
                .await
                .leave_room(&channel_id, conn_id)
                .await;
        }
    }
}

fn collect_channel_users(
    connection_ids: &[String],
    user_info: &std::collections::HashMap<String, (String, String)>,
) -> Vec<ChannelUser> {
    let mut seen = std::collections::HashSet::new();
    let mut users = Vec::new();

    for connection_id in connection_ids {
        if let Some((user_id, username)) = user_info.get(connection_id) {
            if seen.insert(user_id.clone()) {
                users.push(ChannelUser {
                    user_id: user_id.clone(),
                    username: username.clone(),
                });
            }
        }
    }

    users
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::collections::HashMap;
    use tokio::sync::mpsc::error::TryRecvError;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn join_channel_registers_connection_and_sends_channel_users_event() {
        let state = build_state().await;
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let channel_id = Uuid::new_v4().to_string();

        state.add_connection("conn-1".to_string(), tx).await;
        state.register_user("conn-1", "user-1", "alice").await;

        handle_client_event(
            ClientEvent::JoinChannel {
                channel_id: channel_id.clone(),
            },
            "user-1",
            "conn-1",
            "alice",
            &state,
        )
        .await;

        let room_connections = state
            .room_manager
            .lock()
            .await
            .get_room_connections(&channel_id)
            .await;
        assert_eq!(room_connections, vec!["conn-1".to_string()]);

        match rx.try_recv() {
            Ok(Message::Text(text)) => {
                let payload: Value =
                    serde_json::from_str(text.as_str()).expect("channel users payload");
                assert_eq!(payload["type"], "channel_users");
                assert_eq!(payload["channel_id"], channel_id);
                assert_eq!(payload["users"][0]["user_id"], "user-1");
                assert_eq!(payload["users"][0]["username"], "alice");
            }
            other => panic!("unexpected websocket message: {:?}", other),
        }
    }

    #[tokio::test]
    async fn leave_channel_removes_connection_from_room() {
        let state = build_state().await;
        let channel_id = Uuid::new_v4().to_string();

        state
            .room_manager
            .lock()
            .await
            .join_room(&channel_id, "conn-1")
            .await;

        handle_client_event(
            ClientEvent::LeaveChannel {
                channel_id: channel_id.clone(),
            },
            "user-1",
            "conn-1",
            "alice",
            &state,
        )
        .await;

        let room_connections = state
            .room_manager
            .lock()
            .await
            .get_room_connections(&channel_id)
            .await;
        assert!(room_connections.is_empty());
    }

    #[tokio::test]
    async fn typing_start_broadcasts_to_other_channel_members_only() {
        let state = build_state().await;
        let channel_id = Uuid::new_v4().to_string();
        let (tx1, mut rx1) = tokio::sync::mpsc::unbounded_channel();
        let (tx2, mut rx2) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx1).await;
        state.add_connection("conn-2".to_string(), tx2).await;
        state
            .room_manager
            .lock()
            .await
            .join_room(&channel_id, "conn-1")
            .await;
        state
            .room_manager
            .lock()
            .await
            .join_room(&channel_id, "conn-2")
            .await;

        handle_client_event(
            ClientEvent::TypingStart {
                channel_id: channel_id.clone(),
            },
            "user-1",
            "conn-1",
            "alice",
            &state,
        )
        .await;

        assert!(matches!(rx1.try_recv(), Err(TryRecvError::Empty)));
        match rx2.try_recv() {
            Ok(Message::Text(text)) => {
                let payload: Value = serde_json::from_str(text.as_str()).expect("typing payload");
                assert_eq!(payload["type"], "user_typing");
                assert_eq!(payload["channel_id"], channel_id);
                assert_eq!(payload["user_id"], "user-1");
                assert_eq!(payload["username"], "alice");
            }
            other => panic!("unexpected websocket message: {:?}", other),
        }
    }

    #[tokio::test]
    async fn typing_stop_does_not_emit_any_message() {
        let state = build_state().await;
        let channel_id = Uuid::new_v4().to_string();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx).await;
        state
            .room_manager
            .lock()
            .await
            .join_room(&channel_id, "conn-1")
            .await;

        handle_client_event(
            ClientEvent::TypingStop { channel_id },
            "user-1",
            "conn-1",
            "alice",
            &state,
        )
        .await;

        assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
    }

    #[tokio::test]
    async fn message_send_with_invalid_channel_id_returns_early() {
        let state = build_state().await;
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx).await;

        handle_client_event(
            ClientEvent::MessageSend {
                channel_id: "invalid-channel-id".to_string(),
                content: "hello".to_string(),
            },
            &Uuid::new_v4().to_string(),
            "conn-1",
            "alice",
            &state,
        )
        .await;

        assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
        assert!(state
            .room_manager
            .lock()
            .await
            .get_room_connections("invalid-channel-id")
            .await
            .is_empty());
    }

    #[tokio::test]
    async fn message_send_with_invalid_user_id_returns_early() {
        let state = build_state().await;
        let channel_id = Uuid::new_v4().to_string();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx).await;

        handle_client_event(
            ClientEvent::MessageSend {
                channel_id: channel_id.clone(),
                content: "hello".to_string(),
            },
            "not-a-uuid",
            "conn-1",
            "alice",
            &state,
        )
        .await;

        assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
        assert!(state
            .room_manager
            .lock()
            .await
            .get_room_connections(&channel_id)
            .await
            .is_empty());
    }

    #[tokio::test]
    async fn join_channel_deduplicates_users_with_multiple_connections() {
        let state = build_state().await;
        let channel_id = Uuid::new_v4().to_string();
        let (tx1, _rx1) = tokio::sync::mpsc::unbounded_channel();
        let (tx2, _rx2) = tokio::sync::mpsc::unbounded_channel();
        let (tx3, mut rx3) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx1).await;
        state.add_connection("conn-2".to_string(), tx2).await;
        state.add_connection("conn-3".to_string(), tx3).await;
        state.register_user("conn-1", "user-1", "alice").await;
        state.register_user("conn-2", "user-1", "alice").await;
        state.register_user("conn-3", "user-2", "bob").await;
        state
            .room_manager
            .lock()
            .await
            .join_room(&channel_id, "conn-1")
            .await;
        state
            .room_manager
            .lock()
            .await
            .join_room(&channel_id, "conn-2")
            .await;

        handle_client_event(
            ClientEvent::JoinChannel {
                channel_id: channel_id.clone(),
            },
            "user-2",
            "conn-3",
            "bob",
            &state,
        )
        .await;

        match rx3.try_recv() {
            Ok(Message::Text(text)) => {
                let payload: Value =
                    serde_json::from_str(text.as_str()).expect("channel users payload");
                assert_eq!(payload["type"], "channel_users");
                assert_eq!(payload["users"].as_array().map(Vec::len), Some(2));
            }
            other => panic!("unexpected websocket message: {:?}", other),
        }
    }

    #[test]
    fn collect_channel_users_deduplicates_users_and_ignores_unknown_connections() {
        let mut user_info = HashMap::new();
        user_info.insert(
            "conn-1".to_string(),
            ("user-1".to_string(), "alice".to_string()),
        );
        user_info.insert(
            "conn-2".to_string(),
            ("user-1".to_string(), "alice".to_string()),
        );
        user_info.insert(
            "conn-3".to_string(),
            ("user-2".to_string(), "bob".to_string()),
        );

        let users = collect_channel_users(
            &[
                "conn-1".to_string(),
                "missing".to_string(),
                "conn-2".to_string(),
                "conn-3".to_string(),
            ],
            &user_info,
        );

        assert_eq!(users.len(), 2);
        assert_eq!(users[0].user_id, "user-1");
        assert_eq!(users[0].username, "alice");
        assert_eq!(users[1].user_id, "user-2");
        assert_eq!(users[1].username, "bob");
    }
}