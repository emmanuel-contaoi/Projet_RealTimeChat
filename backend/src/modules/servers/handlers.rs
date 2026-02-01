use axum::{
    extract::{State, Path}, 
    http::StatusCode,
    response::{IntoResponse, Json},
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{
    CreateServerRequest, Server, CreateChannelRequest, Channel, JoinServerRequest
};

// ID utilisateur fictif
const HARDCODED_USER_ID: &str = "11111111-1111-1111-1111-111111111111";

// --- Route 1 : CRÉER SERVEUR ---
pub async fn create_server(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateServerRequest>,
) -> impl IntoResponse {
    
    let user_id = Uuid::parse_str(HARDCODED_USER_ID).unwrap();
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
            .bind(user_id)
            .execute(&pool)
            .await;

            (StatusCode::CREATED, Json(server)).into_response()
        }
        Err(e) => {
            println!(" Erreur SQL Create Server: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur création").into_response()
        }
    }
}

// --- Route 2 : LISTER SERVEURS ---
pub async fn list_servers(
    State(pool): State<PgPool>,
) -> impl IntoResponse {
    let user_id = Uuid::parse_str(HARDCODED_USER_ID).unwrap();

    let servers = sqlx::query_as::<_, Server>(
        "SELECT s.* FROM servers s
         JOIN members m ON s.id = m.server_id
         WHERE m.user_id = $1"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await;

    match servers {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => {
            println!(" Erreur SQL List: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur récupération").into_response()
        }
    }
}

// --- Route 3 : CRÉER SALON ---
pub async fn create_channel(
    State(pool): State<PgPool>,
    Path(server_id): Path<Uuid>, 
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    
    let new_channel = sqlx::query_as::<_, Channel>(
        "INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(server_id)
    .bind(&payload.name)
    .bind(&payload.r#type) 
    .fetch_one(&pool)
    .await;

    match new_channel {
        Ok(channel) => (StatusCode::CREATED, Json(channel)).into_response(),
        Err(e) => {
            println!(" Erreur SQL Create Channel: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur lors de la création du salon").into_response()
        }
    }
}

// --- Route 4 : LISTER SALONS ---
pub async fn list_channels(
    State(pool): State<PgPool>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    
    let channels = sqlx::query_as::<_, Channel>(
        "SELECT * FROM channels WHERE server_id = $1"
    )
    .bind(server_id)
    .fetch_all(&pool)
    .await;

    match channels {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => {
            println!(" Erreur SQL List Channels: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur récupération des salons").into_response()
        }
    }
}

// --- Route 5 : REJOINDRE SERVEUR ---
pub async fn join_server(
    State(pool): State<PgPool>,
    Json(payload): Json<JoinServerRequest>,
) -> impl IntoResponse {
    let user_id = Uuid::parse_str(HARDCODED_USER_ID).unwrap();

    let server = sqlx::query_as::<_, Server>(
        "SELECT * FROM servers WHERE invite_code = $1"
    )
    .bind(&payload.invite_code)
    .fetch_optional(&pool) 
    .await;

    match server {
        Ok(Some(server)) => {
            // Le serveur existe, on ajoute le membre
            let result = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'guest') 
                 ON CONFLICT DO NOTHING" 
            )
            .bind(server.id)
            .bind(user_id)
            .execute(&pool)
            .await;

            match result {
                Ok(_) => (StatusCode::OK, Json(server)).into_response(),
                Err(e) => {
                    println!("Erreur Join Member: {:?}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Impossible de rejoindre").into_response()
                }
            }
        }
        Ok(None) => (StatusCode::NOT_FOUND, "Code d'invitation invalide").into_response(),
        Err(e) => {
            println!("Erreur SQL Find Server: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response()
        }
    }
}