# Multi-Tenant Architecture Plan with Supabase Authentication

## Implementation Status: ✅ PHASE 1 COMPLETE

The following backend components have been implemented:
- ✅ Supabase config variables added to `config-variables.ts`
- ✅ Database migration for `supabaseUserId` and `primaryAuthProvider` columns
- ✅ User entity updated with Supabase fields
- ✅ Workspace entity updated with `isSupabaseAuthEnabled` flag
- ✅ Supabase auth strategy (`supabase.auth.strategy.ts`)
- ✅ Supabase auth service (`supabase-auth.service.ts`)
- ✅ Supabase auth controller (`supabase-auth.controller.ts`)
- ✅ Auth module updated with Supabase integration
- ✅ `@supabase/supabase-js` dependency added

---

## Executive Summary

This document outlines the plan to convert Twenty CRM into a multi-tenant SaaS platform with Supabase as the authentication provider. The output will be a Docker image published to a registry that customers can pull and configure for their own deployments.

---

## Current Architecture Analysis

### Database Structure
- **Core Schema (`core`)**: Contains system-wide entities (users, workspaces, app tokens, feature flags)
- **Workspace Schemas (`workspace_{base36_uuid}`)**: Per-workspace data isolation using PostgreSQL schemas
- **Existing Multi-workspace Support**: `IS_MULTIWORKSPACE_ENABLED` config flag exists but is disabled by default

### Current Authentication
- Built-in password authentication (`UserEntity.passwordHash`)
- OAuth providers: Google, Microsoft
- SSO: SAML, OIDC strategies
- JWT-based token system (access tokens, refresh tokens, login tokens)
- Session management via Redis

### Key Files
- `packages/twenty-server/src/engine/core-modules/auth/` - Auth module
- `packages/twenty-server/src/engine/core-modules/user/user.entity.ts` - User entity
- `packages/twenty-server/src/engine/core-modules/workspace/workspace.entity.ts` - Workspace/tenant entity
- `packages/twenty-server/src/engine/workspace-datasource/` - Per-workspace data isolation

---

## Implementation Plan

### Phase 1: Supabase Authentication Provider Integration

#### 1.1 Create Supabase Auth Strategy
**Location**: `packages/twenty-server/src/engine/core-modules/auth/strategies/supabase.auth.strategy.ts`

```
- Implement Passport strategy for Supabase JWT validation
- Validate Supabase JWT tokens against Supabase project
- Extract user claims (sub, email, user_metadata)
- Map Supabase user to Twenty user
```

**New Config Variables** (add to `config-variables.ts`):
```typescript
// Supabase Authentication
AUTH_SUPABASE_ENABLED: boolean = false
SUPABASE_URL: string                    // e.g., https://xxx.supabase.co
SUPABASE_ANON_KEY: string               // Public anon key
SUPABASE_SERVICE_ROLE_KEY: string       // Service role key (sensitive)
SUPABASE_JWT_SECRET: string             // JWT secret for token validation
```

#### 1.2 Create Supabase Auth Controller
**Location**: `packages/twenty-server/src/engine/core-modules/auth/controllers/supabase-auth.controller.ts`

```
- POST /auth/supabase/callback - Handle Supabase auth callback
- POST /auth/supabase/token - Exchange Supabase token for Twenty tokens
- GET /auth/supabase/user - Get current user from Supabase token
```

#### 1.3 Create Supabase Auth Service
**Location**: `packages/twenty-server/src/engine/core-modules/auth/services/supabase-auth.service.ts`

```
- validateSupabaseToken(token: string): Promise<SupabaseUser>
- syncUserFromSupabase(supabaseUser): Promise<UserEntity>
- linkSupabaseUserToWorkspace(userId, workspaceId): Promise<void>
```

#### 1.4 Modify Auth Module
**Location**: `packages/twenty-server/src/engine/core-modules/auth/auth.module.ts`

```
- Conditionally import SupabaseAuthStrategy when AUTH_SUPABASE_ENABLED
- Add SupabaseAuthController to controllers
- Add SupabaseAuthService to providers
```

---

### Phase 2: User Entity Modifications

#### 2.1 Add Supabase User ID Field
**Migration**: `add-supabase-user-id-to-user.ts`

```sql
ALTER TABLE core.user ADD COLUMN "supabaseUserId" VARCHAR(255) UNIQUE;
CREATE INDEX "IDX_USER_SUPABASE_ID" ON core.user ("supabaseUserId") WHERE "supabaseUserId" IS NOT NULL;
```

#### 2.2 Update User Entity
**Location**: `packages/twenty-server/src/engine/core-modules/user/user.entity.ts`

```typescript
// Add field
@Column({ nullable: true, unique: true })
supabaseUserId?: string;

// Add field for auth provider tracking
@Column({ type: 'enum', enum: ['password', 'google', 'microsoft', 'supabase', 'sso'], default: 'password' })
primaryAuthProvider: string;
```

---

### Phase 3: Multi-Tenant Enhancements

#### 3.1 Tenant Isolation Strategy
The existing workspace-based isolation is already suitable for multi-tenancy:
- Each workspace = one tenant
- Data isolated in `workspace_{id}` PostgreSQL schemas
- `IS_MULTIWORKSPACE_ENABLED` flag controls multi-tenant mode

#### 3.2 Tenant Provisioning Flow
```
1. User signs up via Supabase Auth
2. Twenty receives Supabase JWT
3. If new user: Create UserEntity with supabaseUserId
4. If no workspace: Create new workspace (tenant)
5. Create workspace schema
6. Run workspace migrations
7. Associate user with workspace
8. Return Twenty access tokens
```

#### 3.3 Tenant-Aware Request Context
Already implemented via:
- `JwtAuthStrategy` extracts `workspaceId` from token
- `WorkspaceDataSourceService` routes queries to correct schema
- Guards validate workspace membership

---

### Phase 4: Docker Configuration for Distribution

#### 4.1 Environment Variables for Customers
Customers pulling the Docker image will configure:

```env
# Required - Database
PG_DATABASE_URL=postgres://user:pass@host:5432/twenty

# Required - Redis
REDIS_URL=redis://host:6379

# Required - Server
SERVER_URL=https://crm.customer-domain.com
APP_SECRET=<random-string>

# Multi-tenant Mode
IS_MULTIWORKSPACE_ENABLED=true

# Supabase Auth (Customer's Supabase Project)
AUTH_SUPABASE_ENABLED=true
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

# Disable built-in auth (optional)
AUTH_PASSWORD_ENABLED=false
AUTH_GOOGLE_ENABLED=false
AUTH_MICROSOFT_ENABLED=false
```

#### 4.2 Docker Compose Template
Create `docker-compose.multitenancy.yml` for customers:

```yaml
services:
  twenty-server:
    image: your-registry/twenty-multitenant:latest
    environment:
      - IS_MULTIWORKSPACE_ENABLED=true
      - AUTH_SUPABASE_ENABLED=true
      # ... other env vars

  twenty-worker:
    image: your-registry/twenty-multitenant:latest
    command: ["yarn", "worker:prod"]
    # ... same env vars
```

---

### Phase 5: Frontend Modifications

#### 5.1 Supabase Auth UI Integration
**Location**: `packages/twenty-front/src/modules/auth/`

```
- Add Supabase client initialization
- Create SupabaseAuthProvider component
- Modify sign-in flow to use Supabase UI or redirect
- Handle Supabase session tokens
- Exchange Supabase tokens for Twenty tokens
```

#### 5.2 New Frontend Config
```typescript
// Runtime config from server
REACT_APP_AUTH_SUPABASE_ENABLED: boolean
REACT_APP_SUPABASE_URL: string
REACT_APP_SUPABASE_ANON_KEY: string
```

---

## File Changes Summary

### New Files
```
packages/twenty-server/src/engine/core-modules/auth/
├── strategies/supabase.auth.strategy.ts
├── controllers/supabase-auth.controller.ts
├── services/supabase-auth.service.ts
├── guards/supabase-auth.guard.ts
└── dto/supabase-auth.dto.ts

packages/twenty-server/src/database/typeorm/core/migrations/common/
└── XXXXXX-add-supabase-user-id.ts

packages/twenty-docker/
└── docker-compose.multitenancy.yml

packages/twenty-front/src/modules/auth/supabase/
├── SupabaseAuthProvider.tsx
├── useSupabaseAuth.ts
└── supabaseClient.ts
```

### Modified Files
```
packages/twenty-server/src/engine/core-modules/auth/auth.module.ts
packages/twenty-server/src/engine/core-modules/user/user.entity.ts
packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts
packages/twenty-server/src/engine/core-modules/twenty-config/enums/config-variables-group.enum.ts
packages/twenty-front/src/modules/auth/sign-in-up/SignInUp.tsx
```

---

## Implementation Order

### Sprint 1: Backend Supabase Integration (Week 1-2)
1. Add Supabase config variables
2. Create Supabase auth strategy
3. Create Supabase auth service
4. Create Supabase auth controller
5. Add database migration for `supabaseUserId`
6. Update auth module with conditional imports
7. Write unit tests

### Sprint 2: Multi-tenant Hardening (Week 2-3)
1. Review and enhance tenant isolation
2. Add tenant provisioning automation
3. Add tenant-level rate limiting
4. Add tenant usage tracking
5. Write integration tests

### Sprint 3: Frontend Integration (Week 3-4)
1. Add Supabase client to frontend
2. Create Supabase auth components
3. Modify sign-in/sign-up flows
4. Handle token exchange
5. Write E2E tests

### Sprint 4: Docker & Documentation (Week 4)
1. Create multi-tenant Docker compose
2. Update Dockerfile if needed
3. Write deployment documentation
4. Create customer onboarding guide
5. Publish to registry

---

## Security Considerations

1. **Token Validation**: Always validate Supabase JWTs server-side using the JWT secret
2. **Tenant Isolation**: PostgreSQL schemas provide strong isolation; add RLS if needed
3. **Service Role Key**: Never expose to frontend; use only server-side
4. **Rate Limiting**: Apply per-tenant rate limits to prevent abuse
5. **Audit Logging**: Log all auth events for security monitoring

---

## Testing Strategy

### Unit Tests
- Supabase token validation
- User sync logic
- Tenant provisioning

### Integration Tests
- Full auth flow with Supabase
- Cross-tenant data isolation
- Token refresh flows

### E2E Tests
- Sign up via Supabase
- Sign in via Supabase
- Workspace creation
- Multi-user workspace access

---

## Rollback Plan

1. Set `AUTH_SUPABASE_ENABLED=false` to disable Supabase auth
2. Users can still use other auth methods if enabled
3. Database migration is additive (new column), no data loss
4. Feature flags allow gradual rollout

---

## Success Metrics

1. Successful authentication via Supabase
2. Proper tenant isolation (no cross-tenant data leaks)
3. Docker image size and startup time within acceptable limits
4. Customer deployment success rate
5. Auth latency < 500ms

---

## Deployment to DigitalOcean Container Registry

### Setup (One-time)

1. Install `doctl` CLI: https://docs.digitalocean.com/reference/doctl/how-to/install/
2. Create a Container Registry in DigitalOcean dashboard
3. Generate an API token with read/write access to the registry
4. Copy `.env.deploy.example` to `.env.deploy` and fill in your values:

```bash
cp .env.deploy.example .env.deploy
# Edit .env.deploy with your actual values
```

### Deploy

**Windows (PowerShell):**
```powershell
.\scripts\deploy-to-digitalocean.ps1
# Or with a specific tag:
.\scripts\deploy-to-digitalocean.ps1 -Tag "v1.0.0"
```

**Linux/Mac:**
```bash
chmod +x scripts/deploy-to-digitalocean.sh
./scripts/deploy-to-digitalocean.sh
# Or with a specific tag:
./scripts/deploy-to-digitalocean.sh v1.0.0
```

### Customer Pull Command

After deployment, customers can pull the image:
```bash
docker pull registry.digitalocean.com/your-registry/twenty-multitenant:latest
```

---

## Dependencies

### NPM Packages to Add
```json
{
  "@supabase/supabase-js": "^2.x",
  "@supabase/auth-helpers-shared": "^0.x"
}
```

### Supabase Project Requirements (Customer-side)
- Supabase project with Auth enabled
- Email/password auth or OAuth providers configured
- JWT secret available for server-side validation
