use sqlx::PgPool;
use uuid::Uuid;

use crate::models::User;

pub struct UserRepository;

impl UserRepository {
    pub async fn find_by_email(pool: &PgPool, email: &str) -> sqlx::Result<Option<User>> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<User>> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

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

    pub async fn list(pool: &PgPool) -> sqlx::Result<Vec<User>> {
        sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC LIMIT 100")
            .fetch_all(pool)
            .await
    }
}
