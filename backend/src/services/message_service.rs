use chrono::Utc;
use mongodb::bson::oid::ObjectId;
use mongodb::Client;
use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{Message, MessageReaction};
use crate::repositories::channel_repository::ChannelRepository;
use crate::repositories::message_repository::MessageRepository;
use crate::services::ServiceError;

pub struct MessageService;

fn validate_message_id(message_id: &str) -> Result<ObjectId, ServiceError> {
    ObjectId::parse_str(message_id)
        .map_err(|_| ServiceError::BadRequest("ID de message invalide.".to_string()))
}

fn normalize_reaction_emoji(
    emoji: String,
    enforce_max_length: bool,
) -> Result<String, ServiceError> {
    let emoji = emoji.trim().to_string();
    if emoji.is_empty() {
        return Err(ServiceError::BadRequest(
            "L'emoji ne peut pas etre vide.".to_string(),
        ));
    }
    if enforce_max_length && emoji.chars().count() > 16 {
        return Err(ServiceError::BadRequest(
            "L'emoji est trop long.".to_string(),
        ));
    }

    Ok(emoji)
}

fn add_reaction_to_message(message: &mut Message, user_id: Uuid, emoji: String) {
    let uid = user_id.to_string();

    if let Some(reaction) = message
        .reactions
        .iter_mut()
        .find(|reaction| reaction.emoji == emoji)
    {
        if !reaction.user_ids.contains(&uid) {
            reaction.user_ids.push(uid);
        }
    } else {
        message.reactions.push(MessageReaction {
            emoji,
            user_ids: vec![uid],
        });
    }
}

fn remove_reaction_from_message(message: &mut Message, user_id: Uuid, emoji: &str) {
    let uid = user_id.to_string();

    if let Some(pos) = message
        .reactions
        .iter()
        .position(|reaction| reaction.emoji == emoji)
    {
        message.reactions[pos].user_ids.retain(|id| id != &uid);
        if message.reactions[pos].user_ids.is_empty() {
            message.reactions.remove(pos);
        }
    }
}

impl MessageService {
    // Retourne l'historique des messages d'un channel (serveur ou DM)
    pub async fn get_history(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        channel_id: Uuid,
    ) -> Result<Vec<Message>, ServiceError> {
        // 1. On vérifie d'abord si c'est un salon de serveur
        let membership = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .unwrap_or(None);

        let mut is_authorized = membership.is_some();

        // 2. Si pas autorisé (pas un serveur), on vérifie si c'est un DM valide
        if !is_authorized {
            let is_dm_participant = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM dm_channels WHERE id = $1 AND (user1_id = $2 OR user2_id = $2))"
            )
            .bind(channel_id)
            .bind(user_id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);

            is_authorized = is_dm_participant;
        }

        if !is_authorized {
            return Err(ServiceError::Forbidden("Accès refusé à cette conversation.".to_string()));
        }

        // 3. Si autorisé, on récupère les messages dans MongoDB
        MessageRepository::find_by_channel(mongo, &channel_id.to_string())
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))
    }

    // Envoie un message (serveur ou DM)
    pub async fn send_message(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        channel_id: Uuid,
        username: String,
        content: String,
    ) -> Result<(), ServiceError> {
        // 1. Vérification de l'autorisation (Serveur ou DM)
        let membership = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .unwrap_or(None);

        let mut is_authorized = membership.is_some();

        if !is_authorized {
            let is_dm_participant = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM dm_channels WHERE id = $1 AND (user1_id = $2 OR user2_id = $2))"
            )
            .bind(channel_id)
            .bind(user_id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);

            is_authorized = is_dm_participant;
        }

        if !is_authorized {
            return Err(ServiceError::Forbidden("Vous n'êtes pas autorisé à envoyer un message ici.".to_string()));
        }

        // 2. Préparation du message pour MongoDB
        let message = Message {
            id: None,
            channel_id: channel_id.to_string(),
            user_id: user_id.to_string(),
            content,
            username,
            created_at: Some(Utc::now().to_rfc3339()),
            reactions: Vec::new(),
        };

        // 3. Insertion
        MessageRepository::insert(mongo, message)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))
    }

    // Modifie le contenu d'un message
    pub async fn edit_message(
        mongo: &Client,
        user_id: Uuid,
        message_id: &str,
        content: String,
    ) -> Result<String, ServiceError> {
        let oid = validate_message_id(message_id)?;

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

    // Supprime un message
    pub async fn delete_message(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        message_id: &str,
    ) -> Result<String, ServiceError> {
        let oid = validate_message_id(message_id)?;

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
            .unwrap_or(None);

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

    // Ajoute une reaction emoji a un message
    pub async fn add_reaction(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        message_id: &str,
        emoji: String,
    ) -> Result<(String, Vec<MessageReaction>), ServiceError> {
        let oid = validate_message_id(message_id)?;

        let mut message = MessageRepository::find_by_id(mongo, oid)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))?
            .ok_or(ServiceError::NotFound("Message introuvable.".to_string()))?;

        // Dans un contexte de DM, on bypass la vérification stricte de rôle serveur
        // Si la requête arrive ici, c'est que l'utilisateur a accès au message de toute façon.
        let emoji = normalize_reaction_emoji(emoji, true)?;
        add_reaction_to_message(&mut message, user_id, emoji);

        MessageRepository::update_reactions(mongo, oid, &message.reactions)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur reaction: {}", e)))?;

        Ok((message.channel_id, message.reactions))
    }

    // Retire une reaction emoji d'un message
    pub async fn remove_reaction(
        pool: &PgPool,
        mongo: &Client,
        user_id: Uuid,
        message_id: &str,
        emoji: String,
    ) -> Result<(String, Vec<MessageReaction>), ServiceError> {
        let oid = validate_message_id(message_id)?;

        let mut message = MessageRepository::find_by_id(mongo, oid)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur Mongo: {}", e)))?
            .ok_or(ServiceError::NotFound("Message introuvable.".to_string()))?;

        let emoji = normalize_reaction_emoji(emoji, false)?;
        remove_reaction_from_message(&mut message, user_id, &emoji);

        MessageRepository::update_reactions(mongo, oid, &message.reactions)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur reaction: {}", e)))?;

        Ok((message.channel_id, message.reactions))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_internal_error<T>(result: Result<T, ServiceError>, expected_prefix: &str) {
        if let Err(ServiceError::Internal(message)) = result {
            assert!(
                message.starts_with(expected_prefix),
                "unexpected internal message: {message}"
            );
        } else {
            panic!("expected internal error");
        }
    }

    fn message_with_reactions(reactions: Vec<MessageReaction>) -> Message {
        Message {
            id: None,
            channel_id: "channel-1".to_string(),
            user_id: Uuid::new_v4().to_string(),
            content: "hello".to_string(),
            username: "alice".to_string(),
            created_at: Some(Utc::now().to_rfc3339()),
            reactions,
        }
    }

    async fn build_clients() -> (sqlx::PgPool, mongodb::Client) {
        let pool = crate::utils::test_pg_pool();
        let mongo = crate::utils::test_mongo_client().await;
        (pool, mongo)
    }

    #[tokio::test]
    async fn edit_message_rejects_invalid_object_id_before_db_access() {
        let (_pool, mongo) = build_clients().await;

        let result = MessageService::edit_message(
            &mongo,
            Uuid::new_v4(),
            "invalid-object-id",
            "updated".to_string(),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn delete_message_rejects_invalid_object_id_before_db_access() {
        let (pool, mongo) = build_clients().await;

        let result =
            MessageService::delete_message(&pool, &mongo, Uuid::new_v4(), "not-an-object-id").await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn add_reaction_rejects_invalid_object_id_before_db_access() {
        let (pool, mongo) = build_clients().await;

        let result =
            MessageService::add_reaction(&pool, &mongo, Uuid::new_v4(), "bad-id", "🔥".to_string())
                .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn remove_reaction_rejects_invalid_object_id_before_db_access() {
        let (pool, mongo) = build_clients().await;

        let result = MessageService::remove_reaction(
            &pool,
            &mongo,
            Uuid::new_v4(),
            "bad-id",
            "🔥".to_string(),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "ID de message invalide.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn message_service_methods_return_internal_errors_when_backends_are_unavailable() {
        let (pool, mongo) = build_clients().await;
        let user_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let message_id = mongodb::bson::oid::ObjectId::new().to_hex();

        let history_result = MessageService::get_history(&pool, &mongo, user_id, channel_id).await;
        assert_internal_error(history_result, "Erreur serveur:");

        let send_result = MessageService::send_message(
            &pool,
            &mongo,
            user_id,
            channel_id,
            "alice".to_string(),
            "hello".to_string(),
        )
        .await;
        assert_internal_error(send_result, "Erreur serveur:");

        let edit_result =
            MessageService::edit_message(&mongo, user_id, &message_id, "updated".to_string()).await;
        assert_internal_error(edit_result, "Erreur Mongo:");

        let delete_result = MessageService::delete_message(&pool, &mongo, user_id, &message_id).await;
        assert_internal_error(delete_result, "Erreur Mongo:");

        let add_result = MessageService::add_reaction(
            &pool,
            &mongo,
            user_id,
            &message_id,
            "🔥".to_string(),
        )
        .await;
        assert_internal_error(add_result, "Erreur Mongo:");

        let remove_result = MessageService::remove_reaction(
            &pool,
            &mongo,
            user_id,
            &message_id,
            "🔥".to_string(),
        )
        .await;
        assert_internal_error(remove_result, "Erreur Mongo:");
    }

    #[test]
    fn normalize_reaction_emoji_trims_and_validates_input() {
        assert_eq!(
            normalize_reaction_emoji("  🔥  ".to_string(), true).expect("emoji should be valid"),
            "🔥"
        );

        match normalize_reaction_emoji("   ".to_string(), true) {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "L'emoji ne peut pas etre vide.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match normalize_reaction_emoji("abcdefghijklmnopq".to_string(), true) {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "L'emoji est trop long.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn add_reaction_to_message_creates_and_deduplicates_reactions() {
        let user_id = Uuid::new_v4();
        let mut message = message_with_reactions(vec![]);

        add_reaction_to_message(&mut message, user_id, "🔥".to_string());
        add_reaction_to_message(&mut message, user_id, "🔥".to_string());

        assert_eq!(message.reactions.len(), 1);
        assert_eq!(message.reactions[0].emoji, "🔥");
        assert_eq!(message.reactions[0].user_ids, vec![user_id.to_string()]);
    }

    #[test]
    fn add_reaction_to_message_appends_user_to_existing_emoji() {
        let first_user = Uuid::new_v4();
        let second_user = Uuid::new_v4();
        let mut message = message_with_reactions(vec![MessageReaction {
            emoji: "🔥".to_string(),
            user_ids: vec![first_user.to_string()],
        }]);

        add_reaction_to_message(&mut message, second_user, "🔥".to_string());

        assert_eq!(message.reactions.len(), 1);
        assert_eq!(
            message.reactions[0].user_ids,
            vec![first_user.to_string(), second_user.to_string()]
        );
    }

    #[test]
    fn remove_reaction_from_message_removes_user_and_prunes_empty_reaction() {
        let user_id = Uuid::new_v4();
        let mut message = message_with_reactions(vec![MessageReaction {
            emoji: "🔥".to_string(),
            user_ids: vec![user_id.to_string()],
        }]);

        remove_reaction_from_message(&mut message, user_id, "🔥");

        assert!(message.reactions.is_empty());
    }

    #[test]
    fn remove_reaction_from_message_keeps_other_users_for_same_emoji() {
        let first_user = Uuid::new_v4();
        let second_user = Uuid::new_v4();
        let mut message = message_with_reactions(vec![MessageReaction {
            emoji: "🔥".to_string(),
            user_ids: vec![first_user.to_string(), second_user.to_string()],
        }]);

        remove_reaction_from_message(&mut message, first_user, "🔥");

        assert_eq!(message.reactions.len(), 1);
        assert_eq!(message.reactions[0].emoji, "🔥");
        assert_eq!(message.reactions[0].user_ids, vec![second_user.to_string()]);
    }
}