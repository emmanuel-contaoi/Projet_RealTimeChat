CREATE TABLE IF NOT EXISTS dm_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE UNIQUE INDEX IF NOT EXISTS unique_dm_pair_idx ON dm_channels (
    LEAST(user1_id, user2_id), 
    GREATEST(user1_id, user2_id)
);