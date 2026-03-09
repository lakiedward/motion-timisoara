ALTER TABLE users
    ADD COLUMN oauth_provider VARCHAR(50),
    ADD COLUMN oauth_provider_id VARCHAR(255),
    ADD COLUMN avatar_url TEXT;

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX idx_users_oauth_provider_id
    ON users (oauth_provider, oauth_provider_id)
    WHERE oauth_provider IS NOT NULL
      AND oauth_provider_id IS NOT NULL;

