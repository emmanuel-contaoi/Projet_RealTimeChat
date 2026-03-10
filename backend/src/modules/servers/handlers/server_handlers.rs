use axum::{
    extract::{State, Path},
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
    let server = ServerService::join_server(&state.pool, auth_user.0.id, &payload.invite_code).await?;
    Ok(Json(server))
}

pub async fn leave_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    ServerService::leave_server(&state.pool, auth_user.0.id, server_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    ServerService::delete_server(&state.pool, auth_user.0.id, server_id).await?;
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
    Ok(Json(server))
}

pub async fn transfer_ownership(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<TransferOwnershipRequest>,
) -> Result<StatusCode, ServiceError> {
    ServerService::transfer_ownership(&state.pool, auth_user.0.id, server_id, payload.new_owner_id).await?;
    Ok(StatusCode::OK)
}
