pub mod auth_service;
pub mod channel_service;
pub mod friend_service;
pub mod message_service;
pub mod server_service;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

// Erreurs metier retournees par les services, converties automatiquement en reponse HTTP
#[derive(Debug)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn service_error_into_response_maps_status_and_body() {
        let response = ServiceError::Forbidden("forbidden".to_string()).into_response();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "forbidden");
    }

    #[tokio::test]
    async fn internal_service_error_maps_to_500() {
        let response = ServiceError::Internal("boom".to_string()).into_response();

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "boom");
    }

    #[tokio::test]
    async fn remaining_service_errors_map_to_expected_status_codes() {
        let cases = [
            (
                ServiceError::NotFound("missing".to_string()),
                StatusCode::NOT_FOUND,
                "missing",
            ),
            (
                ServiceError::Unauthorized("unauthorized".to_string()),
                StatusCode::UNAUTHORIZED,
                "unauthorized",
            ),
            (
                ServiceError::Conflict("conflict".to_string()),
                StatusCode::CONFLICT,
                "conflict",
            ),
            (
                ServiceError::BadRequest("bad request".to_string()),
                StatusCode::BAD_REQUEST,
                "bad request",
            ),
        ];

        for (error, expected_status, expected_body) in cases {
            let response = error.into_response();
            assert_eq!(response.status(), expected_status);
            let body = to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("body should be readable");
            assert_eq!(body, expected_body);
        }
    }
}
