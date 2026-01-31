use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade, Message},
    response::Response,
};

// Upgrade la connexion HTTP vers WebSocket
pub async fn websocket_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

// Gère une connexion WebSocket individuelle
async fn handle_socket(mut socket: WebSocket) {
    println!("WebSocket connecté");

    // Boucle qui écoute les messages du client
    while let Some(msg) = socket.recv().await {
        match msg {
            // Message texte reçu
            Ok(Message::Text(text)) => {
                println!("Reçu: {}", text);
                
                // Pour l'instant on fait juste un echo pour tester
                if socket.send(Message::Text(text)).await.is_err() {
                    break;
                }
            }
            
            // Le client a fermé la connexion
            Ok(Message::Close(_)) => {
                println!("Connexion fermé");
                break;
            }
            
            // Répondre aux pings pour garder la connexion
            Ok(Message::Ping(data)) => {
                if socket.send(Message::Pong(data)).await.is_err() {
                    break;
                }
            }
            
            Err(e) => {
                println!("Erreur: {}", e);
                break;
            }
            
            _ => {}
        }
    }

    println!("Déconnecter");
}