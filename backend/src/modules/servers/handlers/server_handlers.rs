use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::{CreateServerRequest, Server, JoinServerRequest};

// Créer un serveur + ajouter le créateur comme owner
pub async fn create_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateServerRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;
    let invite_code = Uuid::new_v4().to_string()[..8].to_string();

    let new_server = sqlx::query_as::<_, Server>(
        "INSERT INTO servers (name, invite_code) VALUES ($1, $2) RETURNING *"
    )
    .bind(&payload.name)
    .bind(&invite_code)
    .fetch_one(&state.pool)
    .await;

    match new_server {
        Ok(server) => {
            let member_result = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'owner')"
            )
            .bind(server.id)
            .bind(user_id)
            .execute(&state.pool)
            .await;

            match member_result {
                Ok(_) => (StatusCode::CREATED, Json(server)).into_response(),
                Err(_) => {
                    // Si l'ajout du membre échoue, on supprime le serveur orphelin
                    let _ = sqlx::query("DELETE FROM servers WHERE id = $1")
                        .bind(server.id)
                        .execute(&state.pool)
                        .await;
                    (StatusCode::INTERNAL_SERVER_ERROR, "Erreur ajout membre").into_response()
                }
            }
        }
        Err(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur création").into_response()
        }
    }
}

// Lister les serveurs où l'utilisateur est membre
pub async fn list_servers(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let servers = sqlx::query_as::<_, Server>(
        "SELECT s.* FROM servers s
         JOIN members m ON s.id = m.server_id
         WHERE m.user_id = $1"
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await;

    match servers {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur récupération").into_response(),
    }
}

// Rejoindre un serveur avec un code d'invitation
pub async fn join_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<JoinServerRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let server = sqlx::query_as::<_, Server>(
        "SELECT * FROM servers WHERE invite_code = $1"
    )
    .bind(&payload.invite_code)
    .fetch_optional(&state.pool)
    .await;

    match server {
        Ok(Some(server)) => {
            // Si deja membre, on ne fait rien
            let result = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'member')
                 ON CONFLICT DO NOTHING"
            )
            .bind(server.id)
            .bind(user_id)
            .execute(&state.pool)
            .await;

            match result {
                Ok(_) => (StatusCode::OK, Json(server)).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Impossible de rejoindre").into_response(),
            }
        }
        Ok(None) => (StatusCode::NOT_FOUND, "Code d'invitation invalide").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }
}

// Quitter un serveur (interdit pour le owner)
pub async fn leave_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" => {
            return (StatusCode::FORBIDDEN, "Le owner ne peut pas quitter son serveur.").into_response();
        }
        Ok(None) => {
            return (StatusCode::NOT_FOUND, "Vous n'etes pas membre de ce serveur.").into_response();
        }
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response();
        }
        _ => {}
    }

    let result = sqlx::query(
        "DELETE FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response(),
    }
}

// Supprimer un serveur (owner uniquement)
pub async fn delete_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" => {}
        Ok(Some(_)) => return (StatusCode::FORBIDDEN, "Seul le owner peut supprimer le serveur.").into_response(),
        Ok(None) => return (StatusCode::NOT_FOUND, "Vous n'etes pas membre de ce serveur.").into_response(),
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response();
        }
    }

    let result = sqlx::query("DELETE FROM servers WHERE id = $1")
        .bind(server_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response(),
    }
}
