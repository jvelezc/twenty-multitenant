<p align="center">
  <a href="https://www.twenty.com">
    <img src="./packages/twenty-website/public/images/core/logo.svg" width="100px" alt="Twenty logo" />
  </a>
</p>

<h2 align="center" >The #1 Open-Source CRM </h2>

<p align="center"><a href="https://twenty.com">🌐 Website</a> · <a href="https://docs.twenty.com">📚 Documentation</a> · <a href="https://github.com/orgs/twentyhq/projects/1"><img src="./packages/twenty-website/public/images/readme/planner-icon.svg" width="12" height="12"/> Roadmap </a> · <a href="https://discord.gg/cx5n4Jzs57"><img src="./packages/twenty-website/public/images/readme/discord-icon.svg" width="12" height="12"/> Discord</a> · <a href="https://www.figma.com/file/xt8O9mFeLl46C5InWwoMrN/Twenty"><img src="./packages/twenty-website/public/images/readme/figma-icon.png"  width="12" height="12"/>  Figma</a></p>
<br />


<p align="center">
  <a href="https://www.twenty.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/github-cover-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/github-cover-light.png" />
      <img src="./packages/twenty-website/public/images/readme/github-cover-light.png" alt="Cover" />
    </picture>
  </a>
</p>

<br />

# SleepNest CRM (Multi-tenant Fork)

This is a multi-tenant fork of Twenty CRM designed to operate as an **add-on module** within a larger SaaS platform. The CRM runs on DigitalOcean and integrates with Supabase as the control unit.

---

# 🚀 Customer Deployment

## What You Get

Running the install script ([`customer-install/quick-install.sh`](./customer-install/quick-install.sh)) deploys a **complete CRM system** to your infrastructure:

| Component | What It Is | Where It Runs |
|-----------|-----------|---------------|
| **CRM Server** | NestJS application serving REST & GraphQL APIs | Docker container |
| **PostgreSQL** | Database storing all CRM data (contacts, companies, deals) | Docker container |
| **Redis** | Cache and job queue for background tasks | Docker container |
| **Worker** | Background processor for emails, sync, notifications | Docker container |

## What Changes on Your System

The install script will:

1. **Create a directory** `~/sleepnest-crm/` containing:
   - `docker-compose.yml` - Container orchestration
   - `.env` - Your configuration (secrets, Supabase keys)
   - `update.sh` - Script to pull latest updates

2. **Create Docker volumes** for persistent data:
   - `db-data` - PostgreSQL database files
   - `server-local-data` - File uploads and attachments

3. **Start 4 Docker containers** listening on port `3000`

**Nothing else is modified.** No system packages installed, no global configs changed.

## Quick Install

**Prerequisites:** Docker and Docker Compose installed.

```bash
# One command install
curl -fsSL https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/quick-install.sh | bash
```

After install, edit `~/sleepnest-crm/.env` with your Supabase credentials, then restart:

```bash
cd ~/sleepnest-crm
docker-compose down && docker-compose up -d
```

## Update to Latest Version

We push updates automatically. To get them:

```bash
cd ~/sleepnest-crm
./update.sh
```

## Uninstall

To completely remove:

```bash
cd ~/sleepnest-crm
docker-compose down -v  # Stop containers and delete data
cd ~
rm -rf sleepnest-crm    # Remove config files
```

---

## Programmatic Setup (For Installers)

If you're building an installer (C#, Python, etc.), use the **Setup API** instead of manual configuration:

### 1. Deploy with Setup Key

```bash
# Deploy container with a one-time setup key
docker run -d \
  -e SETUP_KEY="your-random-setup-key" \
  -p 3000:3000 \
  registry.digitalocean.com/sleepnest/sleepnest-crm:latest
```

### 2. Check Setup Status

```http
GET http://localhost:3000/setup/status
```

Response:
```json
{
  "configured": false,
  "setupAvailable": true,
  "supabaseConfigured": false,
  "message": "Setup available - POST to /setup/initialize"
}
```

### 3. Initialize Configuration

```http
POST http://localhost:3000/setup/initialize
Content-Type: application/json

{
  "setupKey": "your-random-setup-key",
  "supabaseUrl": "https://xxx.supabase.co",
  "supabaseAnonKey": "eyJ...",
  "supabaseServiceRoleKey": "eyJ...",
  "adminEmails": ["admin@example.com"],
  "serverUrl": "https://crm.example.com"
}
```

> **Note:** The JWKS URL for JWT verification is automatically derived from `supabaseUrl` as `{supabaseUrl}/auth/v1/.well-known/jwks.json`. You can override this by providing `supabaseJwksUrl` explicitly.

Response:
```json
{
  "success": true,
  "message": "CRM configured successfully",
  "generatedSecrets": {
    "saasAdminKey": "abc123...",
    "webhookSecret": "xyz789..."
  },
  "nextSteps": [
    "Save the generated secrets securely",
    "Restart the CRM server"
  ]
}
```

### 4. Restart to Apply

```bash
docker-compose restart server worker
```

**Security Notes:**
- `SETUP_KEY` is a one-time key - setup can only be called once
- After setup, the endpoint returns 403 Forbidden
- Generated `saasAdminKey` and `webhookSecret` are returned only once - save them!

---

## Full Documentation

- 📋 [Multi-tenancy Plan](./MULTITENANCY_PLAN.md) - Implementation details
- 📦 [Supabase Integration](./supabase/README.md) - Edge functions and schema
- 🚀 [Detailed Install Guide](./customer-install/README.md) - All options and troubleshooting

---

# Architecture Overview (For Developers)

## System Design

The CRM operates as part of a two-system architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARENT SAAS PLATFORM                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Supabase (Control Unit)                           │    │
│  │                                                                      │    │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │    │
│  │  │  auth.users  │   │  crm schema  │   │   Edge Functions     │    │    │
│  │  │              │   │              │   │                      │    │    │
│  │  │  - User auth │   │  - tenants   │   │  - crm-proxy        │    │    │
│  │  │  - SSO/OAuth │   │  - events    │   │  - crm-webhook      │    │    │
│  │  │  - Sessions  │   │  - sync_queue│   │  - tenant-create    │    │    │
│  │  └──────────────┘   └──────────────┘   └──────────────────────┘    │    │
│  │                                                                      │    │
│  │  Responsibilities:                                                   │    │
│  │  • User authentication & authorization                               │    │
│  │  • Tenant lifecycle management (source of truth)                     │    │
│  │  • Billing decisions (handled by parent platform)                    │    │
│  │  • API gateway via Edge Functions                                    │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                      │                                        │
│                                      │ SAAS_ADMIN_KEY                        │
│                                      │ (Secure API Communication)            │
│                                      ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                Twenty CRM (DigitalOcean Droplet)                      │    │
│  │                                                                       │    │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐     │    │
│  │  │   NestJS     │   │  PostgreSQL  │   │   Redis + BullMQ     │     │    │
│  │  │   Server     │   │              │   │                      │     │    │
│  │  │              │   │  - core.*    │   │  - Job queues        │     │    │
│  │  │  - REST API  │   │  - workspace_│   │  - Background tasks  │     │    │
│  │  │  - GraphQL   │   │    schemas   │   │  - Email sync        │     │    │
│  │  └──────────────┘   └──────────────┘   └──────────────────────┘     │    │
│  │                                                                       │    │
│  │  Responsibilities:                                                    │    │
│  │  • CRM data storage (contacts, companies, opportunities)             │    │
│  │  • Multi-tenant workspace isolation                                   │    │
│  │  • Business logic & workflows                                         │    │
│  │  • Webhook notifications back to Supabase                            │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Billing is NOT the CRM's Responsibility

The CRM is an **add-on** to a larger platform. Billing, subscriptions, and payment processing are handled by the parent platform. The CRM simply:
- Receives commands (create/disable/enable/delete tenant)
- Executes them
- Confirms via webhook

### 2. Supabase as Control Unit

Supabase owns:
- **User authentication** (`auth.users`)
- **Tenant lifecycle** (`crm.tenants` - source of truth)
- **API gateway** (Edge Functions proxy requests to CRM)

### 3. Shared Data Model (`crm` Schema)

A dedicated `crm` schema in Supabase acts as the **contract** between systems:

| Table | Purpose |
|-------|---------|
| `crm.tenants` | Master tenant list, links to CRM workspace |
| `crm.tenant_users` | Maps Supabase users to tenants |
| `crm.tenant_events` | Audit log of all lifecycle events |
| `crm.sync_queue` | Queue for operations pending sync |

### 4. Eventual Consistency via Webhooks

PostgreSQL triggers in the CRM use `pg_net` to send HTTP webhooks to Supabase when data changes. This ensures both systems stay in sync even with network issues.

```
Supabase → Edge Function → CRM API → PostgreSQL
                                         │
                                         │ pg_net webhook
                                         ▼
Supabase ← crm-webhook ← HTTP POST ← trigger
```

### 5. Transparent API Proxy

The `crm-proxy` Edge Function allows the client to call CRM APIs without knowing the `SAAS_ADMIN_KEY`. Same API shape in, same API shape out.

```typescript
// Client calls Supabase
POST /functions/v1/crm-proxy/tenants

// Edge Function adds auth and forwards to CRM
POST https://crm.example.com/saas/tenants
Headers: x-saas-admin-key: <secret>
```

---

## Authentication & Authorization

### Three Levels of Access

| Level | Authentication | Use Case |
|-------|----------------|----------|
| **User** | Supabase JWT | Regular CRM users accessing their workspace |
| **Admin** | JWT + `canAccessFullAdminPanel` | Platform admins managing tenants via UI |
| **SaaS API** | `x-saas-admin-key` header | Automation, Edge Functions, system integration |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `SUPABASE_JWKS_URL` | JWKS endpoint for JWT verification (auto-derived from SUPABASE_URL) |
| `SAAS_ADMIN_KEY` | Master API key for SaaS operations |
| `WEBHOOK_SECRET` | Shared secret for webhook signature verification |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |

---

## API Endpoints

### SaaS Admin API (`/saas/*`)

Protected by `x-saas-admin-key` header. Used by Edge Functions and automation.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/saas/tenants` | Create new tenant |
| `GET` | `/saas/tenants` | List all tenants |
| `GET` | `/saas/tenants/:id` | Get tenant details |
| `POST` | `/saas/tenants/:id/disable` | Disable tenant |
| `POST` | `/saas/tenants/:id/enable` | Enable tenant |
| `DELETE` | `/saas/tenants/:id` | Delete tenant permanently |
| `PATCH` | `/saas/tenants/:id/notes` | Update admin notes |
| `GET` | `/saas/stats` | Platform statistics |

### Admin API (`/admin/*`)

Protected by JWT + Admin role. Used by the CRM admin UI.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/tenants` | List tenants |
| `GET` | `/admin/tenants/:id` | Get tenant details |
| `POST` | `/admin/tenants/:id/disable` | Disable tenant |
| `POST` | `/admin/tenants/:id/enable` | Enable tenant |
| `PATCH` | `/admin/tenants/:id/notes` | Update notes |
| `GET` | `/admin/tenants/stats` | Statistics |

---

## Supabase Edge Functions

| Function | Auth | Description |
|----------|------|-------------|
| `tenant-create` | `x-saas-admin-key` | Create tenant in CRM and sync to `crm` schema |
| `tenant-manage` | `x-saas-admin-key` | Enable/disable/delete tenants |
| `tenant-stats` | `x-saas-admin-key` | Get platform statistics |
| `crm-webhook` | Webhook signature | Receives confirmations from CRM via `pg_net` |

---

## Tenant Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │────▶│   ACTIVE    │────▶│  DISABLED   │────▶│   DELETED   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   │                   │
      ▼                   ▼                   ▼
  Created in          Normal use         Subscription
  crm.tenants         of CRM             cancelled
  waiting for                            or suspended
  CRM workspace
```

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| - | `pending` | Tenant created in Supabase |
| `pending` | `active` | CRM workspace created, webhook received |
| `active` | `disabled` | Subscription cancelled, manual disable |
| `disabled` | `active` | Subscription renewed, manual enable |
| `active`/`disabled` | `deleted` | Account deletion requested |

---

## Admin UI

The CRM includes a **Tenants** tab in the admin panel (Settings → Admin → Tenants):

- **Platform Overview**: Stats cards showing total/active/disabled tenants
- **Tenant List**: Searchable, filterable list with status badges
- **Tenant Detail**: Full info, users, usage stats, admin notes
- **Actions**: Enable/disable with reason, update notes

Access requires `canAccessFullAdminPanel = true` on the user.

---

## Deployment

### CRM Server (DigitalOcean)

```bash
# Using customer-install scripts
cd customer-install
./install.sh  # or install.ps1 on Windows
```

### Supabase Schema & Functions

```bash
cd supabase

# Deploy the crm schema
./deploy-schema.sh

# Set secrets and deploy functions
export SAAS_ADMIN_KEY="your-key"
export CRM_SERVER_URL="https://crm.example.com"
./deploy-functions.sh
```

### Configure CRM Webhooks

In CRM PostgreSQL:
```sql
UPDATE core.webhook_config
SET value = 'https://your-project.supabase.co/functions/v1/crm-webhook'
WHERE name = 'supabase_webhook_url';
```

---

# Deployment to DigitalOcean Container Registry

## Prerequisites

1. **Install Docker** - [Get Docker](https://docs.docker.com/get-docker/)
2. **Install doctl CLI** - [Install doctl](https://docs.digitalocean.com/reference/doctl/how-to/install/)
3. **Create a DigitalOcean Container Registry** - [Create Registry](https://cloud.digitalocean.com/registry)
4. **Generate a DigitalOcean API Token** - [API Tokens](https://cloud.digitalocean.com/account/api/tokens)

## Setup (One-time)

1. Copy the example environment file:
   ```bash
   cp .env.deploy.example .env.deploy
   ```

2. Edit `.env.deploy` with your values:
   ```env
   DIGITALOCEAN_ACCESS_TOKEN=dop_v1_your_token_here
   DIGITALOCEAN_REGISTRY=registry.digitalocean.com/your-registry-name
   DOCKER_IMAGE_NAME=sleepnest-crm
   DOCKER_IMAGE_TAG=latest
   ```

> ⚠️ **Important**: Never commit `.env.deploy` to source control. It's already in `.gitignore`.

## Deploy

### Windows (PowerShell)
```powershell
.\scripts\deploy-to-digitalocean.ps1

# With a specific version tag:
.\scripts\deploy-to-digitalocean.ps1 -Tag "v1.0.0"
```

### Linux/Mac (Bash)
```bash
chmod +x scripts/deploy-to-digitalocean.sh
./scripts/deploy-to-digitalocean.sh

# With a specific version tag:
./scripts/deploy-to-digitalocean.sh v1.0.0
```

## CI/CD: Automatic Deployment on Push

The repository includes a GitHub Actions workflow that automatically builds and pushes the Docker image when you commit to `main` or `master`.

### Setup GitHub Secrets

Go to your repository **Settings > Secrets and variables > Actions** and add:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DIGITALOCEAN_ACCESS_TOKEN` | Your DigitalOcean API token | `dop_v1_xxx...` |
| `DIGITALOCEAN_REGISTRY` | Your registry name (without full URL) | `sleepnest` |
| `REGISTRY_USERNAME` | Registry login username (your DO email) | `jose@gentlebirth.com` |
| `REGISTRY_PASSWORD` | Registry login password (your DO API token) | `dop_v1_xxx...` |

### Trigger Deployment

- **Automatic:** Push to `main` or `master` branch
- **Manual:** Go to Actions > "Deploy to DigitalOcean Container Registry" > Run workflow

---

## Customer Usage

After deployment, customers can pull and run the image:

```bash
# Pull the image
docker pull registry.digitalocean.com/your-registry/sleepnest-crm:latest

# Run with docker-compose (see packages/twenty-docker/docker-compose.yml)
```

---

# Local Development

# Does the world need another CRM?

We built Twenty for three reasons:

**CRMs are too expensive, and users are trapped.** Companies use locked-in customer data to hike prices. It shouldn't be that way.

**A fresh start is required to build a better experience.** We can learn from past mistakes and craft a cohesive experience inspired by new UX patterns from tools like Notion, Airtable or Linear.

**We believe in Open-source and community.** Hundreds of developers are already building Twenty together. Once we have plugin capabilities, a whole ecosystem will grow around it.

<br />

# What You Can Do With Twenty

Please feel free to flag any specific needs you have by creating an issue.

Below are a few features we have implemented to date:

+ [Personalize layouts with filters, sort, group by, kanban and table views](#personalize-layouts-with-filters-sort-group-by-kanban-and-table-views)
+ [Customize your objects and fields](#customize-your-objects-and-fields)
+ [Create and manage permissions with custom roles](#create-and-manage-permissions-with-custom-roles)
+ [Automate workflow with triggers and actions](#automate-workflow-with-triggers-and-actions)
+ [Emails, calendar events, files, and more](#emails-calendar-events-files-and-more)


## Personalize layouts with filters, sort, group by, kanban and table views

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/views-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/views-light.png" />
      <img src="./packages/twenty-website/public/images/readme/views-light.png" alt="Companies Kanban Views" />
    </picture>
</p>

## Customize your objects and fields

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/data-model-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/data-model-light.png" />
      <img src="./packages/twenty-website/public/images/readme/data-model-light.png" alt="Setting Custom Objects" />
    </picture>
</p>

## Create and manage permissions with custom roles

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/permissions-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/permissions-light.png" />
      <img src="./packages/twenty-website/public/images/readme/permissions-light.png" alt="Permissions" />
    </picture>
</p>

## Automate workflow with triggers and actions

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/workflows-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/workflows-light.png" />
      <img src="./packages/twenty-website/public/images/readme/workflows-light.png" alt="Workflows" />
    </picture>
</p>

## Emails, calendar events, files, and more

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/plus-other-features-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/plus-other-features-light.png" />
      <img src="./packages/twenty-website/public/images/readme/plus-other-features-light.png" alt="Other Features" />
    </picture>
</p>

<br />

# Stack
- [TypeScript](https://www.typescriptlang.org/)
- [Nx](https://nx.dev/)
- [NestJS](https://nestjs.com/), with [BullMQ](https://bullmq.io/), [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/)
- [React](https://reactjs.org/), with [Recoil](https://recoiljs.org/), [Emotion](https://emotion.sh/) and [Lingui](https://lingui.dev/)



# Thanks

<p align="center">
  <a href="https://www.chromatic.com/"><img src="./packages/twenty-website/public/images/readme/chromatic.png" height="30" alt="Chromatic" /></a>
  <a href="https://greptile.com"><img src="./packages/twenty-website/public/images/readme/greptile.png" height="30" alt="Greptile" /></a>
  <a href="https://sentry.io/"><img src="./packages/twenty-website/public/images/readme/sentry.png" height="30" alt="Sentry" /></a>
  <a href="https://crowdin.com/"><img src="./packages/twenty-website/public/images/readme/crowdin.png" height="30" alt="Crowdin" /></a>
</p>

  Thanks to these amazing services that we use and recommend for UI testing (Chromatic), code review (Greptile), catching bugs (Sentry) and translating (Crowdin).


# Join the Community

- Star the repo
- Subscribe to releases (watch -> custom -> releases)
- Follow us on [Twitter](https://twitter.com/twentycrm) or [LinkedIn](https://www.linkedin.com/company/twenty/)
- Join our [Discord](https://discord.gg/cx5n4Jzs57)
- Improve translations on [Crowdin](https://twenty.crowdin.com/twenty)
- [Contributions](https://github.com/twentyhq/twenty/contribute) are, of course, most welcome!
