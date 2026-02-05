use axum::{
    extract::{State, Path}, 
    http::StatusCode,
    response::{IntoResponse, Json},
};
use uuid::Uuid;
// Imports pour MongoDB
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

// Imports de tes modules
use crate::state::AppState;
use crate::modules::servers::models::{
    CreateServerRequest, Server, CreateChannelRequest, Channel, JoinServerRequest, Message
};

const HARDCODED_USER_ID: &str = "11111111-1111-1111-1111-111111111111";

// --- Route 1 : CRÉER SERVEUR ---
pub async fn create_server(
    State(state): State<AppState>, 
    Json(payload): Json<CreateServerRequest>,
) -> impl IntoResponse {
    
    let user_id = Uuid::parse_str(HARDCODED_USER_ID).unwrap();
    let invite_code = Uuid::new_v4().to_string()[..8].to_string();

    let new_server = sqlx::query_as::<_, Server>(
        "INSERT INTO servers (name, invite_code) VALUES ($1, $2) RETURNING *"
    )
    .bind(&payload.name)
    .bind(&invite_code)
    .fetch_one(&state.pool) 
    .await;

    match new_server {
        Ok(server) => {
            let _ = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'admin')"
            )
            .bind(server.id)
            .bind(user_id)
            .execute(&state.pool)
            .await;

            (StatusCode::CREATED, Json(server)).into_response()
        }
        Err(e) => {
            println!("Erreur SQL Create Server: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur création").into_response()
        }
    }
}

// --- Route 2 : LISTER SERVEURS ---
pub async fn list_servers(
    State(state): State<AppState>,  
) -> impl IntoResponse {
    let user_id = Uuid::parse_str(HARDCODED_USER_ID).unwrap();

    let servers = sqlx::query_as::<_, Server>(
        "SELECT s.* FROM servers s
         JOIN members m ON s.id = m.server_id
         WHERE m.user_id = $1"
    )
    .bind(user_id)
    .fetch_all(&state.pool) 
    .await;

    match servers {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => {
            println!("Erreur SQL List: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur récupération").into_response()
        }
    }
}

// --- Route 3 : CRÉER SALON ---
pub async fn create_channel(
    State(state): State<AppState>,
    Path(server_id): Path<Uuid>, 
    Json(payload): Json<CreateChannelRequest>,
) -> impl IntoResponse {
    
    let new_channel = sqlx::query_as::<_, Channel>(
        "INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(server_id)
    .bind(&payload.name)
    .bind(&payload.r#type) 
    .fetch_one(&state.pool)  
    .await;

    match new_channel {
        Ok(channel) => (StatusCode::CREATED, Json(channel)).into_response(),
        Err(e) => {
            println!("Erreur SQL Create Channel: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur lors de la création du salon").into_response()
        }
    }
}

// --- Route 4 : LISTER SALONS ---
pub async fn list_channels(
    State(state): State<AppState>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    
    let channels = sqlx::query_as::<_, Channel>(
        "SELECT * FROM channels WHERE server_id = $1"
    )
    .bind(server_id)
    .fetch_all(&state.pool) 
    .await;

    match channels {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => {
            println!("Erreur SQL List Channels: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur récupération des salons").into_response()
        }
    }
}

// --- Route 5 : REJOINDRE SERVEUR ---
pub async fn join_server(
    State(state): State<AppState>, 
    Json(payload): Json<JoinServerRequest>,
) -> impl IntoResponse {
    let user_id = Uuid::parse_str(HARDCODED_USER_ID).unwrap();

    let server = sqlx::query_as::<_, Server>(
        "SELECT * FROM servers WHERE invite_code = $1"
    )
    .bind(&payload.invite_code)
    .fetch_optional(&state.pool) 
    .await;

    match server {
        Ok(Some(server)) => {
            let result = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'guest') 
                 ON CONFLICT DO NOTHING" 
            )
            .bind(server.id)
            .bind(user_id)
            .execute(&state.pool)
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

// --- Route 6 : HISTORIQUE MONGO ---
pub async fn get_chat_history(
    State(state): State<AppState>, 
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    
    let collection = state.mongo
        .database("chat")
        .collection::<Message>("messages");

    let filter = doc! { "channel_id": channel_id.to_string() };

    let mut cursor = match collection.find(filter, None).await {
        Ok(cursor) => cursor,
        Err(e) => {
            println!("Erreur Mongo Find: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response();
        }
    };

    let mut messages: Vec<Message> = Vec::new();
    while let Ok(Some(msg)) = cursor.try_next().await {
        messages.push(msg);
    }

    (StatusCode::OK, Json(messages)).into_response()
}