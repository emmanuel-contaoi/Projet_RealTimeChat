use axum::{
    extract::{State, Json},
    http::StatusCode,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use uuid::Uuid;

use crate::models::{RegisterRequest, LoginRequest, AuthResponse, User, UserResponse};
use crate::state::AppState;
use crate::utils::jwt::create_token;

pub async fn register(
    State(state): State<AppState>, // On reçoit le state ici
    Json(payload): Json<RegisterRequest>, // On reçoit le payload ici
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    // On déclare la variable pool ICI, au début de la fonction
    let pool = &state.pool;

    // Vérifier si l'email existe déjà
    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(pool) // On utilise pool directement
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;
    
    if existing_user.is_some() {
        return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
    }
    
    let password_hash = hash(payload.password.as_bytes(), DEFAULT_COST)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?;

    // Convertir les chaînes vides en None pour éviter les violations UNIQUE
    let first_name = payload.first_name.filter(|s| !s.trim().is_empty());
    let last_name = payload.last_name.filter(|s| !s.trim().is_empty());
    let username = payload.username.filter(|s| !s.trim().is_empty());

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, password_hash, first_name, last_name, username, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&first_name)
    .bind(&last_name)
    .bind(&username)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            (StatusCode::CONFLICT, "Email ou pseudo déjà utilisé".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {}", e))
        }
    })?;
    
    let token = create_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let pool = &state.pool;

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?
    .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;
    
    let valid = verify(payload.password.as_bytes(), &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to verify password: {}", e)))?;
    
    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }
    
    let token = create_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

pub async fn me(
    State(_state): State<AppState>, // Correction : Utilise AppState ici aussi !
    axum::extract::Extension(crate::utils::auth::AuthUser(user)): axum::extract::Extension<crate::utils::auth::AuthUser>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    Ok(Json(user.into()))
}

pub async fn logout() -> StatusCode {
    StatusCode::OK
}