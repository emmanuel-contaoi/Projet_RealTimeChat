use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{FriendRequestResponse, UserResponse};
use crate::repositories::friend_repository::FriendRepository;
use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;

pub struct FriendService;

impl FriendService {
    // Retourne la liste des amis de l'utilisateur
    pub async fn list_friends(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<UserResponse>, ServiceError> {
        FriendRepository::list(pool, user_id)
            .await
            .map(|users| users.into_iter().map(UserResponse::from).collect())
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))
    }

    // Envoie une demande d'ami
    pub async fn send_friend_request(
        pool: &PgPool,
        user_id: Uuid,
        friend_id: Uuid,
    ) -> Result<(), ServiceError> {
        if friend_id == user_id {
            return Err(ServiceError::BadRequest(
                "Impossible de s'envoyer une demande a soi-meme.".to_string(),
            ));
        }

        UserRepository::find_by_id(pool, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound(
                "Utilisateur introuvable".to_string(),
            ))?;

        if FriendRepository::are_friends(pool, user_id, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
        {
            return Err(ServiceError::Conflict("Vous etes deja amis.".to_string()));
        }

        if let Some(existing) = FriendRepository::find_pending_between(pool, user_id, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
        {
            if existing.sender_id == user_id {
                return Err(ServiceError::Conflict("Demande deja envoyee.".to_string()));
            }
            return Err(ServiceError::Conflict(
                "Cette personne vous a deja envoye une demande.".to_string(),
            ));
        }

        FriendRepository::create_request(pool, user_id, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        Ok(())
    }

    // Retourne les demandes recues en attente
    pub async fn list_incoming_requests(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<FriendRequestResponse>, ServiceError> {
        FriendRepository::list_incoming_requests(pool, user_id)
            .await
            .map(|rows| {
                rows.into_iter()
                    .map(FriendRequestResponse::from_list_item)
                    .collect()
            })
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))
    }

    // Retourne les demandes envoyees en attente
    pub async fn list_outgoing_requests(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<FriendRequestResponse>, ServiceError> {
        FriendRepository::list_outgoing_requests(pool, user_id)
            .await
            .map(|rows| {
                rows.into_iter()
                    .map(FriendRequestResponse::from_list_item)
                    .collect()
            })
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))
    }

    // Accepte une demande d'ami recue
    pub async fn accept_request(
        pool: &PgPool,
        user_id: Uuid,
        request_id: Uuid,
    ) -> Result<(), ServiceError> {
        let request = FriendRepository::find_request_by_id(pool, request_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound("Demande introuvable.".to_string()))?;

        if request.receiver_id != user_id {
            return Err(ServiceError::Forbidden(
                "Vous ne pouvez pas accepter cette demande.".to_string(),
            ));
        }
        if request.status != "pending" {
            return Err(ServiceError::Conflict(
                "Cette demande n'est plus en attente.".to_string(),
            ));
        }

        FriendRepository::update_request_status(pool, request_id, "accepted")
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        FriendRepository::add(pool, request.sender_id, request.receiver_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;
        FriendRepository::add(pool, request.receiver_id, request.sender_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        Ok(())
    }

    // Refuse une demande d'ami recue
    pub async fn reject_request(
        pool: &PgPool,
        user_id: Uuid,
        request_id: Uuid,
    ) -> Result<(), ServiceError> {
        let request = FriendRepository::find_request_by_id(pool, request_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound("Demande introuvable.".to_string()))?;

        if request.receiver_id != user_id {
            return Err(ServiceError::Forbidden(
                "Vous ne pouvez pas refuser cette demande.".to_string(),
            ));
        }
        if request.status != "pending" {
            return Err(ServiceError::Conflict(
                "Cette demande n'est plus en attente.".to_string(),
            ));
        }

        FriendRepository::update_request_status(pool, request_id, "rejected")
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        Ok(())
    }

    // Annule une demande envoyee
    pub async fn cancel_request(
        pool: &PgPool,
        user_id: Uuid,
        request_id: Uuid,
    ) -> Result<(), ServiceError> {
        let deleted = FriendRepository::delete_pending_request_by_sender(pool, request_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        if deleted == 0 {
            return Err(ServiceError::NotFound(
                "Demande introuvable ou deja traitee.".to_string(),
            ));
        }

        Ok(())
    }

    // Supprime un ami de la liste
    pub async fn remove_friend(
        pool: &PgPool,
        user_id: Uuid,
        friend_id: Uuid,
    ) -> Result<(), ServiceError> {
        FriendRepository::remove(pool, user_id, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))
    }
}
