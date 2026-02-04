mod db;
mod websocket;
mod models;
mod routes;
mod utils;
mod modules;
mod state;

use axum::{
    Router,
    routing::{get, post},
    middleware,
};
use std::net::SocketAddr;
use websocket::AppState;
use tower_http::cors::{CorsLayer, Any};
use crate::state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    // 1. Connexion PostgreSQL
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini dans .env");
    
    let pool = sqlx::postgres::PgPoolOptions::new()
    .max_connections(5)
    .connect(&database_url)
    .await
    .expect("Impossible de se connecter à PostgreSQL");

    
    // 2. Connexion MongoDB
    let mongo_client = db::mongo::init_mongo().await;
    
    // 3. Création du State global
    let state = AppState {
        pool: pool.clone(),
        mongo: mongo_client,
    };
    
    // 4. Routes publiques (sans authentification)
    let public_routes = Router::new()
        .route("/", get(|| async { " Backend fonctionne !" }))
        .route("/health", get(|| async { "OK" }))
        .route("/auth/register", post(routes::auth::register))
        .route("/auth/login", post(routes::auth::login));
    
    // 5. Routes protégées (avec authentification)
    let protected_routes = Router::new()
        .route("/auth/me", get(routes::auth::me))
        .layer(middleware::from_fn_with_state(
            pool.clone(),
            utils::auth::auth_middleware,
        ));
    
    println!("Connecté à PostgreSQL");

    // Créer l'état partagé pour les WebSockets
    let ws_state = AppState::new();
    
    // Router avec 2 routes de test + WebSocket
    let app = Router::new()
        .route("/", get(|| async { "Backend fonctionne !" }))
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(websocket::websocket_handler))
        .with_state(ws_state);
    // 6. Routes servers (de ton ami)
    let server_routes = Router::new()
        .nest("/servers", modules::servers::router());
    
    // 7. Combiner toutes les routes
    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(server_routes)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .with_state(state);
    
    let port = std::env::var("PORT").unwrap_or("3001".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse::<u16>().unwrap()));
    
    println!("Serveur lancé sur http://localhost:{}", port);
    println!("WebSocket disponible sur ws://localhost:{}/ws", port);
    println!(" Serveur lancé sur http://localhost:{}", port);
    println!(" Routes disponibles :");
    println!("   GET  /");
    println!("   GET  /health");
    println!("   POST /auth/register");
    println!("   POST /auth/login");
    println!("   GET  /auth/me (protégée)");
    println!("   *    /servers/* (routes serveurs)");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}