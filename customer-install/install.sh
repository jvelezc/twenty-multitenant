#!/bin/bash
# ============================================
# SleepNest CRM - Customer Installation Script
# ============================================
#
# This script deploys SleepNest CRM to your DigitalOcean account.
#
# ⚡ CUSTOMIZE THIS SCRIPT FOR YOUR NEEDS ⚡
# Feel free to modify any values, add your own defaults,
# or hardcode configuration for automated deployments.
#
# Prerequisites:
# 1. A DigitalOcean account with API access
# 2. Docker installed locally (for initial setup)
# 3. A Supabase project (for authentication)
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
#
# For automated/CI deployments, you can set environment variables:
#   export DO_API_TOKEN="your-token"
#   export SUPABASE_URL="https://xxx.supabase.co"
#   ./install.sh --non-interactive
#
# The script will prompt you for all required configuration.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "============================================"
echo "   SleepNest CRM - Installation Script"
echo "============================================"
echo -e "${NC}"

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        value="${value:-$default}"
    else
        read -p "$prompt: " value
    fi

    eval "$var_name='$value'"
}

# Function to prompt for secret (hidden input)
prompt_secret() {
    local prompt="$1"
    local var_name="$2"

    read -s -p "$prompt: " value
    echo ""
    eval "$var_name='$value'"
}

# Function to generate random string
generate_secret() {
    openssl rand -hex 32
}

echo -e "${YELLOW}Step 1: DigitalOcean Configuration${NC}"
echo "-------------------------------------------"
prompt_secret "Enter your DigitalOcean API Token" DO_API_TOKEN

if [ -z "$DO_API_TOKEN" ]; then
    echo -e "${RED}Error: DigitalOcean API Token is required${NC}"
    exit 1
fi

prompt_with_default "Enter Droplet region" "nyc1" DO_REGION
prompt_with_default "Enter Droplet size" "s-2vcpu-4gb" DO_SIZE
prompt_with_default "Enter your domain (or leave empty for IP access)" "" DOMAIN

echo ""
echo -e "${YELLOW}Step 2: Database Configuration${NC}"
echo "-------------------------------------------"
prompt_with_default "PostgreSQL Database Name" "sleepnest_crm" PG_DATABASE
prompt_with_default "PostgreSQL Username" "sleepnest" PG_USER
echo "Generating secure database password..."
PG_PASSWORD=$(generate_secret)
echo -e "${GREEN}Database password generated (saved to .env file)${NC}"

echo ""
echo -e "${YELLOW}Step 3: Supabase Configuration${NC}"
echo "-------------------------------------------"
echo "Get these values from your Supabase project dashboard:"
echo "https://app.supabase.com/project/_/settings/api"
echo ""
prompt_with_default "Supabase Project URL" "" SUPABASE_URL
prompt_secret "Supabase Anon Key" SUPABASE_ANON_KEY
prompt_secret "Supabase Service Role Key" SUPABASE_SERVICE_ROLE_KEY
prompt_secret "Supabase JWT Secret" SUPABASE_JWT_SECRET

echo ""
echo -e "${YELLOW}Step 4: Admin User Configuration${NC}"
echo "-------------------------------------------"
echo "Admin users have full access to manage all tenants,"
echo "view cross-tenant data, and disable accounts."
echo ""
prompt_with_default "Admin email addresses (comma-separated)" "" ADMIN_EMAILS

if [ -z "$ADMIN_EMAILS" ]; then
    echo -e "${RED}Warning: No admin emails specified. You can add them later in .env${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Webhook & SaaS Admin Configuration${NC}"
echo "-------------------------------------------"
echo "Webhooks allow external systems (billing, CRM, etc.) to notify"
echo "this CRM when a tenant should be disabled/enabled."
echo ""
echo "Generating webhook secret..."
WEBHOOK_SECRET=$(generate_secret)
echo -e "${GREEN}Webhook secret generated${NC}"
echo ""
echo "Generating SaaS Admin API key..."
SAAS_ADMIN_KEY=$(generate_secret)
echo -e "${GREEN}SaaS Admin key generated${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: Save these keys securely!${NC}"
echo "  - WEBHOOK_SECRET: Share with external systems for signed webhooks"
echo "  - SAAS_ADMIN_KEY: Your master API key for full platform access"
echo ""
echo "Use SaaS Admin key with header: x-saas-admin-key"

echo ""
echo -e "${YELLOW}Step 6: Application Configuration${NC}"
echo "-------------------------------------------"
prompt_with_default "App Name" "SleepNest CRM" APP_NAME
echo "Generating application secret..."
APP_SECRET=$(generate_secret)
echo -e "${GREEN}Application secret generated${NC}"

echo ""
echo -e "${YELLOW}Step 7: Creating deployment files...${NC}"
echo "-------------------------------------------"

# Create deployment directory
DEPLOY_DIR="sleepnest-crm-deploy"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Determine server URL
if [ -n "$DOMAIN" ]; then
    SERVER_URL="https://$DOMAIN"
else
    SERVER_URL="http://\${DROPLET_IP}:3000"
fi

# Create docker-compose.yml
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: sleepnest-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${PG_DATABASE}
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PG_USER} -d ${PG_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: sleepnest-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    image: ${DOCKER_IMAGE:-registry.digitalocean.com/sleepnest/sleepnest-crm:latest}
    container_name: sleepnest-server
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "3000:3000"
    environment:
      # Database
      PG_DATABASE_URL: postgres://${PG_USER}:${PG_PASSWORD}@db:5432/${PG_DATABASE}

      # Redis
      REDIS_URL: redis://redis:6379

      # Server
      SERVER_URL: ${SERVER_URL}
      APP_SECRET: ${APP_SECRET}

      # Multi-tenancy
      IS_MULTIWORKSPACE_ENABLED: "true"

      # Supabase Auth
      AUTH_SUPABASE_ENABLED: "true"
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      SUPABASE_JWT_SECRET: ${SUPABASE_JWT_SECRET}

      # Admin Users - these emails get full admin access
      ADMIN_EMAILS: ${ADMIN_EMAILS}

      # Webhook Secret - for signed requests from external systems
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}

      # SaaS Admin Key - master API key for platform operators
      SAAS_ADMIN_KEY: ${SAAS_ADMIN_KEY}

      # Disable other auth providers (optional - remove to enable)
      AUTH_PASSWORD_ENABLED: "false"
      AUTH_GOOGLE_ENABLED: "false"
      AUTH_MICROSOFT_ENABLED: "false"
    command: >
      sh -c "yarn database:migrate:prod && yarn start:prod"

  worker:
    image: ${DOCKER_IMAGE:-registry.digitalocean.com/sleepnest/sleepnest-crm:latest}
    container_name: sleepnest-worker
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      PG_DATABASE_URL: postgres://${PG_USER}:${PG_PASSWORD}@db:5432/${PG_DATABASE}
      REDIS_URL: redis://redis:6379
      SERVER_URL: ${SERVER_URL}
      APP_SECRET: ${APP_SECRET}
      IS_MULTIWORKSPACE_ENABLED: "true"
    command: yarn worker:prod

volumes:
  postgres_data:
  redis_data:
COMPOSE_EOF

# Create .env file
cat > .env << ENV_EOF
# ============================================
# SleepNest CRM Configuration
# Generated on $(date)
# ============================================

# Docker Image
DOCKER_IMAGE=registry.digitalocean.com/sleepnest/sleepnest-crm:latest

# Database
PG_DATABASE=${PG_DATABASE}
PG_USER=${PG_USER}
PG_PASSWORD=${PG_PASSWORD}

# Server
SERVER_URL=${SERVER_URL}
APP_SECRET=${APP_SECRET}

# Supabase
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}

# Admin Users (comma-separated emails)
ADMIN_EMAILS=${ADMIN_EMAILS}

# Webhook Secret (share with external systems for signed requests)
WEBHOOK_SECRET=${WEBHOOK_SECRET}

# SaaS Admin Key (your master API key for full platform access)
SAAS_ADMIN_KEY=${SAAS_ADMIN_KEY}
ENV_EOF

# Create cloud-init script for DigitalOcean
cat > cloud-init.yaml << 'CLOUD_EOF'
#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - docker-compose
  - curl
  - git

runcmd:
  - systemctl enable docker
  - systemctl start docker
  - usermod -aG docker root
CLOUD_EOF

echo -e "${GREEN}Deployment files created in ./$DEPLOY_DIR/${NC}"

echo ""
echo -e "${YELLOW}Step 7: Creating DigitalOcean Droplet...${NC}"
echo "-------------------------------------------"

# Install doctl if not present
if ! command -v doctl &> /dev/null; then
    echo "Installing doctl CLI..."
    curl -sL https://github.com/digitalocean/doctl/releases/download/v1.101.0/doctl-1.101.0-linux-amd64.tar.gz | tar -xzv
    sudo mv doctl /usr/local/bin
fi

# Authenticate with DigitalOcean
doctl auth init --access-token "$DO_API_TOKEN"

# Create SSH key if not exists
SSH_KEY_NAME="sleepnest-crm-key"
if [ ! -f ~/.ssh/sleepnest_crm_rsa ]; then
    echo "Generating SSH key..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/sleepnest_crm_rsa -N "" -C "sleepnest-crm"
fi

# Upload SSH key to DigitalOcean
SSH_KEY_FINGERPRINT=$(doctl compute ssh-key import "$SSH_KEY_NAME" --public-key-file ~/.ssh/sleepnest_crm_rsa.pub --format FingerPrint --no-header 2>/dev/null || doctl compute ssh-key list --format FingerPrint --no-header | head -1)

# Create Droplet
echo "Creating Droplet..."
DROPLET_ID=$(doctl compute droplet create sleepnest-crm \
    --region "$DO_REGION" \
    --size "$DO_SIZE" \
    --image docker-20-04 \
    --ssh-keys "$SSH_KEY_FINGERPRINT" \
    --user-data-file cloud-init.yaml \
    --wait \
    --format ID \
    --no-header)

# Get Droplet IP
DROPLET_IP=$(doctl compute droplet get "$DROPLET_ID" --format PublicIPv4 --no-header)

echo -e "${GREEN}Droplet created with IP: $DROPLET_IP${NC}"

# Update .env with actual IP if no domain
if [ -z "$DOMAIN" ]; then
    sed -i "s|\${DROPLET_IP}|$DROPLET_IP|g" .env
fi

echo ""
echo -e "${YELLOW}Step 8: Deploying application...${NC}"
echo "-------------------------------------------"

# Wait for Droplet to be ready
echo "Waiting for Droplet to be ready (this may take 2-3 minutes)..."
sleep 60

# Copy files to Droplet
echo "Copying deployment files..."
scp -o StrictHostKeyChecking=no -i ~/.ssh/sleepnest_crm_rsa docker-compose.yml .env root@"$DROPLET_IP":/root/

# Deploy on Droplet
echo "Starting deployment..."
ssh -o StrictHostKeyChecking=no -i ~/.ssh/sleepnest_crm_rsa root@"$DROPLET_IP" << 'REMOTE_EOF'
cd /root
docker-compose pull
docker-compose up -d
echo "Waiting for services to start..."
sleep 30
docker-compose ps
REMOTE_EOF

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   SleepNest CRM Installation Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Your CRM is now running at:"
if [ -n "$DOMAIN" ]; then
    echo -e "  ${BLUE}https://$DOMAIN${NC}"
    echo ""
    echo -e "${YELLOW}Note: Configure your DNS to point $DOMAIN to $DROPLET_IP${NC}"
else
    echo -e "  ${BLUE}http://$DROPLET_IP:3000${NC}"
fi
echo ""
echo -e "Droplet IP: ${BLUE}$DROPLET_IP${NC}"
echo -e "SSH Access: ${BLUE}ssh -i ~/.ssh/sleepnest_crm_rsa root@$DROPLET_IP${NC}"
echo ""
echo -e "Configuration files saved in: ${BLUE}./$DEPLOY_DIR/${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure your Supabase project with redirect URLs"
echo "2. Set up your frontend to use Supabase Auth"
echo "3. Access the CRM and create your first workspace"
echo ""
echo -e "${GREEN}Thank you for using SleepNest CRM!${NC}"
