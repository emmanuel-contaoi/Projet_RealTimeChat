use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::PgPool;

use crate::models::{AuthResponse, LoginRequest, RegisterRequest};
use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;
use crate::utils::jwt::create_token;

pub struct AuthService;

impl AuthService {
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

        let first_name = payload.first_name.as_deref().filter(|s| !s.trim().is_empty());
        let last_name = payload.last_name.as_deref().filter(|s| !s.trim().is_empty());
        let username = payload.username.as_deref().filter(|s| !s.trim().is_empty());

        let user = UserRepository::create(pool, &payload.email, &password_hash, first_name, last_name, username)
            .await
            .map_err(|e| {
                if e.to_string().contains("unique") {
                    ServiceError::Conflict("Email ou pseudo déjà utilisé".to_string())
                } else {
                    ServiceError::Internal(format!("Failed to create user: {}", e))
                }
            })?;

        let token = create_token(user.id).map_err(ServiceError::Internal)?;

        Ok(AuthResponse { token, user: user.into() })
    }

    pub async fn login(
        pool: &PgPool,
        payload: LoginRequest,
    ) -> Result<AuthResponse, ServiceError> {
        let user = UserRepository::find_by_email(pool, &payload.email)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::Unauthorized("Invalid credentials".to_string()))?;

        let valid = verify(payload.password.as_bytes(), &user.password_hash)
            .map_err(|e| ServiceError::Internal(format!("Verify error: {}", e)))?;

        if !valid {
            return Err(ServiceError::Unauthorized("Invalid credentials".to_string()));
        }

        let token = create_token(user.id).map_err(ServiceError::Internal)?;

        Ok(AuthResponse { token, user: user.into() })
    }
}
