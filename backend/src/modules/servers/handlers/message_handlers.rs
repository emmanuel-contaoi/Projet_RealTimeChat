use axum::{
    extract::ws::Message,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::modules::servers::models::CreateMessageRequest;
use crate::services::message_service::MessageService;
use crate::services::ServiceError;
use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::websocket::events::ServerEvent;

pub async fn get_chat_history(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let messages =
        MessageService::get_history(&state.pool, &state.mongo, auth_user.0.id, channel_id).await?;
    Ok(Json(messages))
}

pub async fn send_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<CreateMessageRequest>,
) -> Result<StatusCode, ServiceError> {
    let username = auth_user
        .0
        .username
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
    let content = payload.content.clone();
    // On modifie le message et on recupere le channel_id pour le broadcast
    let channel_id =
        MessageService::edit_message(&state.mongo, auth_user.0.id, &message_id, payload.content)
            .await?;

    // On notifie tous les utilisateurs du channel que le message a ete modifie
    let event = ServerEvent::MessageEdited {
        message_id: message_id.clone(),
        channel_id: channel_id.clone(),
        content,
    };
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_channel(&channel_id, Message::Text(json.into()), None)
            .await;
    }

    Ok(StatusCode::OK)
}

pub async fn delete_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
) -> Result<StatusCode, ServiceError> {
    // On supprime le message et on recupere le channel_id pour le broadcast
    let channel_id =
        MessageService::delete_message(&state.pool, &state.mongo, auth_user.0.id, &message_id)
            .await?;

    // On notifie tous les utilisateurs du channel que le message a ete supprime
    let event = ServerEvent::MessageDeleted {
        message_id: message_id.clone(),
        channel_id: channel_id.clone(),
    };
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_channel(&channel_id, Message::Text(json.into()), None)
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}
