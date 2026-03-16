use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;
use crate::{models::UserResponse, state::AppState};

#[derive(Debug, Deserialize)]
pub struct SearchUsersQuery {
    pub q: Option<String>,
}

pub async fn search_users(
    State(state): State<AppState>,
    Query(params): Query<SearchUsersQuery>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let query = params.q.unwrap_or_default().trim().to_string();
    if query.len() < 2 {
        return Ok(Json(vec![]));
    }

    let pattern = format!("%{}%", query);
    let users = UserRepository::search(&state.pool, &pattern)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}

pub async fn list_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let users = UserRepository::list(&state.pool)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}
