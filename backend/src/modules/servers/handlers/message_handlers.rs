use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::CreateMessageRequest;
use crate::services::message_service::MessageService;
use crate::services::ServiceError;

pub async fn get_chat_history(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let messages = MessageService::get_history(&state.pool, &state.mongo, auth_user.0.id, channel_id).await?;
    Ok(Json(messages))
}

pub async fn send_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<CreateMessageRequest>,
) -> Result<StatusCode, ServiceError> {
    let username = auth_user.0.username
        .or(auth_user.0.first_name)
        .unwrap_or_else(|| auth_user.0.email.clone());

    MessageService::send_message(
        &state.pool,
        &state.mongo,
        auth_user.0.id,
        channel_id,
        username,
        payload.content,
    )
    .await?;
    Ok(StatusCode::CREATED)
}

pub async fn edit_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
    Json(payload): Json<CreateMessageRequest>,
) -> Result<StatusCode, ServiceError> {
    MessageService::edit_message(&state.mongo, auth_user.0.id, &message_id, payload.content).await?;
    Ok(StatusCode::OK)
}

pub async fn delete_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
) -> Result<StatusCode, ServiceError> {
    MessageService::delete_message(&state.pool, &state.mongo, auth_user.0.id, &message_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
