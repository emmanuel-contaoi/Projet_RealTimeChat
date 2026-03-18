pub mod auth;
pub mod jwt;

#[cfg(test)]
pub fn test_env_lock() -> &'static std::sync::Mutex<()> {
    use std::sync::{Mutex, OnceLock};

    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[cfg(test)]
pub fn test_pg_pool() -> sqlx::PgPool {
    use sqlx::postgres::PgPoolOptions;
    use std::time::Duration;

    PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_millis(50))
        .connect_lazy("postgres://postgres:postgres@127.0.0.1:1/test")
        .expect("lazy postgres pool should be created")
}

#[cfg(test)]
pub async fn test_mongo_client() -> mongodb::Client {
    mongodb::Client::with_uri_str(
        "mongodb://127.0.0.1:1/?directConnection=true&serverSelectionTimeoutMS=50&connectTimeoutMS=50",
    )
    .await
    .expect("mongo client should be created")
}

#[cfg(test)]
pub async fn test_app_state() -> crate::state::AppState {
    use crate::websocket::rooms::RoomManager;
    use std::{collections::HashMap, sync::Arc};
    use tokio::sync::{Mutex, RwLock};

    crate::state::AppState {
        pool: test_pg_pool(),
        mongo: test_mongo_client().await,
        connections: Arc::new(RwLock::new(HashMap::new())),
        room_manager: Arc::new(Mutex::new(RoomManager::new())),
        user_info: Arc::new(RwLock::new(HashMap::new())),
    }
}
