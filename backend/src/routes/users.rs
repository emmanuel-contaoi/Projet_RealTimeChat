use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::{models::{User, UserResponse}, state::AppState};

#[derive(Debug, Deserialize)]
pub struct SearchUsersQuery {
    pub q: Option<String>,
}

pub async fn search_users(
    State(state): State<AppState>,
    Query(params): Query<SearchUsersQuery>,
) -> Result<Json<Vec<UserResponse>>, (StatusCode, String)> {
    let query = params.q.unwrap_or_default().trim().to_string();
    if query.len() < 2 {
        return Ok(Json(vec![]));
    }

    let pattern = format!("%{}%", query);

    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users
         WHERE email ILIKE $1
            OR username ILIKE $1
            OR first_name ILIKE $1
            OR last_name ILIKE $1
         ORDER BY created_at DESC
         LIMIT 20"
    )
    .bind(pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let results = users.into_iter().map(UserResponse::from).collect();

    Ok(Json(results))
}

pub async fn list_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, (StatusCode, String)> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users
         ORDER BY created_at DESC
         LIMIT 100"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let results = users.into_iter().map(UserResponse::from).collect();

    Ok(Json(results))
}
