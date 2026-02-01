use sqlx::PgPool;
use mongodb::Client;
use axum::extract::FromRef;


#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub mongo: Client,
}


impl FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}


impl FromRef<AppState> for Client {
    fn from_ref(state: &AppState) -> Self {
        state.mongo.clone()
    }
}