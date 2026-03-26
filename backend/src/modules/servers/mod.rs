pub mod handlers;
pub mod models;

use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::list_servers).post(handlers::create_server),
        )
        .route("/join", post(handlers::join_server))
        .route(
            "/{id}",
            get(handlers::get_server)
                .put(handlers::update_server)
                .delete(handlers::delete_server),
        )
        .route("/{id}/leave", delete(handlers::leave_server))
        .route("/{id}/members", get(handlers::list_members))
        .route("/{id}/members/{user_id}", delete(handlers::kick_member))
        .route("/{id}/members/{user_id}/ban", post(handlers::ban_member))
        .route("/{id}/bans", get(handlers::list_bans))
        .route("/{id}/bans/{user_id}", delete(handlers::unban_member))
        .route(
            "/{id}/members/{user_id}/role",
            put(handlers::update_member_role),
        )
        .route("/{id}/transfer", post(handlers::transfer_ownership))
        .route(
            "/{id}/channels",
            get(handlers::list_channels).post(handlers::create_channel),
        )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::util::ServiceExt;
    use uuid::Uuid;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn router_rejects_unsupported_method_on_servers_root() {
        let app = router().with_state(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri("/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn router_rejects_unsupported_method_on_join_route() {
        let app = router().with_state(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/join")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn router_rejects_unsupported_method_on_leave_route() {
        let app = router().with_state(build_state().await);
        let server_id = Uuid::new_v4();

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/{server_id}/leave"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn router_rejects_unsupported_method_on_member_role_route() {
        let app = router().with_state(build_state().await);
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/{server_id}/members/{user_id}/role"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn router_rejects_unsupported_method_on_channels_route() {
        let app = router().with_state(build_state().await);
        let server_id = Uuid::new_v4();

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/{server_id}/channels"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn router_returns_not_found_for_unknown_nested_route() {
        let app = router().with_state(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/unknown/path")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}