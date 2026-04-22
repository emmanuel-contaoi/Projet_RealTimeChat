use chrono::NaiveDateTime;
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize, Serializer};
use sqlx::FromRow;
use uuid::Uuid;

fn serialize_object_id_as_hex<S: Serializer>(
    id: &Option<ObjectId>,
    s: S,
) -> Result<S::Ok, S::Error> {
    match id {
        Some(oid) => s.serialize_str(&oid.to_hex()),
        None => s.serialize_none(),
    }
}

#[derive(Serialize, FromRow, utoipa::ToSchema)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub invite_code: String,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct CreateServerRequest {
    pub name: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct UpdateServerRequest {
    pub name: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct TransferOwnershipRequest {
    pub new_owner_id: Uuid,
}

#[derive(Serialize, FromRow, utoipa::ToSchema)]
pub struct Channel {
    pub id: Uuid,
    pub server_id: Uuid,
    pub name: String,
    pub r#type: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct CreateChannelRequest {
    pub name: String,
    pub r#type: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct JoinServerRequest {
    pub invite_code: String,
}

#[derive(Serialize, Deserialize, Debug, utoipa::ToSchema)]
pub struct Message {
    #[serde(
        rename(serialize = "id", deserialize = "_id"),
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_object_id_as_hex"
    )]
    #[schema(value_type = Option<String>)]
    pub id: Option<ObjectId>,
    pub channel_id: String,
    pub user_id: String,
    pub content: String,
    pub username: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub reactions: Vec<MessageReaction>,
}

#[derive(Serialize, Deserialize, Debug, Clone, utoipa::ToSchema)]
pub struct MessageReaction {
    pub emoji: String,
    #[serde(default)]
    pub user_ids: Vec<String>,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct UpdateChannelRequest {
    pub name: String,
    pub r#type: Option<String>,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct CreateMessageRequest {
    pub content: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct ReactMessageRequest {
    pub emoji: String,
}

#[derive(FromRow, utoipa::ToSchema)]
pub struct MemberRow {
    pub user_id: Uuid,
    pub username: Option<String>,
    pub role: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct UpdateRoleRequest {
    pub role: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct BanRequest {
    pub duration_minutes: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    #[test]
    fn message_serializes_object_id_as_hex_string() {
        let object_id = ObjectId::new();
        let message = Message {
            id: Some(object_id),
            channel_id: "channel-1".to_string(),
            user_id: "user-1".to_string(),
            content: "hello".to_string(),
            username: "alice".to_string(),
            created_at: Some("2026-03-16T10:00:00Z".to_string()),
            reactions: vec![],
        };

        let value = serde_json::to_value(message).expect("message should serialize");

        assert_eq!(value["id"], Value::String(object_id.to_hex()));
        assert_eq!(value["channel_id"], json!("channel-1"));
        assert_eq!(value["content"], json!("hello"));
    }

    #[test]
    fn message_serialization_omits_id_when_missing() {
        let message = Message {
            id: None,
            channel_id: "channel-1".to_string(),
            user_id: "user-1".to_string(),
            content: "hello".to_string(),
            username: "alice".to_string(),
            created_at: None,
            reactions: vec![],
        };

        let value = serde_json::to_value(message).expect("message should serialize");

        assert!(value.get("id").is_none());
    }

    #[test]
    fn message_deserializes_mongo_id_and_defaults_missing_fields() {
        let object_id = ObjectId::new();
        let payload = json!({
            "_id": object_id.to_hex(),
            "channel_id": "channel-1",
            "user_id": "user-1",
            "content": "hello",
            "username": "alice"
        });

        let message: Message =
            serde_json::from_value(payload).expect("message should deserialize from mongo shape");

        assert_eq!(message.id, Some(object_id));
        assert_eq!(message.channel_id, "channel-1");
        assert_eq!(message.user_id, "user-1");
        assert_eq!(message.content, "hello");
        assert_eq!(message.username, "alice");
        assert_eq!(message.created_at, None);
        assert!(message.reactions.is_empty());
    }

    #[test]
    fn message_reaction_defaults_user_ids_when_missing() {
        let reaction: MessageReaction = serde_json::from_value(json!({
            "emoji": "🔥"
        }))
        .expect("reaction should deserialize");

        assert_eq!(reaction.emoji, "🔥");
        assert!(reaction.user_ids.is_empty());
    }
}
