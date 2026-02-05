use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    models::{User, UserResponse},
    state::AppState,
    utils::auth::AuthUser,
};

#[derive(Debug, Deserialize)]
pub struct AddFriendRequest {
    pub friend_id: Uuid,
}

pub async fn list_friends(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<UserResponse>>, (StatusCode, String)> {
    let friends = sqlx::query_as::<_, User>(
        "SELECT u.* FROM users u\n         INNER JOIN user_friends f ON f.friend_id = u.id\n         WHERE f.user_id = $1\n         ORDER BY u.created_at DESC",
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let results = friends.into_iter().map(UserResponse::from).collect();
    Ok(Json(results))
}

pub async fn add_friend(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Json(payload): Json<AddFriendRequest>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    if payload.friend_id == user.id {
        return Err((StatusCode::BAD_REQUEST, "Impossible de s'ajouter soi-meme.".to_string()));
    }

    let friend = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(payload.friend_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?
        .ok_or((StatusCode::NOT_FOUND, "Utilisateur introuvable".to_string()))?;

    sqlx::query(
        "INSERT INTO user_friends (user_id, friend_id) VALUES ($1, $2)\n         ON CONFLICT (user_id, friend_id) DO NOTHING",
    )
    .bind(user.id)
    .bind(payload.friend_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(Json(friend.into()))
}

pub async fn remove_friend(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM user_friends WHERE user_id = $1 AND friend_id = $2")
        .bind(user.id)
        .bind(friend_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(StatusCode::NO_CONTENT)
}
