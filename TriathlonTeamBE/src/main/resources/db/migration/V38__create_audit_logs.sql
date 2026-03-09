CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    target_entity_id UUID NOT NULL,
    target_entity_type VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    field_name VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(255),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_logs_target_entity ON audit_logs(target_entity_id, target_entity_type);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN (metadata);

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_actor_user
    FOREIGN KEY (actor_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL;
