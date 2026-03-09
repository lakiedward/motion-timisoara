-- V12: Add refresh_tokens table for secure JWT refresh token rotation
-- Security features:
-- - One-time use tokens (marked as used after consumption)
-- - Automatic expiration tracking
-- - Manual revocation support
-- - Indexed for performance

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(500) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_refresh_token_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_refresh_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expires_at ON refresh_tokens(expires_at);

-- Comments for documentation
COMMENT ON TABLE refresh_tokens IS 'Secure refresh tokens for JWT token rotation';
COMMENT ON COLUMN refresh_tokens.token IS 'Cryptographically secure random token (Base64, 512 bits)';
COMMENT ON COLUMN refresh_tokens.used IS 'One-time use flag - token is marked as used after refresh';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Manual revocation flag for logout from all devices';
