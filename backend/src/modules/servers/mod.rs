pub mod handlers;
pub mod models;

use axum::{
    routing::{get, post}, 
    Router
};
use sqlx::PgPool;

pub fn router() -> Router<PgPool> {
    Router::new()
        
        .route("/", get(handlers::list_servers).post(handlers::create_server))
        
        
        .route("/join", post(handlers::join_server))
        
        
        .route("/:id/channels", get(handlers::list_channels).post(handlers::create_channel)) 
}