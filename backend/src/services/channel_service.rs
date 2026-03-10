use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{Channel, CreateChannelRequest, UpdateChannelRequest};
use crate::repositories::channel_repository::ChannelRepository;
use crate::repositories::server_repository::ServerRepository;
use crate::services::ServiceError;

pub struct ChannelService;

impl ChannelService {
    pub async fn create_channel(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
        payload: CreateChannelRequest,
    ) -> Result<Channel, ServiceError> {
        let role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match role.as_deref() {
            Some("owner") | Some("admin") => {}
            Some(_) => {
                return Err(ServiceError::Forbidden(
                    "Seuls owner/admin peuvent creer un channel.".to_string(),
                ))
            }
            None => {
                return Err(ServiceError::Forbidden(
                    "Vous n'etes pas membre de ce serveur.".to_string(),
                ))
            }
        }

        ChannelRepository::create(pool, server_id, &payload.name, &payload.r#type)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur création du salon: {}", e)))
    }

    pub async fn list_channels(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> Result<Vec<Channel>, ServiceError> {
        let membership = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if membership.is_none() {
            return Err(ServiceError::Forbidden(
                "Vous n'etes pas membre de ce serveur.".to_string(),
            ));
        }

        ChannelRepository::list_for_server(pool, server_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur récupération des salons: {}", e)))
    }

    pub async fn get_channel(
        pool: &PgPool,
        user_id: Uuid,
        channel_id: Uuid,
    ) -> Result<Channel, ServiceError> {
        let membership = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if membership.is_none() {
            return Err(ServiceError::Forbidden("Acces refuse.".to_string()));
        }

        ChannelRepository::find_by_id(pool, channel_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur SQL: {}", e)))?
            .ok_or(ServiceError::NotFound("Salon introuvable".to_string()))
    }

    pub async fn update_channel(
        pool: &PgPool,
        user_id: Uuid,
        channel_id: Uuid,
        payload: UpdateChannelRequest,
    ) -> Result<Channel, ServiceError> {
        let role = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match role.as_deref() {
            Some("owner") | Some("admin") => {}
            Some(_) => {
                return Err(ServiceError::Forbidden(
                    "Seuls owner/admin peuvent modifier un channel.".to_string(),
                ))
            }
            None => return Err(ServiceError::Forbidden("Acces refuse.".to_string())),
        }

        ChannelRepository::update(pool, channel_id, &payload.name, payload.r#type.as_deref())
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur modification: {}", e)))?
            .ok_or(ServiceError::NotFound("Salon introuvable".to_string()))
    }

    pub async fn delete_channel(
        pool: &PgPool,
        user_id: Uuid,
        channel_id: Uuid,
    ) -> Result<(), ServiceError> {
        let role = ChannelRepository::get_member_role(pool, channel_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match role.as_deref() {
            Some("owner") | Some("admin") => {}
            Some(_) => {
                return Err(ServiceError::Forbidden(
                    "Seuls owner/admin peuvent supprimer un channel.".to_string(),
                ))
            }
            None => return Err(ServiceError::Forbidden("Acces refuse.".to_string())),
        }

        ChannelRepository::delete(pool, channel_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur suppression: {}", e)))
    }
}
