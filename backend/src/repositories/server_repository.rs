use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{MemberRow, Server};

pub struct ServerRepository;

impl ServerRepository {
    pub async fn create(pool: &PgPool, name: &str, invite_code: &str) -> sqlx::Result<Server> {
        sqlx::query_as::<_, Server>(
            "INSERT INTO servers (name, invite_code) VALUES ($1, $2) RETURNING *",
        )
        .bind(name)
        .bind(invite_code)
        .fetch_one(pool)
        .await
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<Server>> {
        sqlx::query_as::<_, Server>("SELECT * FROM servers WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_invite_code(pool: &PgPool, code: &str) -> sqlx::Result<Option<Server>> {
        sqlx::query_as::<_, Server>("SELECT * FROM servers WHERE invite_code = $1")
            .bind(code)
            .fetch_optional(pool)
            .await
    }

    pub async fn list_for_user(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Vec<Server>> {
        sqlx::query_as::<_, Server>(
            "SELECT s.* FROM servers s JOIN members m ON s.id = m.server_id WHERE m.user_id = $1",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    pub async fn update(pool: &PgPool, id: Uuid, name: &str) -> sqlx::Result<Option<Server>> {
        sqlx::query_as::<_, Server>(
            "UPDATE servers SET name = $1 WHERE id = $2 RETURNING *",
        )
        .bind(name)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> sqlx::Result<()> {
        sqlx::query("DELETE FROM servers WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map(|_| ())
    }

    pub async fn get_member_role(
        pool: &PgPool,
        server_id: Uuid,
        user_id: Uuid,
    ) -> sqlx::Result<Option<String>> {
        sqlx::query_scalar::<_, String>(
            "SELECT role FROM members WHERE server_id = $1 AND user_id = $2",
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn add_member(
        pool: &PgPool,
        server_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        )
        .bind(server_id)
        .bind(user_id)
        .bind(role)
        .execute(pool)
        .await
        .map(|_| ())
    }

    pub async fn remove_member(
        pool: &PgPool,
        server_id: Uuid,
        user_id: Uuid,
    ) -> sqlx::Result<()> {
        sqlx::query("DELETE FROM members WHERE server_id = $1 AND user_id = $2")
            .bind(server_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map(|_| ())
    }

    pub async fn update_member_role(
        pool: &PgPool,
        server_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> sqlx::Result<u64> {
        sqlx::query("UPDATE members SET role = $1 WHERE server_id = $2 AND user_id = $3")
            .bind(role)
            .bind(server_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map(|r| r.rows_affected())
    }

    pub async fn list_members(pool: &PgPool, server_id: Uuid) -> sqlx::Result<Vec<MemberRow>> {
        sqlx::query_as::<_, MemberRow>(
            "SELECT m.user_id, COALESCE(u.username, u.first_name, u.email) as username, m.role
             FROM members m
             JOIN users u ON m.user_id = u.id
             WHERE m.server_id = $1",
        )
        .bind(server_id)
        .fetch_all(pool)
        .await
    }

    pub async fn transfer_ownership(
        pool: &PgPool,
        server_id: Uuid,
        old_owner_id: Uuid,
        new_owner_id: Uuid,
    ) -> sqlx::Result<()> {
        let mut tx = pool.begin().await?;

        sqlx::query("UPDATE members SET role = 'owner' WHERE server_id = $1 AND user_id = $2")
            .bind(server_id)
            .bind(new_owner_id)
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE members SET role = 'admin' WHERE server_id = $1 AND user_id = $2")
            .bind(server_id)
            .bind(old_owner_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await
    }
}
