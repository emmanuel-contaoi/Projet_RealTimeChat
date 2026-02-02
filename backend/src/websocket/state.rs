use crate::websocket::rooms::RoomManager;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use axum::extract::ws::Message;

// ID unique pour chaque connexion WebSocket
pub type ConnectionId = String;

// Sender pour envoyer des messages à une connexion spécifique
pub type Sender = tokio::sync::mpsc::UnboundedSender<Message>;

// État partagé entre toutes les connexions WebSocket
#[derive(Clone)]
pub struct AppState {
    pub connections: Arc<RwLock<HashMap<ConnectionId, Sender>>>,
    pub room_manager: Arc<Mutex<RoomManager>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            room_manager: Arc::new(Mutex::new(RoomManager::new())),
        }
    }

    // Ajouter une connexion
    pub async fn add_connection(&self, connection_id: ConnectionId, sender: Sender) {
        self.connections.write().await.insert(connection_id, sender);
    }

    // Retirer une connexion
    pub async fn remove_connection(&self, connection_id: &str) {
        self.connections.write().await.remove(connection_id);
        self.room_manager.lock().await.leave_all_rooms(connection_id).await;
    }

    // Broadcaster un message à tous les users d'un channel
    pub async fn broadcast_to_channel(&self, channel_id: &str, message: Message, exclude_connection: Option<&str>) {
        let connection_ids = self.room_manager
            .lock()
            .await
            .get_room_connections(channel_id)
            .await;

        let connections = self.connections.read().await;

        for conn_id in connection_ids {
            if let Some(exclude) = exclude_connection {
                if conn_id == exclude {
                    continue;
                }
            }
            if let Some(sender) = connections.get(&conn_id) {
                let _ = sender.send(message.clone());
            }
        }
    }
}