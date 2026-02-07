// Gestion des channels (salons) : creer, lister, modifier, supprimer

use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::{CreateChannelRequest, Channel, UpdateChannelRequest};

// Creer un channel dans un serveur
pub async fn create_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" || r == "admin" => {}
        Ok(Some(_)) => return (StatusCode::FORBIDDEN, "Seuls owner/admin peuvent creer un channel.").into_response(),
        Ok(None) => return (StatusCode::FORBIDDEN, "Vous n'etes pas membre de ce serveur.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    let new_channel = sqlx::query_as::<_, Channel>(
        "INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(server_id)
    .bind(&payload.name)
    .bind(&payload.r#type)
    .fetch_one(&state.pool)
    .await;

    match new_channel {
        Ok(channel) => (StatusCode::CREATED, Json(channel)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur lors de la creation du salon").into_response(),
    }
}

// Lister tous les channels d'un serveur
pub async fn list_channels(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let membership = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match membership {
        Ok(Some(_)) => {}
        Ok(None) => return (StatusCode::FORBIDDEN, "Vous n'etes pas membre de ce serveur.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    let channels = sqlx::query_as::<_, Channel>(
        "SELECT * FROM channels WHERE server_id = $1"
    )
    .bind(server_id)
    .fetch_all(&state.pool)
    .await;

    match channels {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur recuperation des salons").into_response(),
    }
}

// Recuperer les details d'un channel
pub async fn get_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    // Verify membership via channel -> server -> members
    let membership = sqlx::query_scalar::<_, String>(
        "SELECT m.role FROM members m
         JOIN channels c ON c.server_id = m.server_id
         WHERE c.id = $1 AND m.user_id = $2"
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match membership {
        Ok(Some(_)) => {}
        Ok(None) => return (StatusCode::FORBIDDEN, "Acces refuse.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    let channel = sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = $1")
        .bind(channel_id)
        .fetch_optional(&state.pool)
        .await;

    match channel {
        Ok(Some(c)) => (StatusCode::OK, Json(c)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Salon introuvable").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur SQL").into_response(),
    }
}

// Modifier un channel (nom, type)
pub async fn update_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let role = sqlx::query_scalar::<_, String>(
        "SELECT m.role FROM members m
         JOIN channels c ON c.server_id = m.server_id
         WHERE c.id = $1 AND m.user_id = $2"
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" || r == "admin" => {}
        Ok(Some(_)) => return (StatusCode::FORBIDDEN, "Seuls owner/admin peuvent modifier un channel.").into_response(),
        Ok(None) => return (StatusCode::FORBIDDEN, "Acces refuse.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    let updated = sqlx::query_as::<_, Channel>(
        "UPDATE channels SET name = $1, type = COALESCE($2, type) WHERE id = $3 RETURNING *"
    )
    .bind(&payload.name)
    .bind(&payload.r#type)
    .bind(channel_id)
    .fetch_optional(&state.pool)
    .await;

    match updated {
        Ok(Some(c)) => (StatusCode::OK, Json(c)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Salon introuvable").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur modification").into_response(),
    }
}

// Supprimer un channel
pub async fn delete_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let role = sqlx::query_scalar::<_, String>(
        "SELECT m.role FROM members m
         JOIN channels c ON c.server_id = m.server_id
         WHERE c.id = $1 AND m.user_id = $2"
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" || r == "admin" => {}
        Ok(Some(_)) => return (StatusCode::FORBIDDEN, "Seuls owner/admin peuvent supprimer un channel.").into_response(),
        Ok(None) => return (StatusCode::FORBIDDEN, "Acces refuse.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    let result = sqlx::query("DELETE FROM channels WHERE id = $1")
        .bind(channel_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response(),
    }
}
