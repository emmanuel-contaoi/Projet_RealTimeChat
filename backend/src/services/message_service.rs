use chrono::Utc;
use mongodb::Client;
use mongodb::bson::oid::ObjectId;
use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::Message;
use crate::repositories::channel_repository::ChannelRepository;
use crate::repositories::message_repository::MessageRepository;
use crate::services::ServiceError;

pub struct MessageService;

impl MessageService {
    // Retourne l'historique des messages d'un channel (acces reserve aux membres)
    pub async fn get_history(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        channel_id: Uuid,
    ) -> Result<Vec<Message>, ServiceError> {
        let membership = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if membership.is_none() {
            return Err(ServiceError::Forbidden("Acces refuse.".to_string()));
        }

        MessageRepository::find_by_channel(mongo, &channel_id.to_string())
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))
    }

    // Envoie un message dans un channel (acces reserve aux membres)
    pub async fn send_message(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        channel_id: Uuid,
        username: String,
        content: String,
    ) -> Result<(), ServiceError> {
        let membership = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if membership.is_none() {
            return Err(ServiceError::Forbidden("Acces refuse.".to_string()));
        }

        let message = Message {
            id: None,
            channel_id: channel_id.to_string(),
            user_id: user_id.to_string(),
            content,
            username,
            created_at: Some(Utc::now().to_rfc3339()),
        };

        MessageRepository::insert(mongo, message)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))
    }

    // Modifie le contenu d'un message (auteur seulement), retourne le channel_id pour le broadcast WS
    pub async fn edit_message(
        mongo: &Client,
        user_id: Uuid,
        message_id: &str,
        content: String,
    ) -> Result<String, ServiceError> {
        let oid = ObjectId::parse_str(message_id)
            .map_err(|_| ServiceError::BadRequest("ID de message invalide.".to_string()))?;

        let message = MessageRepository::find_by_id(mongo, oid)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))?
            .ok_or(ServiceError::NotFound("Message introuvable.".to_string()))?;

        if message.user_id != user_id.to_string() {
            return Err(ServiceError::Forbidden(
                "Vous ne pouvez modifier que vos propres messages.".to_string(),
            ));
        }

        let channel_id = message.channel_id.clone();
        MessageRepository::update_content(mongo, oid, &content)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur modification: {}", e)))?;
        Ok(channel_id)
    }

    // Supprime un message (auteur ou owner/admin du serveur), retourne le channel_id pour le broadcast WS
    pub async fn delete_message(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        message_id: &str,
    ) -> Result<String, ServiceError> {
        let oid = ObjectId::parse_str(message_id)
            .map_err(|_| ServiceError::BadRequest("ID de message invalide.".to_string()))?;

        let message = MessageRepository::find_by_id(mongo, oid)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))?
            .ok_or(ServiceError::NotFound("Message introuvable.".to_string()))?;

        if message.user_id != user_id.to_string() {
            let role = ChannelRepository::get_member_role_by_channel_str(
                pool,
                &message.channel_id,
                user_id,
            )
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

            match role.as_deref() {
                Some("owner") | Some("admin") => {}
                _ => {
                    return Err(ServiceError::Forbidden(
                        "Vous ne pouvez pas supprimer ce message.".to_string(),
                    ))
                }
            }
        }

        let channel_id = message.channel_id.clone();
        MessageRepository::delete(mongo, oid)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur suppression: {}", e)))?;
        Ok(channel_id)
    }
}
