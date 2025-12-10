# SleepNest CRM - C# Installer Integration Guide

## AI Prompt for C# Installer Development

Copy everything between `### PROMPT START` and `### PROMPT END` and paste it into your AI assistant to generate the C# installer code.

---

### PROMPT START

I need to build a C# installer/provisioner for SleepNest CRM that deploys and configures a Docker container on a remote server. The installer reads configuration from appsettings.json and outputs all generated secrets.

## 1. Configuration (appsettings.json)

All input configuration comes from the client application's appsettings.json:

```json
{
  "CrmInstaller": {
    "DigitalOcean": {
      "ApiToken": "dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "Region": "nyc1",
      "DropletSize": "s-2vcpu-4gb",
      "DropletImage": "docker-20-04",
      "SshKeyIds": ["12345678"],
      "RegistryName": "sleepnest"
    },
    "Docker": {
      "Registry": "registry.digitalocean.com/sleepnest/sleepnest-crm",
      "Tag": "latest",
      "InstallPath": "/opt/sleepnest-crm"
    },
    "Supabase": {
      "ProjectRef": "abcdefghijklmnop",
      "AccessToken": "sbp_1234567890abcdef",
      "Url": "https://abcdefghijklmnop.supabase.co",
      "AnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.xxxxx",
      "ServiceRoleKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDB9.xxxxx",
      "JwtSecret": "your-supabase-jwt-secret-from-dashboard"
    },
    "Crm": {
      "ServerUrl": "https://crm.customer-domain.com",
      "AdminEmails": ["admin@example.com", "support@example.com"]
    }
  }
}
```

### Where to find DigitalOcean values:
- **ApiToken**: Generate at https://cloud.digitalocean.com/account/api/tokens (starts with `dop_v1_`)
- **Region**: Choose from: `nyc1`, `nyc3`, `sfo3`, `ams3`, `sgp1`, `lon1`, `fra1`, `tor1`, `blr1`
- **DropletSize**: `s-1vcpu-2gb` (min), `s-2vcpu-4gb` (recommended), `s-4vcpu-8gb` (production)
- **SshKeyIds**: Get from https://cloud.digitalocean.com/account/security (or API)
- **RegistryName**: Your container registry name from https://cloud.digitalocean.com/registry

### Where to find Supabase values:
- **ProjectRef**: From your Supabase dashboard URL: `https://app.supabase.com/project/{ProjectRef}`
- **AccessToken**: Generate at https://app.supabase.com/account/tokens (starts with `sbp_`)
- **Url, AnonKey, ServiceRoleKey**: Settings > API in Supabase dashboard
- **JwtSecret**: Settings > API > JWT Settings > JWT Secret

## 2. C# Configuration Classes

```csharp
public class CrmInstallerSettings
{
    public DigitalOceanSettings DigitalOcean { get; set; } = new();
    public DockerSettings Docker { get; set; } = new();
    public SupabaseSettings Supabase { get; set; } = new();
    public CrmSettings Crm { get; set; } = new();
}

public class DigitalOceanSettings
{
    public string ApiToken { get; set; } = string.Empty;        // dop_v1_xxx
    public string Region { get; set; } = "nyc1";                // Datacenter region
    public string DropletSize { get; set; } = "s-2vcpu-4gb";    // VM size
    public string DropletImage { get; set; } = "docker-20-04";  // Base image with Docker
    public string[] SshKeyIds { get; set; } = Array.Empty<string>(); // For SSH access
    public string RegistryName { get; set; } = string.Empty;    // Container registry name
}

public class DockerSettings
{
    public string Registry { get; set; } = "registry.digitalocean.com/sleepnest/sleepnest-crm";
    public string Tag { get; set; } = "latest";
    public string InstallPath { get; set; } = "/opt/sleepnest-crm";

    public string FullImage => $"{Registry}:{Tag}";
}

public class SupabaseSettings
{
    // For Supabase Management API (setting Edge Function secrets)
    public string ProjectRef { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;

    // For CRM server configuration
    public string Url { get; set; } = string.Empty;
    public string AnonKey { get; set; } = string.Empty;
    public string ServiceRoleKey { get; set; } = string.Empty;
    public string JwtSecret { get; set; } = string.Empty;
}

public class CrmSettings
{
    public string ServerUrl { get; set; } = string.Empty;
    public string[] AdminEmails { get; set; } = Array.Empty<string>();
}
```

## 3. Loading Configuration in .NET

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<CrmInstallerSettings>(
    builder.Configuration.GetSection("CrmInstaller")
);
builder.Services.AddScoped<ICrmInstallerService, CrmInstallerService>();

// CrmInstallerService.cs
public class CrmInstallerService : ICrmInstallerService
{
    private readonly CrmInstallerSettings _settings;
    private readonly ILogger<CrmInstallerService> _logger;

    public CrmInstallerService(
        IOptions<CrmInstallerSettings> settings,
        ILogger<CrmInstallerService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<CrmInstallResult> InstallAsync(CancellationToken cancellationToken = default)
    {
        // Implementation below
    }
}
```

## 4. Container Registry

- **Registry**: `registry.digitalocean.com/sleepnest/sleepnest-crm`
- **Tag**: `latest` (or specific version like `v1.0.0`)
- **Full Image**: `registry.digitalocean.com/sleepnest/sleepnest-crm:latest`
- **Authentication**: DigitalOcean Container Registry (doctl registry login)

## 5. Deployment Flow

The installer must:

1. **Create DigitalOcean Droplet** using the DO API with Docker pre-installed
2. **Wait for Droplet to be ready** (status: active, with public IP)
3. **Configure Docker registry access** on the droplet (doctl registry login)
4. **Generate secrets** (SETUP_KEY, database password)
5. **Deploy docker-compose.yml** to the droplet via SSH
6. **Pull and start containers** (docker-compose up -d)
7. **Wait for CRM to be healthy** (GET /setup/health returns 200)
8. **Call the Setup API** to configure Supabase and generate secrets
9. **Save secrets to Supabase Edge Functions** (via Supabase Management API)
10. **Restart containers** to apply configuration
11. **OUTPUT ALL SECRETS** for backup/reference (see Critical Output section below)

### DigitalOcean API - Create Droplet

```http
POST https://api.digitalocean.com/v2/droplets
Authorization: Bearer {DO_API_TOKEN}
Content-Type: application/json

{
  "name": "sleepnest-crm-{customer-id}",
  "region": "nyc1",
  "size": "s-2vcpu-4gb",
  "image": "docker-20-04",
  "ssh_keys": ["12345678"],
  "user_data": "#!/bin/bash\ndoctl registry login",
  "tags": ["sleepnest-crm", "production"]
}
```

### DigitalOcean API - Check Droplet Status

```http
GET https://api.digitalocean.com/v2/droplets/{droplet_id}
Authorization: Bearer {DO_API_TOKEN}

Response includes:
- status: "new" | "active"
- networks.v4[0].ip_address: public IP
```

## 6. ⚠️ CRITICAL: Required Output

**The installer MUST output ALL of these values.** These secrets are generated during installation and CANNOT be retrieved later:

```json
{
  "installationId": "unique-install-id",
  "crmUrl": "https://crm.customer-domain.com",
  "droplet": {
    "id": "123456789",
    "name": "sleepnest-crm-customer123",
    "ipAddress": "165.232.xxx.xxx",
    "region": "nyc1",
    "size": "s-2vcpu-4gb"
  },
  "credentials": {
    "saasAdminKey": "generated-by-setup-api",
    "webhookSecret": "generated-by-setup-api",
    "setupKey": "generated-by-installer"
  },
  "database": {
    "host": "db",
    "port": 5432,
    "name": "sleepnest_crm",
    "user": "sleepnest",
    "password": "generated-by-installer"
  },
  "supabaseSecretsToSet": {
    "CRM_SERVER_URL": "https://crm.customer-domain.com",
    "SAAS_ADMIN_KEY": "generated-by-setup-api",
    "WEBHOOK_SECRET": "generated-by-setup-api"
  }
}
```

### Why Each Secret Matters

| Secret | Generated By | Used For | If Lost |
|--------|--------------|----------|---------|
| `saasAdminKey` | Setup API | Calling CRM's `/saas/*` endpoints | **Cannot manage tenants** |
| `webhookSecret` | Setup API | Verifying webhook signatures from CRM | **Webhooks rejected** |
| `setupKey` | Installer | One-time setup (already used) | Not needed after setup |
| `dbPassword` | Installer | PostgreSQL access | **Cannot access database** |

## 7. Supabase Edge Function Secrets

The installer MUST set these secrets in Supabase automatically using the Management API:

**Supabase Management API - Set Secrets:**

```http
POST https://api.supabase.com/v1/projects/{project_ref}/secrets
Authorization: Bearer {SUPABASE_ACCESS_TOKEN}
Content-Type: application/json

[
  { "name": "CRM_SERVER_URL", "value": "<crmUrl>" },
  { "name": "SAAS_ADMIN_KEY", "value": "<saasAdminKey from setup response>" },
  { "name": "WEBHOOK_SECRET", "value": "<webhookSecret from setup response>" }
]
```

**C# Implementation:**

```csharp
public async Task SetSupabaseSecretsAsync(
    string supabaseProjectRef,
    string supabaseAccessToken,
    SupabaseSecrets secrets)
{
    var client = new HttpClient();
    client.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", supabaseAccessToken);

    var payload = new[]
    {
        new { name = "CRM_SERVER_URL", value = secrets.CRM_SERVER_URL },
        new { name = "SAAS_ADMIN_KEY", value = secrets.SAAS_ADMIN_KEY },
        new { name = "WEBHOOK_SECRET", value = secrets.WEBHOOK_SECRET }
    };

    var response = await client.PostAsJsonAsync(
        $"https://api.supabase.com/v1/projects/{supabaseProjectRef}/secrets",
        payload
    );

    if (!response.IsSuccessStatusCode)
    {
        throw new Exception($"Failed to set Supabase secrets: {await response.Content.ReadAsStringAsync()}");
    }
}
```

**Required Inputs for Installer:**

| Input | Description | Where to Get |
|-------|-------------|--------------|
| `supabaseProjectRef` | Project ID (e.g., `abcdefghijklmnop`) | Supabase Dashboard URL |
| `supabaseAccessToken` | Personal access token | https://app.supabase.com/account/tokens |

**If secrets are not set, the Edge Functions will fail to communicate with the CRM!**

## 8. Setup API Endpoints

The CRM server exposes these endpoints for initial configuration:

### Check Status
```
GET http://<host>:3000/setup/status

Response:
{
  "configured": false,
  "setupAvailable": true,
  "supabaseConfigured": false,
  "message": "Setup available - POST to /setup/initialize"
}
```

### Initialize Configuration
```
POST http://<host>:3000/setup/initialize
Content-Type: application/json

{
  "setupKey": "<the-setup-key-you-generated>",
  "supabaseUrl": "https://xxx.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "supabaseServiceRoleKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "supabaseJwtSecret": "your-supabase-jwt-secret",
  "adminEmails": ["admin@example.com"],
  "serverUrl": "https://crm.customer-domain.com"
}

Success Response (200):
{
  "success": true,
  "message": "CRM configured successfully. Restart the server to apply all changes.",
  "generatedSecrets": {
    "saasAdminKey": "abc123def456...",
    "webhookSecret": "xyz789ghi012..."
  },
  "nextSteps": [
    "Save the generated secrets securely",
    "Restart the CRM server: docker-compose restart server worker",
    "Configure Supabase redirect URLs to point to this server",
    "Test authentication flow"
  ]
}

Error Responses:
- 401: Invalid setup key
- 403: Already configured (can only run once)
- 400: Missing required fields
- 503: SETUP_KEY not set in environment
```

### Health Check
```
GET http://<host>:3000/setup/health

Response:
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 9. Docker Compose Template

The installer should generate this docker-compose.yml for the target server:

```yaml
version: '3.8'

services:
  server:
    image: registry.digitalocean.com/sleepnest/sleepnest-crm:latest
    ports:
      - "3000:3000"
    environment:
      SETUP_KEY: ${SETUP_KEY}
      PG_DATABASE_URL: postgres://${PG_USER}:${PG_PASSWORD}@db:5432/${PG_DATABASE}
      REDIS_URL: redis://redis:6379
      SERVER_URL: ${SERVER_URL}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: curl --fail http://localhost:3000/setup/health
      interval: 5s
      timeout: 5s
      retries: 20
    restart: always

  worker:
    image: registry.digitalocean.com/sleepnest/sleepnest-crm:latest
    command: ["yarn", "worker:prod"]
    environment:
      PG_DATABASE_URL: postgres://${PG_USER}:${PG_PASSWORD}@db:5432/${PG_DATABASE}
      REDIS_URL: redis://redis:6379
      SERVER_URL: ${SERVER_URL}
    depends_on:
      server:
        condition: service_healthy
    restart: always

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ${PG_DATABASE}
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: pg_isready -U ${PG_USER}
      interval: 5s
      timeout: 5s
      retries: 10
    restart: always

  redis:
    image: redis:7
    command: ["--maxmemory-policy", "noeviction"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: always

volumes:
  db-data:
```

## 10. C# Implementation Requirements

1. **NuGet Packages**:
   - `DigitalOcean.API` - DigitalOcean API client for droplet management
   - `SSH.NET` - SSH client for remote command execution
   - `Microsoft.Extensions.Options` - Configuration binding
   - `System.Net.Http.Json` - HTTP JSON helpers

2. **Secret Generation**: Use `RandomNumberGenerator` for cryptographic randomness
3. **Retry Logic**: Implement exponential backoff for health checks (5 retries, 5s intervals)
4. **Error Handling**: Handle all API error responses gracefully with proper logging
5. **Cancellation**: Support `CancellationToken` for long-running operations
6. **SSH Key Management**: Use SSH keys from DigitalOcean account for droplet access

## 11. Complete Implementation

```csharp
// Result class - MUST contain all secrets for Supabase configuration
public class CrmInstallResult
{
    public bool Success { get; set; }
    public string InstallationId { get; set; }
    public string CrmUrl { get; set; }

    // CRITICAL: These must be saved to Supabase Edge Function secrets
    public CrmCredentials Credentials { get; set; }
    public DatabaseCredentials Database { get; set; }
    public SupabaseSecrets SupabaseSecretsToSet { get; set; }

    public string ErrorMessage { get; set; }
}

public class CrmCredentials
{
    public string SaasAdminKey { get; set; }    // From Setup API response
    public string WebhookSecret { get; set; }   // From Setup API response
    public string SetupKey { get; set; }        // Generated by installer (for reference)
}

public class DatabaseCredentials
{
    public string Host { get; set; }
    public int Port { get; set; }
    public string Name { get; set; }
    public string User { get; set; }
    public string Password { get; set; }        // Generated by installer
}

public class SupabaseSecrets
{
    public string CRM_SERVER_URL { get; set; }
    public string SAAS_ADMIN_KEY { get; set; }
    public string WEBHOOK_SECRET { get; set; }
}

public async Task<CrmInstallResult> InstallCrmAsync(CrmInstallConfig config)
{
    var installationId = Guid.NewGuid().ToString();

    // 1. Generate ALL secrets upfront
    var setupKey = GenerateSecureKey(64);
    var dbPassword = GenerateSecureKey(32);
    var dbName = "sleepnest_crm";
    var dbUser = "sleepnest";

    try
    {
        // 2. Create docker-compose.yml with environment variables
        var composeContent = GenerateDockerCompose(new {
            SETUP_KEY = setupKey,
            PG_DATABASE = dbName,
            PG_USER = dbUser,
            PG_PASSWORD = dbPassword,
            SERVER_URL = config.ServerUrl
        });

        // 3. Write files to target directory
        await File.WriteAllTextAsync(
            Path.Combine(config.InstallPath, "docker-compose.yml"),
            composeContent
        );

        // 4. Pull and start containers
        await RunDockerComposeAsync(config.InstallPath, "pull");
        await RunDockerComposeAsync(config.InstallPath, "up -d");

        // 5. Wait for health check (with timeout and retries)
        await WaitForHealthyAsync(
            $"{config.ServerUrl}/setup/health",
            timeout: TimeSpan.FromMinutes(5),
            retryInterval: TimeSpan.FromSeconds(5)
        );

        // 6. Call setup API to configure and get generated secrets
        var setupResponse = await CallSetupApiAsync(new SetupRequest {
            SetupKey = setupKey,
            SupabaseUrl = config.SupabaseUrl,
            SupabaseAnonKey = config.SupabaseAnonKey,
            SupabaseServiceRoleKey = config.SupabaseServiceRoleKey,
            SupabaseJwtSecret = config.SupabaseJwtSecret,
            AdminEmails = config.AdminEmails,
            ServerUrl = config.ServerUrl
        });

        // 7. CRITICAL: Save secrets to Supabase Edge Functions
        await SetSupabaseSecretsAsync(
            config.SupabaseProjectRef,
            config.SupabaseAccessToken,
            new SupabaseSecrets
            {
                CRM_SERVER_URL = config.ServerUrl,
                SAAS_ADMIN_KEY = setupResponse.GeneratedSecrets.SaasAdminKey,
                WEBHOOK_SECRET = setupResponse.GeneratedSecrets.WebhookSecret
            }
        );

        // 8. Restart containers to apply config
        await RunDockerComposeAsync(config.InstallPath, "restart server worker");

        // 9. Wait for restart to complete
        await WaitForHealthyAsync(
            $"{config.ServerUrl}/healthz",
            timeout: TimeSpan.FromMinutes(2)
        );

        // 10. Return COMPLETE result with ALL secrets (for backup)
        // ⚠️ CRITICAL: Caller MUST save these to Supabase!
        return new CrmInstallResult
        {
            Success = true,
            InstallationId = installationId,
            CrmUrl = config.ServerUrl,

            Credentials = new CrmCredentials
            {
                SaasAdminKey = setupResponse.GeneratedSecrets.SaasAdminKey,
                WebhookSecret = setupResponse.GeneratedSecrets.WebhookSecret,
                SetupKey = setupKey  // For reference only, already used
            },

            Database = new DatabaseCredentials
            {
                Host = "db",  // Internal Docker hostname
                Port = 5432,
                Name = dbName,
                User = dbUser,
                Password = dbPassword
            },

            // Ready-to-use format for Supabase CLI
            SupabaseSecretsToSet = new SupabaseSecrets
            {
                CRM_SERVER_URL = config.ServerUrl,
                SAAS_ADMIN_KEY = setupResponse.GeneratedSecrets.SaasAdminKey,
                WEBHOOK_SECRET = setupResponse.GeneratedSecrets.WebhookSecret
            }
        };
    }
    catch (Exception ex)
    {
        return new CrmInstallResult
        {
            Success = false,
            InstallationId = installationId,
            ErrorMessage = ex.Message
        };
    }
}

// After installation, the caller MUST do this:
//
// var result = await InstallCrmAsync(config);
// if (result.Success)
// {
//     // Save to your database
//     await SaveInstallationAsync(result);
//
//     // Set Supabase secrets (via Supabase Management API or CLI)
//     await SetSupabaseSecretsAsync(result.SupabaseSecretsToSet);
// }
```

## 12. Security Notes

1. **SETUP_KEY is one-time use** - After setup, the endpoint is locked forever
2. **Store secrets securely** - saasAdminKey and webhookSecret should be encrypted at rest
3. **Don't log secrets** - Never write secrets to logs or console output
4. **Use HTTPS in production** - The serverUrl must be https:// in production
5. **Rotate secrets** - If compromised, secrets cannot be regenerated without reinstalling

## 13. Testing the Installation

After installation, verify:

1. **Health**: GET http://<host>:3000/healthz returns 200
2. **Setup locked**: GET http://<host>:3000/setup/status shows configured: true
3. **Auth works**: POST http://<host>:3000/auth/supabase/status returns enabled: true

## 14. Post-Installation: Tenant Management API

After setup, use the SaaS Admin API with the returned saasAdminKey:

```http
# Create tenant
POST http://<host>:3000/saas/tenants
Header: x-saas-admin-key: <saasAdminKey>
Body: { "email": "user@example.com", "displayName": "Acme Corp" }

# List tenants
GET http://<host>:3000/saas/tenants
Header: x-saas-admin-key: <saasAdminKey>

# Disable tenant
POST http://<host>:3000/saas/tenants/{id}/disable
Header: x-saas-admin-key: <saasAdminKey>
Body: { "reason": "Subscription cancelled" }

# Enable tenant
POST http://<host>:3000/saas/tenants/{id}/enable
Header: x-saas-admin-key: <saasAdminKey>

# Delete tenant
DELETE http://<host>:3000/saas/tenants/{id}
Header: x-saas-admin-key: <saasAdminKey>

# Get stats
GET http://<host>:3000/saas/stats
Header: x-saas-admin-key: <saasAdminKey>
```

## Summary

Please implement a C# class library that:
1. Reads configuration from `appsettings.json`
2. Deploys Docker containers to a remote server
3. Calls the Setup API to configure the CRM
4. Saves secrets to Supabase Edge Functions via Management API
5. Returns all generated secrets in a structured result object
6. Supports proper error handling, logging, and cancellation tokens

### PROMPT END

---

## Quick Reference

| Item | Value |
|------|-------|
| Docker Image | `registry.digitalocean.com/sleepnest/sleepnest-crm:latest` |
| Setup Endpoint | `POST /setup/initialize` |
| Health Endpoint | `GET /setup/health` |
| Status Endpoint | `GET /setup/status` |
| Default Port | `3000` |
| Auth Header | `x-saas-admin-key` |

## Secrets to Store

After successful setup, store these securely:

| Secret | Purpose | Usage |
|--------|---------|-------|
| `saasAdminKey` | Full platform API access | Header: `x-saas-admin-key` |
| `webhookSecret` | Webhook signature verification | HMAC-SHA256 signing |
| `dbPassword` | PostgreSQL access | Internal only |

## Error Codes

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| 200 | Success | Continue |
| 400 | Bad request | Check required fields |
| 401 | Invalid setup key | Verify SETUP_KEY matches |
| 403 | Already configured | CRM was already set up |
| 503 | Setup not available | SETUP_KEY env var not set |
