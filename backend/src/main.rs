fn main() {
    println!("Hello, world!");
mod db;

use axum::Router;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Charger les variables du fichier .env
    dotenvy::dotenv().ok();
    
    //  variable pour récupérer l'URL de la base de données
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini dans .env");
    
    // variable pour se co a la db  PostgreSQL
    let pool = db::create_pool(&database_url)
        .await
        .expect("Impossible de se connecter à PostgreSQL");
    
    println!("✅ Connecté à PostgreSQL");
    
    // Router 
    let app = Router::new();
    
    // variable pour démarrer le serveur
    let port = std::env::var("PORT").unwrap_or("3000".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse::<u16>().unwrap()));
    
    println!(" Serveur lancé sur http://localhost:{}", port);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
