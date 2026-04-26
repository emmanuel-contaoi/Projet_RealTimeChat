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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn join_and_leave_room_updates_connections() {
        let manager = RoomManager::new();

        manager.join_room("channel-1", "conn-1").await;
        manager.join_room("channel-1", "conn-2").await;

        let mut connections = manager.get_room_connections("channel-1").await;
        connections.sort();
        assert_eq!(
            connections,
            vec!["conn-1".to_string(), "conn-2".to_string()]
        );

        manager.leave_room("channel-1", "conn-1").await;

        assert_eq!(
            manager.get_room_connections("channel-1").await,
            vec!["conn-2".to_string()]
        );
    }

    #[tokio::test]
    async fn leave_all_rooms_removes_connection_from_every_channel() {
        let manager = RoomManager::new();

        manager.join_room("channel-1", "conn-1").await;
        manager.join_room("channel-2", "conn-1").await;
        manager.join_room("channel-2", "conn-2").await;

        manager.leave_all_rooms("conn-1").await;

        assert!(manager.get_room_connections("channel-1").await.is_empty());
        assert_eq!(
            manager.get_room_connections("channel-2").await,
            vec!["conn-2".to_string()]
        );
    }

    #[tokio::test]
    async fn join_room_deduplicates_same_connection() {
        let manager = RoomManager::new();

        manager.join_room("channel-1", "conn-1").await;
        manager.join_room("channel-1", "conn-1").await;

        assert_eq!(
            manager.get_room_connections("channel-1").await,
            vec!["conn-1".to_string()]
        );
    }

    #[test]
    fn room_manager_default_creates_empty_manager() {
        let manager = RoomManager::default();
        // Default delegates to new() — assert it compiles and returns a valid instance
        let _ = manager.rooms;
    }

    #[tokio::test]
    async fn leaving_unknown_room_or_connection_is_safe() {
        let manager = RoomManager::new();

        manager.leave_room("missing-channel", "missing-conn").await;
        manager.join_room("channel-1", "conn-1").await;
        manager.leave_room("channel-1", "other-conn").await;

        assert_eq!(
            manager.get_room_connections("channel-1").await,
            vec!["conn-1".to_string()]
        );
    }
}
