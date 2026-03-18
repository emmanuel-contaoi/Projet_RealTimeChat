mod db;
mod models;
mod modules;
mod repositories;
mod routes;
mod services;
mod state;
mod utils;
mod websocket;

use crate::state::AppState;
use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

fn build_app(state: AppState) -> Router {
    // 4. Routes publiques (sans authentification)
    let public_routes = Router::new()
        .route("/", get(|| async { "Backend RTC fonctionne !" }))
        .route("/health", get(|| async { "OK" }))
        .route("/auth/signup", post(routes::auth::register))
        .route("/auth/login", post(routes::auth::login));

    // 5. Routes protégées (avec authentification)
    let protected_routes = Router::new()
        .route("/me", get(routes::auth::me))
        .route("/auth/me", get(routes::auth::me))
        .route("/auth/logout", post(routes::auth::logout))
        .route("/users/search", get(routes::users::search_users))
        .route("/users", get(routes::users::list_users))
        .route(
            "/friends",
            get(routes::friends::list_friends).post(routes::friends::send_friend_request),
        )
        .route(
            "/friends/requests/incoming",
            get(routes::friends::list_incoming_requests),
        )
        .route(
            "/friends/requests/outgoing",
            get(routes::friends::list_outgoing_requests),
        )
        .route(
            "/friends/requests/{request_id}/accept",
            post(routes::friends::accept_friend_request),
        )
        .route(
            "/friends/requests/{request_id}/reject",
            post(routes::friends::reject_friend_request),
        )
        .route(
            "/friends/requests/{request_id}",
            delete(routes::friends::cancel_friend_request),
        )
        .route(
            "/friends/{friend_id}",
            delete(routes::friends::remove_friend),
        )
        .route("/dms", post(routes::dms::get_or_create_dm))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            utils::auth::auth_middleware,
        ));

    // 6. Routes servers (protégées par auth)
    let server_routes = Router::new()
        .nest("/servers", modules::servers::router())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            utils::auth::auth_middleware,
        ));

    // Routes channels/messages (protégées par auth)
    let channel_routes = Router::new()
        .route(
            "/channels/{id}",
            get(modules::servers::handlers::get_channel)
                .put(modules::servers::handlers::update_channel)
                .delete(modules::servers::handlers::delete_channel),
        )
        .route(
            "/channels/{id}/messages",
            get(modules::servers::handlers::get_chat_history)
                .post(modules::servers::handlers::send_message),
        )
        .route(
            "/messages/{id}",
            delete(modules::servers::handlers::delete_message)
                .put(modules::servers::handlers::edit_message),
        )
        .route(
            "/messages/{id}/reactions",
            put(modules::servers::handlers::add_reaction)
                .delete(modules::servers::handlers::remove_reaction),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            utils::auth::auth_middleware,
        ));

    // 7. Route WebSocket
    let ws_route = Router::new().route("/ws", get(websocket::websocket_handler));

    // 8. Combiner toutes les routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(server_routes)
        .merge(channel_routes)
        .merge(ws_route)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    // 1. Connexion PostgreSQL
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL doit être défini dans .env");

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Impossible de se connecter à PostgreSQL");

    // Migrations : creer les tables si elles n'existent pas
    db::migrations::run_migrations(&pool).await;

    // 2. Connexion MongoDB
    let mongo_client = db::mongo::init_mongo().await;

    let state = AppState {
        pool: pool.clone(),
        mongo: mongo_client,
        connections: std::sync::Arc::new(
            tokio::sync::RwLock::new(std::collections::HashMap::new()),
        ),
        room_manager: std::sync::Arc::new(tokio::sync::Mutex::new(
            websocket::rooms::RoomManager::new(),
        )),
        user_info: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    let app = build_app(state);

    let port = std::env::var("PORT").unwrap_or("3001".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse::<u16>().unwrap()));

    println!("Serveur lance sur http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{header, Request, StatusCode};
    use tower::util::ServiceExt;
    use uuid::Uuid;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn public_root_route_returns_expected_body() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "Backend RTC fonctionne !");
    }

    #[tokio::test]
    async fn health_route_returns_ok_body() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "OK");
    }

    #[tokio::test]
    async fn unknown_route_returns_not_found() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/does-not-exist")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn protected_me_route_rejects_missing_authorization_header() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(Request::builder().uri("/me").body(Body::empty()).unwrap())
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        assert_eq!(body, "Missing authorization header");
    }

    #[tokio::test]
    async fn protected_logout_route_rejects_invalid_authorization_format() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/logout")
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
    async fn protected_server_route_rejects_missing_authorization_header() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/servers")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn protected_channel_route_rejects_missing_authorization_header() {
        let app = build_app(build_state().await);
        let channel_id = Uuid::new_v4();

        let response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/channels/{channel_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn protected_message_route_rejects_missing_authorization_header() {
        let app = build_app(build_state().await);

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/messages/invalid-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}
