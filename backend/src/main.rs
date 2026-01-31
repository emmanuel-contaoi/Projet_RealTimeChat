use axum::Router;
use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;
use std::env;
use std::net::SocketAddr;


mod db;
mod modules;

#[tokio::main]
async fn main() {
    
    dotenv().ok();

    
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL manquante dans .env");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Erreur de connexion à Postgres");

    println!(" Connecté à Postgres");

    
    let app = Router::new()
        .nest("/servers", modules::servers::router())
        .with_state(pool); 

    
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!(" Serveur Axum lancé sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}