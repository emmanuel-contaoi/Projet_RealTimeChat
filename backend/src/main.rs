mod db;
mod models;
mod routes;
mod utils;

use axum::{Router, routing::{get, post}};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini dans .env");
    
    let pool = db::create_pool(&database_url)
        .await
        .expect("Impossible de se connecter à PostgreSQL");
    
    println!("✅ Connecté à PostgreSQL");
    
    // Router avec les routes d'authentification
    let app = Router::new()
        .route("/", get(|| async { "✅ Backend fonctionne !" }))
        .route("/health", get(|| async { "OK" }))
        .route("/auth/register", post(routes::auth::register))
        .route("/auth/login", post(routes::auth::login))
        .with_state(pool);
    
    let port = std::env::var("PORT").unwrap_or("3000".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse::<u16>().unwrap()));
    
    println!("Serveur lancé sur http://localhost:{}", port);
    println!("Routes disponibles :");
    println!("   GET  /");
    println!("   GET  /health");
    println!("   POST /auth/register");
    println!("   POST /auth/login");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
