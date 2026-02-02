use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{RegisterRequest, LoginRequest, AuthResponse, User, UserResponse};
use crate::utils::jwt::create_token;

pub async fn register(
    State(pool): State<PgPool>, // state(pool) pour se co a postgreesql
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    // Variable pour voir si l'email existe déjà
    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;
    
    if existing_user.is_some() {
        return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
    }
    
    // Hasher le mot de passe
    let password_hash = hash(payload.password.as_bytes(), DEFAULT_COST)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?;
    
    // Créer l'utilisateur
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {}", e)))?;
    
    // Créer le token JWT
    let token = create_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    // Récupérer l'utilisateur
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?
    .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;
    
    // Vérifier le mot de passe
    let valid = verify(payload.password.as_bytes(), &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to verify password: {}", e)))?;
    
    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }
    
    // Créer le token JWT (fonction login)
    let token = create_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
    
}

pub async fn me(
    State(_pool): State<PgPool>,
    axum::extract::Extension(crate::utils::auth::AuthUser(user)): axum::extract::Extension<crate::utils::auth::AuthUser>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    Ok(Json(user.into()))
}


