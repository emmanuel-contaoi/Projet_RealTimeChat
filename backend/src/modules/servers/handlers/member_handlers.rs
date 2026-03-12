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
use crate::modules::servers::models::UpdateRoleRequest;
use crate::services::server_service::ServerService;
use crate::services::ServiceError;
use crate::repositories::server_repository::ServerRepository;
use crate::websocket::events::ServerEvent;

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

pub async fn kick_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ServiceError> {
    // Appelle le service — toute la logique de permission est là-bas
    ServerService::kick_member(&state.pool, auth_user.0.id, server_id, target_user_id).await?;

    // Récupère les IDs de tous les membres restants pour le broadcast
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();

    // Notifie tout le monde (y compris la personne kickée) que quelqu'un a été expulsé
    let event = ServerEvent::MemberKicked {
        user_id: target_user_id.to_string(),
        server_id: server_id.to_string(),
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.clone().into())).await;
        // On notifie aussi la personne kickée (elle n'est plus dans member_ids)
        state.broadcast_to_users(&[target_user_id.to_string()], Message::Text(json.into())).await;
    }

    Ok(StatusCode::OK)
}

pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> Result<StatusCode, ServiceError> {
    let role = payload.role.clone();
    ServerService::update_member_role(
        &state.pool,
        auth_user.0.id,
        server_id,
        target_user_id,
        payload.role,
    )
    .await?;

    // On notifie tous les membres du serveur que le role a change
    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();
    let event = ServerEvent::MemberRoleUpdated {
        user_id: target_user_id.to_string(),
        server_id: server_id.to_string(),
        role,
    };
    if let Ok(json) = event.to_json() {
        state.broadcast_to_users(&member_ids, Message::Text(json.into())).await;
    }

    Ok(StatusCode::OK)
}
