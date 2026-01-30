use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use bcrypt;

use super::models::{RegisterRequest, RegisterResponse, User};

// Handler pour POST /auth/register
pub async fn register(
    State(pool): State<PgPool>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    
    // Verifier si l email existe deja
    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&body.email)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    if existing_user.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Email deja utilise".to_string()));
    }
    
    // Hache le mdp
    let password_hash = bcrypt::hash(&body.password, 12)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // Inserer le nouvel utilisateur
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (username, email, password_hash) 
         VALUES ($1, $2, $3) 
         RETURNING id, username, email, password_hash, avatar_url, created_at"
    )
    .bind(&body.username)
    .bind(&body.email)
    .bind(&password_hash)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // Renvoye la rep
    Ok(Json(RegisterResponse {
        id: user.id,
        username: user.username,
        email: user.email,
    }))
}
