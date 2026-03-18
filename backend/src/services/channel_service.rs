use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{Channel, CreateChannelRequest, UpdateChannelRequest};
use crate::repositories::channel_repository::ChannelRepository;
use crate::repositories::server_repository::ServerRepository;
use crate::services::ServiceError;

pub struct ChannelService;

fn ensure_channel_membership(
    role: Option<&str>,
    missing_message: &str,
) -> Result<(), ServiceError> {
    if role.is_some() {
        Ok(())
    } else {
        Err(ServiceError::Forbidden(missing_message.to_string()))
    }
}

fn ensure_channel_management_role(
    role: Option<&str>,
    forbidden_message: &str,
    missing_message: &str,
) -> Result<(), ServiceError> {
    match role {
        Some("owner") | Some("admin") => Ok(()),
        Some(_) => Err(ServiceError::Forbidden(forbidden_message.to_string())),
        None => Err(ServiceError::Forbidden(missing_message.to_string())),
    }
}

impl ChannelService {
    // Cree un channel dans un serveur (owner ou admin seulement)
    pub async fn create_channel(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
        payload: CreateChannelRequest,
    ) -> Result<Channel, ServiceError> {
        let role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_channel_management_role(
            role.as_deref(),
            "Seuls owner/admin peuvent creer un channel.",
            "Vous n'etes pas membre de ce serveur.",
        )?;

        ChannelRepository::create(pool, server_id, &payload.name, &payload.r#type)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur création du salon: {}", e)))
    }

    // Retourne tous les channels d'un serveur (acces reserve aux membres)
    pub async fn list_channels(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> Result<Vec<Channel>, ServiceError> {
        let membership = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_channel_membership(
            membership.as_deref(),
            "Vous n'etes pas membre de ce serveur.",
        )?;

        ChannelRepository::list_for_server(pool, server_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur récupération des salons: {}", e)))
    }

    // Retourne un channel si l'utilisateur est membre du serveur associe
    pub async fn get_channel(
        pool: &PgPool,
        user_id: Uuid,
        channel_id: Uuid,
    ) -> Result<Channel, ServiceError> {
        let membership = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_channel_membership(membership.as_deref(), "Acces refuse.")?;

        ChannelRepository::find_by_id(pool, channel_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur SQL: {}", e)))?
            .ok_or(ServiceError::NotFound("Salon introuvable".to_string()))
    }

    // Renomme un channel (owner ou admin seulement)
    pub async fn update_channel(
        pool: &PgPool,
        user_id: Uuid,
        channel_id: Uuid,
        payload: UpdateChannelRequest,
    ) -> Result<Channel, ServiceError> {
        let role = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_channel_management_role(
            role.as_deref(),
            "Seuls owner/admin peuvent modifier un channel.",
            "Acces refuse.",
        )?;

        ChannelRepository::update(pool, channel_id, &payload.name, payload.r#type.as_deref())
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur modification: {}", e)))?
            .ok_or(ServiceError::NotFound("Salon introuvable".to_string()))
    }

    // Supprime un channel (owner ou admin seulement)
    pub async fn delete_channel(
        pool: &PgPool,
        user_id: Uuid,
        channel_id: Uuid,
    ) -> Result<(), ServiceError> {
        let role = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_channel_management_role(
            role.as_deref(),
            "Seuls owner/admin peuvent supprimer un channel.",
            "Acces refuse.",
        )?;

        ChannelRepository::delete(pool, channel_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur suppression: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_internal_error<T>(result: Result<T, ServiceError>, expected_prefix: &str) {
        if let Err(ServiceError::Internal(message)) = result {
            assert!(
                message.starts_with(expected_prefix),
                "unexpected internal message: {message}"
            );
        } else {
            panic!("expected internal error");
        }
    }

    #[test]
    fn ensure_channel_membership_rejects_missing_membership() {
        assert!(ensure_channel_membership(Some("member"), "forbidden").is_ok());

        match ensure_channel_membership(None, "forbidden") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "forbidden"),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_channel_management_role_allows_owner_and_admin_only() {
        assert!(ensure_channel_management_role(Some("owner"), "forbidden", "missing").is_ok());
        assert!(ensure_channel_management_role(Some("admin"), "forbidden", "missing").is_ok());

        match ensure_channel_management_role(Some("member"), "forbidden", "missing") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "forbidden"),
            other => panic!("unexpected result: {:?}", other),
        }

        match ensure_channel_management_role(None, "forbidden", "missing") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "missing"),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn channel_service_methods_return_internal_errors_when_database_is_unavailable() {
        let pool = crate::utils::test_pg_pool();
        let user_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();

        let create_result = ChannelService::create_channel(
            &pool,
            user_id,
            server_id,
            CreateChannelRequest {
                name: "general".to_string(),
                r#type: "text".to_string(),
            },
        )
        .await;
        assert_internal_error(create_result, "Erreur serveur:");

        let list_result = ChannelService::list_channels(&pool, user_id, server_id).await;
        assert_internal_error(list_result, "Erreur serveur:");

        let get_result = ChannelService::get_channel(&pool, user_id, channel_id).await;
        assert_internal_error(get_result, "Erreur serveur:");

        let update_result = ChannelService::update_channel(
            &pool,
            user_id,
            channel_id,
            UpdateChannelRequest {
                name: "random".to_string(),
                r#type: Some("voice".to_string()),
            },
        )
        .await;
        assert_internal_error(update_result, "Erreur serveur:");

        let delete_result = ChannelService::delete_channel(&pool, user_id, channel_id).await;
        assert_internal_error(delete_result, "Erreur serveur:");
    }
}
