use axum::{
    extract::ws::Message,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::modules::servers::models::{CreateMessageRequest, ReactMessageRequest};
use crate::services::message_service::MessageService;
use crate::services::ServiceError;
use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::websocket::events::ServerEvent;

fn build_message_edited_event(message_id: &str, channel_id: &str, content: String) -> ServerEvent {
    ServerEvent::MessageEdited {
        message_id: message_id.to_string(),
        channel_id: channel_id.to_string(),
        content,
    }
}

fn build_message_deleted_event(message_id: &str, channel_id: &str) -> ServerEvent {
    ServerEvent::MessageDeleted {
        message_id: message_id.to_string(),
        channel_id: channel_id.to_string(),
    }
}

fn build_message_reaction_updated_event(
    message_id: &str,
    channel_id: &str,
    reactions: Vec<crate::modules::servers::models::MessageReaction>,
) -> ServerEvent {
    ServerEvent::MessageReactionUpdated {
        message_id: message_id.to_string(),
        channel_id: channel_id.to_string(),
        reactions,
    }
}

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
    let event = build_message_edited_event(&message_id, &channel_id, content);
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
    let event = build_message_deleted_event(&message_id, &channel_id);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_channel(&channel_id, Message::Text(json.into()), None)
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_reaction(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
    Json(payload): Json<ReactMessageRequest>,
) -> Result<impl IntoResponse, ServiceError> {
    let (channel_id, reactions) = MessageService::add_reaction(
        &state.pool,
        &state.mongo,
        auth_user.0.id,
        &message_id,
        payload.emoji,
    )
    .await?;

    let event = build_message_reaction_updated_event(&message_id, &channel_id, reactions.clone());
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_channel(&channel_id, Message::Text(json.into()), None)
            .await;
    }

    Ok(Json(reactions))
}

pub async fn remove_reaction(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
    Json(payload): Json<ReactMessageRequest>,
) -> Result<impl IntoResponse, ServiceError> {
    let (channel_id, reactions) = MessageService::remove_reaction(
        &state.pool,
        &state.mongo,
        auth_user.0.id,
        &message_id,
        payload.emoji,
    )
    .await?;

    let event = build_message_reaction_updated_event(&message_id, &channel_id, reactions.clone());
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_channel(&channel_id, Message::Text(json.into()), None)
            .await;
    }

    Ok(Json(reactions))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use crate::modules::servers::models::MessageReaction;
    use chrono::Utc;
    use tokio::sync::mpsc::error::TryRecvError;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    fn build_user() -> User {
        User {
            id: Uuid::new_v4(),
            email: "alice@example.com".to_string(),
            password_hash: "hashed".to_string(),
            first_name: Some("Alice".to_string()),
            last_name: Some("Martin".to_string()),
            username: Some("alice".to_string()),
            created_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn edit_message_returns_bad_request_for_invalid_message_id() {
        let state = build_state().await;
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        state.add_connection("conn-1".to_string(), tx).await;
        state
            .room_manager
            .lock()
            .await
            .join_room("channel-1", "conn-1")
            .await;

        let result = edit_message(
            State(state),
            Extension(AuthUser(build_user())),
            Path("invalid-id".to_string()),
            Json(CreateMessageRequest {
                content: "updated".to_string(),
            }),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            _ => panic!("unexpected result"),
        }
        assert!(matches!(
            rx.try_recv(),
            Err(TryRecvError::Empty) | Err(TryRecvError::Disconnected)
        ));
    }

    #[tokio::test]
    async fn delete_message_returns_bad_request_for_invalid_message_id() {
        let state = build_state().await;

        let result = delete_message(
            State(state),
            Extension(AuthUser(build_user())),
            Path("invalid-id".to_string()),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            _ => panic!("unexpected result"),
        }
    }

    #[tokio::test]
    async fn add_reaction_returns_bad_request_for_invalid_message_id() {
        let state = build_state().await;

        let result = add_reaction(
            State(state),
            Extension(AuthUser(build_user())),
            Path("invalid-id".to_string()),
            Json(ReactMessageRequest {
                emoji: "🔥".to_string(),
            }),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            _ => panic!("unexpected result"),
        }
    }

    #[tokio::test]
    async fn remove_reaction_returns_bad_request_for_invalid_message_id() {
        let state = build_state().await;

        let result = remove_reaction(
            State(state),
            Extension(AuthUser(build_user())),
            Path("invalid-id".to_string()),
            Json(ReactMessageRequest {
                emoji: "🔥".to_string(),
            }),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            _ => panic!("unexpected result"),
        }
    }

    #[test]
    fn build_message_edited_event_preserves_ids_and_content() {
        match build_message_edited_event("message-1", "channel-1", "updated".to_string()) {
            ServerEvent::MessageEdited {
                message_id,
                channel_id,
                content,
            } => {
                assert_eq!(message_id, "message-1");
                assert_eq!(channel_id, "channel-1");
                assert_eq!(content, "updated");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_message_deleted_event_preserves_ids() {
        match build_message_deleted_event("message-1", "channel-1") {
            ServerEvent::MessageDeleted {
                message_id,
                channel_id,
            } => {
                assert_eq!(message_id, "message-1");
                assert_eq!(channel_id, "channel-1");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_message_reaction_updated_event_preserves_reactions() {
        let reactions = vec![MessageReaction {
            emoji: "🔥".to_string(),
            user_ids: vec!["user-1".to_string()],
        }];

        match build_message_reaction_updated_event("message-1", "channel-1", reactions.clone()) {
            ServerEvent::MessageReactionUpdated {
                message_id,
                channel_id,
                reactions: built_reactions,
            } => {
                assert_eq!(message_id, "message-1");
                assert_eq!(channel_id, "channel-1");
                assert_eq!(built_reactions.len(), 1);
                assert_eq!(built_reactions[0].emoji, "🔥");
                assert_eq!(built_reactions[0].user_ids, vec!["user-1".to_string()]);
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }
}
