-- ============================================
-- Webhook Notifications for Supabase Sync
-- ============================================
--
-- Uses pg_net extension to send HTTP webhooks to Supabase
-- when tenant operations complete in the CRM.
--
-- This ensures eventual consistency:
-- 1. Supabase calls CRM to create/update tenant
-- 2. CRM saves data and triggers webhook
-- 3. Supabase receives confirmation and updates crm.tenants
--

-- Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- Webhook Queue Table
-- ============================================
-- Stores pending webhooks for retry if network fails

CREATE TABLE IF NOT EXISTS core.webhook_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target
    webhook_url TEXT NOT NULL,

    -- Payload
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_queue_pending ON core.webhook_queue(status, next_retry_at)
    WHERE status IN ('pending', 'failed');

-- ============================================
-- Webhook Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS core.webhook_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default config (update these after deployment)
INSERT INTO core.webhook_config (name, value) VALUES
    ('supabase_webhook_url', 'https://your-project.supabase.co/functions/v1/crm-webhook'),
    ('webhook_secret', 'change-me-in-production')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Send Webhook Function
-- ============================================

CREATE OR REPLACE FUNCTION core.send_webhook(
    p_event_type TEXT,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_webhook_url TEXT;
    v_webhook_secret TEXT;
    v_queue_id UUID;
    v_signature TEXT;
    v_timestamp BIGINT;
    v_request_id BIGINT;
BEGIN
    -- Get webhook config
    SELECT value INTO v_webhook_url FROM core.webhook_config WHERE name = 'supabase_webhook_url';
    SELECT value INTO v_webhook_secret FROM core.webhook_config WHERE name = 'webhook_secret';

    IF v_webhook_url IS NULL OR v_webhook_url = 'https://your-project.supabase.co/functions/v1/crm-webhook' THEN
        -- Webhook not configured, just queue it
        INSERT INTO core.webhook_queue (webhook_url, event_type, payload, status)
        VALUES (COALESCE(v_webhook_url, 'not-configured'), p_event_type, p_payload, 'pending')
        RETURNING id INTO v_queue_id;

        RETURN v_queue_id;
    END IF;

    -- Generate timestamp and signature
    v_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT;
    v_signature := encode(
        hmac(
            v_timestamp::TEXT || '.' || p_payload::TEXT,
            v_webhook_secret,
            'sha256'
        ),
        'hex'
    );

    -- Queue the webhook
    INSERT INTO core.webhook_queue (webhook_url, event_type, payload, status)
    VALUES (v_webhook_url, p_event_type, p_payload, 'sending')
    RETURNING id INTO v_queue_id;

    -- Send via pg_net
    SELECT net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-signature', v_timestamp::TEXT || '.' || v_signature,
            'x-webhook-event', p_event_type
        ),
        body := jsonb_build_object(
            'event', p_event_type,
            'timestamp', v_timestamp,
            'payload', p_payload
        )
    ) INTO v_request_id;

    -- Update queue with request ID
    UPDATE core.webhook_queue
    SET status = 'sent', sent_at = NOW()
    WHERE id = v_queue_id;

    RETURN v_queue_id;

EXCEPTION WHEN OTHERS THEN
    -- Mark as failed for retry
    UPDATE core.webhook_queue
    SET status = 'failed',
        last_error = SQLERRM,
        attempts = attempts + 1,
        next_retry_at = NOW() + INTERVAL '1 minute' * POWER(2, attempts)
    WHERE id = v_queue_id;

    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Workspace Triggers
-- ============================================

-- Trigger after workspace is created
CREATE OR REPLACE FUNCTION core.notify_workspace_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM core.send_webhook('tenant.created', jsonb_build_object(
        'crm_workspace_id', NEW.id,
        'subdomain', NEW.subdomain,
        'display_name', NEW."displayName",
        'created_at', NEW."createdAt"
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger after workspace is updated (disabled/enabled)
CREATE OR REPLACE FUNCTION core.notify_workspace_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if disabled status changed
    IF OLD."isDisabled" IS DISTINCT FROM NEW."isDisabled" THEN
        IF NEW."isDisabled" = true THEN
            PERFORM core.send_webhook('tenant.disabled', jsonb_build_object(
                'crm_workspace_id', NEW.id,
                'subdomain', NEW.subdomain,
                'disabled_at', NEW."disabledAt",
                'disabled_reason', NEW."disabledReason"
            ));
        ELSE
            PERFORM core.send_webhook('tenant.enabled', jsonb_build_object(
                'crm_workspace_id', NEW.id,
                'subdomain', NEW.subdomain
            ));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger after workspace is deleted
CREATE OR REPLACE FUNCTION core.notify_workspace_deleted()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM core.send_webhook('tenant.deleted', jsonb_build_object(
        'crm_workspace_id', OLD.id,
        'subdomain', OLD.subdomain
    ));
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on workspace table
DROP TRIGGER IF EXISTS trigger_workspace_created ON core.workspace;
CREATE TRIGGER trigger_workspace_created
    AFTER INSERT ON core.workspace
    FOR EACH ROW
    EXECUTE FUNCTION core.notify_workspace_created();

DROP TRIGGER IF EXISTS trigger_workspace_updated ON core.workspace;
CREATE TRIGGER trigger_workspace_updated
    AFTER UPDATE ON core.workspace
    FOR EACH ROW
    EXECUTE FUNCTION core.notify_workspace_updated();

DROP TRIGGER IF EXISTS trigger_workspace_deleted ON core.workspace;
CREATE TRIGGER trigger_workspace_deleted
    AFTER DELETE ON core.workspace
    FOR EACH ROW
    EXECUTE FUNCTION core.notify_workspace_deleted();

-- ============================================
-- Retry Failed Webhooks (call periodically)
-- ============================================

CREATE OR REPLACE FUNCTION core.retry_failed_webhooks()
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    v_webhook RECORD;
BEGIN
    FOR v_webhook IN
        SELECT * FROM core.webhook_queue
        WHERE status = 'failed'
        AND attempts < max_attempts
        AND next_retry_at <= NOW()
        ORDER BY created_at
        LIMIT 100
    LOOP
        PERFORM core.send_webhook(v_webhook.event_type, v_webhook.payload);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE core.webhook_queue IS 'Queue for outgoing webhooks to Supabase';
COMMENT ON TABLE core.webhook_config IS 'Configuration for webhook endpoints';
COMMENT ON FUNCTION core.send_webhook IS 'Send a webhook notification to Supabase';
COMMENT ON FUNCTION core.retry_failed_webhooks IS 'Retry failed webhooks (call from cron)';
