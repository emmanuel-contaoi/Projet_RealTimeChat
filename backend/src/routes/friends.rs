use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::services::friend_service::FriendService;
use crate::services::ServiceError;
use crate::{
    models::{FriendRequestResponse, UserResponse},
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
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let friends = FriendService::list_friends(&state.pool, user.id).await?;
    Ok(Json(friends))
}

pub async fn send_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Json(payload): Json<AddFriendRequest>,
) -> Result<StatusCode, ServiceError> {
    FriendService::send_friend_request(&state.pool, user.id, payload.friend_id).await?;
    Ok(StatusCode::CREATED)
}

pub async fn list_incoming_requests(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<FriendRequestResponse>>, ServiceError> {
    let requests = FriendService::list_incoming_requests(&state.pool, user.id).await?;
    Ok(Json(requests))
}

pub async fn list_outgoing_requests(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<FriendRequestResponse>>, ServiceError> {
    let requests = FriendService::list_outgoing_requests(&state.pool, user.id).await?;
    Ok(Json(requests))
}

pub async fn accept_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    FriendService::accept_request(&state.pool, user.id, request_id).await?;
    Ok(StatusCode::OK)
}

pub async fn reject_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    FriendService::reject_request(&state.pool, user.id, request_id).await?;
    Ok(StatusCode::OK)
}

pub async fn cancel_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    FriendService::cancel_request(&state.pool, user.id, request_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_friend(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    FriendService::remove_friend(&state.pool, user.id, friend_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
