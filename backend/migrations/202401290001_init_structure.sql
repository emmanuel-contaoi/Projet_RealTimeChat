-- table: servers, channels, members
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,           
    invite_code VARCHAR(50) UNIQUE NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

-- table des CANAUX 
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE, 
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'text', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- table des MEMBRES 
CREATE TABLE IF NOT EXISTS members (
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, 
    role VARCHAR(20) DEFAULT 'guest', 
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (server_id, user_id) 
);