# Nexus - Messagerie temps réel

Application de messagerie inspirée de Discord : serveurs, channels, messages en temps réel.

## Stack

- **Frontend** : Next.js
- **Backend** : Rust (Axum)
- **Bases de données** : PostgreSQL (utilisateurs, serveurs) + MongoDB (messages)
- **Temps réel** : WebSocket
- **Auth** : JWT

## Lancement

### Pré-requis

- Rust / Cargo
- Node.js 20+
- Docker (pour PostgreSQL et MongoDB)

### Variables d'environnement

**Backend** (`backend/.env`) :
```
DATABASE_URL=postgres://user:password@localhost:5432/rtc
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET=votre-secret
PORT=3001
```

**Frontend** (`frontend/.env.local`) :
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Démarrage

```bash
# Lancer les bases de données
docker compose up -d postgres mongo

# Backend
cd backend
cargo run

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

L'application est accessible sur `http://localhost:3000`.

## API

### Auth

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/auth/signup` | Inscription |
| POST | `/auth/login` | Connexion |
| GET | `/me` | Utilisateur courant |

### Serveurs

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/servers` | Lister ses serveurs |
| POST | `/servers` | Créer un serveur |
| POST | `/servers/join` | Rejoindre via code d'invitation |
| DELETE | `/servers/:id` | Supprimer un serveur |
| DELETE | `/servers/:id/leave` | Quitter un serveur |
| GET | `/servers/:id/members` | Lister les membres |
| PUT | `/servers/:id/members/:uid/role` | Changer le rôle d'un membre |
| GET | `/servers/:id/channels` | Lister les channels |
| POST | `/servers/:id/channels` | Créer un channel |

### Channels & Messages

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/channels/:id` | Détails d'un channel |
| PUT | `/channels/:id` | Modifier un channel |
| DELETE | `/channels/:id` | Supprimer un channel |
| GET | `/channels/:id/messages` | Historique des messages |
| POST | `/channels/:id/messages` | Envoyer un message |
| DELETE | `/messages/:id` | Supprimer un message |

## WebSocket

### Connexion

```
ws://localhost:3001/ws?token=<JWT>
```

Le token est obtenu via `/auth/login` ou `/auth/signup`.

### Évènements client -> serveur

Tous les messages sont du JSON avec un champ `type`.

| Évènement | Champs | Description |
|-----------|--------|-------------|
| `message_send` | `channel_id`, `content` | Envoyer un message |
| `typing_start` | `channel_id` | Commencer à écrire |
| `typing_stop` | `channel_id` | Arrêter d'écrire |
| `join_channel` | `channel_id` | Rejoindre un channel |
| `leave_channel` | `channel_id` | Quitter un channel |

Exemple :
```json
{ "type": "message_send", "channel_id": "uuid", "content": "Hello!" }
```

### Évènements serveur -> client

| Évènement | Champs | Description |
|-----------|--------|-------------|
| `message_new` | `id`, `channel_id`, `user_id`, `username`, `content`, `created_at` | Nouveau message |
| `user_typing` | `channel_id`, `user_id`, `username` | Quelqu'un écrit |
| `user_connected` | `user_id`, `username` | Utilisateur en ligne |
| `user_disconnected` | `user_id` | Utilisateur hors ligne |
| `channel_users` | `channel_id`, `users[]` | Liste des connectés au channel |
| `error` | `message` | Erreur |

Exemple :
```json
{ "type": "message_new", "id": "uuid", "channel_id": "uuid", "user_id": "uuid", "username": "alice", "content": "Hello!", "created_at": "2026-02-08T12:00:00+00:00" }
```
