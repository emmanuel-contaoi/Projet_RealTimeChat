use chrono::NaiveDateTime;
use sqlx::PgPool;
use uuid::Uuid;

pub struct BanRepository;

// Représente un ban actif en base
pub struct BanRow {
    pub id: Uuid,
    pub expires_at: Option<NaiveDateTime>,
}

impl BanRepository {
    // Insère un ban. expires_at = None → permanent, Some(...) → temporaire
    pub async fn insert(
        pool: &PgPool,
        server_id: Uuid,
        user_id: Uuid,
        banned_by: Uuid,
        expires_at: Option<NaiveDateTime>,
    ) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT INTO server_bans (server_id, user_id, banned_by, expires_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (server_id, user_id) DO UPDATE
             SET banned_by = EXCLUDED.banned_by,
                 expires_at = EXCLUDED.expires_at,
                 created_at = now()",
        )
        .bind(server_id)
        .bind(user_id)
        .bind(banned_by)
        .bind(expires_at)
        .execute(pool)
        .await
        .map(|_| ())
    }

    // Retourne le ban actif d'un utilisateur sur un serveur (ignore les bans expirés)
    pub async fn get_active_ban(
        pool: &PgPool,
        server_id: Uuid,
        user_id: Uuid,
    ) -> sqlx::Result<Option<BanRow>> {
        sqlx::query_as::<_, (Uuid, Option<NaiveDateTime>)>(
            "SELECT id, expires_at FROM server_bans
             WHERE server_id = $1 AND user_id = $2
             AND (expires_at IS NULL OR expires_at > now())",
        )
        .bind(server_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map(|opt| opt.map(|(id, expires_at)| BanRow { id, expires_at }))
    }

    // Supprime le ban d'un utilisateur (unban)
    pub async fn delete(pool: &PgPool, server_id: Uuid, user_id: Uuid) -> sqlx::Result<u64> {
        sqlx::query("DELETE FROM server_bans WHERE server_id = $1 AND user_id = $2")
            .bind(server_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map(|r| r.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_pool() -> PgPool {
        crate::utils::test_pg_pool()
    }

    #[tokio::test]
    async fn ban_repository_queries_fail_fast_without_a_database() {
        let pool = build_pool();
        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        assert!(
            BanRepository::insert(&pool, server_id, user_id, Uuid::new_v4(), None)
                .await
                .is_err()
        );
        assert!(BanRepository::get_active_ban(&pool, server_id, user_id)
            .await
            .is_err());
        assert!(BanRepository::delete(&pool, server_id, user_id)
            .await
            .is_err());
    }
}
