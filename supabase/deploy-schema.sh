#!/bin/bash
# ============================================
# Deploy CRM Schema to Supabase
# ============================================
#
# This script deploys the crm schema to your Supabase project.
#
# Prerequisites:
# 1. Supabase CLI installed: npm install -g supabase
# 2. Logged in: supabase login
# 3. Project linked: supabase link --project-ref your-project-id
#
# Usage:
#   chmod +x deploy-schema.sh
#   ./deploy-schema.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Deploying CRM Schema to Supabase...${NC}"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not installed${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Run migrations
echo -e "${YELLOW}Running migrations...${NC}"
supabase db push

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   CRM Schema Deployed Successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "The following tables were created in the 'crm' schema:"
echo ""
echo "  - crm.tenants         (master tenant list)"
echo "  - crm.tenant_users    (user-tenant mapping)"
echo "  - crm.tenant_events   (audit log)"
echo "  - crm.sync_queue      (sync operations)"
echo ""
echo "Helper functions:"
echo "  - crm.get_tenant_by_subdomain(subdomain)"
echo "  - crm.get_tenant_by_email(email)"
echo "  - crm.get_user_tenants(user_id)"
echo "  - crm.queue_sync(operation, payload, tenant_id)"
echo "  - crm.log_event(tenant_id, event_type, ...)"
echo ""
