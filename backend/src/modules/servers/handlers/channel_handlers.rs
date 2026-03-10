use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::{CreateChannelRequest, UpdateChannelRequest};
use crate::services::channel_service::ChannelService;
use crate::services::ServiceError;

pub async fn create_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<(StatusCode, impl IntoResponse), ServiceError> {
    let channel = ChannelService::create_channel(&state.pool, auth_user.0.id, server_id, payload).await?;
    Ok((StatusCode::CREATED, Json(channel)))
}

pub async fn list_channels(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let channels = ChannelService::list_channels(&state.pool, auth_user.0.id, server_id).await?;
    Ok(Json(channels))
}

pub async fn get_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let channel = ChannelService::get_channel(&state.pool, auth_user.0.id, channel_id).await?;
    Ok(Json(channel))
}

pub async fn update_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> Result<impl IntoResponse, ServiceError> {
    let channel = ChannelService::update_channel(&state.pool, auth_user.0.id, channel_id, payload).await?;
    Ok(Json(channel))
}

pub async fn delete_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    ChannelService::delete_channel(&state.pool, auth_user.0.id, channel_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
