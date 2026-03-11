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
use crate::modules::servers::models::{CreateServerRequest, JoinServerRequest, UpdateServerRequest, TransferOwnershipRequest};
use crate::services::server_service::ServerService;
use crate::services::ServiceError;
use crate::websocket::events::ServerEvent;
use crate::repositories::server_repository::ServerRepository;

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
    let member_ids = ServerRepository::get_member_user_ids_by_invite(&state.pool, &payload.invite_code)
        .await
        .unwrap_or_default();

    let server = ServerService::join_server(&state.pool, auth_user.0.id, &payload.invite_code).await?;

    let username = auth_user.0.username
        .or(auth_user.0.first_name)
        .unwrap_or_else(|| auth_user.0.email.clone());

    // On notifie tous les membres que quelqu'un a rejoint le serveur
    let event = ServerEvent::MemberJoined {
        user_id: auth_user.0.id.to_string(),
        server_id: server.id.to_string(),
        username,
        role: "member".to_string(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
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
    let event = ServerEvent::MemberLeft {
        user_id: auth_user.0.id.to_string(),
        server_id: server_id.to_string(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
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
    let event = ServerEvent::ServerDeleted {
        server_id: server_id.to_string(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
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
    let server = ServerService::update_server(&state.pool, auth_user.0.id, server_id, payload).await?;

    // On notifie tous les membres du nouveau nom du serveur
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();
    let event = ServerEvent::ServerUpdated {
        server_id: server.id.to_string(),
        name: server.name.clone(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
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

    let events = [
        ServerEvent::MemberRoleUpdated {
            user_id: new_owner_id.to_string(),
            server_id: server_id.to_string(),
            role: "owner".to_string(),
        },
        ServerEvent::MemberRoleUpdated {
            user_id: auth_user.0.id.to_string(),
            server_id: server_id.to_string(),
            role: "admin".to_string(),
        },
    ];
    for event in events {
        if let Ok(json) = event.to_json() {
            state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
        }
    }

    Ok(StatusCode::OK)
}
