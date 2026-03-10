use axum::{
    extract::{State, Json},
    http::StatusCode,
};

use crate::models::{RegisterRequest, LoginRequest, AuthResponse, UserResponse};
use crate::state::AppState;
use crate::services::auth_service::AuthService;
use crate::services::ServiceError;

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, ServiceError> {
    let response = AuthService::register(&state.pool, payload).await?;
    Ok(Json(response))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ServiceError> {
    let response = AuthService::login(&state.pool, payload).await?;
    Ok(Json(response))
}

pub async fn me(
    State(_state): State<AppState>,
    axum::extract::Extension(crate::utils::auth::AuthUser(user)): axum::extract::Extension<crate::utils::auth::AuthUser>,
) -> Result<Json<UserResponse>, ServiceError> {
    Ok(Json(user.into()))
}

pub async fn logout() -> StatusCode {
    StatusCode::OK
}
