# SleepNest CRM - Customer Installation Guide

Deploy your own instance of SleepNest CRM to DigitalOcean with Supabase authentication.

> **💡 These scripts are templates!** Feel free to modify them for your specific needs - change defaults, hardcode values for CI/CD, or adapt for other cloud providers.

## Prerequisites

Before you begin, you'll need:

1. **DigitalOcean Account**
   - Create an account at [digitalocean.com](https://digitalocean.com)
   - Generate an API token at [API Tokens](https://cloud.digitalocean.com/account/api/tokens)
   - Token needs read/write access

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

## Quick Start

### Linux/Mac

```bash
curl -O https://raw.githubusercontent.com/your-repo/sleepnest-crm/main/customer-install/install.sh
chmod +x install.sh
./install.sh
```

### Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-repo/sleepnest-crm/main/customer-install/install.ps1" -OutFile "install.ps1"
.\install.ps1
```

## What the Script Does

1. **Prompts for configuration** - API keys, database settings, Supabase credentials
2. **Creates a DigitalOcean Droplet** - Ubuntu with Docker pre-installed
3. **Generates deployment files** - `docker-compose.yml` and `.env`
4. **Deploys the application** - Pulls the Docker image and starts services

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
docker-compose pull
docker-compose up -d
```

## Support

- Documentation: [docs.sleepnest.com](https://docs.sleepnest.com)
- Issues: [GitHub Issues](https://github.com/your-repo/sleepnest-crm/issues)

## License

SleepNest CRM is licensed under AGPL-3.0.
