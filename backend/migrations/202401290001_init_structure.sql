-- table: servers, channels, members
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,           --  nom du serveur
    invite_code VARCHAR(50) UNIQUE NOT NULL, -- Le code pour rejoindre
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- La date de création
);

-- table des CANAUX (channels)
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE, -- Si on supprime le serveur, on supprime ses canaux
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'text', -- Soit 'text', soit 'voice'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- table des MEMBRES (members)
CREATE TABLE IF NOT EXISTS members (
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- L'ID de l'utilisateur 
    role VARCHAR(20) DEFAULT 'guest', -- 'admin' ou 'guest'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (server_id, user_id) -- Un user ne peut être qu'une seule fois dans un même serveur
);