-- Table des bans de serveur (permanent et temporaire)
CREATE TABLE IF NOT EXISTS server_bans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    banned_by   UUID NOT NULL,
    -- NULL = ban permanent, valeur = ban temporaire avec expiration
    expires_at  TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Un utilisateur ne peut avoir qu'un seul ban actif par serveur
    UNIQUE(server_id, user_id)
);

CREATE INDEX idx_server_bans_server_user ON server_bans(server_id, user_id);
