use axum::{
    extract::ws::Message,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::modules::servers::models::{
    CreateServerRequest, JoinServerRequest, TransferOwnershipRequest, UpdateServerRequest,
};
use crate::repositories::server_repository::ServerRepository;
use crate::services::server_service::ServerService;
use crate::services::ServiceError;
use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::websocket::events::ServerEvent;

fn build_member_joined_event(user: &crate::models::User, server_id: Uuid) -> ServerEvent {
    ServerEvent::MemberJoined {
        user_id: user.id.to_string(),
        server_id: server_id.to_string(),
        username: user.preferred_display_name(),
        role: "member".to_string(),
    }
}

fn build_member_left_event(user_id: Uuid, server_id: Uuid) -> ServerEvent {
    ServerEvent::MemberLeft {
        user_id: user_id.to_string(),
        server_id: server_id.to_string(),
    }
}

fn build_server_deleted_event(server_id: Uuid) -> ServerEvent {
    ServerEvent::ServerDeleted {
        server_id: server_id.to_string(),
    }
}

fn build_server_updated_event(server_id: Uuid, name: String) -> ServerEvent {
    ServerEvent::ServerUpdated {
        server_id: server_id.to_string(),
        name,
    }
}

fn build_transfer_ownership_events(
    server_id: Uuid,
    new_owner_id: Uuid,
    previous_owner_id: Uuid,
) -> [ServerEvent; 2] {
    [
        ServerEvent::MemberRoleUpdated {
            user_id: new_owner_id.to_string(),
            server_id: server_id.to_string(),
            role: "owner".to_string(),
        },
        ServerEvent::MemberRoleUpdated {
            user_id: previous_owner_id.to_string(),
            server_id: server_id.to_string(),
            role: "admin".to_string(),
        },
    ]
}

pub async fn create_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateServerRequest>,
) -> Result<(StatusCode, impl IntoResponse), ServiceError> {
    let server = ServerService::create_server(&state.pool, auth_user.0.id, payload).await?;
    Ok((StatusCode::CREATED, Json(server)))
}

pub async fn list_servers(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<impl IntoResponse, ServiceError> {
    let servers = ServerService::list_servers(&state.pool, auth_user.0.id).await?;
    Ok(Json(servers))
}

pub async fn join_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<JoinServerRequest>,
) -> Result<impl IntoResponse, ServiceError> {
    // On recupere les membres existants avant de rejoindre, pour leur envoyer l'evenement
    let member_ids =
        ServerRepository::get_member_user_ids_by_invite(&state.pool, &payload.invite_code)
            .await
            .unwrap_or_default();

    let server =
        ServerService::join_server(&state.pool, auth_user.0.id, &payload.invite_code).await?;

    let username = auth_user
        .0
        .username
        .or(auth_user.0.first_name)
        .unwrap_or_else(|| auth_user.0.email.clone());

    // On notifie tous les membres que quelqu'un a rejoint le serveur
    let event = build_member_joined_event(&auth_user.0, server.id);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
    }

    Ok(Json(server))
}

pub async fn leave_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    // On recupere les membres avant de quitter pour pouvoir leur envoyer l'evenement
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();

    ServerService::leave_server(&state.pool, auth_user.0.id, server_id).await?;

    // On notifie tous les membres que l'utilisateur a quitte le serveur
    let event = build_member_left_event(auth_user.0.id, server_id);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    // On recupere les membres avant la suppression pour pouvoir leur envoyer l'evenement
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();

    ServerService::delete_server(&state.pool, auth_user.0.id, server_id).await?;

    // On notifie tous les membres que le serveur a ete supprime
    let event = build_server_deleted_event(server_id);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let server = ServerService::get_server(&state.pool, auth_user.0.id, server_id).await?;
    Ok(Json(server))
}

pub async fn update_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<UpdateServerRequest>,
) -> Result<impl IntoResponse, ServiceError> {
    let server =
        ServerService::update_server(&state.pool, auth_user.0.id, server_id, payload).await?;

    // On notifie tous les membres du nouveau nom du serveur
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();
    let event = build_server_updated_event(server.id, server.name.clone());
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
    }

    Ok(Json(server))
}

pub async fn transfer_ownership(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<TransferOwnershipRequest>,
) -> Result<StatusCode, ServiceError> {
    let new_owner_id = payload.new_owner_id;
    ServerService::transfer_ownership(&state.pool, auth_user.0.id, server_id, new_owner_id).await?;

    // On notifie tous les membres des changements de role (nouveau owner + ancien owner devenu admin)
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();

    let events = build_transfer_ownership_events(server_id, new_owner_id, auth_user.0.id);
    for event in events {
        if let Ok(json) = event.to_json() {
            state
                .broadcast_to_users(&member_ids, Message::Text(json.into()))
                .await;
        }
    }

    Ok(StatusCode::OK)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use chrono::Utc;

    fn build_user(username: Option<&str>, first_name: Option<&str>, email: &str) -> User {
        User {
            id: Uuid::new_v4(),
            email: email.to_string(),
            password_hash: "hashed".to_string(),
            first_name: first_name.map(str::to_string),
            last_name: None,
            username: username.map(str::to_string),
            created_at: Utc::now(),
        }
    }

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[test]
    fn build_member_joined_event_uses_preferred_display_name() {
        let server_id = Uuid::new_v4();
        let user = build_user(None, Some("Alice"), "alice@example.com");

        let event = build_member_joined_event(&user, server_id);

        match event {
            ServerEvent::MemberJoined {
                user_id,
                server_id: built_server_id,
                username,
                role,
            } => {
                assert_eq!(user_id, user.id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
                assert_eq!(username, "Alice");
                assert_eq!(role, "member");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_member_left_and_server_deleted_events_include_server_ids() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        match build_member_left_event(user_id, server_id) {
            ServerEvent::MemberLeft {
                user_id: built_user_id,
                server_id: built_server_id,
            } => {
                assert_eq!(built_user_id, user_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
            }
            other => panic!("unexpected event: {:?}", other),
        }

        match build_server_deleted_event(server_id) {
            ServerEvent::ServerDeleted {
                server_id: built_server_id,
            } => assert_eq!(built_server_id, server_id.to_string()),
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_server_updated_event_preserves_name() {
        let server_id = Uuid::new_v4();

        match build_server_updated_event(server_id, "Backend".to_string()) {
            ServerEvent::ServerUpdated {
                server_id: built_server_id,
                name,
            } => {
                assert_eq!(built_server_id, server_id.to_string());
                assert_eq!(name, "Backend");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_transfer_ownership_events_returns_new_owner_then_previous_owner_update() {
        let server_id = Uuid::new_v4();
        let new_owner_id = Uuid::new_v4();
        let previous_owner_id = Uuid::new_v4();

        let events = build_transfer_ownership_events(server_id, new_owner_id, previous_owner_id);

        match &events[0] {
            ServerEvent::MemberRoleUpdated {
                user_id,
                server_id: built_server_id,
                role,
            } => {
                assert_eq!(user_id, &new_owner_id.to_string());
                assert_eq!(built_server_id, &server_id.to_string());
                assert_eq!(role, "owner");
            }
            other => panic!("unexpected first event: {:?}", other),
        }

        match &events[1] {
            ServerEvent::MemberRoleUpdated {
                user_id,
                server_id: built_server_id,
                role,
            } => {
                assert_eq!(user_id, &previous_owner_id.to_string());
                assert_eq!(built_server_id, &server_id.to_string());
                assert_eq!(role, "admin");
            }
            other => panic!("unexpected second event: {:?}", other),
        }
    }

    #[tokio::test]
    async fn server_handlers_return_internal_errors_when_database_is_unavailable() {
        let state = State(build_state().await);
        let auth_user = Extension(AuthUser(build_user(
            Some("alice"),
            Some("Alice"),
            "alice@example.com",
        )));
        let server_id = Uuid::new_v4();

        match create_server(
            state.clone(),
            auth_user.clone(),
            Json(CreateServerRequest {
                name: "Backend".to_string(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => {
                assert!(message.contains("Erreur création") || message.contains("Erreur serveur"))
            }
            _ => panic!("unexpected create_server result"),
        }

        match list_servers(state.clone(), auth_user.clone()).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur récupération")),
            _ => panic!("unexpected list_servers result"),
        }

        match join_server(
            state.clone(),
            auth_user.clone(),
            Json(JoinServerRequest {
                invite_code: "invite123".to_string(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected join_server result"),
        }

        match leave_server(state.clone(), auth_user.clone(), Path(server_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected leave_server result"),
        }

        match delete_server(state.clone(), auth_user.clone(), Path(server_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected delete_server result"),
        }

        match get_server(state.clone(), auth_user.clone(), Path(server_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected get_server result"),
        }

        match update_server(
            state.clone(),
            auth_user.clone(),
            Path(server_id),
            Json(UpdateServerRequest {
                name: "Renamed".to_string(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected update_server result"),
        }

        match transfer_ownership(
            state,
            auth_user,
            Path(server_id),
            Json(TransferOwnershipRequest {
                new_owner_id: Uuid::new_v4(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected transfer_ownership result"),
        }
    }
}
