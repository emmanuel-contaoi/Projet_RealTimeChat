use sqlx::PgPool;
use uuid::Uuid;

use crate::models::User;

pub struct UserRepository;

impl UserRepository {
    // Cherche un utilisateur par son email
    pub async fn find_by_email(pool: &PgPool, email: &str) -> sqlx::Result<Option<User>> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(pool)
            .await
    }

    // Cherche un utilisateur par son ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<User>> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    // Cree un nouvel utilisateur dans la base de donnees
    pub async fn create(
        pool: &PgPool,
        email: &str,
        password_hash: &str,
        first_name: Option<&str>,
        last_name: Option<&str>,
        username: Option<&str>,
    ) -> sqlx::Result<User> {
        sqlx::query_as::<_, User>(
            "INSERT INTO users (id, email, password_hash, first_name, last_name, username, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING *",
        )
        .bind(Uuid::new_v4())
        .bind(email)
        .bind(password_hash)
        .bind(first_name)
        .bind(last_name)
        .bind(username)
        .fetch_one(pool)
        .await
    }

    // Cherche des utilisateurs par email, pseudo ou nom (max 20 resultats)
    pub async fn search(pool: &PgPool, pattern: &str) -> sqlx::Result<Vec<User>> {
        sqlx::query_as::<_, User>(
            "SELECT * FROM users
             WHERE email ILIKE $1
                OR username ILIKE $1
                OR first_name ILIKE $1
                OR last_name ILIKE $1
             ORDER BY created_at DESC
             LIMIT 20",
        )
        .bind(pattern)
        .fetch_all(pool)
        .await
    }

    // Retourne tous les utilisateurs (max 100)
    pub async fn list(pool: &PgPool) -> sqlx::Result<Vec<User>> {
        sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC LIMIT 100")
            .fetch_all(pool)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_pool() -> PgPool {
        crate::utils::test_pg_pool()
    }

    #[tokio::test]
    async fn user_repository_queries_fail_fast_without_a_database() {
        let pool = build_pool();

        assert!(UserRepository::find_by_email(&pool, "alice@example.com")
            .await
            .is_err());
        assert!(UserRepository::find_by_id(&pool, Uuid::new_v4())
            .await
            .is_err());
        assert!(UserRepository::create(
            &pool,
            "alice@example.com",
            "hashed",
            Some("Alice"),
            Some("Martin"),
            Some("alice"),
        )
        .await
        .is_err());
        assert!(UserRepository::search(&pool, "%alice%").await.is_err());
        assert!(UserRepository::list(&pool).await.is_err());
    }
}
