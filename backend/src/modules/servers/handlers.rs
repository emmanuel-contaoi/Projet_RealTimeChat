use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{CreateServerRequest, Server, ServerResponse};

pub async fn create_server(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateServerRequest>,
) -> impl IntoResponse {

    
    let fake_user_id = Uuid::new_v4(); 
    let invite_code = Uuid::new_v4().to_string()[..8].to_string();

    
    let new_server = sqlx::query_as::<_, Server>(
        "INSERT INTO servers (name, invite_code) VALUES ($1, $2) RETURNING *"
    )
    .bind(&payload.name)
    .bind(&invite_code)
    .fetch_one(&pool)
    .await;

    match new_server {
        Ok(server) => {
            
            let _ = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'admin')"
            )
            .bind(server.id)
            .bind(fake_user_id)
            .execute(&pool)
            .await;

            
            (
                StatusCode::CREATED,
                Json(ServerResponse {
                    id: server.id,
                    name: server.name,
                    invite_code: server.invite_code,
                }),
            ).into_response()
        }
        Err(e) => {
            println!("Erreur SQL: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur lors de la création").into_response()
        }
    }
}