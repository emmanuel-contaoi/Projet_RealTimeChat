use axum::{
    extract::{State, Path}, 
    http::StatusCode,
    response::{IntoResponse, Json},
};
use uuid::Uuid;
// Imports pour MongoDB
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

// Imports des modules
use crate::state::AppState;
// UpdateChannelRequest et CreateMessageRequest
use crate::modules::servers::models::{
    CreateServerRequest, Server, CreateChannelRequest, Channel, JoinServerRequest, 
    Message, UpdateChannelRequest, CreateMessageRequest
};

const HARDCODED_USER_ID: &str = "11111111-1111-1111-1111-111111111111";

// Route 1 : CRÉER SERVEUR 
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

// LISTER SERVEURS ---
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

//  CRÉER SALON 
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

// LISTER SALONS
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

//  REJOINDRE SERVEUR 
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

//  HISTORIQUE MONGO 
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


// GET /channels/:id (Détails d'un salon)
pub async fn get_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let channel = sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = $1")
        .bind(channel_id)
        .fetch_optional(&state.pool)
        .await;

    match channel {
        Ok(Some(c)) => (StatusCode::OK, Json(c)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Salon introuvable").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur SQL").into_response(),
    }
}

// PUT channels/
pub async fn update_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> impl IntoResponse {
    let updated = sqlx::query_as::<_, Channel>(
        "UPDATE channels SET name = $1, type = COALESCE($2, type) WHERE id = $3 RETURNING *"
    )
    .bind(&payload.name)
    .bind(&payload.r#type)
    .bind(channel_id)
    .fetch_optional(&state.pool)
    .await;

    match updated {
        Ok(Some(c)) => (StatusCode::OK, Json(c)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Salon introuvable").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur modification").into_response(),
    }
}

// DELETE channels
pub async fn delete_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM channels WHERE id = $1")
        .bind(channel_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response(),
    }
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<CreateMessageRequest>,
) -> impl IntoResponse {
    let collection = state.mongo.database("chat").collection::<Message>("messages");

    let new_message = Message {
        channel_id: channel_id.to_string(),
        user_id: payload.user_id,
        content: payload.content,
        username: payload.username,
    };

    match collection.insert_one(new_message, None).await {
        Ok(_) => (StatusCode::CREATED, "Message envoyé").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response(),
    }
}