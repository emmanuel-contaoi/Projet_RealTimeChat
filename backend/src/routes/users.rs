use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::repositories::user_repository::UserRepository;
use crate::services::ServiceError;
use crate::{models::UserResponse, state::AppState};

#[derive(Debug, Deserialize)]
pub struct SearchUsersQuery {
    pub q: Option<String>,
}

fn normalize_search_query(query: Option<String>) -> Option<String> {
    let query = query.unwrap_or_default().trim().to_string();
    if query.len() < 2 {
        None
    } else {
        Some(query)
    }
}

pub async fn search_users(
    State(state): State<AppState>,
    Query(params): Query<SearchUsersQuery>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let Some(query) = normalize_search_query(params.q) else {
        return Ok(Json(vec![]));
    };

    let pattern = format!("%{}%", query);
    let users = UserRepository::search(&state.pool, &pattern)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}

pub async fn list_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, ServiceError> {
    let users = UserRepository::list(&state.pool)
        .await
        .map_err(|e| ServiceError::Internal(format!("Database error: {}", e)))?;

    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn build_state() -> AppState {
        crate::utils::test_app_state().await
    }

    #[tokio::test]
    async fn search_users_returns_empty_for_missing_query() {
        let result = search_users(
            State(build_state().await),
            Query(SearchUsersQuery { q: None }),
        )
        .await
        .expect("search should succeed");

        let Json(users) = result;
        assert!(users.is_empty());
    }

    #[tokio::test]
    async fn search_users_returns_empty_for_short_query_after_trim() {
        let result = search_users(
            State(build_state().await),
            Query(SearchUsersQuery {
                q: Some(" a ".to_string()),
            }),
        )
        .await
        .expect("search should succeed");

        let Json(users) = result;
        assert!(users.is_empty());
    }

    #[tokio::test]
    async fn search_users_returns_internal_error_for_valid_query_when_database_is_unavailable() {
        let result = search_users(
            State(build_state().await),
            Query(SearchUsersQuery {
                q: Some("alice".to_string()),
            }),
        )
        .await;

        match result {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn list_users_returns_internal_error_when_database_is_unavailable() {
        let result = list_users(State(build_state().await)).await;

        match result {
            Err(ServiceError::Internal(message)) => {
                assert!(message.starts_with("Database error:"))
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn normalize_search_query_rejects_missing_blank_and_single_character_values() {
        assert_eq!(normalize_search_query(None), None);
        assert_eq!(normalize_search_query(Some("   ".to_string())), None);
        assert_eq!(normalize_search_query(Some(" a ".to_string())), None);
    }

    #[test]
    fn normalize_search_query_trims_valid_values() {
        assert_eq!(
            normalize_search_query(Some("  ab  ".to_string())),
            Some("ab".to_string())
        );
        assert_eq!(
            normalize_search_query(Some("alice".to_string())),
            Some("alice".to_string())
        );
    }
}
