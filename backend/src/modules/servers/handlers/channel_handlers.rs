use axum::{
    extract::ws::Message,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::modules::servers::models::{CreateChannelRequest, UpdateChannelRequest};
use crate::repositories::channel_repository::ChannelRepository;
use crate::repositories::server_repository::ServerRepository;
use crate::services::channel_service::ChannelService;
use crate::services::ServiceError;
use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::websocket::events::ServerEvent;

fn build_channel_created_event(
    channel_id: Uuid,
    server_id: Uuid,
    name: String,
    channel_type: String,
) -> ServerEvent {
    ServerEvent::ChannelCreated {
        channel_id: channel_id.to_string(),
        server_id: server_id.to_string(),
        name,
        channel_type,
    }
}

fn build_channel_updated_event(
    channel_id: Uuid,
    server_id: Uuid,
    name: String,
    channel_type: String,
) -> ServerEvent {
    ServerEvent::ChannelUpdated {
        channel_id: channel_id.to_string(),
        server_id: server_id.to_string(),
        name,
        channel_type,
    }
}

fn build_channel_deleted_event(channel_id: Uuid, server_id: Uuid) -> ServerEvent {
    ServerEvent::ChannelDeleted {
        channel_id: channel_id.to_string(),
        server_id: server_id.to_string(),
    }
}

pub async fn create_channel(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<(StatusCode, impl IntoResponse), ServiceError> {
    let channel =
        ChannelService::create_channel(&state.pool, auth_user.0.id, server_id, payload).await?;

    // On notifie tous les membres du serveur qu'un nouveau channel a ete cree
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();
    let event = build_channel_created_event(
        channel.id,
        channel.server_id,
        channel.name.clone(),
        channel.r#type.clone(),
    );
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
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
    let channel =
        ChannelService::update_channel(&state.pool, auth_user.0.id, channel_id, payload).await?;

    // On notifie tous les membres du serveur que le channel a ete renomme
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, channel.server_id)
        .await
        .unwrap_or_default();
    let event = build_channel_updated_event(
        channel.id,
        channel.server_id,
        channel.name.clone(),
        channel.r#type.clone(),
    );
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
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
        let event = build_channel_deleted_event(channel_id, ch.server_id);
        if let Ok(json) = event.to_json() {
            state
                .broadcast_to_users(&member_ids, Message::Text(json.into()))
                .await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use chrono::Utc;

    fn build_user() -> User {
        User {
            id: Uuid::new_v4(),
            email: "alice@example.com".to_string(),
            password_hash: "hashed".to_string(),
            first_name: Some("Alice".to_string()),
            last_name: None,
            username: Some("alice".to_string()),
            created_at: Utc::now(),
        }
    }

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[test]
    fn build_channel_created_event_serializes_expected_payload() {
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let event = build_channel_created_event(
            channel_id,
            server_id,
            "general".to_string(),
            "text".to_string(),
        );

        match event {
            ServerEvent::ChannelCreated {
                channel_id: built_channel_id,
                server_id: built_server_id,
                name,
                channel_type,
            } => {
                assert_eq!(built_channel_id, channel_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
                assert_eq!(name, "general");
                assert_eq!(channel_type, "text");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_channel_updated_event_serializes_expected_payload() {
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let event = build_channel_updated_event(
            channel_id,
            server_id,
            "announcements".to_string(),
            "voice".to_string(),
        );

        match event {
            ServerEvent::ChannelUpdated {
                channel_id: built_channel_id,
                server_id: built_server_id,
                name,
                channel_type,
            } => {
                assert_eq!(built_channel_id, channel_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
                assert_eq!(name, "announcements");
                assert_eq!(channel_type, "voice");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_channel_deleted_event_contains_channel_and_server_ids() {
        let channel_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let event = build_channel_deleted_event(channel_id, server_id);

        match event {
            ServerEvent::ChannelDeleted {
                channel_id: built_channel_id,
                server_id: built_server_id,
            } => {
                assert_eq!(built_channel_id, channel_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[tokio::test]
    async fn channel_handlers_return_internal_errors_when_database_is_unavailable() {
        let state = State(build_state().await);
        let auth_user = Extension(AuthUser(build_user()));
        let server_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();

        match create_channel(
            state.clone(),
            auth_user.clone(),
            Path(server_id),
            Json(CreateChannelRequest {
                name: "general".to_string(),
                r#type: "text".to_string(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected create_channel result"),
        }

        match list_channels(state.clone(), auth_user.clone(), Path(server_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected list_channels result"),
        }

        match get_channel(state.clone(), auth_user.clone(), Path(channel_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected get_channel result"),
        }

        match update_channel(
            state.clone(),
            auth_user.clone(),
            Path(channel_id),
            Json(UpdateChannelRequest {
                name: "random".to_string(),
                r#type: Some("voice".to_string()),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected update_channel result"),
        }

        match delete_channel(state, auth_user, Path(channel_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected delete_channel result"),
        }
    }
}
