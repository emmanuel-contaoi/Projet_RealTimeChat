use axum::{
    extract::{Json, State},
    http::StatusCode,
};

use crate::models::{AuthResponse, LoginRequest, RegisterRequest, UserResponse};
use crate::services::auth_service::AuthService;
use crate::services::ServiceError;
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/auth/signup",
    tag = "Auth",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "Inscription réussie", body = AuthResponse),
        (status = 400, description = "Données invalides"),
        (status = 500, description = "Erreur serveur")
    )
)]
pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, ServiceError> {
    let response = AuthService::register(&state.pool, payload).await?;
    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Connexion réussie", body = AuthResponse),
        (status = 401, description = "Identifiants invalides"),
        (status = 500, description = "Erreur serveur")
    )
)]
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ServiceError> {
    let response = AuthService::login(&state.pool, payload).await?;
    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/auth/me",
    tag = "Auth",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Informations de l'utilisateur", body = UserResponse),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn me(
    State(_state): State<AppState>,
    axum::extract::Extension(crate::utils::auth::AuthUser(user)): axum::extract::Extension<
        crate::utils::auth::AuthUser,
    >,
) -> Result<Json<UserResponse>, ServiceError> {
    Ok(Json(user.into()))
}

#[utoipa::path(
    post,
    path = "/auth/logout",
    tag = "Auth",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Déconnexion réussie")
    )
)]
pub async fn logout() -> StatusCode {
    StatusCode::OK
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{LoginRequest, RegisterRequest};
    use crate::{models::User, utils::auth::AuthUser};
    use chrono::Utc;
    use uuid::Uuid;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn me_returns_the_authenticated_user_profile() {
        let created_at = Utc::now();
        let user = User {
            id: Uuid::new_v4(),
            email: "alice@example.com".to_string(),
            password_hash: "hashed".to_string(),
            first_name: Some("Alice".to_string()),
            last_name: Some("Martin".to_string()),
            username: Some("alice".to_string()),
            created_at,
        };

        let Json(response) = me(
            State(build_state().await),
            axum::extract::Extension(AuthUser(user)),
        )
        .await
        .expect("me should succeed");

        assert_eq!(response.email, "alice@example.com");
        assert_eq!(response.first_name.as_deref(), Some("Alice"));
        assert_eq!(response.last_name.as_deref(), Some("Martin"));
        assert_eq!(response.username.as_deref(), Some("alice"));
        assert_eq!(response.created_at, created_at);
    }

    #[tokio::test]
    async fn logout_returns_ok_status() {
        assert_eq!(logout().await, StatusCode::OK);
    }

    #[tokio::test]
    async fn register_returns_internal_error_when_database_is_unavailable() {
        let result = register(
            State(build_state().await),
            Json(RegisterRequest {
                email: "alice@example.com".to_string(),
                password: "secret".to_string(),
                first_name: Some("Alice".to_string()),
                last_name: Some("Martin".to_string()),
                username: Some("alice".to_string()),
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
    async fn login_returns_internal_error_when_database_is_unavailable() {
        let result = login(
            State(build_state().await),
            Json(LoginRequest {
                email: "alice@example.com".to_string(),
                password: "secret".to_string(),
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
}