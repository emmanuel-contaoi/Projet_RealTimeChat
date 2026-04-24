use axum::{
    extract::{Multipart, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use bcrypt::{hash, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs;
use uuid::Uuid;

use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;
use crate::utils::jwt::validate_token_claims;
use crate::{models::UserResponse, state::AppState};

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SearchUsersQuery {
    pub q: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateProfileRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub username: String,
    pub password: Option<String>,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct AvatarUploadResponse {
    pub avatar_url: String,
}

fn normalize_search_query(query: Option<String>) -> Option<String> {
    let query = query.unwrap_or_default().trim().to_string();
    if query.len() < 2 {
        None
    } else {
        Some(query)
    }
}

#[utoipa::path(
    get,
    path = "/users/search",
    tag = "Users",
    security(
        ("bearerAuth" = [])
    ),
    params(
        ("q" = Option<String>, Query, description = "Recherche par nom ou email")
    ),
    responses(
        (status = 200, description = "Résultats de recherche", body = Vec<UserResponse>),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn search_users(
    State(state): State<AppState>,
    Query(params): Query<SearchUsersQuery>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let Some(query) = normalize_search_query(params.q) else {
        return Ok(Json(vec![]));
    };

    let pattern = format!("%{}%", query);
    let users = UserRepository::search(&state.pool, &pattern)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}

#[utoipa::path(
    get,
    path = "/users",
    tag = "Users",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Liste de tous les utilisateurs", body = Vec<UserResponse>),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn list_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let users = UserRepository::list(&state.pool)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}

#[utoipa::path(
    put,
    path = "/users/me",
    tag = "Users",
    security(
        ("bearerAuth" = [])
    ),
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, description = "Profil mis à jour", body = UserResponse),
        (status = 400, description = "Données invalides"),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn update_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, ServiceError> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ServiceError::Forbidden("Token manquant".to_string()))?;

    let claims = validate_token_claims(auth_header)
        .map_err(|_| ServiceError::Forbidden("Token invalide".to_string()))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ServiceError::BadRequest("ID utilisateur invalide".to_string()))?;

    // CORRECTION ICI : On vérifie que le mot de passe n'est pas vide avant de le hacher
    let updated_user = if let Some(new_password) = payload.password.filter(|p| !p.trim().is_empty()) {
        let password_hash = hash(new_password.as_bytes(), DEFAULT_COST)
            .map_err(|e| ServiceError::Internal(format!("Hash error: {}", e)))?;

        sqlx::query_as::<_, crate::models::User>(
            r#"
            UPDATE users
            SET first_name = $1, last_name = $2, email = $3, username = $4, password_hash = $5
            WHERE id = $6
            RETURNING *
            "#,
        )
        .bind(&payload.first_name)
        .bind(&payload.last_name)
        .bind(&payload.email)
        .bind(&payload.username)
        .bind(password_hash)
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, crate::models::User>(
            r#"
            UPDATE users
            SET first_name = $1, last_name = $2, email = $3, username = $4
            WHERE id = $5
            RETURNING *
            "#,
        )
        .bind(&payload.first_name)
        .bind(&payload.last_name)
        .bind(&payload.email)
        .bind(&payload.username)
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
    };

    let user =
        updated_user.map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(UserResponse::from(user)))
}

#[utoipa::path(
    post,
    path = "/users/me/avatar",
    tag = "Users",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Avatar mis à jour", body = AvatarUploadResponse),
        (status = 400, description = "Fichier invalide"),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn upload_avatar(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<AvatarUploadResponse>, ServiceError> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ServiceError::Forbidden("Token manquant".to_string()))?;

    let claims = validate_token_claims(auth_header)
        .map_err(|_| ServiceError::Forbidden("Token invalide".to_string()))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ServiceError::BadRequest("ID utilisateur invalide".to_string()))?;

    let mut file_data = None;
    let mut file_extension = "png".to_string();

    while let Some(field) = multipart.next_field().await.map_err(|_| ServiceError::BadRequest("Multipart error".to_string()))? {
        if field.name() == Some("avatar") {
            if let Some(content_type) = field.content_type() {
                if !content_type.starts_with("image/") {
                    return Err(ServiceError::BadRequest("Seules les images sont autorisées".to_string()));
                }
                
                file_extension = match content_type {
                    "image/jpeg" => "jpg".to_string(),
                    "image/gif" => "gif".to_string(),
                    "image/webp" => "webp".to_string(),
                    _ => "png".to_string(),
                };
            }

            let data = field.bytes().await.map_err(|_| ServiceError::Internal("Erreur lecture fichier".to_string()))?;
            
            if data.len() > 5 * 1024 * 1024 {
                return Err(ServiceError::BadRequest("L'image est trop volumineuse (max 5MB)".to_string()));
            }
            
            file_data = Some(data);
            break;
        }
    }

    let data = file_data.ok_or_else(|| ServiceError::BadRequest("Aucun fichier envoyé".to_string()))?;

    let file_name = format!("{}.{}", Uuid::new_v4(), file_extension);
    let file_path = format!("uploads/avatars/{}", file_name);

    fs::write(Path::new(&file_path), &data)
        .await
        .map_err(|e| ServiceError::Internal(format!("Erreur d'écriture sur le disque: {}", e)))?;

    let port = std::env::var("PORT").unwrap_or("3001".to_string());
    let avatar_url = format!("http://localhost:{}/uploads/avatars/{}", port, file_name);

    // CORRECTION ICI : On utilise sqlx::query avec .bind() pour éviter l'erreur de macro stricte
    sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
        .bind(&avatar_url)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(AvatarUploadResponse { avatar_url }))
}

#[utoipa::path(
    delete,
    path = "/users/me/avatar",
    tag = "Users",
    security(("bearerAuth" = [])),
    responses(
        (status = 204, description = "Avatar supprimé"),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn delete_avatar(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<StatusCode, ServiceError> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ServiceError::Forbidden("Token manquant".to_string()))?;

    let claims = validate_token_claims(auth_header)
        .map_err(|_| ServiceError::Forbidden("Token invalide".to_string()))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ServiceError::BadRequest("ID utilisateur invalide".to_string()))?;

    // CORRECTION ICI : De même, on utilise query avec .bind() pour éviter les caprices de typage
    sqlx::query("UPDATE users SET avatar_url = NULL WHERE id = $1")
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn search_users_returns_empty_for_missing_query() {
        let result = search_users(
            State(build_state().await),
            Query(SearchUsersQuery { q: None }),
        )
        .await
        .expect("search should succeed");

        let Json(users) = result;
        assert!(users.is_empty());
    }

    #[tokio::test]
    async fn search_users_returns_empty_for_short_query_after_trim() {
        let result = search_users(
            State(build_state().await),
            Query(SearchUsersQuery {
                q: Some(" a ".to_string()),
            }),
        )
        .await
        .expect("search should succeed");

        let Json(users) = result;
        assert!(users.is_empty());
    }

    #[tokio::test]
    async fn search_users_returns_internal_error_for_valid_query_when_database_is_unavailable() {
        let result = search_users(
            State(build_state().await),
            Query(SearchUsersQuery {
                q: Some("alice".to_string()),
            }),
        )
        .await;

        match result {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn list_users_returns_internal_error_when_database_is_unavailable() {
        let result = list_users(State(build_state().await)).await;

        match result {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn normalize_search_query_rejects_missing_blank_and_single_character_values() {
        assert_eq!(normalize_search_query(None), None);
        assert_eq!(normalize_search_query(Some("   ".to_string())), None);
        assert_eq!(normalize_search_query(Some(" a ".to_string())), None);
    }

    #[test]
    fn normalize_search_query_trims_valid_values() {
        assert_eq!(
            normalize_search_query(Some("  ab  ".to_string())),
            Some("ab".to_string())
        );
        assert_eq!(
            normalize_search_query(Some("alice".to_string())),
            Some("alice".to_string())
        );
    }
}