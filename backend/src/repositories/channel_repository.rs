use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::Channel;

pub struct ChannelRepository;

impl ChannelRepository {
    // Cree un nouveau channel dans un serveur
    pub async fn create(
        pool: &PgPool,
        server_id: Uuid,
        name: &str,
        channel_type: &str,
    ) -> sqlx::Result<Channel> {
        sqlx::query_as::<_, Channel>(
            "INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3) RETURNING *",
        )
        .bind(server_id)
        .bind(name)
        .bind(channel_type)
        .fetch_one(pool)
        .await
    }

    // Cherche un channel par son ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<Channel>> {
        sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    // Retourne tous les channels d'un serveur
    pub async fn list_for_server(pool: &PgPool, server_id: Uuid) -> sqlx::Result<Vec<Channel>> {
        sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE server_id = $1")
            .bind(server_id)
            .fetch_all(pool)
            .await
    }

    // Met a jour le nom (et optionnellement le type) d'un channel
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        name: &str,
        channel_type: Option<&str>,
    ) -> sqlx::Result<Option<Channel>> {
        sqlx::query_as::<_, Channel>(
            "UPDATE channels SET name = $1, type = COALESCE($2, type) WHERE id = $3 RETURNING *",
        )
        .bind(name)
        .bind(channel_type)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    // Supprime un channel par son ID
    pub async fn delete(pool: &PgPool, id: Uuid) -> sqlx::Result<()> {
        sqlx::query("DELETE FROM channels WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map(|_| ())
    }

    // Recupere le role d'un utilisateur dans le serveur qui contient ce channel (par UUID)
    pub async fn get_member_role(
        pool: &PgPool,
        channel_id: Uuid,
        user_id: Uuid,
    ) -> sqlx::Result<Option<String>> {
        sqlx::query_scalar::<_, String>(
            "SELECT m.role FROM members m
             JOIN channels c ON c.server_id = m.server_id
             WHERE c.id = $1 AND m.user_id = $2",
        )
        .bind(channel_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }

    // Recupere le role d'un utilisateur via l'ID du channel en texte (utile pour les messages MongoDB)
    pub async fn get_member_role_by_channel_str(
        pool: &PgPool,
        channel_id_str: &str,
        user_id: Uuid,
    ) -> sqlx::Result<Option<String>> {
        sqlx::query_scalar::<_, String>(
            "SELECT m.role FROM members m
             JOIN channels c ON c.server_id = m.server_id
             WHERE c.id::text = $1 AND m.user_id = $2",
        )
        .bind(channel_id_str)
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }
}
