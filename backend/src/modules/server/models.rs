use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::NaiveDateTime;


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