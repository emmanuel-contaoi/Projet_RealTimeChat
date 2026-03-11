use axum::{
    extract::{State, Path},
    extract::ws::Message,
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
use crate::websocket::events::ServerEvent;
use crate::repositories::server_repository::ServerRepository;
use crate::repositories::channel_repository::ChannelRepository;

pub async fn create_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<(StatusCode, impl IntoResponse), ServiceError> {
    let channel = ChannelService::create_channel(&state.pool, auth_user.0.id, server_id, payload).await?;

    // On notifie tous les membres du serveur qu'un nouveau channel a ete cree
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();
    let event = ServerEvent::ChannelCreated {
        channel_id: channel.id.to_string(),
        server_id: channel.server_id.to_string(),
        name: channel.name.clone(),
        channel_type: channel.r#type.clone(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
    }

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

    // On notifie tous les membres du serveur que le channel a ete renomme
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, channel.server_id)
        .await
        .unwrap_or_default();
    let event = ServerEvent::ChannelUpdated {
        channel_id: channel.id.to_string(),
        server_id: channel.server_id.to_string(),
        name: channel.name.clone(),
        channel_type: channel.r#type.clone(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
    }

    Ok(Json(channel))
}

pub async fn delete_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    // On recupere les infos du channel avant de le supprimer (pour avoir le server_id)
    let channel = ChannelRepository::find_by_id(&state.pool, channel_id)
        .await
        .ok()
        .flatten();

    ChannelService::delete_channel(&state.pool, auth_user.0.id, channel_id).await?;

    // On notifie tous les membres du serveur que le channel a ete supprime
    if let Some(ch) = channel {
        let member_ids = ServerRepository::get_member_user_ids(&state.pool, ch.server_id)
            .await
            .unwrap_or_default();
        let event = ServerEvent::ChannelDeleted {
            channel_id: channel_id.to_string(),
            server_id: ch.server_id.to_string(),
        };
        if let Ok(json) = event.to_json() {
            state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}
