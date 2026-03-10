use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::UpdateRoleRequest;
use crate::services::server_service::ServerService;
use crate::services::ServiceError;

pub async fn list_members(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let members = ServerService::list_members(&state.pool, auth_user.0.id, server_id).await?;

    let mut response = Vec::new();
    for m in members {
        let is_online = state.is_user_online(&m.user_id.to_string()).await;
        response.push(serde_json::json!({
            "user_id": m.user_id,
            "username": m.username.unwrap_or_else(|| "Inconnu".to_string()),
            "role": m.role,
            "is_online": is_online
        }));
    }

    Ok(Json(serde_json::Value::Array(response)))
}

pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> Result<StatusCode, ServiceError> {
    ServerService::update_member_role(
        &state.pool,
        auth_user.0.id,
        server_id,
        target_user_id,
        payload.role,
    )
    .await?;
    Ok(StatusCode::OK)
}
