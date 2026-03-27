use axum::{
    extract::ws::Message,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use chrono::{Duration, NaiveDateTime, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::modules::servers::models::{BanRequest, UpdateRoleRequest};
use crate::repositories::server_repository::ServerRepository;
use crate::services::server_service::ServerService;
use crate::services::ServiceError;
use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::websocket::events::ServerEvent;

fn serialize_member_presence(
    user_id: Uuid,
    username: Option<String>,
    role: String,
    is_online: bool,
) -> Value {
    json!({
        "user_id": user_id,
        "username": username.unwrap_or_else(|| "Inconnu".to_string()),
        "role": role,
        "is_online": is_online
    })
}

#[allow(dead_code)]
fn compute_ban_expiration(
    duration_minutes: Option<i64>,
    now: chrono::DateTime<Utc>,
) -> Option<chrono::NaiveDateTime> {
    duration_minutes.map(|mins| (now + Duration::minutes(mins)).naive_utc())
}

#[allow(dead_code)]
fn format_ban_expiration_for_event(expires_at: Option<chrono::NaiveDateTime>) -> Option<String> {
    expires_at.map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
}

fn build_member_kicked_event(server_id: Uuid, target_user_id: Uuid) -> ServerEvent {
    ServerEvent::MemberKicked {
        user_id: target_user_id.to_string(),
        server_id: server_id.to_string(),
    }
}

fn build_member_banned_event(
    server_id: Uuid,
    target_user_id: Uuid,
    expires_at: Option<String>,
) -> ServerEvent {
    ServerEvent::MemberBanned {
        user_id: target_user_id.to_string(),
        server_id: server_id.to_string(),
        expires_at,
    }
}

fn build_member_role_updated_event(
    server_id: Uuid,
    target_user_id: Uuid,
    role: String,
) -> ServerEvent {
    ServerEvent::MemberRoleUpdated {
        user_id: target_user_id.to_string(),
        server_id: server_id.to_string(),
        role,
    }
}

pub async fn list_members(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, ServiceError> {
    let members = ServerService::list_members(&state.pool, auth_user.0.id, server_id).await?;

    let mut response = Vec::new();
    for m in members {
        let is_online = state.is_user_online(&m.user_id.to_string()).await;
        response.push(serialize_member_presence(
            m.user_id, m.username, m.role, is_online,
        ));
    }

    Ok(Json(serde_json::Value::Array(response)))
}

pub async fn kick_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ServiceError> {
    ServerService::kick_member(&state.pool, auth_user.0.id, server_id, target_user_id).await?;

    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();

    let event = build_member_kicked_event(server_id, target_user_id);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.clone().into()))
            .await;
        state
            .broadcast_to_users(&[target_user_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::OK)
}

pub async fn ban_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<BanRequest>,
) -> Result<StatusCode, ServiceError> {
    let expires_at = payload
        .duration_minutes
        .map(|mins| (Utc::now() + Duration::minutes(mins)).naive_utc());

    let expires_at_str = expires_at.map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string());

    ServerService::ban_member(
        &state.pool,
        auth_user.0.id,
        server_id,
        target_user_id,
        expires_at,
    )
    .await?;

    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();

    let event = build_member_banned_event(server_id, target_user_id, expires_at_str);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.clone().into()))
            .await;
        state
            .broadcast_to_users(&[target_user_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::OK)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use chrono::NaiveDate;
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
    fn serialize_member_presence_uses_unknown_username_fallback() {
        let user_id = Uuid::new_v4();
        let value = serialize_member_presence(user_id, None, "member".to_string(), true);

        assert_eq!(value["user_id"], user_id.to_string());
        assert_eq!(value["username"], "Inconnu");
        assert_eq!(value["role"], "member");
        assert_eq!(value["is_online"], true);
    }

    #[test]
    fn serialize_member_presence_preserves_existing_username() {
        let value = serialize_member_presence(
            Uuid::new_v4(),
            Some("alice".to_string()),
            "admin".to_string(),
            false,
        );

        assert_eq!(value["username"], "alice");
        assert_eq!(value["role"], "admin");
        assert_eq!(value["is_online"], false);
    }

    #[test]
    fn compute_ban_expiration_returns_none_for_permanent_ban() {
        assert_eq!(compute_ban_expiration(None, Utc::now()), None);
    }

    #[test]
    fn compute_ban_expiration_and_format_ban_expiration_for_event_match_expected_date() {
        let now = chrono::DateTime::from_naive_utc_and_offset(
            NaiveDate::from_ymd_opt(2026, 3, 17)
                .expect("date should be valid")
                .and_hms_opt(12, 0, 0)
                .expect("time should be valid"),
            Utc,
        );

        let expires_at =
            compute_ban_expiration(Some(90), now).expect("temporary ban should have expiration");

        assert_eq!(
            format_ban_expiration_for_event(Some(expires_at)),
            Some("2026-03-17T13:30:00".to_string())
        );
    }

    #[test]
    fn build_member_kicked_event_contains_target_user_and_server() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        match build_member_kicked_event(server_id, user_id) {
            ServerEvent::MemberKicked {
                user_id: built_user_id,
                server_id: built_server_id,
            } => {
                assert_eq!(built_user_id, user_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_member_banned_event_preserves_optional_expiration() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        match build_member_banned_event(server_id, user_id, Some("2026-03-17T13:30:00".to_string()))
        {
            ServerEvent::MemberBanned {
                user_id: built_user_id,
                server_id: built_server_id,
                expires_at,
            } => {
                assert_eq!(built_user_id, user_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
                assert_eq!(expires_at, Some("2026-03-17T13:30:00".to_string()));
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn build_member_role_updated_event_contains_role() {
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        match build_member_role_updated_event(server_id, user_id, "admin".to_string()) {
            ServerEvent::MemberRoleUpdated {
                user_id: built_user_id,
                server_id: built_server_id,
                role,
            } => {
                assert_eq!(built_user_id, user_id.to_string());
                assert_eq!(built_server_id, server_id.to_string());
                assert_eq!(role, "admin");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[tokio::test]
    async fn member_handlers_return_internal_errors_when_database_is_unavailable() {
        let state = State(build_state().await);
        let auth_user = Extension(AuthUser(build_user()));
        let server_id = Uuid::new_v4();
        let target_user_id = Uuid::new_v4();

        match list_members(state.clone(), auth_user.clone(), Path(server_id)).await {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected list_members result"),
        }

        match kick_member(
            state.clone(),
            auth_user.clone(),
            Path((server_id, target_user_id)),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected kick_member result"),
        }

        match ban_member(
            state.clone(),
            auth_user.clone(),
            Path((server_id, target_user_id)),
            Json(BanRequest {
                duration_minutes: Some(30),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected ban_member result"),
        }

        match update_member_role(
            state,
            auth_user,
            Path((server_id, target_user_id)),
            Json(UpdateRoleRequest {
                role: "admin".to_string(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => assert!(message.contains("Erreur serveur")),
            _ => panic!("unexpected update_member_role result"),
        }
    }
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

    let member_ids = ServerRepository::get_member_user_ids(&state.pool, server_id)
        .await
        .unwrap_or_default();
    let event = build_member_role_updated_event(server_id, target_user_id, role);
    if let Ok(json) = event.to_json() {
        state
            .broadcast_to_users(&member_ids, Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::OK)
}

#[derive(Serialize)]
pub struct BannedUserResponse {
    pub id: Uuid,
    pub username: String,
    pub expires_at: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
}

pub async fn list_bans(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<Json<Vec<BannedUserResponse>>, ServiceError> {
    // On demande à SQL de vérifier que la ligne existe ET que le rôle est admin ou owner
    let permission = sqlx::query!(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2 AND role IN ('admin', 'owner')",
        server_id,
        auth_user.0.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    if permission.is_none() {
        return Err(ServiceError::Forbidden(
            "Permissions insuffisantes pour voir les bans".to_string(),
        ));
    }

    let bans = sqlx::query!(
        r#"
        SELECT 
            b.user_id as id, 
            u.username, 
            b.expires_at, 
            b.created_at
        FROM server_bans b
        JOIN users u ON b.user_id = u.id
        WHERE b.server_id = $1
        ORDER BY b.created_at DESC
        "#,
        server_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    let response: Vec<BannedUserResponse> = bans
        .into_iter()
        .map(|b| BannedUserResponse {
            id: b.id,
            username: b.username.unwrap_or_default(),
            expires_at: b.expires_at,
            created_at: b.created_at,
        })
        .collect();

    Ok(Json(response))
}

pub async fn unban_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ServiceError> {
    // Même chose : on délègue le check à la BDD
    let permission = sqlx::query!(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2 AND role IN ('admin', 'owner')",
        server_id,
        auth_user.0.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    if permission.is_none() {
        return Err(ServiceError::Forbidden(
            "Permissions insuffisantes pour débannir".to_string(),
        ));
    }

    sqlx::query!(
        "DELETE FROM server_bans WHERE server_id = $1 AND user_id = $2",
        server_id,
        target_user_id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(StatusCode::OK)
}
