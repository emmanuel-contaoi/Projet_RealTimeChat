use sqlx::{PgPool, postgres::PgPoolOptions};
use std::time::Duration;

// la fonction crée une connexion à PostgreSQL
pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)  
        .acquire_timeout(Duration::from_secs(3))  
        .connect(database_url)
        .await
}
