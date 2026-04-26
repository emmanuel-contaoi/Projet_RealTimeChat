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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AddFriendRequest {
    pub friend_id: Uuid,
}

#[utoipa::path(
    get,
    path = "/friends",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Liste des amis récupérée", body = Vec<UserResponse>),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn list_friends(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let friends = FriendService::list_friends(&state.pool, user.id).await?;
    Ok(Json(friends))
}

#[utoipa::path(
    post,
    path = "/friends",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    request_body = AddFriendRequest,
    responses(
        (status = 201, description = "Demande d'ami envoyée"),
        (status = 400, description = "Impossible de s'envoyer une demande à soi-même"),
        (status = 401, description = "Non autorisé")
    )
)]
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

#[utoipa::path(
    get,
    path = "/friends/requests/incoming",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Liste des demandes entrantes", body = Vec<FriendRequestResponse>),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn list_incoming_requests(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<FriendRequestResponse>>, ServiceError> {
    let requests = FriendService::list_incoming_requests(&state.pool, user.id).await?;
    Ok(Json(requests))
}

#[utoipa::path(
    get,
    path = "/friends/requests/outgoing",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Liste des demandes sortantes", body = Vec<FriendRequestResponse>),
        (status = 401, description = "Non autorisé")
    )
)]
pub async fn list_outgoing_requests(
    State(state): State<AppState>,
    axum::extract::Extension(AuthUser(user)): axum::extract::Extension<AuthUser>,
) -> Result<Json<Vec<FriendRequestResponse>>, ServiceError> {
    let requests = FriendService::list_outgoing_requests(&state.pool, user.id).await?;
    Ok(Json(requests))
}

#[utoipa::path(
    post,
    path = "/friends/requests/{request_id}/accept",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    params(
        ("request_id" = Uuid, Path, description = "ID de la demande")
    ),
    responses(
        (status = 200, description = "Demande acceptée"),
        (status = 401, description = "Non autorisé")
    )
)]
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

#[utoipa::path(
    post,
    path = "/friends/requests/{request_id}/reject",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    params(
        ("request_id" = Uuid, Path, description = "ID de la demande")
    ),
    responses(
        (status = 200, description = "Demande refusée"),
        (status = 401, description = "Non autorisé")
    )
)]
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

#[utoipa::path(
    delete,
    path = "/friends/requests/{request_id}",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    params(
        ("request_id" = Uuid, Path, description = "ID de la demande")
    ),
    responses(
        (status = 204, description = "Demande annulée"),
        (status = 401, description = "Non autorisé")
    )
)]
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

#[utoipa::path(
    delete,
    path = "/friends/{friend_id}",
    tag = "Friends",
    security(
        ("bearerAuth" = [])
    ),
    params(
        ("friend_id" = Uuid, Path, description = "ID de l'ami")
    ),
    responses(
        (status = 204, description = "Ami supprimé"),
        (status = 401, description = "Non autorisé")
    )
)]
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
            avatar_url: None, // 🔴 AJOUT ICI
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

    async fn create_live_user(pool: &sqlx::PgPool, email: &str, username: &str) -> User {
        sqlx::query_as::<_, User>(
            "INSERT INTO users (email, password_hash, first_name, last_name, username) VALUES ($1, $2, $3, $4, $5) RETURNING *"
        )
        .bind(email)
        .bind("hashed_test_password")
        .bind("Test")
        .bind("User")
        .bind(username)
        .fetch_one(pool)
        .await
        .expect("create user failed")
    }

    async fn delete_live_user(pool: &sqlx::PgPool, email: &str) {
        sqlx::query("DELETE FROM users WHERE email = $1")
            .bind(email)
            .execute(pool)
            .await
            .expect("delete user failed");
    }

    #[tokio::test]
    async fn friend_routes_succeed_with_real_database() {
        let state = match crate::utils::live_app_state().await {
            Some(s) => s,
            None => return,
        };
        let pool = state.pool.clone();

        let email1 = format!("cov_fr1_{}@test.example", Uuid::new_v4());
        let email2 = format!("cov_fr2_{}@test.example", Uuid::new_v4());
        let u1 = create_live_user(&pool, &email1, &format!("fr1_{}", &Uuid::new_v4().to_string()[..8])).await;
        let u2 = create_live_user(&pool, &email2, &format!("fr2_{}", &Uuid::new_v4().to_string()[..8])).await;

        let auth1 = axum::extract::Extension(AuthUser(u1.clone()));
        let auth2 = axum::extract::Extension(AuthUser(u2.clone()));
        let s = State(state.clone());

        // list_friends (empty)
        let friends = list_friends(s.clone(), auth1.clone()).await.expect("list_friends ok");
        assert!(friends.0.is_empty());

        // list_incoming and outgoing (empty)
        let incoming = list_incoming_requests(s.clone(), auth1.clone()).await.expect("incoming ok");
        assert!(incoming.0.is_empty());
        let outgoing = list_outgoing_requests(s.clone(), auth1.clone()).await.expect("outgoing ok");
        assert!(outgoing.0.is_empty());

        // send friend request u1 → u2
        let send_result = send_friend_request(
            s.clone(),
            auth1.clone(),
            Json(AddFriendRequest { friend_id: u2.id }),
        )
        .await
        .expect("send request ok");
        assert_eq!(send_result, StatusCode::CREATED);

        // outgoing now has one request
        let outgoing = list_outgoing_requests(s.clone(), auth1.clone()).await.expect("outgoing ok");
        let request_id = outgoing.0[0].id;

        // incoming for u2
        let incoming = list_incoming_requests(s.clone(), auth2.clone()).await.expect("incoming ok");
        assert_eq!(incoming.0.len(), 1);

        // cancel the request
        let cancel_result = cancel_friend_request(s.clone(), auth1.clone(), Path(request_id))
            .await
            .expect("cancel ok");
        assert_eq!(cancel_result, StatusCode::NO_CONTENT);

        // re-send and reject
        send_friend_request(
            s.clone(),
            auth1.clone(),
            Json(AddFriendRequest { friend_id: u2.id }),
        )
        .await
        .expect("re-send ok");
        let outgoing = list_outgoing_requests(s.clone(), auth1.clone()).await.expect("outgoing ok");
        let request_id2 = outgoing.0[0].id;

        let reject_result = reject_friend_request(s.clone(), auth2.clone(), Path(request_id2))
            .await
            .expect("reject ok");
        assert_eq!(reject_result, StatusCode::OK);

        // re-send and accept
        send_friend_request(
            s.clone(),
            auth1.clone(),
            Json(AddFriendRequest { friend_id: u2.id }),
        )
        .await
        .expect("third send ok");
        let outgoing = list_outgoing_requests(s.clone(), auth1.clone()).await.expect("outgoing ok");
        let request_id3 = outgoing.0[0].id;

        let accept_result = accept_friend_request(s.clone(), auth2.clone(), Path(request_id3))
            .await
            .expect("accept ok");
        assert_eq!(accept_result, StatusCode::OK);

        // list friends now has u2
        let friends = list_friends(s.clone(), auth1.clone()).await.expect("list ok");
        assert_eq!(friends.0.len(), 1);

        // remove friend
        let remove_result = remove_friend(s.clone(), auth1.clone(), Path(u2.id))
            .await
            .expect("remove ok");
        assert_eq!(remove_result, StatusCode::NO_CONTENT);

        delete_live_user(&pool, &email1).await;
        delete_live_user(&pool, &email2).await;
    }
}
