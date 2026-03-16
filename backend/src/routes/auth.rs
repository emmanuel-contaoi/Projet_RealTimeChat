use axum::{
    extract::{Json, State},
    http::StatusCode,
};

use crate::models::{AuthResponse, LoginRequest, RegisterRequest, UserResponse};
use crate::services::auth_service::AuthService;
use crate::services::ServiceError;
use crate::state::AppState;

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
    axum::extract::Extension(crate::utils::auth::AuthUser(user)): axum::extract::Extension<
        crate::utils::auth::AuthUser,
    >,
) -> Result<Json<UserResponse>, ServiceError> {
    Ok(Json(user.into()))
}

pub async fn logout() -> StatusCode {
    StatusCode::OK
}
