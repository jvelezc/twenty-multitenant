# Supabase Integration for Twenty CRM

This directory contains the Supabase integration layer for the Twenty CRM multi-tenant system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Control Unit)                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    crm schema                         │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │   tenants   │  │tenant_users │  │tenant_events│   │   │
│  │  │             │  │             │  │             │   │   │
│  │  │ - id        │  │ - tenant_id │  │ - tenant_id │   │   │
│  │  │ - subdomain │  │ - user_id   │  │ - event_type│   │   │
│  │  │ - status    │  │ - role      │  │ - synced    │   │   │
│  │  │ - crm_id    │  └─────────────┘  └─────────────┘   │   │
│  │  └─────────────┘                                      │   │
│  │                    ┌─────────────┐                    │   │
│  │                    │ sync_queue  │                    │   │
│  │                    │             │                    │   │
│  │                    │ - operation │                    │   │
│  │                    │ - status    │                    │   │
│  │                    └─────────────┘                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Edge Functions                           │   │
│  │  tenant-create | tenant-manage | tenant-stats        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Sync via SAAS_ADMIN_KEY
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Twenty CRM (DigitalOcean Droplet)              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (core schema)                 │   │
│  │                                                       │   │
│  │  workspaces | users | contacts | companies | ...     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## CRM Schema

The `crm` schema in Supabase acts as the shared interface between the parent platform and the CRM.

### Tables

| Table | Purpose |
|-------|---------|
| `crm.tenants` | Master list of tenants, source of truth for lifecycle |
| `crm.tenant_users` | Maps Supabase users to tenants |
| `crm.tenant_events` | Audit log of all tenant lifecycle events |
| `crm.sync_queue` | Queue for operations to sync to CRM server |

### Key Fields in `crm.tenants`

| Field | Description |
|-------|-------------|
| `id` | Primary key (UUID) |
| `subdomain` | Unique subdomain for the tenant |
| `crm_workspace_id` | Links to workspace in CRM PostgreSQL |
| `owner_user_id` | Links to Supabase auth.users |
| `status` | pending, active, disabled, deleted |

## Edge Functions

| Function | Description | Method |
|----------|-------------|--------|
| `tenant-create` | Create a new tenant | POST |
| `tenant-manage` | Manage tenants (disable, enable, delete, update) | POST |
| `tenant-stats` | Get platform statistics | GET |

## Prerequisites

1. **Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link your project**
   ```bash
   supabase link --project-ref your-project-id
   ```

## Deployment

### Set Environment Variables

```bash
export SAAS_ADMIN_KEY="your-saas-admin-key"
export CRM_SERVER_URL="https://crm.example.com"
```

### Deploy Functions

```bash
cd supabase
chmod +x deploy-functions.sh
./deploy-functions.sh
```

Or deploy manually:

```bash
supabase secrets set SAAS_ADMIN_KEY="$SAAS_ADMIN_KEY"
supabase secrets set CRM_SERVER_URL="$CRM_SERVER_URL"

supabase functions deploy tenant-create --no-verify-jwt
supabase functions deploy tenant-manage --no-verify-jwt
supabase functions deploy tenant-stats --no-verify-jwt
```

## Usage

All requests require the `x-saas-admin-key` header.

### Create Tenant

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tenant-create \
  -H "Content-Type: application/json" \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -d '{
    "email": "user@example.com",
    "displayName": "My Company",
    "subdomain": "mycompany"
  }'
```

Response:
```json
{
  "success": true,
  "tenant": {
    "id": "uuid",
    "displayName": "My Company",
    "subdomain": "mycompany",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### List Tenants

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tenant-manage \
  -H "Content-Type: application/json" \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -d '{"action": "list"}'
```

### Get Tenant Details

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tenant-manage \
  -H "Content-Type: application/json" \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -d '{"action": "get", "tenantId": "uuid"}'
```

### Disable Tenant

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tenant-manage \
  -H "Content-Type: application/json" \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -d '{"action": "disable", "tenantId": "uuid", "reason": "Non-payment"}'
```

### Enable Tenant

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tenant-manage \
  -H "Content-Type: application/json" \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -d '{"action": "enable", "tenantId": "uuid"}'
```

### Delete Tenant

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tenant-manage \
  -H "Content-Type: application/json" \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -d '{"action": "delete", "tenantId": "uuid"}'
```

### Get Platform Stats

```bash
curl -X GET https://your-project.supabase.co/functions/v1/tenant-stats \
  -H "x-saas-admin-key: your-saas-admin-key"
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalTenants": 100,
    "activeTenants": 95,
    "disabledTenants": 5,
    "totalUsers": 500
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Integration with Your SaaS App

### JavaScript/TypeScript Client

```typescript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SAAS_ADMIN_KEY = 'your-saas-admin-key';

async function createTenant(email: string, displayName: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/tenant-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-saas-admin-key': SAAS_ADMIN_KEY,
    },
    body: JSON.stringify({ email, displayName }),
  });
  return response.json();
}

async function disableTenant(tenantId: string, reason: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/tenant-manage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-saas-admin-key': SAAS_ADMIN_KEY,
    },
    body: JSON.stringify({ action: 'disable', tenantId, reason }),
  });
  return response.json();
}
```

## Security

- The `x-saas-admin-key` is verified against the `SAAS_ADMIN_KEY` secret
- JWT verification is disabled since we use our own authentication
- Keep your `SAAS_ADMIN_KEY` secret and never expose it in client-side code
- Use these functions from your backend or serverless functions only
