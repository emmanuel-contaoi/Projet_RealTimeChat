use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// Structure User (ce qu'on stocke en base de données)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]  // jamais renvoyer le hash dans l'API
    pub password_hash: String,
    pub avatar_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// Requête d'inscription (ce que le frontend envoie)
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

// Requête de login (ce que le frontend envoie)
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

// Réponse d'inscription (ce qu'on renvoie au frontend)
#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
}

// Réponse de login (ce qu'on renvoie au frontend)
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserResponse,
}

// Infos utilisateur (sans le password_hash)
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

// Claims du JWT (ce qu'on met dans le token)
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub user_id: Uuid,
    pub exp: i64,  // Timestamp d'expiration
}
