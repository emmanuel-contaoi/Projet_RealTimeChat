pub mod handlers;
pub mod models;

use actix_web::web;

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/servers")
            .route("", web::post().to(handlers::create_server))
    );
}