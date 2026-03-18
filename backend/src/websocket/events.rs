use crate::modules::servers::models::MessageReaction;
use serde::{Deserialize, Serialize};

// Les événements que le client envoie au serveur
// tag = "type" : le JSON aura un champ "type" pour identifier l'événement
// rename_all = "snake_case" : HelloWorld devient "hello_world" en JSON
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientEvent {
    MessageSend {
        channel_id: String,
        content: String,
    },
    TypingStart {
        channel_id: String,
    },
    TypingStop {
        #[allow(dead_code)]
        channel_id: String,
    },
    JoinChannel {
        channel_id: String,
    },
    LeaveChannel {
        channel_id: String,
    },
}

// les événements que le serveur envoie au client
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerEvent {
    MessageNew {
        id: String,
        channel_id: String,
        user_id: String,
        username: String,
        content: String,
        created_at: String,
        reactions: Vec<MessageReaction>,
    },
    UserTyping {
        channel_id: String,
        user_id: String,
        username: String,
    },
    UserConnected {
        user_id: String,
        username: String,
    },
    UserDisconnected {
        user_id: String,
    },
    ChannelUsers {
        channel_id: String,
        users: Vec<ChannelUser>,
    },
    Error {
        message: String,
    },
    ServerDeleted {
        server_id: String,
    },
    ChannelCreated {
        channel_id: String,
        server_id: String,
        name: String,
        channel_type: String,
    },
    ChannelDeleted {
        channel_id: String,
        server_id: String,
    },
    MessageEdited {
        message_id: String,
        channel_id: String,
        content: String,
    },
    MessageDeleted {
        message_id: String,
        channel_id: String,
    },
    MessageReactionUpdated {
        message_id: String,
        channel_id: String,
        reactions: Vec<MessageReaction>,
    },
    MemberRoleUpdated {
        user_id: String,
        server_id: String,
        role: String,
    },
    MemberLeft {
        user_id: String,
        server_id: String,
    },
    MemberKicked {
        user_id: String,
        server_id: String,
    },
    MemberBanned {
        user_id: String,
        server_id: String,
        // "permanent" ou la date d'expiration ISO8601
        expires_at: Option<String>,
    },
    MemberJoined {
        user_id: String,
        server_id: String,
        username: String,
        role: String,
    },
    ChannelUpdated {
        channel_id: String,
        server_id: String,
        name: String,
        channel_type: String,
    },
    ServerUpdated {
        server_id: String,
        name: String,
    },
}

#[derive(Debug, Serialize)]
pub struct ChannelUser {
    pub user_id: String,
    pub username: String,
}

impl ServerEvent {
    // Convertit l'événement en JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::servers::models::MessageReaction;
    use serde_json::Value;

    #[test]
    fn client_event_deserializes_from_snake_case_json() {
        let payload = r#"{"type":"message_send","channel_id":"channel-1","content":"hello"}"#;

        let event: ClientEvent =
            serde_json::from_str(payload).expect("client event should deserialize");

        match event {
            ClientEvent::MessageSend {
                channel_id,
                content,
            } => {
                assert_eq!(channel_id, "channel-1");
                assert_eq!(content, "hello");
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn server_event_serializes_type_and_payload() {
        let event = ServerEvent::MessageReactionUpdated {
            message_id: "message-1".to_string(),
            channel_id: "channel-1".to_string(),
            reactions: vec![MessageReaction {
                emoji: ":fire:".to_string(),
                user_ids: vec!["user-1".to_string()],
            }],
        };

        let json = event.to_json().expect("server event should serialize");

        assert!(json.contains(r#""type":"message_reaction_updated""#));
        assert!(json.contains(r#""message_id":"message-1""#));
        assert!(json.contains(r#""emoji":":fire:""#));
    }

    #[test]
    fn client_event_typing_stop_deserializes_from_json() {
        let payload = r#"{"type":"typing_stop","channel_id":"channel-1"}"#;

        let event: ClientEvent =
            serde_json::from_str(payload).expect("typing stop event should deserialize");

        match event {
            ClientEvent::TypingStop { channel_id } => assert_eq!(channel_id, "channel-1"),
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[test]
    fn server_event_channel_users_serializes_nested_users() {
        let event = ServerEvent::ChannelUsers {
            channel_id: "channel-1".to_string(),
            users: vec![
                ChannelUser {
                    user_id: "user-1".to_string(),
                    username: "alice".to_string(),
                },
                ChannelUser {
                    user_id: "user-2".to_string(),
                    username: "bob".to_string(),
                },
            ],
        };

        let json = event
            .to_json()
            .expect("channel users event should serialize");
        let payload: Value = serde_json::from_str(&json).expect("serialized json should parse");

        assert_eq!(payload["type"], "channel_users");
        assert_eq!(payload["channel_id"], "channel-1");
        assert_eq!(payload["users"][0]["user_id"], "user-1");
        assert_eq!(payload["users"][1]["username"], "bob");
    }

    #[test]
    fn server_event_member_banned_serializes_null_expiration_when_permanent() {
        let event = ServerEvent::MemberBanned {
            user_id: "user-1".to_string(),
            server_id: "server-1".to_string(),
            expires_at: None,
        };

        let json = event
            .to_json()
            .expect("member banned event should serialize");
        let payload: Value = serde_json::from_str(&json).expect("serialized json should parse");

        assert_eq!(payload["type"], "member_banned");
        assert_eq!(payload["user_id"], "user-1");
        assert_eq!(payload["server_id"], "server-1");
        assert_eq!(payload["expires_at"], Value::Null);
    }
}
