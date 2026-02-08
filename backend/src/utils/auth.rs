use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use crate::{models::User, state::AppState};
use crate::utils::jwt::validate_token;

// Extension pour stocker l'utilisateur dans la requête
#[derive(Clone)]
pub struct AuthUser(pub User);


pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    // Extraire le header Authorization
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization header".to_string()))?;
    
    // Vérifier le format "Bearer <token>"
    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid authorization format".to_string()))?;
    
    // Valider le token et extraire l'user_id
    let user_id = validate_token(token)
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
    
    // Récupére l'utilisateur depuis la DB
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    request.extensions_mut().insert(AuthUser(user));
    Ok(next.run(request).await)
}