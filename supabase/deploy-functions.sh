#!/bin/bash
# ============================================
# Deploy Supabase Edge Functions
# ============================================
#
# This script deploys the tenant management edge functions to Supabase.
#
# Prerequisites:
# 1. Supabase CLI installed: npm install -g supabase
# 2. Logged in: supabase login
# 3. Project linked: supabase link --project-ref your-project-id
#
# Usage:
#   chmod +x deploy-functions.sh
#   ./deploy-functions.sh
#
# Environment variables (set these before running):
#   SAAS_ADMIN_KEY - Your SaaS admin API key
#   CRM_SERVER_URL - Your CRM server URL (e.g., https://crm.example.com)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Deploying Supabase Edge Functions...${NC}"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not installed${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Check required environment variables
if [ -z "$SAAS_ADMIN_KEY" ]; then
    echo -e "${RED}Error: SAAS_ADMIN_KEY environment variable not set${NC}"
    echo "Set it with: export SAAS_ADMIN_KEY=your-key"
    exit 1
fi

if [ -z "$CRM_SERVER_URL" ]; then
    echo -e "${RED}Error: CRM_SERVER_URL environment variable not set${NC}"
    echo "Set it with: export CRM_SERVER_URL=https://crm.example.com"
    exit 1
fi

# Set secrets in Supabase
echo -e "${YELLOW}Setting secrets...${NC}"
supabase secrets set SAAS_ADMIN_KEY="$SAAS_ADMIN_KEY"
supabase secrets set CRM_SERVER_URL="$CRM_SERVER_URL"

# Deploy functions
echo ""
echo -e "${YELLOW}Deploying tenant-create function...${NC}"
supabase functions deploy tenant-create --no-verify-jwt

echo ""
echo -e "${YELLOW}Deploying tenant-manage function...${NC}"
supabase functions deploy tenant-manage --no-verify-jwt

echo ""
echo -e "${YELLOW}Deploying tenant-stats function...${NC}"
supabase functions deploy tenant-stats --no-verify-jwt

echo ""
echo -e "${YELLOW}Deploying crm-webhook function...${NC}"
supabase functions deploy crm-webhook --no-verify-jwt

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Edge Functions Deployed Successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Your functions are available at:"
echo ""
echo -e "  ${YELLOW}Create Tenant:${NC}"
echo "    POST https://<project-ref>.supabase.co/functions/v1/tenant-create"
echo ""
echo -e "  ${YELLOW}Manage Tenant:${NC}"
echo "    POST https://<project-ref>.supabase.co/functions/v1/tenant-manage"
echo ""
echo -e "  ${YELLOW}Get Stats:${NC}"
echo "    GET https://<project-ref>.supabase.co/functions/v1/tenant-stats"
echo ""
echo "All requests require header: x-saas-admin-key: $SAAS_ADMIN_KEY"
echo ""
