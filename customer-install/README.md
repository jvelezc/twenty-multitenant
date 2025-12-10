# SleepNest CRM - Customer Installation Guide

Deploy your own instance of SleepNest CRM with Supabase authentication.

## 🚀 Quick Install (Recommended)

If you already have Docker installed, run this single command:

```bash
# One-line install
curl -fsSL https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/quick-install.sh | bash
```

Or with pre-configured Supabase settings:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
export SUPABASE_JWT_SECRET="your-jwt-secret"
curl -fsSL https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/quick-install.sh | bash
```

**That's it!** Your CRM will be running at `http://localhost:3000`

---

## 🔄 Automatic Updates

The Docker image is automatically updated whenever we push to the main branch. To get the latest version:

```bash
cd ~/sleepnest-crm
./update.sh
```

Or manually:

```bash
docker-compose pull
docker-compose up -d
```

---

## Prerequisites

Before you begin, you'll need:

1. **Docker & Docker Compose**
   - Install Docker: [get.docker.com](https://get.docker.com)
   - Docker Compose is included with Docker Desktop

2. **Supabase Project**
   - Create a free project at [supabase.com](https://supabase.com)
   - Get your project credentials from Settings > API:
     - Project URL
     - Anon (public) key
     - Service role key
     - JWT secret (Settings > API > JWT Settings)

3. **Domain (Optional)**
   - A domain name if you want HTTPS access
   - You'll need to configure DNS after deployment

---

## Installation Options

### Option 1: Quick Install (Local Docker)

Best for: Development, testing, small deployments

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/quick-install.sh | bash
```

### Option 2: Full Install (DigitalOcean Droplet)

Best for: Production deployments

```bash
curl -O https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/install.sh
chmod +x install.sh
./install.sh
```

### Option 3: Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/install.ps1" -OutFile "install.ps1"
.\install.ps1
```

## What the Script Does

1. **Prompts for configuration** - API keys, database settings, Supabase credentials
2. **Prompts for admin emails** - Users who will have full admin access
3. **Creates a DigitalOcean Droplet** - Ubuntu with Docker pre-installed
4. **Generates deployment files** - `docker-compose.yml` and `.env`
5. **Deploys the application** - Pulls the Docker image and starts services

## Admin Users

Admin users have special privileges:
- **Manage all tenants** - View, enable/disable any tenant
- **Cross-tenant data access** - View contacts, companies across all tenants
- **Add admin notes** - Internal notes about tenants

### Setting Admin Users

During installation, you'll be prompted for admin email addresses:

```
Admin email addresses (comma-separated): admin@yourcompany.com,ceo@yourcompany.com
```

You can also set this in your `.env` file:

```env
ADMIN_EMAILS=admin@yourcompany.com,ceo@yourcompany.com
```

### Alternative: Supabase app_metadata

For more granular control, set admin roles directly in Supabase:

```sql
-- In Supabase SQL Editor
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@yourcompany.com';
```

## Webhooks (External System Integration)

The CRM supports webhooks for external systems (billing, CRM, etc.) to notify when tenants should be disabled/enabled.

### Webhook Endpoint

```
POST /webhooks/tenant
```

### Signature Verification (Like Stripe)

All webhook requests must be signed using HMAC-SHA256:

```
x-webhook-signature: t=1234567890,v1=abc123...
```

The signature is computed as:

```
HMAC-SHA256(timestamp + "." + payload, WEBHOOK_SECRET)
```

### Supported Events

| Event | Description |
|-------|-------------|
| `tenant.disabled` | Disable a tenant |
| `tenant.enabled` | Enable a tenant |
| `tenant.subscription.cancelled` | Subscription cancelled (disables tenant) |
| `tenant.subscription.updated` | Subscription updated (enables tenant) |

### Example: Disable a Tenant

```bash
# Set your webhook secret
SECRET="your-webhook-secret"

# Create payload
PAYLOAD='{"event":"tenant.disabled","timestamp":"2024-01-01T00:00:00Z","data":{"tenantId":"workspace-uuid","reason":"Subscription cancelled"}}'

# Generate signature
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${SECRET}" | cut -d' ' -f2)

# Send webhook
curl -X POST https://your-crm.com/webhooks/tenant \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: t=${TIMESTAMP},v1=${SIGNATURE}" \
  -d "${PAYLOAD}"
```

### Test Endpoint

To verify your webhook configuration:

```bash
curl -X POST https://your-crm.com/webhooks/tenant/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

This returns a sample signature you can use for testing.

## Manual Installation

If you prefer to deploy manually:

### 1. Create a Droplet

- Image: Docker on Ubuntu 22.04
- Size: s-2vcpu-4gb (minimum recommended)
- Region: Choose closest to your users

### 2. SSH into the Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### 3. Create Configuration Files

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: sleepnest_crm
      POSTGRES_USER: sleepnest
      POSTGRES_PASSWORD: YOUR_SECURE_PASSWORD
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  server:
    image: registry.digitalocean.com/sleepnest/sleepnest-crm:latest
    restart: unless-stopped
    depends_on:
      - db
      - redis
    ports:
      - "3000:3000"
    environment:
      PG_DATABASE_URL: postgres://sleepnest:YOUR_SECURE_PASSWORD@db:5432/sleepnest_crm
      REDIS_URL: redis://redis:6379
      SERVER_URL: http://YOUR_DROPLET_IP:3000
      APP_SECRET: YOUR_APP_SECRET
      IS_MULTIWORKSPACE_ENABLED: "true"
      AUTH_SUPABASE_ENABLED: "true"
      SUPABASE_URL: https://YOUR_PROJECT.supabase.co
      SUPABASE_ANON_KEY: YOUR_ANON_KEY
      SUPABASE_SERVICE_ROLE_KEY: YOUR_SERVICE_ROLE_KEY
      SUPABASE_JWT_SECRET: YOUR_JWT_SECRET
    command: sh -c "yarn database:migrate:prod && yarn start:prod"

  worker:
    image: registry.digitalocean.com/sleepnest/sleepnest-crm:latest
    restart: unless-stopped
    depends_on:
      - db
      - redis
    environment:
      PG_DATABASE_URL: postgres://sleepnest:YOUR_SECURE_PASSWORD@db:5432/sleepnest_crm
      REDIS_URL: redis://redis:6379
      SERVER_URL: http://YOUR_DROPLET_IP:3000
      APP_SECRET: YOUR_APP_SECRET
      IS_MULTIWORKSPACE_ENABLED: "true"
    command: yarn worker:prod

volumes:
  postgres_data:
  redis_data:
```

### 4. Start the Application

```bash
docker-compose up -d
```

### 5. Check Status

```bash
docker-compose ps
docker-compose logs -f server
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `PG_DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `SERVER_URL` | Public URL of your CRM | Yes |
| `APP_SECRET` | Secret key for encryption (generate with `openssl rand -hex 32`) | Yes |
| `IS_MULTIWORKSPACE_ENABLED` | Enable multi-tenant mode | Yes |
| `AUTH_SUPABASE_ENABLED` | Enable Supabase authentication | Yes |
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Yes |
| `AUTH_PASSWORD_ENABLED` | Enable email/password auth | No (default: false) |
| `AUTH_GOOGLE_ENABLED` | Enable Google OAuth | No (default: false) |
| `AUTH_MICROSOFT_ENABLED` | Enable Microsoft OAuth | No (default: false) |

## Supabase Configuration

After deployment, configure your Supabase project:

### 1. Authentication Settings

Go to Authentication > URL Configuration and add:

- **Site URL**: `http://YOUR_DROPLET_IP:3000` (or your domain)
- **Redirect URLs**:
  - `http://YOUR_DROPLET_IP:3000/auth/callback`
  - `http://YOUR_DROPLET_IP:3000/verify`

### 2. Enable Auth Providers

Go to Authentication > Providers and enable:
- Email (for email/password login)
- Any OAuth providers you want (Google, GitHub, etc.)

## API Endpoints

Your CRM exposes these Supabase auth endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/supabase/token` | POST | Exchange Supabase token for CRM token |
| `/auth/supabase/validate` | POST | Validate a Supabase token |
| `/auth/supabase/status` | GET | Check if Supabase auth is enabled |

### Token Exchange Example

```bash
curl -X POST http://YOUR_CRM_URL/auth/supabase/token \
  -H "Content-Type: application/json" \
  -d '{
    "supabaseAccessToken": "YOUR_SUPABASE_ACCESS_TOKEN",
    "workspaceId": "optional-workspace-id"
  }'
```

Response:
```json
{
  "loginToken": "twenty-login-token",
  "workspaceId": "workspace-uuid"
}
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs server

# Check if database is ready
docker-compose logs db

# Restart services
docker-compose restart
```

### Database migration fails

```bash
# Run migrations manually
docker-compose exec server yarn database:migrate:prod
```

### Can't connect to CRM

1. Check firewall allows port 3000
2. Verify SERVER_URL matches your actual URL
3. Check Supabase credentials are correct

### Reset everything

```bash
docker-compose down -v  # Warning: This deletes all data!
docker-compose up -d
```

## Updating

To update to the latest version:

```bash
cd ~/sleepnest-crm
./update.sh
```

Or manually:

```bash
docker-compose pull
docker-compose up -d
```

The Docker image is automatically rebuilt and pushed whenever we commit to the main branch, so `latest` always has the newest features and fixes.

---

## SaaS Admin API

For programmatic tenant management, use the SaaS Admin API with your `SAAS_ADMIN_KEY`:

```bash
# List all tenants
curl -X GET https://your-crm.com/saas/tenants \
  -H "x-saas-admin-key: your-saas-admin-key"

# Create a tenant
curl -X POST https://your-crm.com/saas/tenants \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "displayName": "Acme Corp"}'

# Disable a tenant
curl -X POST https://your-crm.com/saas/tenants/{id}/disable \
  -H "x-saas-admin-key: your-saas-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Subscription cancelled"}'

# Enable a tenant
curl -X POST https://your-crm.com/saas/tenants/{id}/enable \
  -H "x-saas-admin-key: your-saas-admin-key"

# Get platform stats
curl -X GET https://your-crm.com/saas/stats \
  -H "x-saas-admin-key: your-saas-admin-key"
```

### Supabase Edge Function Proxy

If using Supabase, you can call the CRM through Edge Functions without exposing the API key:

```typescript
// In your Supabase client
const { data } = await supabase.functions.invoke('crm-proxy', {
  body: { path: '/tenants', method: 'GET' }
});
```

---

## Support

- Documentation: [docs.sleepnest.com](https://docs.sleepnest.com)
- Issues: [GitHub Issues](https://github.com/your-repo/sleepnest-crm/issues)

## License

SleepNest CRM is licensed under AGPL-3.0.
