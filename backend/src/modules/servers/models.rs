use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::NaiveDateTime;

// --- SERVERS ---

#[derive(Serialize, FromRow)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub invite_code: String,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct ServerResponse {
    pub id: Uuid,
    pub name: String,
    pub invite_code: String,
}

// --- CHANNELS ---

#[derive(Serialize, FromRow)]
pub struct Channel {
    pub id: Uuid,
    pub server_id: Uuid,
    pub name: String,
    pub r#type: String, 
    
}

#[derive(Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    pub r#type: String, 
}