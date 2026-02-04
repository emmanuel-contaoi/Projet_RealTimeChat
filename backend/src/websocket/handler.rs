use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, State},
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use tokio::sync::mpsc;
use crate::websocket::{
    events::{ClientEvent, ServerEvent},
    state::AppState,
};

// Upgrade la connexion HTTP vers WebSocket
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

// Gère une connexion WebSocket individuelle
async fn handle_socket(socket: WebSocket, state: AppState) {
    // Générer un ID unique pour cette connexion
    let connection_id = uuid::Uuid::new_v4().to_string();
    println!("WebSocket connecté: {}", connection_id);

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Créer un channel pour envoyer des messages à cette connexion
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    state.add_connection(connection_id.clone(), tx).await;

    let state_clone = state.clone();
    let connection_id_clone = connection_id.clone();

    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    println!("Reçu de {}: {}", connection_id_clone, text);

                    match serde_json::from_str::<ClientEvent>(&text) {
                        Ok(event) => {
                            handle_client_event(
                                event,
                                &connection_id_clone,
                                &state_clone
                            ).await;
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
                                    .get(&connection_id_clone)
                                    .map(|sender| sender.send(Message::Text(json.into())));
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    println!("Connexion fermée: {}", connection_id_clone);
                    break;
                }
                Message::Ping(data) => {
                    if let Some(sender) = state_clone.connections.read().await.get(&connection_id_clone) {
                        let _ = sender.send(Message::Pong(data));
                    }
                }
                _ => {}
            }
        }
    });

    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    state.remove_connection(&connection_id).await;
    println!("Déconnecté: {}", connection_id);
}

// Route les événements des client vers les bonnes actions
async fn handle_client_event(
    event: ClientEvent,
    connection_id: &str,
    state: &AppState,
) {
    match event {
        ClientEvent::MessageSend { channel_id, content } => {
            println!("Message de {} pour channel {}: {}", connection_id, channel_id, content);

            // TODO: faire la sauvegarde des messages dans MongoDB

            // Créer l'événement à broadcaster
            let response = ServerEvent::MessageNew {
                id: uuid::Uuid::new_v4().to_string(),
                channel_id: channel_id.clone(),
                user_id: connection_id.to_string(), // TODO: Utiliser le vrai user_id du JWT
                username: "TestUser".to_string(),   // TODO: Utiliser le vrai username du JWT
                content: content.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
            };

            if let Ok(json) = response.to_json() {
                state.broadcast_to_channel(
                    &channel_id,
                    Message::Text(json.into()),
                    None
                ).await;
            }
        }

        ClientEvent::TypingStart { channel_id } => {
            println!("Utilisateur {} tape dans channel {}", connection_id, channel_id);

            let typing_event = ServerEvent::UserTyping {
                channel_id: channel_id.clone(),
                user_id: connection_id.to_string(),
                username: "TestUser".to_string(),
            };

            if let Ok(json) = typing_event.to_json() {
                state.broadcast_to_channel(
                    &channel_id,
                    Message::Text(json.into()),
                    Some(connection_id)
                ).await;
            }
        }

        ClientEvent::TypingStop { channel_id } => {
            println!("Utilisateur {} arrête de taper dans channel {}", connection_id, channel_id);
        }

        ClientEvent::JoinChannel { channel_id } => {
            println!("Utilisateur {} rejoint channel {}", connection_id, channel_id);

            state.room_manager
                .lock()
                .await
                .join_room(&channel_id, connection_id)
                .await;

            let connected_event = ServerEvent::UserConnected {
                user_id: connection_id.to_string(),
                username: "TestUser".to_string(),
            };

            if let Ok(json) = connected_event.to_json() {
                state.broadcast_to_channel(
                    &channel_id,
                    Message::Text(json.into()),
                    Some(connection_id)
                ).await;
            }
        }

        ClientEvent::LeaveChannel { channel_id } => {
            println!("Utilisateur {} quitte channel {}", connection_id, channel_id);

            state.room_manager
                .lock()
                .await
                .leave_room(&channel_id, connection_id)
                .await;

            let disconnected_event = ServerEvent::UserDisconnected {
                user_id: connection_id.to_string(),
            };

            if let Ok(json) = disconnected_event.to_json() {
                state.broadcast_to_channel(
                    &channel_id,
                    Message::Text(json.into()),
                    Some(connection_id)
                ).await;
            }
        }
    }
}