use axum::Router;
use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;
use std::env;
use std::net::SocketAddr;

mod db;
mod modules;
mod state;
use crate::state::AppState;

#[tokio::main]
async fn main() {
    // 1. Charger les variables d'environnement
    dotenv().ok();

    // 2. Connexion Postgres
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL manquante dans .env");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Erreur de connexion à Postgres");
    println!("✅ Connecté à Postgres");

    // 3. Connexion MongoDB
    // Note : On utilise MONGO_URL pour être compatible avec ton groupe
    let mongo_client = db::mongo::init_mongo().await;

    // 4. Création de la "Boîte" (State global)
    let state = AppState {
        pool,
        mongo: mongo_client,
    };

    // 5. Création de l'application
    let app = Router::new()
        .nest("/servers", modules::servers::router())
        .with_state(state);

    // 6. Lancement du serveur
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("🚀 Serveur Axum lancé sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}