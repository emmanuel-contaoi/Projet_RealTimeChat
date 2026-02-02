mod db;
mod websocket;

use axum::{Router, routing::get};
use std::net::SocketAddr;
use websocket::AppState;

#[tokio::main]
async fn main() {
    // Charger les variables du fichier .env
    dotenvy::dotenv().ok();
    
    // Variable pour récupérer l'URL de la base de données
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini dans .env");
    
    // Variable pour se connecter à la db PostgreSQL
    let _pool = db::create_pool(&database_url)
        .await
        .expect("Impossible de se connecter à PostgreSQL");
    
    println!("Connecté à PostgreSQL");

    // Créer l'état partagé pour les WebSockets
    let ws_state = AppState::new();
    
    // Router avec 2 routes de test + WebSocket
    let app = Router::new()
        .route("/", get(|| async { "Backend fonctionne !" }))
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(websocket::websocket_handler))
        .with_state(ws_state);
    
    // Variable pour démarrer le serveur
    let port = std::env::var("PORT").unwrap_or("3000".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse::<u16>().unwrap()));
    
    println!("Serveur lancé sur http://localhost:{}", port);
    println!("WebSocket disponible sur ws://localhost:{}/ws", port);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}