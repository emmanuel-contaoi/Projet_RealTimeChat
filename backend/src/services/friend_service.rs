use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{FriendRequestResponse, UserResponse};
use crate::repositories::friend_repository::FriendRepository;
use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;

pub struct FriendService;

fn ensure_not_self_friend_request(user_id: Uuid, friend_id: Uuid) -> Result<(), ServiceError> {
    if friend_id == user_id {
        Err(ServiceError::BadRequest(
            "Impossible de s'envoyer une demande a soi-meme.".to_string(),
        ))
    } else {
        Ok(())
    }
}

fn validate_incoming_request_action(
    request_receiver_id: Uuid,
    current_user_id: Uuid,
    status: &str,
    action: &str,
) -> Result<(), ServiceError> {
    if request_receiver_id != current_user_id {
        return Err(ServiceError::Forbidden(format!(
            "Vous ne pouvez pas {} cette demande.",
            action
        )));
    }

    if status != "pending" {
        return Err(ServiceError::Conflict(
            "Cette demande n'est plus en attente.".to_string(),
        ));
    }

    Ok(())
}

fn ensure_pending_request_deleted(deleted: u64) -> Result<(), ServiceError> {
    if deleted == 0 {
        Err(ServiceError::NotFound(
            "Demande introuvable ou deja traitee.".to_string(),
        ))
    } else {
        Ok(())
    }
}

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
        ensure_not_self_friend_request(user_id, friend_id)?;

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

    // Accepte une demande d'ami recue — retourne l'ID de l'expediteur pour la notification WS
    pub async fn accept_request(
        pool: &PgPool,
        user_id: Uuid,
        request_id: Uuid,
    ) -> Result<Uuid, ServiceError> {
        let request = FriendRepository::find_request_by_id(pool, request_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound("Demande introuvable.".to_string()))?;

        validate_incoming_request_action(
            request.receiver_id,
            user_id,
            &request.status,
            "accepter",
        )?;

        FriendRepository::update_request_status(pool, request_id, "accepted")
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        FriendRepository::add(pool, request.sender_id, request.receiver_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;
        FriendRepository::add(pool, request.receiver_id, request.sender_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        Ok(request.sender_id)
    }

    // Refuse une demande d'ami recue — retourne l'ID de l'expediteur pour la notification WS
    pub async fn reject_request(
        pool: &PgPool,
        user_id: Uuid,
        request_id: Uuid,
    ) -> Result<Uuid, ServiceError> {
        let request = FriendRepository::find_request_by_id(pool, request_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound("Demande introuvable.".to_string()))?;

        validate_incoming_request_action(request.receiver_id, user_id, &request.status, "refuser")?;

        FriendRepository::update_request_status(pool, request_id, "rejected")
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        Ok(request.sender_id)
    }

    // Annule une demande envoyee — retourne l'ID du destinataire pour la notification WS
    pub async fn cancel_request(
        pool: &PgPool,
        user_id: Uuid,
        request_id: Uuid,
    ) -> Result<Uuid, ServiceError> {
        let request = FriendRepository::find_request_by_id(pool, request_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound(
                "Demande introuvable ou deja traitee.".to_string(),
            ))?;

        let deleted = FriendRepository::delete_pending_request_by_sender(pool, request_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        ensure_pending_request_deleted(deleted)?;

        Ok(request.receiver_id)
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

    #[test]
    fn ensure_not_self_friend_request_rejects_same_user() {
        let user_id = Uuid::new_v4();

        match ensure_not_self_friend_request(user_id, user_id) {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "Impossible de s'envoyer une demande a soi-meme.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_not_self_friend_request_allows_different_users() {
        assert!(ensure_not_self_friend_request(Uuid::new_v4(), Uuid::new_v4()).is_ok());
    }

    #[test]
    fn validate_incoming_request_action_rejects_wrong_receiver() {
        let current_user_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();

        match validate_incoming_request_action(
            other_user_id,
            current_user_id,
            "pending",
            "accepter",
        ) {
            Err(ServiceError::Forbidden(message)) => {
                assert_eq!(message, "Vous ne pouvez pas accepter cette demande.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn validate_incoming_request_action_rejects_non_pending_requests() {
        let user_id = Uuid::new_v4();

        match validate_incoming_request_action(user_id, user_id, "accepted", "refuser") {
            Err(ServiceError::Conflict(message)) => {
                assert_eq!(message, "Cette demande n'est plus en attente.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn validate_incoming_request_action_allows_pending_request_for_receiver() {
        let user_id = Uuid::new_v4();

        assert!(validate_incoming_request_action(user_id, user_id, "pending", "accepter").is_ok());
        assert!(validate_incoming_request_action(user_id, user_id, "pending", "refuser").is_ok());
    }

    #[test]
    fn ensure_pending_request_deleted_requires_affected_row() {
        match ensure_pending_request_deleted(0) {
            Err(ServiceError::NotFound(message)) => {
                assert_eq!(message, "Demande introuvable ou deja traitee.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        assert!(ensure_pending_request_deleted(1).is_ok());
    }

    #[tokio::test]
    async fn send_friend_request_rejects_self_requests_before_db_access() {
        let pool = crate::utils::test_pg_pool();
        let user_id = Uuid::new_v4();

        let result = FriendService::send_friend_request(&pool, user_id, user_id).await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "Impossible de s'envoyer une demande a soi-meme.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn friend_service_methods_return_internal_errors_when_database_is_unavailable() {
        let pool = crate::utils::test_pg_pool();
        let user_id = Uuid::new_v4();
        let friend_id = Uuid::new_v4();
        let request_id = Uuid::new_v4();

        let list_result = FriendService::list_friends(&pool, user_id).await;
        assert_internal_error(list_result, "Database error:");

        let send_result = FriendService::send_friend_request(&pool, user_id, friend_id).await;
        assert_internal_error(send_result, "Database error:");

        let incoming_result = FriendService::list_incoming_requests(&pool, user_id).await;
        assert_internal_error(incoming_result, "Database error:");

        let outgoing_result = FriendService::list_outgoing_requests(&pool, user_id).await;
        assert_internal_error(outgoing_result, "Database error:");

        let accept_result = FriendService::accept_request(&pool, user_id, request_id).await;
        assert_internal_error(accept_result, "Database error:");

        let reject_result = FriendService::reject_request(&pool, user_id, request_id).await;
        assert_internal_error(reject_result, "Database error:");

        let cancel_result = FriendService::cancel_request(&pool, user_id, request_id).await;
        assert_internal_error(cancel_result, "Database error:");

        let remove_result = FriendService::remove_friend(&pool, user_id, friend_id).await;
        assert_internal_error(remove_result, "Database error:");
    }
}
