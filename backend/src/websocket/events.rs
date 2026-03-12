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