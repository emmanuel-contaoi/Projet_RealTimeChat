use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{
    CreateServerRequest, MemberRow, Server, UpdateServerRequest,
};
use crate::repositories::server_repository::ServerRepository;
use crate::repositories::ban_repository::BanRepository;
use crate::services::ServiceError;
use chrono::NaiveDateTime;

pub struct ServerService;

impl ServerService {
    // Cree un serveur avec un code d'invitation unique et ajoute le createur comme owner
    pub async fn create_server(
        pool: &PgPool,
        user_id: Uuid,
        payload: CreateServerRequest,
    ) -> Result<Server, ServiceError> {
        let invite_code = Uuid::new_v4().to_string()[..8].to_string();

        let server = ServerRepository::create(pool, &payload.name, &invite_code)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur création: {}", e)))?;

        ServerRepository::add_member(pool, server.id, user_id, "owner")
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur ajout membre: {}", e)))?;

        Ok(server)
    }

    // Retourne tous les serveurs dont l'utilisateur est membre
    pub async fn list_servers(pool: &PgPool, user_id: Uuid) -> Result<Vec<Server>, ServiceError> {
        ServerRepository::list_for_user(pool, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur récupération: {}", e)))
    }

    // Rejoint un serveur via son code d'invitation et ajoute l'utilisateur comme membre
    pub async fn join_server(
        pool: &PgPool,
        user_id: Uuid,
        invite_code: &str,
    ) -> Result<Server, ServiceError> {
        let server = ServerRepository::find_by_invite_code(pool, invite_code)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?
            .ok_or(ServiceError::NotFound("Code d'invitation invalide".to_string()))?;

        // Vérifie si l'utilisateur est banni de ce serveur
        let active_ban = BanRepository::get_active_ban(pool, server.id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur ban: {}", e)))?;

        if let Some(ban) = active_ban {
            let msg = match ban.expires_at {
                None => "Vous etes banni definitivement de ce serveur.".to_string(),
                Some(exp) => format!("Vous etes banni de ce serveur jusqu'au {}.", exp.format("%d/%m/%Y %H:%M")),
            };
            return Err(ServiceError::Forbidden(msg));
        }

        ServerRepository::add_member(pool, server.id, user_id, "member")
            .await
            .map_err(|e| ServiceError::Internal(format!("Impossible de rejoindre: {}", e)))?;

        Ok(server)
    }

    // Quitte un serveur (interdit si l'utilisateur est owner)
    pub async fn leave_server(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> Result<(), ServiceError> {
        let role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match role.as_deref() {
            Some("owner") => {
                return Err(ServiceError::Forbidden(
                    "Le owner ne peut pas quitter son serveur.".to_string(),
                ))
            }
            None => {
                return Err(ServiceError::NotFound(
                    "Vous n'etes pas membre de ce serveur.".to_string(),
                ))
            }
            _ => {}
        }

        ServerRepository::remove_member(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur suppression: {}", e)))
    }

    // Supprime un serveur (seul le owner peut faire ca)
    pub async fn delete_server(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> Result<(), ServiceError> {
        let role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match role.as_deref() {
            Some("owner") => {}
            Some(_) => {
                return Err(ServiceError::Forbidden(
                    "Seul le owner peut supprimer le serveur.".to_string(),
                ))
            }
            None => {
                return Err(ServiceError::NotFound(
                    "Vous n'etes pas membre de ce serveur.".to_string(),
                ))
            }
        }

        ServerRepository::delete(pool, server_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur suppression: {}", e)))
    }

    // Retourne les infos d'un serveur si l'utilisateur en est membre
    pub async fn get_server(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> Result<Server, ServiceError> {
        let role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if role.is_none() {
            return Err(ServiceError::Forbidden(
                "Vous n'etes pas membre de ce serveur.".to_string(),
            ));
        }

        ServerRepository::find_by_id(pool, server_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?
            .ok_or(ServiceError::NotFound("Serveur introuvable".to_string()))
    }

    // Renomme un serveur (owner ou admin seulement)
    pub async fn update_server(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
        payload: UpdateServerRequest,
    ) -> Result<Server, ServiceError> {
        let role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match role.as_deref() {
            Some("owner") | Some("admin") => {}
            Some(_) => {
                return Err(ServiceError::Forbidden(
                    "Seuls owner/admin peuvent modifier le serveur.".to_string(),
                ))
            }
            None => {
                return Err(ServiceError::Forbidden(
                    "Vous n'etes pas membre de ce serveur.".to_string(),
                ))
            }
        }

        ServerRepository::update(pool, server_id, &payload.name)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur modification: {}", e)))?
            .ok_or(ServiceError::NotFound("Serveur introuvable".to_string()))
    }

    // Transfere la propriete du serveur a un autre membre (owner devient admin, cible devient owner)
    pub async fn transfer_ownership(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
        new_owner_id: Uuid,
    ) -> Result<(), ServiceError> {
        let caller_role = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if caller_role.as_deref() != Some("owner") {
            return Err(ServiceError::Forbidden(
                "Seul le owner peut transferer la propriete.".to_string(),
            ));
        }

        let target_role = ServerRepository::get_member_role(pool, server_id, new_owner_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if target_role.is_none() {
            return Err(ServiceError::NotFound(
                "L'utilisateur cible n'est pas membre du serveur.".to_string(),
            ));
        }

        ServerRepository::transfer_ownership(pool, server_id, user_id, new_owner_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur transfert: {}", e)))
    }

    // Retourne la liste des membres d'un serveur (acces reserve aux membres)
    pub async fn list_members(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> Result<Vec<MemberRow>, ServiceError> {
        let membership = ServerRepository::get_member_role(pool, server_id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if membership.is_none() {
            return Err(ServiceError::Forbidden(
                "Vous n'etes pas membre de ce serveur.".to_string(),
            ));
        }

        ServerRepository::list_members(pool, server_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur membres: {}", e)))
    }

    // Change le role d'un membre (owner seulement, ne peut pas changer son propre role)
    pub async fn update_member_role(
        pool: &PgPool,
        caller_id: Uuid,
        server_id: Uuid,
        target_id: Uuid,
        role: String,
    ) -> Result<(), ServiceError> {
        let caller_role = ServerRepository::get_member_role(pool, server_id, caller_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if caller_role.as_deref() != Some("owner") {
            return Err(ServiceError::Forbidden(
                "Seul le owner peut changer les roles.".to_string(),
            ));
        }

        if caller_id == target_id {
            return Err(ServiceError::BadRequest(
                "Impossible de changer votre propre role.".to_string(),
            ));
        }

        if role != "admin" && role != "member" {
            return Err(ServiceError::BadRequest(
                "Role invalide. Valeurs acceptees : admin, member.".to_string(),
            ));
        }

        let affected = ServerRepository::update_member_role(pool, server_id, target_id, &role)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        if affected == 0 {
            return Err(ServiceError::NotFound("Membre introuvable.".to_string()));
        }

        Ok(())
    }

    // Expulse un membre du serveur (owner ou admin seulement, ne peut pas kick un owner)
    pub async fn kick_member(
        pool: &PgPool,
        caller_id: Uuid,
        server_id: Uuid,
        target_id: Uuid,
    ) -> Result<(), ServiceError> {
        // 1. Vérifie que celui qui kick a le droit (owner ou admin)
        let caller_role = ServerRepository::get_member_role(pool, server_id, caller_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match caller_role.as_deref() {
            Some("owner") | Some("admin") => {}
            _ => {
                return Err(ServiceError::Forbidden(
                    "Seuls owner et admin peuvent expulser un membre.".to_string(),
                ))
            }
        }

        // 2. Vérifie que la cible n'est pas le owner (intouchable)
        let target_role = ServerRepository::get_member_role(pool, server_id, target_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match target_role.as_deref() {
            None => {
                return Err(ServiceError::NotFound(
                    "Ce membre n'est pas dans le serveur.".to_string(),
                ))
            }
            Some("owner") => {
                return Err(ServiceError::Forbidden(
                    "Impossible d'expulser le owner.".to_string(),
                ))
            }
            _ => {}
        }

        // 3. Un admin ne peut pas kick un autre admin
        if caller_role.as_deref() == Some("admin") && target_role.as_deref() == Some("admin") {
            return Err(ServiceError::Forbidden(
                "Un admin ne peut pas expulser un autre admin.".to_string(),
            ));
        }

        // 4. Supprime le membre (il pourra revenir avec le code d'invitation)
        ServerRepository::remove_member(pool, server_id, target_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur expulsion: {}", e)))
    }

    // Bannit un membre du serveur (owner ou admin, mêmes règles que kick)
    // expires_at = None → ban permanent, Some(...) → ban temporaire
    pub async fn ban_member(
        pool: &PgPool,
        caller_id: Uuid,
        server_id: Uuid,
        target_id: Uuid,
        expires_at: Option<NaiveDateTime>,
    ) -> Result<(), ServiceError> {
        // 1. Vérifie les permissions du caller (même logique que kick)
        let caller_role = ServerRepository::get_member_role(pool, server_id, caller_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match caller_role.as_deref() {
            Some("owner") | Some("admin") => {}
            _ => return Err(ServiceError::Forbidden(
                "Seuls owner et admin peuvent bannir un membre.".to_string(),
            )),
        }

        // 2. Vérifie la cible
        let target_role = ServerRepository::get_member_role(pool, server_id, target_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        match target_role.as_deref() {
            None => return Err(ServiceError::NotFound(
                "Ce membre n'est pas dans le serveur.".to_string(),
            )),
            Some("owner") => return Err(ServiceError::Forbidden(
                "Impossible de bannir le owner.".to_string(),
            )),
            _ => {}
        }

        if caller_role.as_deref() == Some("admin") && target_role.as_deref() == Some("admin") {
            return Err(ServiceError::Forbidden(
                "Un admin ne peut pas bannir un autre admin.".to_string(),
            ));
        }

        // 3. Enregistre le ban en BDD
        BanRepository::insert(pool, server_id, target_id, caller_id, expires_at)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur ban: {}", e)))?;

        // 4. Supprime le membre du serveur (comme un kick)
        ServerRepository::remove_member(pool, server_id, target_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur expulsion: {}", e)))
    }
}
