use sqlx::PgPool;
use mongodb::Client as MongoClient;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use axum::extract::ws::Message;
use crate::websocket::rooms::RoomManager;

pub type ConnectionId = String;
pub type Sender = tokio::sync::mpsc::UnboundedSender<Message>;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub mongo: MongoClient,

    // WebSocket connections
    pub connections: Arc<RwLock<HashMap<ConnectionId, Sender>>>,
    pub room_manager: Arc<Mutex<RoomManager>>,

    // conn_id -> (user_id, username)
    pub user_info: Arc<RwLock<HashMap<ConnectionId, (String, String)>>>,
}

impl AppState {
    // Ajouter une connexion WebSocket
    pub async fn add_connection(&self, connection_id: ConnectionId, sender: Sender) {
        self.connections.write().await.insert(connection_id, sender);
    }

    // Retirer une connexion WebSocket
    pub async fn remove_connection(&self, connection_id: &str) {
        self.connections.write().await.remove(connection_id);
        self.room_manager.lock().await.leave_all_rooms(connection_id).await;
    }

    pub async fn register_user(&self, conn_id: &str, user_id: &str, username: &str) {
        self.user_info.write().await.insert(
            conn_id.to_string(),
            (user_id.to_string(), username.to_string()),
        );
    }

    pub async fn unregister_user(&self, conn_id: &str) -> Option<(String, String)> {
        self.user_info.write().await.remove(conn_id)
    }

    pub async fn is_user_online(&self, user_id: &str) -> bool {
        self.user_info.read().await.values().any(|(uid, _)| uid == user_id)
    }

    pub async fn broadcast_all(&self, message: Message, exclude_connection: Option<&str>) {
        let connections = self.connections.read().await;
        for (conn_id, sender) in connections.iter() {
            if let Some(exclude) = exclude_connection {
                if conn_id == exclude {
                    continue;
                }
            }
            let _ = sender.send(message.clone());
        }
    }

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