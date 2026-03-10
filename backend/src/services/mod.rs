pub mod auth_service;
pub mod channel_service;
pub mod friend_service;
pub mod message_service;
pub mod server_service;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

pub enum ServiceError {
    NotFound(String),
    Forbidden(String),
    Unauthorized(String),
    Conflict(String),
    BadRequest(String),
    Internal(String),
}

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        match self {
            ServiceError::NotFound(msg) => (StatusCode::NOT_FOUND, msg).into_response(),
            ServiceError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg).into_response(),
            ServiceError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg).into_response(),
            ServiceError::Conflict(msg) => (StatusCode::CONFLICT, msg).into_response(),
            ServiceError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg).into_response(),
            ServiceError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg).into_response(),
        }
    }
}
