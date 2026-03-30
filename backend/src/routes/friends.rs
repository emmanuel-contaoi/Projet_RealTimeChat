use axum::{
    extract::{ws::Message, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::services::friend_service::FriendService;
use crate::services::ServiceError;
use crate::websocket::events::ServerEvent;
use crate::{
    models::{FriendRequestResponse, UserResponse},
    state::AppState,
    utils::auth::AuthUser,
};

#[derive(Debug, Deserialize)]
pub struct AddFriendRequest {
    pub friend_id: Uuid,
}

pub async fn list_friends(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let friends = FriendService::list_friends(&state.pool, user.id).await?;
    Ok(Json(friends))
}

pub async fn send_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Json(payload): Json<AddFriendRequest>,
) -> Result<StatusCode, ServiceError> {
    FriendService::send_friend_request(&state.pool, user.id, payload.friend_id).await?;

    if let Ok(json) = (ServerEvent::FriendRequestReceived {
        from_user_id: user.id.to_string(),
    })
    .to_json()
    {
        state
            .broadcast_to_users(&[payload.friend_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::CREATED)
}

pub async fn list_incoming_requests(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<FriendRequestResponse>>, ServiceError> {
    let requests = FriendService::list_incoming_requests(&state.pool, user.id).await?;
    Ok(Json(requests))
}

pub async fn list_outgoing_requests(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<FriendRequestResponse>>, ServiceError> {
    let requests = FriendService::list_outgoing_requests(&state.pool, user.id).await?;
    Ok(Json(requests))
}

pub async fn accept_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    let sender_id = FriendService::accept_request(&state.pool, user.id, request_id).await?;

    if let Ok(json) = (ServerEvent::FriendRequestAccepted {
        by_user_id: user.id.to_string(),
    })
    .to_json()
    {
        state
            .broadcast_to_users(&[sender_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::OK)
}

pub async fn reject_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    let sender_id = FriendService::reject_request(&state.pool, user.id, request_id).await?;

    if let Ok(json) = (ServerEvent::FriendRequestRejected {
        by_user_id: user.id.to_string(),
    })
    .to_json()
    {
        state
            .broadcast_to_users(&[sender_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::OK)
}

pub async fn cancel_friend_request(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    let receiver_id = FriendService::cancel_request(&state.pool, user.id, request_id).await?;

    if let Ok(json) = (ServerEvent::FriendRequestCancelled {
        from_user_id: user.id.to_string(),
    })
    .to_json()
    {
        state
            .broadcast_to_users(&[receiver_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_friend(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    FriendService::remove_friend(&state.pool, user.id, friend_id).await?;

    if let Ok(json) = (ServerEvent::FriendRemoved {
        by_user_id: user.id.to_string(),
    })
    .to_json()
    {
        state
            .broadcast_to_users(&[friend_id.to_string()], Message::Text(json.into()))
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{models::User, utils::auth::AuthUser};
    use chrono::Utc;

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
            created_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn send_friend_request_rejects_self_request() {
        let user_id = Uuid::new_v4();
        let result = send_friend_request(
            State(build_state().await),
            axum::extract::Extension(AuthUser(build_user(user_id))),
            Json(AddFriendRequest { friend_id: user_id }),
        )
        .await;

        match result {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "Impossible de s'envoyer une demande a soi-meme.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn friend_routes_return_internal_errors_when_database_is_unavailable() {
        let user_id = Uuid::new_v4();
        let auth_user = axum::extract::Extension(AuthUser(build_user(user_id)));
        let state = State(build_state().await);

        match list_friends(state.clone(), auth_user.clone()).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected list_friends result: {:?}", other),
        }

        match send_friend_request(
            state.clone(),
            auth_user.clone(),
            Json(AddFriendRequest {
                friend_id: Uuid::new_v4(),
            }),
        )
        .await
        {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected send_friend_request result: {:?}", other),
        }

        match list_incoming_requests(state.clone(), auth_user.clone()).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected list_incoming_requests result: {:?}", other),
        }

        match list_outgoing_requests(state.clone(), auth_user.clone()).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected list_outgoing_requests result: {:?}", other),
        }

        let request_id = Uuid::new_v4();
        match accept_friend_request(state.clone(), auth_user.clone(), Path(request_id)).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected accept_friend_request result: {:?}", other),
        }

        match reject_friend_request(state.clone(), auth_user.clone(), Path(request_id)).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected reject_friend_request result: {:?}", other),
        }

        match cancel_friend_request(state.clone(), auth_user.clone(), Path(request_id)).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected cancel_friend_request result: {:?}", other),
        }

        match remove_friend(state, auth_user, Path(Uuid::new_v4())).await {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected remove_friend result: {:?}", other),
        }
    }
}
