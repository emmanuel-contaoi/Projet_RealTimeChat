use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use uuid::Uuid;
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;

use crate::state::AppState;
use crate::utils::auth::AuthUser;
use crate::modules::servers::models::{Message, CreateMessageRequest};

// Recuperer l'historique des messages d'un channel
pub async fn get_chat_history(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    // Verify membership via channel -> server -> members
    let membership = sqlx::query_scalar::<_, String>(
        "SELECT m.role FROM members m
         JOIN channels c ON c.server_id = m.server_id
         WHERE c.id = $1 AND m.user_id = $2"
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match membership {
        Ok(Some(_)) => {}
        Ok(None) => return (StatusCode::FORBIDDEN, "Acces refuse.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    let collection = state.mongo
        .database("chat")
        .collection::<Message>("messages");

    let filter = doc! { "channel_id": channel_id.to_string() };

    let mut cursor = match collection.find(filter, None).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response();
        }
    };

    let mut messages: Vec<Message> = Vec::new();
    while let Ok(Some(msg)) = cursor.try_next().await {
        messages.push(msg);
    }

    (StatusCode::OK, Json(messages)).into_response()
}

// Envoyer un message dans un channel
pub async fn send_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<CreateMessageRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    // Verify membership
    let membership = sqlx::query_scalar::<_, String>(
        "SELECT m.role FROM members m
         JOIN channels c ON c.server_id = m.server_id
         WHERE c.id = $1 AND m.user_id = $2"
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await;

    match membership {
        Ok(Some(_)) => {}
        Ok(None) => return (StatusCode::FORBIDDEN, "Acces refuse.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur serveur").into_response(),
    }

    // Get username from auth user
    let username = auth_user.0.username
        .or(auth_user.0.first_name)
        .unwrap_or_else(|| auth_user.0.email.clone());

    let collection = state.mongo.database("chat").collection::<Message>("messages");

    let new_message = Message {
        id: None,
        channel_id: channel_id.to_string(),
        user_id: user_id.to_string(),
        content: payload.content,
        username,
        created_at: Some(Utc::now().to_rfc3339()),
    };

    match collection.insert_one(new_message, None).await {
        Ok(_) => (StatusCode::CREATED, "Message envoye").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response(),
    }
}

// Modifier son propre message
pub async fn edit_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
    Json(payload): Json<CreateMessageRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let oid = match ObjectId::parse_str(&message_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "ID de message invalide.").into_response(),
    };

    let collection = state.mongo
        .database("chat")
        .collection::<Message>("messages");

    let message = match collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(msg)) => msg,
        Ok(None) => return (StatusCode::NOT_FOUND, "Message introuvable.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response(),
    };

    if message.user_id != user_id.to_string() {
        return (StatusCode::FORBIDDEN, "Vous ne pouvez modifier que vos propres messages.").into_response();
    }

    match collection.update_one(
        doc! { "_id": oid },
        doc! { "$set": { "content": &payload.content } },
        None,
    ).await {
        Ok(_) => (StatusCode::OK, "Message modifie").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur modification").into_response(),
    }
}

// Supprimer un message
pub async fn delete_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(message_id): Path<String>,
) -> impl IntoResponse {
    let user_id = auth_user.0.id;

    let oid = match ObjectId::parse_str(&message_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "ID de message invalide.").into_response(),
    };

    let collection = state.mongo
        .database("chat")
        .collection::<Message>("messages");

    // Find the message first
    let message = match collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(msg)) => msg,
        Ok(None) => return (StatusCode::NOT_FOUND, "Message introuvable.").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur Mongo").into_response(),
    };

    // Check ownership or admin/owner role in the server
    let is_author = message.user_id == user_id.to_string();

    if !is_author {
        // Check if user is admin/owner of the server for this channel
        let role = sqlx::query_scalar::<_, String>(
            "SELECT m.role FROM members m
             JOIN channels c ON c.server_id = m.server_id
             WHERE c.id::text = $1 AND m.user_id = $2"
        )
        .bind(&message.channel_id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await;

        match role {
            Ok(Some(r)) if r == "owner" || r == "admin" => {}
            _ => return (StatusCode::FORBIDDEN, "Vous ne pouvez pas supprimer ce message.").into_response(),
        }
    }

    match collection.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur suppression").into_response(),
    }
}
