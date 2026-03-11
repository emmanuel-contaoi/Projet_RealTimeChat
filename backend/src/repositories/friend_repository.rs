use sqlx::PgPool;
use uuid::Uuid;

use crate::models::User;

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

    // Supprime un ami de la liste
    pub async fn remove(pool: &PgPool, user_id: Uuid, friend_id: Uuid) -> sqlx::Result<()> {
        sqlx::query("DELETE FROM user_friends WHERE user_id = $1 AND friend_id = $2")
            .bind(user_id)
            .bind(friend_id)
            .execute(pool)
            .await
            .map(|_| ())
    }
}
