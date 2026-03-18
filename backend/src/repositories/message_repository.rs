use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Client,
};

use crate::modules::servers::models::{Message, MessageReaction};

pub struct MessageRepository;

impl MessageRepository {
    // Retourne la collection MongoDB "messages" de la base "chat"
    fn collection(mongo: &Client) -> mongodb::Collection<Message> {
        mongo.database("chat").collection::<Message>("messages")
    }

    // Retourne tous les messages d'un channel
    pub async fn find_by_channel(
        mongo: &Client,
        channel_id: &str,
    ) -> mongodb::error::Result<Vec<Message>> {
        let filter = doc! { "channel_id": channel_id };
        let mut cursor = Self::collection(mongo).find(filter).await?;
        let mut messages = Vec::new();
        while let Some(msg) = cursor.try_next().await? {
            messages.push(msg);
        }
        Ok(messages)
    }

    // Cherche un message par son ObjectId MongoDB
    pub async fn find_by_id(
        mongo: &Client,
        oid: ObjectId,
    ) -> mongodb::error::Result<Option<Message>> {
        Self::collection(mongo).find_one(doc! { "_id": oid }).await
    }

    // Insere un nouveau message dans MongoDB
    pub async fn insert(mongo: &Client, message: Message) -> mongodb::error::Result<()> {
        Self::collection(mongo)
            .insert_one(message)
            .await
            .map(|_| ())
    }

    // Met a jour le contenu d'un message existant
    pub async fn update_content(
        mongo: &Client,
        oid: ObjectId,
        content: &str,
    ) -> mongodb::error::Result<()> {
        Self::collection(mongo)
            .update_one(doc! { "_id": oid }, doc! { "$set": { "content": content } })
            .await
            .map(|_| ())
    }

    // Met a jour l'ensemble des reactions d'un message
    pub async fn update_reactions(
        mongo: &Client,
        oid: ObjectId,
        reactions: &[MessageReaction],
    ) -> mongodb::error::Result<()> {
        let reactions_bson =
            mongodb::bson::to_bson(reactions).expect("Message reactions should serialize");

        Self::collection(mongo)
            .update_one(
                doc! { "_id": oid },
                doc! { "$set": { "reactions": reactions_bson } },
            )
            .await
            .map(|_| ())
    }

    // Supprime un message par son ObjectId
    pub async fn delete(mongo: &Client, oid: ObjectId) -> mongodb::error::Result<()> {
        Self::collection(mongo)
            .delete_one(doc! { "_id": oid })
            .await
            .map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    async fn build_mongo_client() -> Client {
        Client::with_uri_str("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=50")
            .await
            .expect("mongo client should be created")
    }

    #[tokio::test]
    async fn message_repository_operations_fail_fast_without_mongodb() {
        let mongo = build_mongo_client().await;
        let oid = ObjectId::new();

        assert!(MessageRepository::find_by_channel(&mongo, "channel-1")
            .await
            .is_err());
        assert!(MessageRepository::find_by_id(&mongo, oid).await.is_err());
        assert!(MessageRepository::insert(
            &mongo,
            Message {
                id: None,
                channel_id: "channel-1".to_string(),
                user_id: Uuid::new_v4().to_string(),
                username: "alice".to_string(),
                content: "hello".to_string(),
                created_at: None,
                reactions: Vec::new(),
            },
        )
        .await
        .is_err());
        assert!(MessageRepository::update_content(&mongo, ObjectId::new(), "updated")
            .await
            .is_err());
        assert!(MessageRepository::update_reactions(
            &mongo,
            ObjectId::new(),
            &[MessageReaction {
                emoji: "🔥".to_string(),
                user_ids: vec![Uuid::new_v4().to_string()],
            }],
        )
        .await
        .is_err());
        assert!(MessageRepository::delete(&mongo, ObjectId::new()).await.is_err());
    }
}
