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
use crate::models::user::Claims; // Utilisez le bon chemin selon votre structure
use jsonwebtoken::{decode, DecodingKey, Validation};

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

// Upgrade la connexion HTTP vers WebSocket avec authentification
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    // Valider le JWT
    let claims = validate_token(&query.token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    println!("WebSocket auth réussie pour user: {}", claims.user_id);
    
    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, claims)))
}

// Valider le JWT et extraire les claims
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

// Gère une connexion WebSocket individuelle
async fn handle_socket(socket: WebSocket, state: AppState, claims: Claims) {
    let user_id = claims.user_id.to_string();
    println!("WebSocket connecté: user {}", user_id);

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    state.add_connection(user_id.clone(), tx).await;

    let state_clone = state.clone();
    let user_id_clone = user_id.clone();

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
                            handle_client_event(event, &user_id_clone, &state_clone).await;
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
                                    .get(&user_id_clone)
                                    .map(|sender| sender.send(Message::Text(json.into())));
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    println!("Connexion fermée: {}", user_id_clone);
                    break;
                }
                Message::Ping(data) => {
                    if let Some(sender) = state_clone.connections.read().await.get(&user_id_clone) {
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

    state.remove_connection(&user_id).await;
    println!("Déconnecté: {}", user_id);
}

// Route les événements du client
async fn handle_client_event(event: ClientEvent, user_id: &str, state: &AppState) {
    match event {
        ClientEvent::MessageSend { channel_id, content } => {
            println!("Message de {} pour channel {}: {}", user_id, channel_id, content);

            let response = ServerEvent::MessageNew {
                id: Uuid::new_v4().to_string(),
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                username: "User".to_string(), // TODO: Récupérer depuis DB
                content: content.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
            };

            if let Ok(json) = response.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), None).await;
            }
        }

        ClientEvent::TypingStart { channel_id } => {
            let typing_event = ServerEvent::UserTyping {
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
                username: "User".to_string(),
            };

            if let Ok(json) = typing_event.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(user_id)).await;
            }
        }

        ClientEvent::TypingStop { .. } => {}

        ClientEvent::JoinChannel { channel_id } => {
            state.room_manager.lock().await.join_room(&channel_id, user_id).await;

            let connected_event = ServerEvent::UserConnected {
                user_id: user_id.to_string(),
                username: "User".to_string(),
            };

            if let Ok(json) = connected_event.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(user_id)).await;
            }
        }

        ClientEvent::LeaveChannel { channel_id } => {
            state.room_manager.lock().await.leave_room(&channel_id, user_id).await;

            let disconnected_event = ServerEvent::UserDisconnected {
                user_id: user_id.to_string(),
            };

            if let Ok(json) = disconnected_event.to_json() {
                state.broadcast_to_channel(&channel_id, Message::Text(json.into()), Some(user_id)).await;
            }
        }
    }
}