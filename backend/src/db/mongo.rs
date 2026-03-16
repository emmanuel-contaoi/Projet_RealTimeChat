use dotenv::dotenv;
use mongodb::{options::ClientOptions, Client};
use std::env;

pub async fn init_mongo() -> Client {
    dotenv().ok();

    let client_uri =
        env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());

    let client_options = ClientOptions::parse(client_uri)
        .await
        .expect("Impossible de configurer l'URL Mongo");

    Client::with_options(client_options).expect("Impossible de creer le client Mongo")
}
