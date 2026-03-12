use serde::{Deserialize, Serialize, Serializer};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::NaiveDateTime;
use mongodb::bson::oid::ObjectId;

fn serialize_object_id_as_hex<S: Serializer>(id: &Option<ObjectId>, s: S) -> Result<S::Ok, S::Error> {
    match id {
        Some(oid) => s.serialize_str(&oid.to_hex()),
        None => s.serialize_none(),
    }
}

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

#[derive(Deserialize)]
pub struct UpdateServerRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct TransferOwnershipRequest {
    pub new_owner_id: Uuid,
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
    #[serde(rename(serialize = "id", deserialize = "_id"), skip_serializing_if = "Option::is_none", serialize_with = "serialize_object_id_as_hex")]
    pub id: Option<ObjectId>,
    pub channel_id: String,
    pub user_id: String,
    pub content: String,
    pub username: String,
    #[serde(default)]
    pub created_at: Option<String>,
}


#[derive(Deserialize)]
pub struct UpdateChannelRequest {
    pub name: String,
    pub r#type: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateMessageRequest {
    pub content: String,
}

#[derive(FromRow)]
pub struct MemberRow {
    pub user_id: Uuid,
    pub username: Option<String>,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateRoleRequest {
    pub role: String,
}

#[derive(Deserialize)]
pub struct BanRequest {
    // Durée du ban en minutes. None ou absent = ban permanent
    pub duration_minutes: Option<i64>,
}