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
