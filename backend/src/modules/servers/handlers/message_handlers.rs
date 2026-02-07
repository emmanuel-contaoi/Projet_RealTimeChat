use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use uuid::Uuid;
use chrono::Utc;
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

use crate::state::AppState;
use crate::modules::servers::models::{Message, CreateMessageRequest};

// Recuperer l'historique des messages d'un channel
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
