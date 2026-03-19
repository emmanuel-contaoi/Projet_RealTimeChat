use dotenv::dotenv;
use mongodb::{options::ClientOptions, Client};
use std::env;

#[cfg(test)]
fn mongo_uri_from_env() -> String {
    env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string())
}

pub async fn init_mongo() -> Client {
    dotenv().ok();

    let client_uri =
        env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());

    let client_options = ClientOptions::parse(client_uri)
        .await
        .expect("Impossible de configurer l'URL Mongo");

    Client::with_options(client_options).expect("Impossible de creer le client Mongo")
}

#[cfg(test)]
mod tests {
    use super::mongo_uri_from_env;

    #[test]
    fn mongo_uri_from_env_uses_default_when_variable_is_missing() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::remove_var("MONGODB_URI");

        assert_eq!(mongo_uri_from_env(), "mongodb://localhost:27017");
    }

    #[test]
    fn mongo_uri_from_env_returns_configured_value() {
        let _guard = crate::utils::test_env_lock().lock().unwrap();
        std::env::set_var("MONGODB_URI", "mongodb://example.com:27018");

        assert_eq!(mongo_uri_from_env(), "mongodb://example.com:27018");
    }
}
