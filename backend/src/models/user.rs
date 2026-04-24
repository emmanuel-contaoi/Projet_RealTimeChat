use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>, // NOUVEAU
    pub created_at: DateTime<Utc>,
}

impl User {
    pub fn preferred_display_name(&self) -> String {
        self.username
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .or_else(|| {
                self.first_name
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
            })
            .unwrap_or_else(|| self.email.clone())
    }
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>, // NOUVEAU (Optionnel lors de l'inscription)
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>, // NOUVEAU
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        UserResponse {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            avatar_url: user.avatar_url, // NOUVEAU
            created_at: user.created_at,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, sqlx::FromRow, utoipa::ToSchema)]
pub struct FriendRequest {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Uuid,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow, utoipa::ToSchema)]
pub struct FriendRequestListItem {
    pub request_id: Uuid,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub user_email: String,
    pub user_first_name: Option<String>,
    pub user_last_name: Option<String>,
    pub user_username: Option<String>,
    pub user_avatar_url: Option<String>, // NOUVEAU
    pub user_created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct FriendRequestResponse {
    pub id: Uuid,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
    pub user: UserResponse,
}

impl FriendRequestResponse {
    pub fn from_list_item(item: FriendRequestListItem) -> Self {
        Self {
            id: item.request_id,
            status: item.status,
            created_at: item.created_at,
            responded_at: item.responded_at,
            user: UserResponse {
                id: item.user_id,
                email: item.user_email,
                first_name: item.user_first_name,
                last_name: item.user_last_name,
                username: item.user_username,
                avatar_url: item.user_avatar_url, // NOUVEAU
                created_at: item.user_created_at,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_response_from_user_copies_public_fields() {
        let created_at = Utc::now();
        let user_id = Uuid::new_v4();
        let user = User {
            id: user_id,
            email: "alice@example.com".to_string(),
            password_hash: "hashed-password".to_string(),
            first_name: Some("Alice".to_string()),
            last_name: Some("Martin".to_string()),
            username: Some("alice".to_string()),
            avatar_url: Some("http://image.com/alice.png".to_string()),
            created_at,
        };

        let response = UserResponse::from(user);

        assert_eq!(response.id, user_id);
        assert_eq!(response.email, "alice@example.com");
        assert_eq!(response.first_name.as_deref(), Some("Alice"));
        assert_eq!(response.last_name.as_deref(), Some("Martin"));
        assert_eq!(response.username.as_deref(), Some("alice"));
        assert_eq!(
            response.avatar_url.as_deref(),
            Some("http://image.com/alice.png")
        );
        assert_eq!(response.created_at, created_at);
    }

    #[test]
    fn friend_request_response_from_list_item_maps_nested_user() {
        let request_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let created_at = Utc::now();
        let responded_at = Some(Utc::now());
        let item = FriendRequestListItem {
            request_id,
            status: "pending".to_string(),
            created_at,
            responded_at,
            user_id,
            user_email: "bob@example.com".to_string(),
            user_first_name: Some("Bob".to_string()),
            user_last_name: Some("Lee".to_string()),
            user_username: Some("bobby".to_string()),
            user_avatar_url: None,
            user_created_at: created_at,
        };

        let response = FriendRequestResponse::from_list_item(item);

        assert_eq!(response.id, request_id);
        assert_eq!(response.status, "pending");
        assert_eq!(response.created_at, created_at);
        assert_eq!(response.responded_at, responded_at);
        assert_eq!(response.user.id, user_id);
        assert_eq!(response.user.email, "bob@example.com");
        assert_eq!(response.user.first_name.as_deref(), Some("Bob"));
        assert_eq!(response.user.last_name.as_deref(), Some("Lee"));
        assert_eq!(response.user.username.as_deref(), Some("bobby"));
        assert_eq!(response.user.avatar_url, None);
    }

    #[test]
    fn preferred_display_name_prioritizes_username_then_first_name_then_email() {
        let created_at = Utc::now();
        let base_user = User {
            id: Uuid::new_v4(),
            email: "fallback@example.com".to_string(),
            password_hash: "hashed-password".to_string(),
            first_name: Some("Alice".to_string()),
            last_name: None,
            username: Some("alice42".to_string()),
            avatar_url: None,
            created_at,
        };

        assert_eq!(base_user.preferred_display_name(), "alice42");

        let user_without_username = User {
            username: None,
            ..base_user.clone()
        };
        assert_eq!(user_without_username.preferred_display_name(), "Alice");

        let user_without_names = User {
            first_name: None,
            username: None,
            ..base_user
        };
        assert_eq!(
            user_without_names.preferred_display_name(),
            "fallback@example.com"
        );
    }

    #[test]
    fn preferred_display_name_ignores_blank_username_and_first_name() {
        let user = User {
            id: Uuid::new_v4(),
            email: "fallback@example.com".to_string(),
            password_hash: "hashed-password".to_string(),
            first_name: Some("  ".to_string()),
            last_name: None,
            username: Some("   ".to_string()),
            avatar_url: None,
            created_at: Utc::now(),
        };

        assert_eq!(user.preferred_display_name(), "fallback@example.com");
    }

    #[test]
    fn friend_request_response_from_list_item_preserves_missing_optional_fields() {
        let created_at = Utc::now();
        let item = FriendRequestListItem {
            request_id: Uuid::new_v4(),
            status: "accepted".to_string(),
            created_at,
            responded_at: None,
            user_id: Uuid::new_v4(),
            user_email: "bob@example.com".to_string(),
            user_first_name: None,
            user_last_name: None,
            user_username: None,
            user_avatar_url: None,
            user_created_at: created_at,
        };

        let response = FriendRequestResponse::from_list_item(item);

        assert_eq!(response.responded_at, None);
        assert_eq!(response.user.first_name, None);
        assert_eq!(response.user.last_name, None);
        assert_eq!(response.user.username, None);
        assert_eq!(response.user.avatar_url, None);
    }
}
