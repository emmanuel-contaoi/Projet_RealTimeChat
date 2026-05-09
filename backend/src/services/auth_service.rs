use crate::models::{AuthResponse, LoginRequest, RegisterRequest};
use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;
use crate::utils::jwt::create_token;
use bcrypt::{hash, verify, DEFAULT_COST};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use sqlx::PgPool;
use std::fmt::Write;

// Définition de notre type HMAC-SHA256 pour le Poivre
type HmacSha256 = Hmac<Sha256>;

pub struct AuthService;

impl AuthService {
    //  Validation stricte de la politique de mot de passe
    fn validate_password(password: &str) -> Result<(), String> {
        if password.len() < 8 {
            return Err("Le mot de passe doit contenir au moins 8 caractères.".to_string());
        }

        let has_uppercase = password.chars().any(|c| c.is_uppercase());
        let has_lowercase = password.chars().any(|c| c.is_lowercase());
        let has_digit = password.chars().any(|c| c.is_numeric());
        let has_special = password.chars().any(|c| !c.is_alphanumeric());

        if !has_uppercase {
            return Err("Le mot de passe doit contenir au moins une lettre majuscule.".to_string());
        }
        if !has_lowercase {
            return Err("Le mot de passe doit contenir au moins une lettre minuscule.".to_string());
        }
        if !has_digit {
            return Err("Le mot de passe doit contenir au moins un chiffre.".to_string());
        }
        if !has_special {
            return Err("Le mot de passe doit contenir au moins un caractère spécial.".to_string());
        }

        Ok(())
    }

    // 🔴 Application du Poivre cryptographique
    fn get_peppered_password(password: &str) -> String {
        // En mode test, on utilise un poivre statique pour ne pas casser "cargo test"
        let pepper = std::env::var("PEPPER_SECRET").unwrap_or_else(|_| {
            if cfg!(test) {
                "test_pepper_for_tests_only".to_string()
            } else {
                panic!("CRITICAL: PEPPER_SECRET is missing in .env");
            }
        });

        let mut mac =
            HmacSha256::new_from_slice(pepper.as_bytes()).expect("HMAC can take key of any size");
        mac.update(password.as_bytes());
        let result = mac.finalize().into_bytes();

        let mut hex_string = String::with_capacity(result.len() * 2);
        for b in result {
            write!(&mut hex_string, "{:02x}", b).unwrap();
        }

        hex_string
    }

    // Inscrit un nouvel utilisateur
    pub async fn register(
        pool: &PgPool,
        payload: RegisterRequest,
    ) -> Result<AuthResponse, ServiceError> {
        // 1. Validation du mot de passe (Politique de sécurité)
        if let Err(validation_error) = Self::validate_password(&payload.password) {
            return Err(ServiceError::Conflict(validation_error));
        }

        // 2. Vérification de l'email
        let existing = UserRepository::find_by_email(pool, &payload.email)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        if existing.is_some() {
            return Err(ServiceError::Conflict("Email already exists".to_string()));
        }

        // 3. Application du Poivre
        let peppered_password = Self::get_peppered_password(&payload.password);

        // 4. Définition du Sel et Hachage (Bcrypt)
        let cost = std::env::var("BCRYPT_SALT_ROUNDS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(DEFAULT_COST);

        let password_hash = hash(peppered_password.as_bytes(), cost)
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

        let avatar_url = payload
            .avatar_url
            .as_deref()
            .filter(|s| !s.trim().is_empty());

        // 5. Sauvegarde en Base de données
        let user = UserRepository::create(
            pool,
            &payload.email,
            &password_hash,
            first_name,
            last_name,
            username,
            avatar_url,
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

    // Connecte un utilisateur
    pub async fn login(pool: &PgPool, payload: LoginRequest) -> Result<AuthResponse, ServiceError> {
        let user = UserRepository::find_by_email(pool, &payload.email)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::Unauthorized(
                "Invalid credentials".to_string(),
            ))?;

        // 1. Re-poivrer le mot de passe fourni
        let peppered_password = Self::get_peppered_password(&payload.password);

        // 2. Comparer avec le hash en base de données
        let valid = verify(peppered_password.as_bytes(), &user.password_hash)
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

    #[tokio::test]
    async fn register_and_login_succeed_with_real_database() {
        let pool = match crate::utils::live_pg_pool().await {
            Some(p) => p,
            None => return,
        };
        let email = format!("cov_auth_{}@test.example", uuid::Uuid::new_v4());
        let username = format!("cov_{}", &uuid::Uuid::new_v4().to_string()[..8]);

        // Utilisation d'un mot de passe fort pour passer la validation
        let response = AuthService::register(
            &pool,
            RegisterRequest {
                email: email.clone(),
                password: "P@ssw0rd123!".to_string(),
                first_name: Some("Test".to_string()),
                last_name: Some("Coverage".to_string()),
                username: Some(username.clone()),
                avatar_url: None,
            },
        )
        .await
        .expect("registration should succeed");
        assert!(!response.token.is_empty());

        let dup = AuthService::register(
            &pool,
            RegisterRequest {
                email: email.clone(),
                password: "0th3rP@ssw0rd!".to_string(),
                first_name: None,
                last_name: None,
                username: Some(format!("cov_{}", &uuid::Uuid::new_v4().to_string()[..8])),
                avatar_url: None,
            },
        )
        .await;
        assert!(matches!(dup, Err(ServiceError::Conflict(_))));

        let login = AuthService::login(
            &pool,
            LoginRequest {
                email: email.clone(),
                password: "P@ssw0rd123!".to_string(),
            },
        )
        .await
        .expect("login should succeed");
        assert!(!login.token.is_empty());

        let bad_login = AuthService::login(
            &pool,
            LoginRequest {
                email: email.clone(),
                password: "Wr0ngP@ssw0rd!".to_string(),
            },
        )
        .await;
        assert!(matches!(bad_login, Err(ServiceError::Unauthorized(_))));

        sqlx::query("DELETE FROM users WHERE email = $1")
            .bind(&email)
            .execute(&pool)
            .await
            .expect("cleanup failed");
    }

    #[tokio::test]
    async fn register_and_login_return_internal_errors_when_database_is_unavailable() {
        let pool = crate::utils::test_pg_pool();

        let register_result = AuthService::register(
            &pool,
            RegisterRequest {
                email: "alice@example.com".to_string(),
                password: "P@ssw0rd123!".to_string(), // Mot de passe fort requis ici aussi
                first_name: Some(" Alice ".to_string()),
                last_name: Some(" Martin ".to_string()),
                username: Some(" alice ".to_string()),
                avatar_url: None,
            },
        )
        .await;
        assert_internal_error(register_result, "Database error:");

        let login_result = AuthService::login(
            &pool,
            LoginRequest {
                email: "alice@example.com".to_string(),
                password: "P@ssw0rd123!".to_string(),
            },
        )
        .await;
        assert_internal_error(login_result, "Database error:");
    }
}
