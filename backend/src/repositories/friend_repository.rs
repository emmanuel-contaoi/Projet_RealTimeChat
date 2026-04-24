use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{FriendRequest, FriendRequestListItem, User};

pub struct FriendRepository;

impl FriendRepository {
    // Retourne la liste des amis d'un utilisateur
    pub async fn list(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Vec<User>> {
        sqlx::query_as::<_, User>(
            "SELECT u.* FROM users u
             INNER JOIN user_friends f ON f.friend_id = u.id
             WHERE f.user_id = $1
             ORDER BY u.created_at DESC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    // Ajoute un ami (sans doublon grace a ON CONFLICT DO NOTHING)
    pub async fn add(pool: &PgPool, user_id: Uuid, friend_id: Uuid) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT INTO user_friends (user_id, friend_id) VALUES ($1, $2)
             ON CONFLICT (user_id, friend_id) DO NOTHING",
        )
        .bind(user_id)
        .bind(friend_id)
        .execute(pool)
        .await
        .map(|_| ())
    }

    // Supprime un ami de la liste (dans les deux sens)
    pub async fn remove(pool: &PgPool, user_id: Uuid, friend_id: Uuid) -> sqlx::Result<()> {
        sqlx::query(
            "DELETE FROM user_friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)"
        )
        .bind(user_id)
        .bind(friend_id)
        .execute(pool)
        .await
        .map(|_| ())
    }

    // Verifie si deux utilisateurs sont deja amis
    pub async fn are_friends(pool: &PgPool, user_id: Uuid, friend_id: Uuid) -> sqlx::Result<bool> {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(
                SELECT 1 FROM user_friends
                WHERE user_id = $1 AND friend_id = $2
            )",
        )
        .bind(user_id)
        .bind(friend_id)
        .fetch_one(pool)
        .await
    }

    // Retourne la demande pending existante entre deux utilisateurs (peu importe le sens)
    pub async fn find_pending_between(
        pool: &PgPool,
        user_a: Uuid,
        user_b: Uuid,
    ) -> sqlx::Result<Option<FriendRequest>> {
        sqlx::query_as::<_, FriendRequest>(
            "SELECT *
             FROM friend_requests
             WHERE status = 'pending'
               AND (
                 (sender_id = $1 AND receiver_id = $2)
                 OR
                 (sender_id = $2 AND receiver_id = $1)
               )
             ORDER BY created_at DESC
             LIMIT 1",
        )
        .bind(user_a)
        .bind(user_b)
        .fetch_optional(pool)
        .await
    }

    // Cree une nouvelle demande d'ami
    pub async fn create_request(
        pool: &PgPool,
        sender_id: Uuid,
        receiver_id: Uuid,
    ) -> sqlx::Result<FriendRequest> {
        sqlx::query_as::<_, FriendRequest>(
            "INSERT INTO friend_requests (id, sender_id, receiver_id, status, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'pending', NOW())
             RETURNING *",
        )
        .bind(sender_id)
        .bind(receiver_id)
        .fetch_one(pool)
        .await
    }

    // Liste des demandes recues (pending), avec profil de l'expediteur
    pub async fn list_incoming_requests(
        pool: &PgPool,
        receiver_id: Uuid,
    ) -> sqlx::Result<Vec<FriendRequestListItem>> {
        sqlx::query_as::<_, FriendRequestListItem>(
            "SELECT
                fr.id AS request_id,
                fr.status,
                fr.created_at,
                fr.responded_at,
                u.id AS user_id,
                u.email AS user_email,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.username AS user_username,
                u.avatar_url AS user_avatar_url,
                u.created_at AS user_created_at
             FROM friend_requests fr
             INNER JOIN users u ON u.id = fr.sender_id
             WHERE fr.receiver_id = $1
               AND fr.status = 'pending'
             ORDER BY fr.created_at DESC",
        )
        .bind(receiver_id)
        .fetch_all(pool)
        .await
    }

    // Liste des demandes envoyees (pending), avec profil du destinataire
    pub async fn list_outgoing_requests(
        pool: &PgPool,
        sender_id: Uuid,
    ) -> sqlx::Result<Vec<FriendRequestListItem>> {
        sqlx::query_as::<_, FriendRequestListItem>(
            "SELECT
                fr.id AS request_id,
                fr.status,
                fr.created_at,
                fr.responded_at,
                u.id AS user_id,
                u.email AS user_email,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.username AS user_username,
                u.avatar_url AS user_avatar_url,
                u.created_at AS user_created_at
             FROM friend_requests fr
             INNER JOIN users u ON u.id = fr.receiver_id
             WHERE fr.sender_id = $1
               AND fr.status = 'pending'
             ORDER BY fr.created_at DESC",
        )
        .bind(sender_id)
        .fetch_all(pool)
        .await
    }

    // Trouve une demande par son ID
    pub async fn find_request_by_id(
        pool: &PgPool,
        request_id: Uuid,
    ) -> sqlx::Result<Option<FriendRequest>> {
        sqlx::query_as::<_, FriendRequest>("SELECT * FROM friend_requests WHERE id = $1")
            .bind(request_id)
            .fetch_optional(pool)
            .await
    }

    // Met a jour le statut d'une demande et retourne la ligne mise a jour
    pub async fn update_request_status(
        pool: &PgPool,
        request_id: Uuid,
        status: &str,
    ) -> sqlx::Result<Option<FriendRequest>> {
        sqlx::query_as::<_, FriendRequest>(
            "UPDATE friend_requests
             SET status = $2, responded_at = NOW()
             WHERE id = $1
             RETURNING *",
        )
        .bind(request_id)
        .bind(status)
        .fetch_optional(pool)
        .await
    }

    // Annule une demande pending envoyee par l'utilisateur (suppression)
    pub async fn delete_pending_request_by_sender(
        pool: &PgPool,
        request_id: Uuid,
        sender_id: Uuid,
    ) -> sqlx::Result<u64> {
        sqlx::query(
            "DELETE FROM friend_requests
             WHERE id = $1
               AND sender_id = $2
               AND status = 'pending'",
        )
        .bind(request_id)
        .bind(sender_id)
        .execute(pool)
        .await
        .map(|res| res.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_pool() -> PgPool {
        crate::utils::test_pg_pool()
    }

    #[tokio::test]
    async fn friend_repository_queries_fail_fast_without_a_database() {
        let pool = build_pool();
        let user_id = Uuid::new_v4();
        let friend_id = Uuid::new_v4();
        let request_id = Uuid::new_v4();

        assert!(FriendRepository::list(&pool, user_id).await.is_err());
        assert!(FriendRepository::add(&pool, user_id, friend_id)
            .await
            .is_err());
        assert!(FriendRepository::remove(&pool, user_id, friend_id)
            .await
            .is_err());
        assert!(FriendRepository::are_friends(&pool, user_id, friend_id)
            .await
            .is_err());
        assert!(
            FriendRepository::find_pending_between(&pool, user_id, friend_id)
                .await
                .is_err()
        );
        assert!(FriendRepository::create_request(&pool, user_id, friend_id)
            .await
            .is_err());
        assert!(FriendRepository::list_incoming_requests(&pool, user_id)
            .await
            .is_err());
        assert!(FriendRepository::list_outgoing_requests(&pool, user_id)
            .await
            .is_err());
        assert!(FriendRepository::find_request_by_id(&pool, request_id)
            .await
            .is_err());
        assert!(
            FriendRepository::update_request_status(&pool, request_id, "accepted")
                .await
                .is_err()
        );
        assert!(
            FriendRepository::delete_pending_request_by_sender(&pool, request_id, user_id)
                .await
                .is_err()
        );
    }
}