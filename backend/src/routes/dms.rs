use crate::utils::auth::AuthUser;
use axum::http::StatusCode;
use axum::{extract::State, Json};

use crate::models::dm::{CreateDmRequest, DmChannel};
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/dms",
    tag = "DMs",
    security(
        ("bearerAuth" = [])
    ),
    request_body = CreateDmRequest,
    responses(
        (status = 200, description = "Message privé récupéré ou créé", body = DmChannel),
        (status = 500, description = "Erreur interne du serveur")
    )
)]
pub async fn get_or_create_dm(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Json(payload): Json<CreateDmRequest>,
) -> Result<Json<DmChannel>, StatusCode> {
    let user1 = user.id;
    let user2 = payload.target_user_id;

    let existing_dm = sqlx::query_as::<_, DmChannel>(
        "SELECT * FROM dm_channels 
         WHERE (user1_id = $1 AND user2_id = $2) 
            OR (user1_id = $2 AND user2_id = $1)",
    )
    .bind(user1)
    .bind(user2)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(dm) = existing_dm {
        return Ok(Json(dm));
    }

    let new_dm = sqlx::query_as::<_, DmChannel>(
        "INSERT INTO dm_channels (user1_id, user2_id) 
         VALUES ($1, $2) 
         RETURNING *",
    )
    .bind(user1)
    .bind(user2)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(new_dm))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{models::User, utils::auth::AuthUser};
    use chrono::Utc;
    use uuid::Uuid;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    fn build_user(id: Uuid) -> User {
        User {
            id,
            email: "alice@example.com".to_string(),
            password_hash: "hashed".to_string(),
            first_name: Some("Alice".to_string()),
            last_name: Some("Martin".to_string()),
            username: Some("alice".to_string()),
            avatar_url: None,
            created_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn get_or_create_dm_returns_server_error_when_database_is_unavailable() {
        let user_id = Uuid::new_v4();
        let result = get_or_create_dm(
            State(build_state().await),
            axum::extract::Extension(AuthUser(build_user(user_id))),
            Json(CreateDmRequest {
                target_user_id: Uuid::new_v4(),
            }),
        )
        .await;

        assert!(matches!(result, Err(StatusCode::INTERNAL_SERVER_ERROR)));
    }

    #[tokio::test]
    async fn get_or_create_dm_creates_and_returns_channel_with_real_database() {
        let state = match crate::utils::live_app_state().await {
            Some(s) => s,
            None => return,
        };
        let pool = state.pool.clone();

        let email1 = format!("cov_dm1_{}@test.example", Uuid::new_v4());
        let email2 = format!("cov_dm2_{}@test.example", Uuid::new_v4());

        // 🔴 AJOUT : Génération de usernames uniques pour les tests
        let username1 = format!("u1_{}", &Uuid::new_v4().to_string()[..8]);
        let username2 = format!("u2_{}", &Uuid::new_v4().to_string()[..8]);

        // 🔴 CORRECTION : Ajout de la colonne username dans l'INSERT
        let u1 = sqlx::query_as::<_, User>(
            "INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING *",
        )
        .bind(&email1)
        .bind("hashed")
        .bind(&username1)
        .fetch_one(&pool)
        .await
        .expect("create u1 failed");

        // 🔴 CORRECTION : Ajout de la colonne username dans l'INSERT
        let u2 = sqlx::query_as::<_, User>(
            "INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING *",
        )
        .bind(&email2)
        .bind("hashed")
        .bind(&username2)
        .fetch_one(&pool)
        .await
        .expect("create u2 failed");

        let auth1 = axum::extract::Extension(AuthUser(u1.clone()));

        // First call creates the DM channel
        let result = get_or_create_dm(
            State(state.clone()),
            auth1.clone(),
            Json(CreateDmRequest {
                target_user_id: u2.id,
            }),
        )
        .await
        .expect("get_or_create_dm should succeed");
        let dm_id = result.0.id;

        // Second call returns existing channel
        let result2 = get_or_create_dm(
            State(state),
            auth1,
            Json(CreateDmRequest {
                target_user_id: u2.id,
            }),
        )
        .await
        .expect("get_or_create_dm should return existing");
        assert_eq!(result2.0.id, dm_id);

        sqlx::query("DELETE FROM dm_channels WHERE id = $1")
            .bind(dm_id)
            .execute(&pool)
            .await
            .expect("cleanup dm failed");
        sqlx::query("DELETE FROM users WHERE email = $1 OR email = $2")
            .bind(&email1)
            .bind(&email2)
            .execute(&pool)
            .await
            .expect("cleanup users failed");
    }
}
