use sqlx::PgPool;
use uuid::Uuid;

use crate::modules::servers::models::{
    CreateServerRequest, MemberRow, Server, UpdateServerRequest,
};
use crate::repositories::ban_repository::BanRepository;
use crate::repositories::server_repository::ServerRepository;
use crate::services::ServiceError;
use chrono::NaiveDateTime;

pub struct ServerService;

fn generate_invite_code() -> String {
    Uuid::new_v4().to_string()[..8].to_string()
}

fn format_active_ban_message(expires_at: Option<NaiveDateTime>) -> String {
    match expires_at {
        None => "Vous etes banni definitivement de ce serveur.".to_string(),
        Some(exp) => format!(
            "Vous etes banni de ce serveur jusqu'au {}.",
            exp.format("%d/%m/%Y %H:%M")
        ),
    }
}

fn ensure_server_owner(role: Option<&str>, message: &str) -> Result<(), ServiceError> {
    if role == Some("owner") {
        Ok(())
    } else {
        Err(ServiceError::Forbidden(message.to_string()))
    }
}

fn ensure_server_owner_or_admin(
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

fn validate_member_role_change(
    caller_id: Uuid,
    target_id: Uuid,
    role: &str,
) -> Result<(), ServiceError> {
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

    Ok(())
}

fn validate_moderation_roles(
    caller_role: Option<&str>,
    target_role: Option<&str>,
    action: &str,
) -> Result<(), ServiceError> {
    let owner_action = if matches!(
        action.chars().next(),
        Some('a' | 'e' | 'i' | 'o' | 'u' | 'y')
    ) {
        format!("d'{}", action)
    } else {
        format!("de {}", action)
    };

    match caller_role {
        Some("owner") | Some("admin") => {}
        _ => {
            return Err(ServiceError::Forbidden(format!(
                "Seuls owner et admin peuvent {} un membre.",
                action
            )))
        }
    }

    match target_role {
        None => {
            return Err(ServiceError::NotFound(
                "Ce membre n'est pas dans le serveur.".to_string(),
            ))
        }
        Some("owner") => {
            return Err(ServiceError::Forbidden(format!(
                "Impossible {} le owner.",
                owner_action
            )))
        }
        _ => {}
    }

    if caller_role == Some("admin") && target_role == Some("admin") {
        return Err(ServiceError::Forbidden(format!(
            "Un admin ne peut pas {} un autre admin.",
            action
        )));
    }

    Ok(())
}

fn ensure_can_leave_server(role: Option<&str>) -> Result<(), ServiceError> {
    match role {
        Some("owner") => Err(ServiceError::Forbidden(
            "Le owner ne peut pas quitter son serveur.".to_string(),
        )),
        None => Err(ServiceError::NotFound(
            "Vous n'etes pas membre de ce serveur.".to_string(),
        )),
        Some(_) => Ok(()),
    }
}

fn ensure_can_delete_server(role: Option<&str>) -> Result<(), ServiceError> {
    match role {
        Some("owner") => Ok(()),
        Some(_) => Err(ServiceError::Forbidden(
            "Seul le owner peut supprimer le serveur.".to_string(),
        )),
        None => Err(ServiceError::NotFound(
            "Vous n'etes pas membre de ce serveur.".to_string(),
        )),
    }
}

fn ensure_server_membership(role: Option<&str>, message: &str) -> Result<(), ServiceError> {
    if role.is_some() {
        Ok(())
    } else {
        Err(ServiceError::Forbidden(message.to_string()))
    }
}

fn ensure_transfer_target_membership(role: Option<&str>) -> Result<(), ServiceError> {
    if role.is_some() {
        Ok(())
    } else {
        Err(ServiceError::NotFound(
            "L'utilisateur cible n'est pas membre du serveur.".to_string(),
        ))
    }
}

fn ensure_member_role_updated(affected: u64) -> Result<(), ServiceError> {
    if affected == 0 {
        Err(ServiceError::NotFound("Membre introuvable.".to_string()))
    } else {
        Ok(())
    }
}

impl ServerService {
    // Cree un serveur avec un code d'invitation unique et ajoute le createur comme owner
    pub async fn create_server(
        pool: &PgPool,
        user_id: Uuid,
        payload: CreateServerRequest,
    ) -> Result<Server, ServiceError> {
        let invite_code = generate_invite_code();

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
            .ok_or(ServiceError::NotFound(
                "Code d'invitation invalide".to_string(),
            ))?;

        // Vérifie si l'utilisateur est banni de ce serveur
        let active_ban = BanRepository::get_active_ban(pool, server.id, user_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur ban: {}", e)))?;

        if let Some(ban) = active_ban {
            return Err(ServiceError::Forbidden(format_active_ban_message(
                ban.expires_at,
            )));
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

        ensure_can_leave_server(role.as_deref())?;

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

        ensure_can_delete_server(role.as_deref())?;

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

        ensure_server_membership(role.as_deref(), "Vous n'etes pas membre de ce serveur.")?;

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

        ensure_server_owner_or_admin(
            role.as_deref(),
            "Seuls owner/admin peuvent modifier le serveur.",
            "Vous n'etes pas membre de ce serveur.",
        )?;

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

        ensure_server_owner(
            caller_role.as_deref(),
            "Seul le owner peut transferer la propriete.",
        )?;

        let target_role = ServerRepository::get_member_role(pool, server_id, new_owner_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_transfer_target_membership(target_role.as_deref())?;

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

        ensure_server_membership(
            membership.as_deref(),
            "Vous n'etes pas membre de ce serveur.",
        )?;

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

        ensure_server_owner(
            caller_role.as_deref(),
            "Seul le owner peut changer les roles.",
        )?;
        validate_member_role_change(caller_id, target_id, &role)?;

        let affected = ServerRepository::update_member_role(pool, server_id, target_id, &role)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        ensure_member_role_updated(affected)?;
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

        // 2. Vérifie que la cible n'est pas le owner (intouchable)
        let target_role = ServerRepository::get_member_role(pool, server_id, target_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        validate_moderation_roles(caller_role.as_deref(), target_role.as_deref(), "expulser")?;

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
            _ => {
                return Err(ServiceError::Forbidden(
                    "Seuls owner et admin peuvent bannir un membre.".to_string(),
                ))
            }
        }

        // 2. Vérifie la cible
        let target_role = ServerRepository::get_member_role(pool, server_id, target_id)
            .await
            .map_err(|e| ServiceError::Internal(format!("Erreur serveur: {}", e)))?;

        validate_moderation_roles(caller_role.as_deref(), target_role.as_deref(), "bannir")?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

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
    fn generate_invite_code_returns_eight_character_prefix() {
        let invite_code = generate_invite_code();

        assert_eq!(invite_code.len(), 8);
        assert!(invite_code.chars().all(|char| char.is_ascii_hexdigit()));
    }

    #[test]
    fn format_active_ban_message_supports_permanent_and_temporary_bans() {
        assert_eq!(
            format_active_ban_message(None),
            "Vous etes banni definitivement de ce serveur."
        );

        let expires_at = NaiveDate::from_ymd_opt(2026, 3, 17)
            .expect("date should be valid")
            .and_hms_opt(21, 45, 0)
            .expect("time should be valid");

        assert_eq!(
            format_active_ban_message(Some(expires_at)),
            "Vous etes banni de ce serveur jusqu'au 17/03/2026 21:45."
        );
    }

    #[test]
    fn ensure_server_owner_allows_only_owners() {
        assert!(ensure_server_owner(Some("owner"), "forbidden").is_ok());

        match ensure_server_owner(Some("admin"), "forbidden") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "forbidden"),
            other => panic!("unexpected result: {:?}", other),
        }

        match ensure_server_owner(None, "forbidden") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "forbidden"),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_server_owner_or_admin_rejects_members_and_missing_users() {
        assert!(ensure_server_owner_or_admin(Some("owner"), "forbidden", "missing").is_ok());
        assert!(ensure_server_owner_or_admin(Some("admin"), "forbidden", "missing").is_ok());

        match ensure_server_owner_or_admin(Some("member"), "forbidden", "missing") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "forbidden"),
            other => panic!("unexpected result: {:?}", other),
        }

        match ensure_server_owner_or_admin(None, "forbidden", "missing") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "missing"),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn validate_member_role_change_rejects_self_target_and_invalid_role() {
        let user_id = Uuid::new_v4();

        match validate_member_role_change(user_id, user_id, "admin") {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "Impossible de changer votre propre role.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match validate_member_role_change(user_id, Uuid::new_v4(), "owner") {
            Err(ServiceError::BadRequest(message)) => {
                assert_eq!(message, "Role invalide. Valeurs acceptees : admin, member.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        assert!(validate_member_role_change(user_id, Uuid::new_v4(), "member").is_ok());
    }

    #[test]
    fn validate_moderation_roles_enforces_expected_hierarchy() {
        assert!(validate_moderation_roles(Some("owner"), Some("member"), "expulser").is_ok());
        assert!(validate_moderation_roles(Some("admin"), Some("member"), "bannir").is_ok());

        match validate_moderation_roles(Some("member"), Some("member"), "expulser") {
            Err(ServiceError::Forbidden(message)) => {
                assert_eq!(message, "Seuls owner et admin peuvent expulser un membre.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match validate_moderation_roles(Some("owner"), None, "bannir") {
            Err(ServiceError::NotFound(message)) => {
                assert_eq!(message, "Ce membre n'est pas dans le serveur.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match validate_moderation_roles(Some("owner"), Some("owner"), "bannir") {
            Err(ServiceError::Forbidden(message)) => {
                assert_eq!(message, "Impossible de bannir le owner.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match validate_moderation_roles(Some("admin"), Some("admin"), "expulser") {
            Err(ServiceError::Forbidden(message)) => {
                assert_eq!(message, "Un admin ne peut pas expulser un autre admin.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_can_leave_server_enforces_owner_and_membership_rules() {
        assert!(ensure_can_leave_server(Some("member")).is_ok());
        assert!(ensure_can_leave_server(Some("admin")).is_ok());

        match ensure_can_leave_server(Some("owner")) {
            Err(ServiceError::Forbidden(message)) => {
                assert_eq!(message, "Le owner ne peut pas quitter son serveur.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match ensure_can_leave_server(None) {
            Err(ServiceError::NotFound(message)) => {
                assert_eq!(message, "Vous n'etes pas membre de ce serveur.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_can_delete_server_requires_owner_role() {
        assert!(ensure_can_delete_server(Some("owner")).is_ok());

        match ensure_can_delete_server(Some("admin")) {
            Err(ServiceError::Forbidden(message)) => {
                assert_eq!(message, "Seul le owner peut supprimer le serveur.")
            }
            other => panic!("unexpected result: {:?}", other),
        }

        match ensure_can_delete_server(None) {
            Err(ServiceError::NotFound(message)) => {
                assert_eq!(message, "Vous n'etes pas membre de ce serveur.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_server_membership_requires_existing_role() {
        assert!(ensure_server_membership(Some("member"), "missing").is_ok());

        match ensure_server_membership(None, "missing") {
            Err(ServiceError::Forbidden(message)) => assert_eq!(message, "missing"),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_transfer_target_membership_requires_existing_member() {
        assert!(ensure_transfer_target_membership(Some("member")).is_ok());

        match ensure_transfer_target_membership(None) {
            Err(ServiceError::NotFound(message)) => {
                assert_eq!(message, "L'utilisateur cible n'est pas membre du serveur.")
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    fn ensure_member_role_updated_requires_affected_row() {
        assert!(ensure_member_role_updated(1).is_ok());

        match ensure_member_role_updated(0) {
            Err(ServiceError::NotFound(message)) => assert_eq!(message, "Membre introuvable."),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[tokio::test]
    async fn server_service_methods_return_internal_errors_when_database_is_unavailable() {
        let pool = crate::utils::test_pg_pool();
        let user_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let server_id = Uuid::new_v4();

        let create_result = ServerService::create_server(
            &pool,
            user_id,
            CreateServerRequest {
                name: "Backend".to_string(),
            },
        )
        .await;
        assert_internal_error(create_result, "Erreur création:");

        let list_result = ServerService::list_servers(&pool, user_id).await;
        assert_internal_error(list_result, "Erreur récupération:");

        let join_result = ServerService::join_server(&pool, user_id, "invite123").await;
        assert_internal_error(join_result, "Erreur serveur:");

        let leave_result = ServerService::leave_server(&pool, user_id, server_id).await;
        assert_internal_error(leave_result, "Erreur serveur:");

        let delete_result = ServerService::delete_server(&pool, user_id, server_id).await;
        assert_internal_error(delete_result, "Erreur serveur:");

        let get_result = ServerService::get_server(&pool, user_id, server_id).await;
        assert_internal_error(get_result, "Erreur serveur:");

        let update_result = ServerService::update_server(
            &pool,
            user_id,
            server_id,
            UpdateServerRequest {
                name: "Renamed".to_string(),
            },
        )
        .await;
        assert_internal_error(update_result, "Erreur serveur:");

        let transfer_result =
            ServerService::transfer_ownership(&pool, user_id, server_id, target_id).await;
        assert_internal_error(transfer_result, "Erreur serveur:");

        let members_result = ServerService::list_members(&pool, user_id, server_id).await;
        assert_internal_error(members_result, "Erreur serveur:");

        let update_role_result = ServerService::update_member_role(
            &pool,
            user_id,
            server_id,
            target_id,
            "admin".to_string(),
        )
        .await;
        assert_internal_error(update_role_result, "Erreur serveur:");

        let kick_result = ServerService::kick_member(&pool, user_id, server_id, target_id).await;
        assert_internal_error(kick_result, "Erreur serveur:");

        let expires_at = NaiveDate::from_ymd_opt(2026, 3, 17)
            .expect("date should be valid")
            .and_hms_opt(23, 0, 0)
            .expect("time should be valid");
        let ban_result =
            ServerService::ban_member(&pool, user_id, server_id, target_id, Some(expires_at)).await;
        assert_internal_error(ban_result, "Erreur serveur:");
    }
}
