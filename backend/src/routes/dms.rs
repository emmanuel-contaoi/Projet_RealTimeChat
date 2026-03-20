use crate::utils::auth::AuthUser;
use axum::http::StatusCode;
use axum::{extract::State, Json};

use crate::models::dm::{CreateDmRequest, DmChannel};
use crate::state::AppState;

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
