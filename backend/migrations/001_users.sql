-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour le login (recherche par email)
CREATE INDEX idx_users_email ON users(email);
