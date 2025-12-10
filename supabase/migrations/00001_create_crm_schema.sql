-- ============================================
-- CRM Integration Schema
-- ============================================
--
-- This schema contains tables shared between:
-- - Supabase (control unit - client app, auth, edge functions)
-- - Twenty CRM (DigitalOcean droplet - main CRM data)
--
-- Purpose: Provide a clean interface for tenant management
-- and synchronization between the two systems.
--

-- Create the CRM schema
CREATE SCHEMA IF NOT EXISTS crm;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA crm TO authenticated;
GRANT USAGE ON SCHEMA crm TO service_role;

-- ============================================
-- Tenants Table
-- ============================================
-- Master list of tenants managed by the parent platform.
-- This is the source of truth for tenant lifecycle.

CREATE TABLE IF NOT EXISTS crm.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    display_name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,

    -- Link to CRM workspace (set after CRM creates the workspace)
    crm_workspace_id UUID UNIQUE,

    -- Owner info (links to Supabase auth.users)
    owner_user_id UUID REFERENCES auth.users(id),
    owner_email TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled', 'deleted')),
    disabled_at TIMESTAMPTZ,
    disabled_reason TEXT,

    -- Metadata
    admin_notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_crm_tenants_owner_email ON crm.tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_crm_tenants_status ON crm.tenants(status);
CREATE INDEX IF NOT EXISTS idx_crm_tenants_subdomain ON crm.tenants(subdomain);

-- ============================================
-- Tenant Users Table
-- ============================================
-- Maps Supabase users to tenants they belong to.

CREATE TABLE IF NOT EXISTS crm.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL REFERENCES crm.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role within the tenant
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure user can only be in a tenant once
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_tenant_users_tenant ON crm.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_tenant_users_user ON crm.tenant_users(user_id);

-- ============================================
-- Tenant Events Table
-- ============================================
-- Audit log of tenant lifecycle events.
-- Used for sync and debugging.

CREATE TABLE IF NOT EXISTS crm.tenant_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL REFERENCES crm.tenants(id) ON DELETE CASCADE,

    -- Event info
    event_type TEXT NOT NULL CHECK (event_type IN (
        'created', 'activated', 'disabled', 'enabled', 'deleted',
        'user_added', 'user_removed', 'settings_updated'
    )),
    event_data JSONB DEFAULT '{}',

    -- Who triggered it
    triggered_by UUID REFERENCES auth.users(id),
    triggered_by_system TEXT, -- 'supabase', 'crm', 'webhook', etc.

    -- Sync status with CRM
    synced_to_crm BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    sync_error TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tenant_events_tenant ON crm.tenant_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_tenant_events_type ON crm.tenant_events(event_type);
CREATE INDEX IF NOT EXISTS idx_crm_tenant_events_unsynced ON crm.tenant_events(synced_to_crm) WHERE synced_to_crm = FALSE;

-- ============================================
-- Sync Queue Table
-- ============================================
-- Queue for operations that need to be synced to CRM.

CREATE TABLE IF NOT EXISTS crm.sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What to sync
    operation TEXT NOT NULL CHECK (operation IN (
        'create_tenant', 'disable_tenant', 'enable_tenant', 'delete_tenant',
        'add_user', 'remove_user', 'update_settings'
    )),
    payload JSONB NOT NULL,

    -- Target
    tenant_id UUID REFERENCES crm.tenants(id) ON DELETE CASCADE,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_queue_status ON crm.sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_crm_sync_queue_pending ON crm.sync_queue(status, next_retry_at) WHERE status = 'pending';

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION crm.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenants_updated_at
    BEFORE UPDATE ON crm.tenants
    FOR EACH ROW
    EXECUTE FUNCTION crm.update_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE crm.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.tenant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.sync_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for edge functions)
CREATE POLICY "Service role full access on tenants"
    ON crm.tenants FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on tenant_users"
    ON crm.tenant_users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on tenant_events"
    ON crm.tenant_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on sync_queue"
    ON crm.sync_queue FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can view their own tenants
CREATE POLICY "Users can view own tenants"
    ON crm.tenants FOR SELECT
    TO authenticated
    USING (
        owner_user_id = auth.uid() OR
        id IN (SELECT tenant_id FROM crm.tenant_users WHERE user_id = auth.uid())
    );

-- Users can view tenant_users for their tenants
CREATE POLICY "Users can view own tenant users"
    ON crm.tenant_users FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        tenant_id IN (SELECT tenant_id FROM crm.tenant_users WHERE user_id = auth.uid())
    );

-- ============================================
-- Helper Functions
-- ============================================

-- Get tenant by subdomain
CREATE OR REPLACE FUNCTION crm.get_tenant_by_subdomain(p_subdomain TEXT)
RETURNS crm.tenants AS $$
    SELECT * FROM crm.tenants WHERE subdomain = p_subdomain LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get tenant by owner email
CREATE OR REPLACE FUNCTION crm.get_tenant_by_email(p_email TEXT)
RETURNS crm.tenants AS $$
    SELECT * FROM crm.tenants WHERE owner_email = p_email LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get user's tenants
CREATE OR REPLACE FUNCTION crm.get_user_tenants(p_user_id UUID)
RETURNS SETOF crm.tenants AS $$
    SELECT t.* FROM crm.tenants t
    JOIN crm.tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id AND t.status != 'deleted';
$$ LANGUAGE sql SECURITY DEFINER;

-- Queue a sync operation
CREATE OR REPLACE FUNCTION crm.queue_sync(
    p_operation TEXT,
    p_payload JSONB,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO crm.sync_queue (operation, payload, tenant_id)
    VALUES (p_operation, p_payload, p_tenant_id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log tenant event
CREATE OR REPLACE FUNCTION crm.log_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}',
    p_triggered_by UUID DEFAULT NULL,
    p_triggered_by_system TEXT DEFAULT 'supabase'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO crm.tenant_events (tenant_id, event_type, event_data, triggered_by, triggered_by_system)
    VALUES (p_tenant_id, p_event_type, p_event_data, p_triggered_by, p_triggered_by_system)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comments
-- ============================================

COMMENT ON SCHEMA crm IS 'CRM integration schema - shared between Supabase and Twenty CRM';
COMMENT ON TABLE crm.tenants IS 'Master list of tenants managed by the parent platform';
COMMENT ON TABLE crm.tenant_users IS 'Maps Supabase users to tenants';
COMMENT ON TABLE crm.tenant_events IS 'Audit log of tenant lifecycle events';
COMMENT ON TABLE crm.sync_queue IS 'Queue for operations to sync to CRM';
