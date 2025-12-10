#!/bin/bash
# ============================================
# SleepNest CRM - Quick Install Script
# ============================================
#
# One-command installation for customers.
# Downloads and runs the full installer with sensible defaults.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install/quick-install.sh | bash
#
# Or with environment variables:
#   export SUPABASE_URL="https://xxx.supabase.co"
#   export SUPABASE_ANON_KEY="your-key"
#   curl -fsSL ... | bash
#

set -e

echo ""
echo "🚀 SleepNest CRM Quick Installer"
echo "================================="
echo ""

# Check for required tools
for cmd in docker docker-compose curl; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Error: $cmd is required but not installed."
        echo "   Please install $cmd and try again."
        exit 1
    fi
done

echo "✅ Prerequisites check passed"
echo ""

# Create install directory
INSTALL_DIR="${INSTALL_DIR:-$HOME/sleepnest-crm}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "📁 Installing to: $INSTALL_DIR"
echo ""

# Download latest docker-compose and scripts
BASE_URL="https://raw.githubusercontent.com/your-org/twenty-multitenant/main/customer-install"

echo "📥 Downloading configuration files..."
curl -fsSL "$BASE_URL/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$BASE_URL/update.sh" -o update.sh
chmod +x update.sh

# Generate secrets if not provided
generate_secret() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p
}

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "🔐 Generating configuration..."

    cat > .env << EOF
# ============================================
# SleepNest CRM Configuration
# Generated on $(date)
# ============================================

# Docker Image (auto-updated)
DOCKER_IMAGE=registry.digitalocean.com/sleepnest/sleepnest-crm:latest

# Database (auto-generated)
PG_DATABASE=sleepnest_crm
PG_USER=sleepnest
PG_PASSWORD=$(generate_secret)

# Server
SERVER_URL=${SERVER_URL:-http://localhost:3000}
APP_SECRET=$(generate_secret)

# Supabase (REQUIRED - update these!)
SUPABASE_URL=${SUPABASE_URL:-https://your-project.supabase.co}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-your-anon-key}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET:-your-jwt-secret}

# Admin Users (comma-separated emails)
ADMIN_EMAILS=${ADMIN_EMAILS:-}

# SaaS Integration (auto-generated)
WEBHOOK_SECRET=$(generate_secret)
SAAS_ADMIN_KEY=$(generate_secret)
EOF

    echo "✅ Configuration generated"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and update Supabase settings!"
    echo "   nano $INSTALL_DIR/.env"
    echo ""
else
    echo "✅ Using existing configuration"
fi

# Pull and start
echo "📦 Pulling latest Docker image..."
docker-compose pull

echo ""
echo "🚀 Starting SleepNest CRM..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Check status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "============================================"
echo "✅ SleepNest CRM Installation Complete!"
echo "============================================"
echo ""
echo "🌐 Access your CRM at: http://localhost:3000"
echo ""
echo "📁 Installation directory: $INSTALL_DIR"
echo "📝 Configuration file: $INSTALL_DIR/.env"
echo ""
echo "🔄 To update to latest version:"
echo "   cd $INSTALL_DIR && ./update.sh"
echo ""
echo "📋 Useful commands:"
echo "   docker-compose logs -f     # View logs"
echo "   docker-compose restart     # Restart services"
echo "   docker-compose down        # Stop services"
echo ""
