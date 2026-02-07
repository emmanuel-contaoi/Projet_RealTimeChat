# T-JSF-600-PAR_22 - Messagerie temps reel

Application de messagerie temps reel inspiree de Discord, avec serveurs, channels, et WebSocket.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | Next.js 15 (React 19, TypeScript, Tailwind CSS) |
| **Backend** | Rust (Axum 0.8) |
| **Base relationnelle** | PostgreSQL (sqlx) |
| **Base documents** | MongoDB (messages) |
| **Temps reel** | WebSocket natif |
| **Auth** | JWT (jsonwebtoken) |

## Architecture

```
backend/src/
  main.rs              # Point d'entree, migrations, routes
  state.rs             # Etat partage (pools, connexions WS, users online)
  db/                  # Connexions base de donnees (MongoDB)
  models/              # Modeles de donnees (User, Auth)
  routes/              # Endpoints HTTP (auth, friends, users)
  modules/servers/     # CRUD serveurs, channels, messages, membres
  utils/               # JWT + middleware auth
  websocket/           # Handler WS, events, room manager

frontend/src/
  app/                 # Pages Next.js (App Router)
    connexion/         # Page de connexion
    inscription/       # Page d'inscription
    conversations/     # Page principale
      components/      # 12 composants React (Sidebar, ChatPanel, etc.)
      types.ts         # Types TypeScript
      utils.ts         # Fonctions utilitaires
  hooks/               # useWebSocket (hook custom)
  services/            # api.ts (services axios centralises)
```

## Fonctionnalites

### Serveurs
- Creation de serveur avec channels
- Rejoindre un serveur via code d'invitation
- Quitter / supprimer un serveur
- Copier le code d'invitation
- Gestion multi-serveurs

### Channels
- Creation / suppression de channels
- Listing des channels par serveur
- Selection et navigation entre channels

### Messages temps reel
- Envoi et reception via WebSocket
- Persistance dans MongoDB
- Historique des messages au chargement

### Roles et permissions
- **Owner** : createur du serveur (suppression serveur, gestion channels, promotion/retrograde)
- **Admin** : promu par l'owner (gestion channels)
- **Member** : membre standard (lecture/ecriture)

### Statut en ligne
- Indicateur vert/gris pour chaque membre
- Broadcast global via WebSocket (connect/disconnect)

### Indicateur de frappe
- Animation "X ecrit..." en temps reel
- Throttle cote client (2s), auto-clear (3s)

### Amis
- Recherche d'utilisateurs
- Ajout / suppression d'amis
- Liste d'amis avec statut

## Lancement

### Pre-requis
- Rust (cargo)
- Node.js 18+
- PostgreSQL
- MongoDB
- Docker (optionnel, voir compose.yml)

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

### Demarrage

```bash
# Backend
cd backend
cargo run

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

L'application est accessible sur `http://localhost:3000`.

## API Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/auth/register` | Inscription |
| POST | `/auth/login` | Connexion |
| GET | `/auth/me` | Utilisateur courant |
| GET | `/servers` | Lister ses serveurs |
| POST | `/servers` | Creer un serveur |
| POST | `/servers/join` | Rejoindre un serveur |
| DELETE | `/servers/:id` | Supprimer un serveur |
| DELETE | `/servers/:id/leave` | Quitter un serveur |
| GET | `/servers/:id/members` | Lister les membres |
| PUT | `/servers/:id/members/:uid/role` | Changer le role |
| GET | `/servers/:id/channels` | Lister les channels |
| POST | `/servers/:id/channels` | Creer un channel |
| DELETE | `/servers/channels/:id` | Supprimer un channel |
| GET | `/servers/channels/:id/messages` | Historique messages |
| WS | `/ws?token=JWT` | WebSocket temps reel |

## WebSocket Events

**Client -> Serveur :**
- `message_send` : envoyer un message
- `typing_start` : indicateur de frappe
- `join_channel` : rejoindre un channel
- `leave_channel` : quitter un channel

**Serveur -> Client :**
- `message_new` : nouveau message
- `user_typing` : quelqu'un ecrit
- `user_connected` / `user_disconnected` : statut en ligne
- `channel_users` : liste des utilisateurs connectes
