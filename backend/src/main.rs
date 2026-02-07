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
    
    // Migrations : créer les tables si elles n'existent pas
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            username TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"
    ).execute(&pool).await.expect("Migration users échouée");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS servers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT now()
        )"
    ).execute(&pool).await.expect("Migration servers échouée");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'text'
        )"
    ).execute(&pool).await.expect("Migration channels échouée");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'member',
            UNIQUE(server_id, user_id)
        )"
    ).execute(&pool).await.expect("Migration members échouée");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user_friends (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, friend_id)
        )"
    ).execute(&pool).await.expect("Migration user_friends échouée");

    // 2. Connexion MongoDB
    let mongo_client = db::mongo::init_mongo().await;
    
    // 3. Création du State global (pour auth + serveurs + WebSocket)
    // Migrate existing roles: guest->member, admin->owner
    sqlx::query("UPDATE members SET role = 'member' WHERE role = 'guest'")
        .execute(&pool).await.ok();
    sqlx::query("UPDATE members SET role = 'owner' WHERE role = 'admin'")
        .execute(&pool).await.ok();

    let state = AppState {
        pool: pool.clone(),
        mongo: mongo_client,
        connections: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        room_manager: std::sync::Arc::new(tokio::sync::Mutex::new(websocket::rooms::RoomManager::new())),
        user_info: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
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
    
    // 6. Routes servers (protégées par auth)
    let server_routes = Router::new()
        .nest("/servers", modules::servers::router())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            utils::auth::auth_middleware,
        ));
    
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
    
    println!("Serveur lance sur http://localhost:{}", port);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
