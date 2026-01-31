
pub mod handlers;
pub mod models;

use axum::{routing::post, Router};
use sqlx::PgPool;


pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/", post(handlers::create_server))
}