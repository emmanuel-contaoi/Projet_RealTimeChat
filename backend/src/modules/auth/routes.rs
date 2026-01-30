use axum::{routing::post, Router};
use sqlx::PgPool;

use super::handlers;

// Ca crée le router pour /auth
pub fn auth_routes(pool: PgPool) -> Router {
    Router::new()
        .route("/register", post(handlers::register))
        .with_state(pool)
}

