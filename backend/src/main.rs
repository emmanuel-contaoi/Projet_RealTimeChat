mod db;
mod websocket;
mod models;
mod routes;
mod utils;
mod modules;
mod state;

use axum::{
    Router,
    routing::{get, post, delete},
    middleware,
};
use std::net::SocketAddr;
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
    
    println!("Connecté à PostgreSQL");

    // 1b. Appliquer les migrations (création des tables)
    println!("Application des migrations...");
    sqlx::query(
        "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\""
    ).execute(&pool).await.expect("Erreur extension pgcrypto");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            avatar_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(&pool).await.expect("Erreur création table users");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS servers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            invite_code VARCHAR(50) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(&pool).await.expect("Erreur création table servers");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'text',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(&pool).await.expect("Erreur création table channels");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS members (
            server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            role VARCHAR(20) DEFAULT 'guest',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (server_id, user_id)
        )"
    ).execute(&pool).await.expect("Erreur création table members");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user_friends (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (user_id, friend_id),
            CHECK (user_id <> friend_id)
        )"
    ).execute(&pool).await.expect("Erreur création table user_friends");

    println!("Migrations appliquées avec succès");

    // 2. Connexion MongoDB
    let mongo_client = db::mongo::init_mongo().await;
    println!("Connecté à MongoDB");
    
    // 3. Création du State global (pour auth + serveurs + WebSocket)
    let state = AppState {
        pool: pool.clone(),
        mongo: mongo_client,
        connections: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        room_manager: std::sync::Arc::new(tokio::sync::Mutex::new(websocket::rooms::RoomManager::new())),
    };
    
    // 4. Routes publiques (sans authentification)
    let public_routes = Router::new()
        .route("/", get(|| async { "Backend RTC fonctionne !" }))
        .route("/health", get(|| async { "OK" }))
        .route("/auth/register", post(routes::auth::register))
        .route("/auth/login", post(routes::auth::login));
    
    // 5. Routes protégées (avec authentification)
    let protected_routes = Router::new()
        .route("/auth/me", get(routes::auth::me))
        .route("/users/search", get(routes::users::search_users))
        .route("/users", get(routes::users::list_users))
        .route("/friends", get(routes::friends::list_friends).post(routes::friends::add_friend))
        .route("/friends/{friend_id}", delete(routes::friends::remove_friend))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            utils::auth::auth_middleware,
        )); 
    
    // 6. Routes servers
    let server_routes = Router::new()
        .nest("/servers", modules::servers::router());
    
    // 7. Route WebSocket
    let ws_route = Router::new()
        .route("/ws", get(websocket::websocket_handler));
    
    // 8. Combiner toutes les routes
    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(server_routes)
        .merge(ws_route)
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
    println!("Routes disponibles :");
    println!("   GET    /");
    println!("   GET    /health");
    println!("   POST   /auth/register");
    println!("   POST   /auth/login");
    println!("   GET    /auth/me (protégée)");
    println!("   *      /servers/* (routes serveurs)");
    println!("   WS     /ws (WebSocket)");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
