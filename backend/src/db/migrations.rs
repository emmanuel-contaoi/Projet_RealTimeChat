// Creation des tables au demarrage si elles n'existent pas encore

use sqlx::PgPool;

pub async fn run_migrations(pool: &PgPool) {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            username TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )
    .execute(pool)
    .await
    .expect("Migration users echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS servers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT now()
        )",
    )
    .execute(pool)
    .await
    .expect("Migration servers echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'text'
        )",
    )
    .execute(pool)
    .await
    .expect("Migration channels echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'member',
            UNIQUE(server_id, user_id)
        )",
    )
    .execute(pool)
    .await
    .expect("Migration members echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user_friends (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, friend_id)
        )",
    )
    .execute(pool)
    .await
    .expect("Migration user_friends echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS friend_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            responded_at TIMESTAMPTZ,
            CHECK (sender_id <> receiver_id),
            CHECK (status IN ('pending', 'accepted', 'rejected'))
        )",
    )
    .execute(pool)
    .await
    .expect("Migration friend_requests echouee");

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status
         ON friend_requests(receiver_id, status, created_at DESC)",
    )
    .execute(pool)
    .await
    .expect("Migration idx_friend_requests_receiver_status echouee");

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status
         ON friend_requests(sender_id, status, created_at DESC)",
    )
    .execute(pool)
    .await
    .expect("Migration idx_friend_requests_sender_status echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS server_bans (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            user_id     UUID NOT NULL,
            banned_by   UUID NOT NULL,
            expires_at  TIMESTAMP,
            created_at  TIMESTAMP DEFAULT now(),
            UNIQUE(server_id, user_id)
        )",
    )
    .execute(pool)
    .await
    .expect("Migration server_bans echouee");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS dm_channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await
    .expect("Migration dm_channels echouee");

    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS unique_dm_pair_idx ON dm_channels (
            LEAST(user1_id, user2_id),
            GREATEST(user1_id, user2_id)
        )",
    )
    .execute(pool)
    .await
    .expect("Migration unique_dm_pair_idx echouee");

    // Fix les doublons de owner (garde un seul owner par serveur)
    sqlx::query(
        "UPDATE members SET role = 'admin'
         WHERE role = 'owner'
           AND id NOT IN (
               SELECT DISTINCT ON (server_id) id
               FROM members
               WHERE role = 'owner'
               ORDER BY server_id, id
           )",
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) DEFAULT NULL",
    )
    .execute(pool)
    .await
    .expect("Migration avatar_url echouee");
}
