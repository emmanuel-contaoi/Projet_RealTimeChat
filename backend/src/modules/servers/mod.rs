pub mod handlers;
pub mod models;

use axum::{
    routing::{get, post}, 
    Router
};
use sqlx::PgPool;

pub fn router() -> Router<PgPool> {
    Router::new()
        // Serveurs : Lister (GET) et Créer (POST)
        .route("/", get(handlers::list_servers).post(handlers::create_server))
        
        // Channels : Lister (GET) et Créer (POST) <-- Modification ici
        .route("/:id/channels", get(handlers::list_channels).post(handlers::create_channel)) 
}