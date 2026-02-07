use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;
use chrono::Utc;
// Imports pour MongoDB
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

// Imports des modules
use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::{
    CreateServerRequest, Server, CreateChannelRequest, Channel, JoinServerRequest,
    Message, UpdateChannelRequest, CreateMessageRequest, MemberRow, UpdateRoleRequest
};

// Route 1 : CRÉER SERVEUR
pub async fn create_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateServerRequest>,
) -> impl IntoResponse {

    let user_id = auth_user.0.id;
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
            let member_result = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'owner')"
            )
            .bind(server.id)
            .bind(user_id)
            .execute(&state.pool)
            .await;

            match member_result {
                Ok(_) => {
                    println!("Membre admin inséré pour user {} dans serveur {}", user_id, server.id);
                    (StatusCode::CREATED, Json(server)).into_response()
                }
                Err(e) => {
                    println!("Erreur INSERT member: {:?}", e);
                    // Nettoyer le serveur orphelin
                    let _ = sqlx::query("DELETE FROM servers WHERE id = $1")
                        .bind(server.id)
                        .execute(&state.pool)
                        .await;
                    (StatusCode::INTERNAL_SERVER_ERROR, "Erreur ajout membre").into_response()
                }
            }
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
    Extension(auth_user): Extension<AuthUser>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

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
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<JoinServerRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let server = sqlx::query_as::<_, Server>(
        "SELECT * FROM servers WHERE invite_code = $1"
    )
    .bind(&payload.invite_code)
    .fetch_optional(&state.pool) 
    .await;

    match server {
        Ok(Some(server)) => {
            let result = sqlx::query(
                "INSERT INTO members (server_id, user_id, role) VALUES ($1, $2, 'member')
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

//  QUITTER SERVEUR
pub async fn leave_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    // Vérifier que l'utilisateur n'est pas owner
    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" => {
            return (StatusCode::FORBIDDEN, "Le owner ne peut pas quitter son serveur.").into_response();
        }
        Ok(None) => {
            return (StatusCode::NOT_FOUND, "Vous n'etes pas membre de ce serveur.").into_response();
        }
        Err(e) => {
            println!("Erreur SQL leave_server: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response();
        }
        _ => {}
    }

    let result = sqlx::query(
        "DELETE FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(e) => {
            println!("Erreur SQL DELETE member: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response()
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

// SUPPRIMER SERVEUR (owner uniquement)
pub async fn delete_server(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match role {
        Ok(Some(r)) if r == "owner" => {}
        Ok(Some(_)) => return (StatusCode::FORBIDDEN, "Seul le owner peut supprimer le serveur.").into_response(),
        Ok(None) => return (StatusCode::NOT_FOUND, "Vous n'etes pas membre de ce serveur.").into_response(),
        Err(e) => {
            println!("Erreur SQL delete_server: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response();
        }
    }

    let result = sqlx::query("DELETE FROM servers WHERE id = $1")
        .bind(server_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(e) => {
            println!("Erreur SQL DELETE server: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response()
        }
    }
}

// LISTER MEMBRES D'UN SERVEUR
pub async fn list_members(
    State(state): State<AppState>,
    Path(server_id): Path<Uuid>,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, MemberRow>(
        "SELECT m.user_id, COALESCE(u.username, u.first_name, u.email) as username, m.role
         FROM members m
         JOIN users u ON m.user_id = u.id
         WHERE m.server_id = $1"
    )
    .bind(server_id)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(members) => {
            let mut response = Vec::new();
            for m in members {
                let is_online = state.is_user_online(&m.user_id.to_string()).await;
                response.push(serde_json::json!({
                    "user_id": m.user_id,
                    "username": m.username.unwrap_or_else(|| "Inconnu".to_string()),
                    "role": m.role,
                    "is_online": is_online
                }));
            }
            (StatusCode::OK, Json(serde_json::Value::Array(response))).into_response()
        }
        Err(e) => {
            println!("Erreur SQL list_members: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur membres").into_response()
        }
    }
}

// CHANGER LE ROLE D'UN MEMBRE (owner uniquement)
pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    // Seul le owner peut changer les roles
    let caller_role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM members WHERE server_id = $1 AND user_id = $2"
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match caller_role {
        Ok(Some(r)) if r == "owner" => {}
        _ => return (StatusCode::FORBIDDEN, "Seul le owner peut changer les roles.").into_response(),
    }

    // On ne peut pas changer son propre role
    if user_id == target_user_id {
        return (StatusCode::BAD_REQUEST, "Impossible de changer votre propre role.").into_response();
    }

    // Seuls "admin" et "member" sont des roles valides a attribuer
    if payload.role != "admin" && payload.role != "member" {
        return (StatusCode::BAD_REQUEST, "Role invalide. Valeurs acceptees : admin, member.").into_response();
    }

    let result = sqlx::query(
        "UPDATE members SET role = $1 WHERE server_id = $2 AND user_id = $3"
    )
    .bind(&payload.role)
    .bind(server_id)
    .bind(target_user_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, format!("Role mis a jour: {}", payload.role)).into_response()
        }
        Ok(_) => (StatusCode::NOT_FOUND, "Membre introuvable.").into_response(),
        Err(e) => {
            println!("Erreur SQL update_member_role: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response()
        }
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
        created_at: Some(Utc::now().to_rfc3339()),
    };

    match collection.insert_one(new_message, None).await {
        Ok(_) => (StatusCode::CREATED, "Message envoyé").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response(),
    }
}