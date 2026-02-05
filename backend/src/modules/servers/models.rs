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

#[derive(Deserialize)]
pub struct JoinServerRequest {
    pub invite_code: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub channel_id: String,
    pub user_id: String,
    pub content: String,
    pub username: String,
}


#[derive(Deserialize)]
pub struct UpdateChannelRequest {
    pub name: String,
    pub r#type: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateMessageRequest {
    pub content: String,
    pub user_id: String,
    pub username: String,
}