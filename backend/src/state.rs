use sqlx::PgPool;
use mongodb::Client as MongoClient;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use axum::extract::ws::Message;
use crate::websocket::rooms::RoomManager;

pub type ConnectionId = String;
pub type Sender = tokio::sync::mpsc::UnboundedSender<Message>;

// État global partagé par toute l'application
#[derive(Clone)]
pub struct AppState {
    // Base de données
    pub pool: PgPool,
    pub mongo: MongoClient,
    
    // WebSocket
    pub connections: Arc<RwLock<HashMap<ConnectionId, Sender>>>,
    pub room_manager: Arc<Mutex<RoomManager>>,
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

    // Broadcaster un message à tous les users d'un channel
    pub async fn broadcast_to_channel(&self, channel_id: &str, message: Message, exclude_connection: Option<&str>) {
        let connection_ids = self.room_manager
            .lock()
            .await
            .get_room_connections(channel_id)
            .await;

        println!("[broadcast] Channel {} has {} connections: {:?}", channel_id, connection_ids.len(), connection_ids);

        let connections = self.connections.read().await;
        let total_connections = connections.len();
        println!("[broadcast] Total active connections: {}", total_connections);

        for conn_id in connection_ids {
            if let Some(exclude) = exclude_connection {
                if conn_id == exclude {
                    println!("[broadcast] Skipping excluded connection: {}", conn_id);
                    continue;
                }
            }
            if let Some(sender) = connections.get(&conn_id) {
                match sender.send(message.clone()) {
                    Ok(_) => println!("[broadcast] Sent to connection: {}", conn_id),
                    Err(e) => println!("[broadcast] Failed to send to {}: {}", conn_id, e),
                }
            } else {
                println!("[broadcast] Connection {} not found in active connections!", conn_id);
            }
        }
    }
}