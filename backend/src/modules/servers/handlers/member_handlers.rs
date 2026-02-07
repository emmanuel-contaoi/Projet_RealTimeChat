use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::{MemberRow, UpdateRoleRequest};

// Lister les membres d'un serveur avec leur statut en ligne
pub async fn list_members(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let membership = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match membership {
        Ok(Some(_)) => {}
        Ok(None) => return (StatusCode::FORBIDDEN, "Vous n'etes pas membre de ce serveur.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }
    let rows = sqlx::query_as::<_, MemberRow>(
        "SELECT m.user_id, COALESCE(u.username, u.first_name, u.email) as username, m.role
         FROM members m
         JOIN users u ON m.user_id = u.id
         WHERE m.server_id = $1"
    )
    .bind(server_id)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(members) => {
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
            (StatusCode::OK, Json(serde_json::Value::Array(response))).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur membres").into_response(),
    }
}

// Changer le role d'un membre (seul le owner peut faire ca)
pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let caller_role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match caller_role {
        Ok(Some(r)) if r == "owner" => {}
        _ => return (StatusCode::FORBIDDEN, "Seul le owner peut changer les roles.").into_response(),
    }

    // On peut pas changer son propre role
    if user_id == target_user_id {
        return (StatusCode::BAD_REQUEST, "Impossible de changer votre propre role.").into_response();
    }

    // Seuls "admin" et "member" sont valides (pas "owner")
    if payload.role != "admin" && payload.role != "member" {
        return (StatusCode::BAD_REQUEST, "Role invalide. Valeurs acceptees : admin, member.").into_response();
    }

    let result = sqlx::query(
        "UPDATE members SET role = $1 WHERE server_id = $2 AND user_id = $3"
    )
    .bind(&payload.role)
    .bind(server_id)
    .bind(target_user_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, format!("Role mis a jour: {}", payload.role)).into_response()
        }
        Ok(_) => (StatusCode::NOT_FOUND, "Membre introuvable.").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }
}
