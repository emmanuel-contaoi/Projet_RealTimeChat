use mongodb::{Client, options::ClientOptions};
use std::env;
use dotenv::dotenv;

pub async fn init_mongo() -> Client {

    dotenv().ok();


    let client_uri = env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    
    println!("Connexion à MongoDB sur : {}", client_uri);


    let client_options = ClientOptions::parse(client_uri).await.expect("Impossible de configurer l'URL Mongo");
    
    
    let client = Client::with_options(client_options).expect("Impossible de créer le client Mongo");

    println!("Connecté à MongoDB !");
    client
}