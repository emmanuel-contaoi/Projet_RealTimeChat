use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub exp: i64,    // expiration timestamp
}

pub fn create_token(user_id: Uuid) -> Result<String, String> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| "JWT_SECRET not found in environment")?;

    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .ok_or("Failed to calculate expiration")?
        .timestamp();

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| format!("Failed to create token: {}", e))
}

pub fn validate_token_claims(token: &str) -> Result<Claims, String> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| "JWT_SECRET not found in environment")?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| format!("Invalid token: {}", e))?;

    Ok(token_data.claims)
}

pub fn validate_token(token: &str) -> Result<Uuid, String> {
    let claims = validate_token_claims(token)?;
    Uuid::parse_str(&claims.sub).map_err(|e| format!("Invalid user ID in token: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_and_validate_token_roundtrip() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::set_var("JWT_SECRET", "test-secret");
        let user_id = Uuid::new_v4();

        let token = create_token(user_id).expect("token should be created");
        let validated = validate_token(token.as_str()).expect("token should validate");
        let claims = validate_token_claims(token.as_str()).expect("claims should validate");

        assert_eq!(validated, user_id);
        assert_eq!(claims.sub, user_id.to_string());
        assert!(claims.exp > Utc::now().timestamp());
    }

    #[test]
    fn create_token_fails_when_secret_is_missing() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::remove_var("JWT_SECRET");

        let result = create_token(Uuid::new_v4());

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "JWT_SECRET not found in environment");
    }

    #[test]
    fn validate_token_fails_for_invalid_user_id_claim() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::set_var("JWT_SECRET", "test-secret");

        let token = encode(
            &Header::default(),
            &Claims {
                sub: "not-a-uuid".to_string(),
                exp: Utc::now().timestamp() + 3600,
            },
            &EncodingKey::from_secret("test-secret".as_bytes()),
        )
        .expect("token encoding should succeed");

        let result = validate_token(token.as_str());

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid user ID in token"));
    }

    #[test]
    fn validate_token_claims_fails_when_secret_is_missing() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::remove_var("JWT_SECRET");

        let result = validate_token_claims("some-token");

        assert_eq!(result.unwrap_err(), "JWT_SECRET not found in environment");
    }

    #[test]
    fn validate_token_claims_rejects_expired_tokens() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::set_var("JWT_SECRET", "test-secret");

        let token = encode(
            &Header::default(),
            &Claims {
                sub: Uuid::new_v4().to_string(),
                exp: Utc::now().timestamp() - 3600,
            },
            &EncodingKey::from_secret("test-secret".as_bytes()),
        )
        .expect("token encoding should succeed");

        let result = validate_token_claims(token.as_str());

        assert!(result.is_err());
        assert!(result.unwrap_err().starts_with("Invalid token:"));
    }
}
