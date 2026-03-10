use sqlx::PgPool;
use uuid::Uuid;

use crate::models::UserResponse;
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

    // Ajoute un ami (verifie qu'on ne s'ajoute pas soi-meme et que l'utilisateur existe)
    pub async fn add_friend(
        pool: &PgPool,
        user_id: Uuid,
        friend_id: Uuid,
    ) -> Result<UserResponse, ServiceError> {
        if friend_id == user_id {
            return Err(ServiceError::BadRequest(
                "Impossible de s'ajouter soi-meme.".to_string(),
            ));
        }

        let friend = UserRepository::find_by_id(pool, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?
            .ok_or(ServiceError::NotFound("Utilisateur introuvable".to_string()))?;

        FriendRepository::add(pool, user_id, friend_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

        Ok(friend.into())
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
