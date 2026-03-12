pub mod handlers;
pub mod models;

use axum::{
    routing::{get, post, put, delete},
    Router
};

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Serveurs
        .route("/", get(handlers::list_servers).post(handlers::create_server))
        .route("/join", post(handlers::join_server))
        .route("/{id}", get(handlers::get_server).put(handlers::update_server).delete(handlers::delete_server))
        .route("/{id}/leave", delete(handlers::leave_server))
        .route("/{id}/members", get(handlers::list_members))
        .route("/{id}/members/{user_id}", delete(handlers::kick_member))
        .route("/{id}/members/{user_id}/ban", post(handlers::ban_member))
        .route("/{id}/members/{user_id}/role", put(handlers::update_member_role))
        .route("/{id}/transfer", post(handlers::transfer_ownership))

        // Liste des salons d'un serveur
        .route("/{id}/channels", get(handlers::list_channels).post(handlers::create_channel))
}
