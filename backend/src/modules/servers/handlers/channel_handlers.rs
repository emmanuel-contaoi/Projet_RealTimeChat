// Gestion des channels (salons) : creer, lister, modifier, supprimer

use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use uuid::Uuid;

use crate::state::AppState;
use crate::modules::servers::models::{CreateChannelRequest, Channel, UpdateChannelRequest};

// Creer un channel dans un serveur
pub async fn create_channel(
    State(state): State<AppState>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
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
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur lors de la création du salon").into_response(),
    }
}

// Lister tous les channels d'un serveur
pub async fn list_channels(
    State(state): State<AppState>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let channels = sqlx::query_as::<_, Channel>(
        "SELECT * FROM channels WHERE server_id = $1"
    )
    .bind(server_id)
    .fetch_all(&state.pool)
    .await;

    match channels {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur récupération des salons").into_response(),
    }
}

// Recuperer les details d'un channel
pub async fn get_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
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
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> impl IntoResponse {
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
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM channels WHERE id = $1")
        .bind(channel_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response(),
    }
}
