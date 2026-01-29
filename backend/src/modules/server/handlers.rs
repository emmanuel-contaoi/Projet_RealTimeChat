use actix_web::{web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;
use crate::modules::servers::models::{CreateServerRequest, Server, ServerResponse};

pub async fn create_server(
    pool: web::Data<PgPool>,
    body: web::Json<CreateServerRequest>,
) -> impl Responder {
    
    
    let fake_user_id = Uuid::new_v4(); 

    
    let invite_code = Uuid::new_v4().to_string()[..8].to_string();

    
    let new_server = sqlx::query_as::<_, Server>(
        "INSERT INTO servers (name, invite_code) VALUES ($1, $2) RETURNING *"
    )
    .bind(&body.name)
    .bind(&invite_code)
    .fetch_one(pool.get_ref())
    .await;

    match new_server {
        Ok(server) => {
            
            let _ = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'admin')"
            )
            .bind(server.id)
            .bind(fake_user_id)
            .execute(pool.get_ref())
            .await;

            
            HttpResponse::Ok().json(ServerResponse {
                id: server.id,
                name: server.name,
                invite_code: server.invite_code,
            })
        }
        Err(_) => HttpResponse::InternalServerError().body("Erreur lors de la création du serveur"),
    }
}