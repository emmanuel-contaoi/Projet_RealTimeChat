-- Créer la table users si elle n'existe pas
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Utilisateur de test commun à toute l'équipe
-- Email: test@example.com
-- Password: password123
INSERT INTO users (id, email, password_hash, created_at) 
VALUES (
  '5d4bf590-a8c0-4e92-b752-11caa0638df5',
  'test@example.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ7UqXqKqOC',
  NOW()
) 
ON CONFLICT (email) DO NOTHING;
