use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Client,
};

use crate::modules::servers::models::Message;

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
        let mut cursor = Self::collection(mongo).find(filter, None).await?;
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
        Self::collection(mongo)
            .find_one(doc! { "_id": oid }, None)
            .await
    }

    // Insere un nouveau message dans MongoDB
    pub async fn insert(mongo: &Client, message: Message) -> mongodb::error::Result<()> {
        Self::collection(mongo)
            .insert_one(message, None)
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
            .update_one(
                doc! { "_id": oid },
                doc! { "$set": { "content": content } },
                None,
            )
            .await
            .map(|_| ())
    }

    // Supprime un message par son ObjectId
    pub async fn delete(mongo: &Client, oid: ObjectId) -> mongodb::error::Result<()> {
        Self::collection(mongo)
            .delete_one(doc! { "_id": oid }, None)
            .await
            .map(|_| ())
    }
}
