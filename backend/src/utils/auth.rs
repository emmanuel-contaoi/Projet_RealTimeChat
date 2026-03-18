use crate::utils::jwt::validate_token;
use crate::{models::User, state::AppState};
use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};

// Extension pour stocker l'utilisateur dans la requête
#[derive(Clone)]
pub struct AuthUser(pub User);

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    // Extraire le header Authorization
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing authorization header".to_string(),
        ))?;

    // Vérifier le format "Bearer <token>"
    let token = auth_header.strip_prefix("Bearer ").ok_or((
        StatusCode::UNAUTHORIZED,
        "Invalid authorization format".to_string(),
    ))?;

    // Valider le token et extraire l'user_id
    let user_id = validate_token(token).map_err(|e| (StatusCode::UNAUTHORIZED, e))?;

    // Récupére l'utilisateur depuis la DB
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?
        .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    request.extensions_mut().insert(AuthUser(user));
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::jwt::create_token;
    use axum::{
        body::{to_bytes, Body},
        middleware,
        routing::get,
        Router,
    };
    use tower::util::ServiceExt;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    async fn build_app() -> Router {
        let state = build_state().await;

        Router::new()
            .route("/", get(|| async { StatusCode::OK }))
            .layer(middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            ))
            .with_state(state)
    }

    #[tokio::test]
    async fn middleware_rejects_missing_authorization_header() {
        let app = build_app().await;

        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "Missing authorization header");
    }

    #[tokio::test]
    async fn middleware_rejects_invalid_authorization_format() {
        let app = build_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/")
                    .header(header::AUTHORIZATION, "Token abc")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "Invalid authorization format");
    }

    #[tokio::test]
    async fn middleware_rejects_invalid_token() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::set_var("JWT_SECRET", "test-secret");
        let app = build_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/")
                    .header(header::AUTHORIZATION, "Bearer invalid-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        let body_text = String::from_utf8(body.to_vec()).expect("body should be valid utf8");
        assert!(
            body_text.starts_with("Invalid token:")
                || body_text == "JWT_SECRET not found in environment"
        );
    }

    #[tokio::test]
    async fn middleware_returns_internal_error_when_database_lookup_fails() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::set_var("JWT_SECRET", "test-secret");
        let token = create_token(uuid::Uuid::new_v4()).expect("token should be created");
        let app = build_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/")
                    .header(header::AUTHORIZATION, format!("Bearer {}", token))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        let body_text = String::from_utf8(body.to_vec()).expect("body should be valid utf8");
        assert!(body_text.starts_with("Database error:"));
    }
}
