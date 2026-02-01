use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade, Message},
    response::Response,
};
use crate::websocket::events::{ClientEvent, ServerEvent};

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
                
                // Parser le JSON en ClientEvent
                match serde_json::from_str::<ClientEvent>(&text) {
                    Ok(event) => {
                        // Router vers la bonne action
                        handle_client_event(event, &mut socket).await;
                    }
                    Err(e) => {
                        println!("JSON invalide: {}", e);
                        
                        let error = ServerEvent::Error {
                            message: format!("JSON invalide: {}", e),
                        };
                        
                        if let Ok(json) = error.to_json() {
                            let _ = socket.send(Message::Text(json.into())).await;
                        }
                    }
                }
            }
            
            // Le client a fermé la connexion
            Ok(Message::Close(_)) => {
                println!("Connexion fermée");
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

    println!("Déconnecté");
}

// Route les événements des client vers les bonnes actions
async fn handle_client_event(event: ClientEvent, socket: &mut WebSocket) {
    match event {
        ClientEvent::MessageSend { channel_id, content } => {
            println!("Message pour channel {}: {}", channel_id, content);
            
            // TODO: faire la sauvegarde des messages dans MongoDB
            // TODO: Broadcaster à tous les users du channel
            
            // Pour l'instant on fait un echo amélioré pour pouvoir tester le websocket
            let response = ServerEvent::MessageNew {
                id: uuid::Uuid::new_v4().to_string(),
                channel_id: channel_id.clone(),
                user_id: "test-user".to_string(),
                username: "TestUser".to_string(),
                content: content.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
            };
            
            if let Ok(json) = response.to_json() {
                let _ = socket.send(Message::Text(json.into())).await;
            }
        }
        
        ClientEvent::TypingStart { channel_id } => {
            println!("Utilisateur tape dans channel {}", channel_id);
            
            // TODO: Broadcaster aux autres users
        }
        
        ClientEvent::TypingStop { channel_id } => {
            println!("Utilisateur arrête de taper dans channel {}", channel_id);
        }
        
        ClientEvent::JoinChannel { channel_id } => {
            println!("Utilisateur rejoint channel {}", channel_id);
            
            // TODO: Ajouter à la room avec RoomManager
        }
        
        ClientEvent::LeaveChannel { channel_id } => {
            println!("Utilisateur quitte channel {}", channel_id);
            
            // TODO: Retirer de la room
        }
    }
}