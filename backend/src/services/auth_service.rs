use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::PgPool;

use crate::models::{AuthResponse, LoginRequest, RegisterRequest};
use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;
use crate::utils::jwt::create_token;

pub struct AuthService;

impl AuthService {
    // Inscrit un nouvel utilisateur : verifie si l'email existe, hash le mot de passe, cree le compte et retourne un token JWT
    pub async fn register(
        pool: &PgPool,
        payload: RegisterRequest,
    ) -> Result<AuthResponse, ServiceError> {
        let existing = UserRepository::find_by_email(pool, &payload.email)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        if existing.is_some() {
            return Err(ServiceError::Conflict("Email already exists".to_string()));
        }

        let password_hash = hash(payload.password.as_bytes(), DEFAULT_COST)
            .map_err(|e| ServiceError::Internal(format!("Hash error: {}", e)))?;

        let first_name = payload
            .first_name
            .as_deref()
            .filter(|s| !s.trim().is_empty());
        let last_name = payload
            .last_name
            .as_deref()
            .filter(|s| !s.trim().is_empty());
        let username = payload.username.as_deref().filter(|s| !s.trim().is_empty());

        let user = UserRepository::create(
            pool,
            &payload.email,
            &password_hash,
            first_name,
            last_name,
            username,
        )
        .await
        .map_err(|e| {
            if e.to_string().contains("unique") {
                ServiceError::Conflict("Email ou pseudo déjà utilisé".to_string())
            } else {
                ServiceError::Internal(format!("Failed to create user: {}", e))
            }
        })?;

        let token = create_token(user.id).map_err(ServiceError::Internal)?;

        Ok(AuthResponse {
            token,
            user: user.into(),
        })
    }

    // Connecte un utilisateur : verifie l'email, compare le mot de passe et retourne un token JWT
    pub async fn login(pool: &PgPool, payload: LoginRequest) -> Result<AuthResponse, ServiceError> {
        let user = UserRepository::find_by_email(pool, &payload.email)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::Unauthorized(
                "Invalid credentials".to_string(),
            ))?;

        let valid = verify(payload.password.as_bytes(), &user.password_hash)
            .map_err(|e| ServiceError::Internal(format!("Verify error: {}", e)))?;

        if !valid {
            return Err(ServiceError::Unauthorized(
                "Invalid credentials".to_string(),
            ));
        }

        let token = create_token(user.id).map_err(ServiceError::Internal)?;

        Ok(AuthResponse {
            token,
            user: user.into(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_internal_error<T>(result: Result<T, ServiceError>, expected_prefix: &str) {
        if let Err(ServiceError::Internal(message)) = result {
            assert!(
                message.starts_with(expected_prefix),
                "unexpected internal message: {message}"
            );
        } else {
            panic!("expected internal error");
        }
    }

    #[test]
    fn normalize_optional_field_trims_non_empty_values() {
        assert_eq!(
            normalize_optional_field(Some("  Alice  ")),
            Some("Alice".to_string())
        );
        assert_eq!(
            normalize_optional_field(Some("bob_42")),
            Some("bob_42".to_string())
        );
    }

    #[test]
    fn normalize_optional_field_drops_missing_or_blank_values() {
        assert_eq!(normalize_optional_field(None), None);
        assert_eq!(normalize_optional_field(Some("")), None);
        assert_eq!(normalize_optional_field(Some("   \n\t  ")), None);
    }

    #[tokio::test]
    async fn register_and_login_return_internal_errors_when_database_is_unavailable() {
        let pool = crate::utils::test_pg_pool();

        let register_result = AuthService::register(
            &pool,
            RegisterRequest {
                email: "alice@example.com".to_string(),
                password: "password123".to_string(),
                first_name: Some(" Alice ".to_string()),
                last_name: Some(" Martin ".to_string()),
                username: Some(" alice ".to_string()),
            },
        )
        .await;
        assert_internal_error(register_result, "Database error:");

        let login_result = AuthService::login(
            &pool,
            LoginRequest {
                email: "alice@example.com".to_string(),
                password: "password123".to_string(),
            },
        )
        .await;
        assert_internal_error(login_result, "Database error:");
    }
}
