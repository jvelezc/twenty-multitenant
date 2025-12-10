# ============================================
# SleepNest CRM - Customer Installation Script (Windows)
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
# 2. A Supabase project (for authentication)
#
# Usage:
#   .\install.ps1
#
# For automated deployments, you can set environment variables:
#   $env:DO_API_TOKEN = "your-token"
#   $env:SUPABASE_URL = "https://xxx.supabase.co"
#   .\install.ps1

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Generate-SecurePassword {
    $bytes = New-Object Byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Blue
Write-Host "   SleepNest CRM - Installation Script" -ForegroundColor Blue
Write-Host "============================================" -ForegroundColor Blue
Write-Host ""

# Step 1: DigitalOcean Configuration
Write-Host "Step 1: DigitalOcean Configuration" -ForegroundColor Yellow
Write-Host "-------------------------------------------"

$DO_API_TOKEN = Read-Host "Enter your DigitalOcean API Token" -AsSecureString
$DO_API_TOKEN_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DO_API_TOKEN))

if ([string]::IsNullOrEmpty($DO_API_TOKEN_PLAIN)) {
    Write-Host "Error: DigitalOcean API Token is required" -ForegroundColor Red
    exit 1
}

$DO_REGION = Read-Host "Enter Droplet region [nyc1]"
if ([string]::IsNullOrEmpty($DO_REGION)) { $DO_REGION = "nyc1" }

$DO_SIZE = Read-Host "Enter Droplet size [s-2vcpu-4gb]"
if ([string]::IsNullOrEmpty($DO_SIZE)) { $DO_SIZE = "s-2vcpu-4gb" }

$DOMAIN = Read-Host "Enter your domain (or leave empty for IP access)"

# Step 2: Database Configuration
Write-Host ""
Write-Host "Step 2: Database Configuration" -ForegroundColor Yellow
Write-Host "-------------------------------------------"

$PG_DATABASE = Read-Host "PostgreSQL Database Name [sleepnest_crm]"
if ([string]::IsNullOrEmpty($PG_DATABASE)) { $PG_DATABASE = "sleepnest_crm" }

$PG_USER = Read-Host "PostgreSQL Username [sleepnest]"
if ([string]::IsNullOrEmpty($PG_USER)) { $PG_USER = "sleepnest" }

Write-Host "Generating secure database password..."
$PG_PASSWORD = Generate-SecurePassword
Write-Host "Database password generated (saved to .env file)" -ForegroundColor Green

# Step 3: Supabase Configuration
Write-Host ""
Write-Host "Step 3: Supabase Configuration" -ForegroundColor Yellow
Write-Host "-------------------------------------------"
Write-Host "Get these values from your Supabase project dashboard:"
Write-Host "https://app.supabase.com/project/_/settings/api"
Write-Host ""

$SUPABASE_URL = Read-Host "Supabase Project URL"
$SUPABASE_ANON_KEY = Read-Host "Supabase Anon Key" -AsSecureString
$SUPABASE_ANON_KEY_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SUPABASE_ANON_KEY))

$SUPABASE_SERVICE_ROLE_KEY = Read-Host "Supabase Service Role Key" -AsSecureString
$SUPABASE_SERVICE_ROLE_KEY_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SUPABASE_SERVICE_ROLE_KEY))

$SUPABASE_JWT_SECRET = Read-Host "Supabase JWT Secret" -AsSecureString
$SUPABASE_JWT_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SUPABASE_JWT_SECRET))

# Step 4: Admin User Configuration
Write-Host ""
Write-Host "Step 4: Admin User Configuration" -ForegroundColor Yellow
Write-Host "-------------------------------------------"
Write-Host "Admin users have full access to manage all tenants,"
Write-Host "view cross-tenant data, and disable accounts."
Write-Host ""

$ADMIN_EMAILS = Read-Host "Admin email addresses (comma-separated)"

if ([string]::IsNullOrEmpty($ADMIN_EMAILS)) {
    Write-Host "Warning: No admin emails specified. You can add them later in .env" -ForegroundColor Yellow
}

# Step 5: Application Configuration
Write-Host ""
Write-Host "Step 5: Application Configuration" -ForegroundColor Yellow
Write-Host "-------------------------------------------"

$APP_NAME = Read-Host "App Name [SleepNest CRM]"
if ([string]::IsNullOrEmpty($APP_NAME)) { $APP_NAME = "SleepNest CRM" }

Write-Host "Generating application secret..."
$APP_SECRET = Generate-SecurePassword
Write-Host "Application secret generated" -ForegroundColor Green

# Step 6: Create deployment files
Write-Host ""
Write-Host "Step 6: Creating deployment files..." -ForegroundColor Yellow
Write-Host "-------------------------------------------"

$DEPLOY_DIR = "sleepnest-crm-deploy"
New-Item -ItemType Directory -Force -Path $DEPLOY_DIR | Out-Null
Set-Location $DEPLOY_DIR

# Determine server URL
if ([string]::IsNullOrEmpty($DOMAIN)) {
    $SERVER_URL = "http://`${DROPLET_IP}:3000"
} else {
    $SERVER_URL = "https://$DOMAIN"
}

# Create docker-compose.yml
$dockerCompose = @"
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: sleepnest-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: `${PG_DATABASE}
      POSTGRES_USER: `${PG_USER}
      POSTGRES_PASSWORD: `${PG_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U `${PG_USER} -d `${PG_DATABASE}"]
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
    image: `${DOCKER_IMAGE:-registry.digitalocean.com/sleepnest/sleepnest-crm:latest}
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
      PG_DATABASE_URL: postgres://`${PG_USER}:`${PG_PASSWORD}@db:5432/`${PG_DATABASE}
      REDIS_URL: redis://redis:6379
      SERVER_URL: `${SERVER_URL}
      APP_SECRET: `${APP_SECRET}
      IS_MULTIWORKSPACE_ENABLED: "true"
      AUTH_SUPABASE_ENABLED: "true"
      SUPABASE_URL: `${SUPABASE_URL}
      SUPABASE_ANON_KEY: `${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: `${SUPABASE_SERVICE_ROLE_KEY}
      SUPABASE_JWT_SECRET: `${SUPABASE_JWT_SECRET}
      ADMIN_EMAILS: `${ADMIN_EMAILS}
      AUTH_PASSWORD_ENABLED: "false"
      AUTH_GOOGLE_ENABLED: "false"
      AUTH_MICROSOFT_ENABLED: "false"
    command: >
      sh -c "yarn database:migrate:prod && yarn start:prod"

  worker:
    image: `${DOCKER_IMAGE:-registry.digitalocean.com/sleepnest/sleepnest-crm:latest}
    container_name: sleepnest-worker
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      PG_DATABASE_URL: postgres://`${PG_USER}:`${PG_PASSWORD}@db:5432/`${PG_DATABASE}
      REDIS_URL: redis://redis:6379
      SERVER_URL: `${SERVER_URL}
      APP_SECRET: `${APP_SECRET}
      IS_MULTIWORKSPACE_ENABLED: "true"
    command: yarn worker:prod

volumes:
  postgres_data:
  redis_data:
"@

$dockerCompose | Out-File -FilePath "docker-compose.yml" -Encoding UTF8

# Create .env file
$envContent = @"
# ============================================
# SleepNest CRM Configuration
# Generated on $(Get-Date)
# ============================================

# Docker Image
DOCKER_IMAGE=registry.digitalocean.com/sleepnest/sleepnest-crm:latest

# Database
PG_DATABASE=$PG_DATABASE
PG_USER=$PG_USER
PG_PASSWORD=$PG_PASSWORD

# Server
SERVER_URL=$SERVER_URL
APP_SECRET=$APP_SECRET

# Supabase
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_PLAIN
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY_PLAIN
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET_PLAIN

# Admin Users (comma-separated emails)
ADMIN_EMAILS=$ADMIN_EMAILS
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Deployment files created in ./$DEPLOY_DIR/" -ForegroundColor Green

# Step 7: Create Droplet
Write-Host ""
Write-Host "Step 7: Creating DigitalOcean Droplet..." -ForegroundColor Yellow
Write-Host "-------------------------------------------"

# Check if doctl is installed
$doctlPath = Get-Command doctl -ErrorAction SilentlyContinue
if (-not $doctlPath) {
    Write-Host "Installing doctl CLI..." -ForegroundColor Yellow
    Write-Host "Please download doctl from: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    Write-Host ""
    Write-Host "After installing doctl, run these commands manually:" -ForegroundColor Yellow
    Write-Host "  1. doctl auth init --access-token YOUR_TOKEN"
    Write-Host "  2. doctl compute droplet create sleepnest-crm --region $DO_REGION --size $DO_SIZE --image docker-20-04 --wait"
    Write-Host "  3. Copy docker-compose.yml and .env to the droplet"
    Write-Host "  4. SSH into the droplet and run: docker-compose up -d"
    Write-Host ""
    Write-Host "Configuration files are ready in: $DEPLOY_DIR" -ForegroundColor Green
    exit 0
}

# Authenticate
doctl auth init --access-token $DO_API_TOKEN_PLAIN

# Create Droplet
Write-Host "Creating Droplet..."
$dropletOutput = doctl compute droplet create sleepnest-crm `
    --region $DO_REGION `
    --size $DO_SIZE `
    --image docker-20-04 `
    --wait `
    --format ID,PublicIPv4 `
    --no-header

$dropletInfo = $dropletOutput -split '\s+'
$DROPLET_ID = $dropletInfo[0]
$DROPLET_IP = $dropletInfo[1]

Write-Host "Droplet created with IP: $DROPLET_IP" -ForegroundColor Green

# Update .env with actual IP
if ([string]::IsNullOrEmpty($DOMAIN)) {
    (Get-Content .env) -replace '\$\{DROPLET_IP\}', $DROPLET_IP | Set-Content .env
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Deployment Files Ready!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Droplet IP: $DROPLET_IP" -ForegroundColor Blue
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. SSH into your droplet: ssh root@$DROPLET_IP"
Write-Host "2. Copy the files from $DEPLOY_DIR to the droplet"
Write-Host "3. Run: docker-compose up -d"
Write-Host ""
Write-Host "Your CRM will be available at:"
if ([string]::IsNullOrEmpty($DOMAIN)) {
    Write-Host "  http://${DROPLET_IP}:3000" -ForegroundColor Blue
} else {
    Write-Host "  https://$DOMAIN" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Note: Configure your DNS to point $DOMAIN to $DROPLET_IP" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Thank you for using SleepNest CRM!" -ForegroundColor Green
