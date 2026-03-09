-- This migration creates optimized indexes for the audit_logs table
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction
-- This migration must be executed with executeInTransaction=false

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_audit_logs_target_time ON audit_logs(target_entity_id, timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_actor_time ON audit_logs(actor_user_id, timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_entity_action ON audit_logs(target_entity_type, action, timestamp DESC);

