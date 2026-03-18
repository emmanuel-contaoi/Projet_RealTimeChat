use crate::websocket::rooms::RoomManager;
use axum::extract::ws::Message;
use mongodb::Client as MongoClient;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

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
        self.room_manager
            .lock()
            .await
            .leave_all_rooms(connection_id)
            .await;
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
        self.user_info
            .read()
            .await
            .values()
            .any(|(uid, _)| uid == user_id)
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

    // Envoie un message WebSocket a tous les utilisateurs dont l'ID est dans la liste
    pub async fn broadcast_to_users(&self, user_ids: &[String], message: Message) {
        let connections = self.connections.read().await;
        let user_info = self.user_info.read().await;
        for (conn_id, (uid, _)) in user_info.iter() {
            if user_ids.contains(uid) {
                if let Some(sender) = connections.get(conn_id) {
                    let _ = sender.send(message.clone());
                }
            }
        }
    }

    pub async fn broadcast_to_channel(
        &self,
        channel_id: &str,
        message: Message,
        exclude_connection: Option<&str>,
    ) {
        let connection_ids = self
            .room_manager
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::ws::Message;
    use tokio::sync::mpsc::error::TryRecvError;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn register_and_unregister_user_updates_online_status() {
        let state = build_state().await;

        state.register_user("conn-1", "user-1", "alice").await;

        assert!(state.is_user_online("user-1").await);
        assert_eq!(
            state.unregister_user("conn-1").await,
            Some(("user-1".to_string(), "alice".to_string()))
        );
        assert!(!state.is_user_online("user-1").await);
    }

    #[tokio::test]
    async fn broadcast_all_respects_excluded_connection() {
        let state = build_state().await;
        let (tx1, mut rx1) = tokio::sync::mpsc::unbounded_channel();
        let (tx2, mut rx2) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx1).await;
        state.add_connection("conn-2".to_string(), tx2).await;
        state
            .broadcast_all(Message::Text("hello".into()), Some("conn-1"))
            .await;

        assert!(matches!(rx1.try_recv(), Err(TryRecvError::Empty)));
        match rx2.try_recv() {
            Ok(Message::Text(text)) => assert_eq!(text.as_str(), "hello"),
            other => panic!("unexpected message: {:?}", other),
        }
    }

    #[tokio::test]
    async fn broadcast_helpers_target_expected_connections() {
        let state = build_state().await;
        let (tx1, mut rx1) = tokio::sync::mpsc::unbounded_channel();
        let (tx2, mut rx2) = tokio::sync::mpsc::unbounded_channel();
        let (tx3, mut rx3) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx1).await;
        state.add_connection("conn-2".to_string(), tx2).await;
        state.add_connection("conn-3".to_string(), tx3).await;
        state.register_user("conn-1", "user-1", "alice").await;
        state.register_user("conn-2", "user-2", "bob").await;
        state.register_user("conn-3", "user-3", "charlie").await;

        state
            .broadcast_to_users(
                &["user-1".to_string(), "user-3".to_string()],
                Message::Text("users".into()),
            )
            .await;

        match rx1.try_recv() {
            Ok(Message::Text(text)) => assert_eq!(text.as_str(), "users"),
            other => panic!("unexpected message for conn-1: {:?}", other),
        }
        assert!(matches!(rx2.try_recv(), Err(TryRecvError::Empty)));
        match rx3.try_recv() {
            Ok(Message::Text(text)) => assert_eq!(text.as_str(), "users"),
            other => panic!("unexpected message for conn-3: {:?}", other),
        }

        state
            .room_manager
            .lock()
            .await
            .join_room("channel-1", "conn-1")
            .await;
        state
            .room_manager
            .lock()
            .await
            .join_room("channel-1", "conn-2")
            .await;

        state
            .broadcast_to_channel("channel-1", Message::Text("room".into()), Some("conn-1"))
            .await;

        assert!(matches!(rx1.try_recv(), Err(TryRecvError::Empty)));
        match rx2.try_recv() {
            Ok(Message::Text(text)) => assert_eq!(text.as_str(), "room"),
            other => panic!("unexpected room message for conn-2: {:?}", other),
        }
        assert!(matches!(rx3.try_recv(), Err(TryRecvError::Empty)));
    }

    #[tokio::test]
    async fn remove_connection_cleans_up_room_membership() {
        let state = build_state().await;
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx).await;
        state
            .room_manager
            .lock()
            .await
            .join_room("channel-1", "conn-1")
            .await;

        state.remove_connection("conn-1").await;

        assert!(!state.connections.read().await.contains_key("conn-1"));
        assert!(state
            .room_manager
            .lock()
            .await
            .get_room_connections("channel-1")
            .await
            .is_empty());
    }

    #[tokio::test]
    async fn unregister_user_returns_none_when_connection_is_unknown() {
        let state = build_state().await;

        assert_eq!(state.unregister_user("missing-conn").await, None);
    }

    #[tokio::test]
    async fn user_stays_online_while_another_connection_is_registered() {
        let state = build_state().await;

        state.register_user("conn-1", "user-1", "alice").await;
        state.register_user("conn-2", "user-1", "alice").await;

        assert!(state.is_user_online("user-1").await);
        assert_eq!(
            state.unregister_user("conn-1").await,
            Some(("user-1".to_string(), "alice".to_string()))
        );
        assert!(state.is_user_online("user-1").await);
    }

    #[tokio::test]
    async fn broadcast_all_without_exclusion_reaches_every_connection() {
        let state = build_state().await;
        let (tx1, mut rx1) = tokio::sync::mpsc::unbounded_channel();
        let (tx2, mut rx2) = tokio::sync::mpsc::unbounded_channel();

        state.add_connection("conn-1".to_string(), tx1).await;
        state.add_connection("conn-2".to_string(), tx2).await;

        state
            .broadcast_all(Message::Text("hello-all".into()), None)
            .await;

        match rx1.try_recv() {
            Ok(Message::Text(text)) => assert_eq!(text.as_str(), "hello-all"),
            other => panic!("unexpected message for conn-1: {:?}", other),
        }
        match rx2.try_recv() {
            Ok(Message::Text(text)) => assert_eq!(text.as_str(), "hello-all"),
            other => panic!("unexpected message for conn-2: {:?}", other),
        }
    }
}
