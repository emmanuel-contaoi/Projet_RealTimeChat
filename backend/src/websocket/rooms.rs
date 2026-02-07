use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

pub type ConnectionId = String;
pub type ChannelId = String;

// Gère les rooms (channels) et qui est connecté où
#[derive(Debug, Clone)]
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<ChannelId, HashSet<ConnectionId>>>>,
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // Ajoute une connexion à un channel
    pub async fn join_room(&self, channel_id: &str, connection_id: &str) {
        let mut rooms = self.rooms.write().await;
        rooms
            .entry(channel_id.to_string())
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());
        
    }

    // Retire une connexion d'un channel
    pub async fn leave_room(&self, channel_id: &str, connection_id: &str) {
        let mut rooms = self.rooms.write().await;
        if let Some(connections) = rooms.get_mut(channel_id) {
            connections.remove(connection_id);
            if connections.is_empty() {
                rooms.remove(channel_id);
            }
        }
    }

    // Retire une connexion de tous les channels
    pub async fn leave_all_rooms(&self, connection_id: &str) {
        let mut rooms = self.rooms.write().await;
        rooms.retain(|_, connections| {
            connections.remove(connection_id);
            !connections.is_empty()
        });
    }

    // Récupère toutes les connexions d'un channel
    pub async fn get_room_connections(&self, channel_id: &str) -> Vec<ConnectionId> {
        let rooms = self.rooms.read().await;
        rooms
            .get(channel_id)
            .map(|connections| connections.iter().cloned().collect())
            .unwrap_or_default()
    }
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}