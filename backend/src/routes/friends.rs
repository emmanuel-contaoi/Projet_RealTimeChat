use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    models::UserResponse,
    state::AppState,
    utils::auth::AuthUser,
};
use crate::services::friend_service::FriendService;
use crate::services::ServiceError;

#[derive(Debug, Deserialize)]
pub struct AddFriendRequest {
    pub friend_id: Uuid,
}

pub async fn list_friends(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let friends = FriendService::list_friends(&state.pool, user.id).await?;
    Ok(Json(friends))
}

pub async fn add_friend(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Json(payload): Json<AddFriendRequest>,
) -> Result<Json<UserResponse>, ServiceError> {
    let friend = FriendService::add_friend(&state.pool, user.id, payload.friend_id).await?;
    Ok(Json(friend))
}

pub async fn remove_friend(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    FriendService::remove_friend(&state.pool, user.id, friend_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
