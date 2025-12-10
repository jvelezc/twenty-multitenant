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

# Check if Supabase config is provided via environment
SUPABASE_CONFIGURED=false
if [ -n "$SUPABASE_URL" ] && [ "$SUPABASE_URL" != "https://your-project.supabase.co" ]; then
    SUPABASE_CONFIGURED=true
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "🔐 Generating configuration..."

    # If Supabase not configured, prompt for it
    if [ "$SUPABASE_CONFIGURED" = false ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📋 Supabase Configuration Required"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Get these from: https://app.supabase.com/project/_/settings/api"
        echo ""

        read -p "Supabase Project URL (e.g., https://xxx.supabase.co): " SUPABASE_URL
        read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
        read -p "Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
        read -p "Supabase JWT Secret: " SUPABASE_JWT_SECRET
        echo ""
        read -p "Admin email addresses (comma-separated, or leave empty): " ADMIN_EMAILS
        echo ""
    fi

    cat > .env << EOF
# ============================================
# SleepNest CRM Configuration
# Generated on $(date)
# ============================================

# Database (auto-generated - do not change)
PG_DATABASE_NAME=default
PG_DATABASE_USER=postgres
PG_DATABASE_PASSWORD=$(generate_secret)

# Server
SERVER_URL=${SERVER_URL:-http://localhost:3000}
APP_SECRET=$(generate_secret)

# Supabase Authentication
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}

# Admin Users (comma-separated emails with full platform access)
ADMIN_EMAILS=${ADMIN_EMAILS:-}

# SaaS Integration (auto-generated - save these securely!)
WEBHOOK_SECRET=$(generate_secret)
SAAS_ADMIN_KEY=$(generate_secret)
EOF

    echo "✅ Configuration saved to .env"
    echo ""
else
    echo "✅ Using existing configuration from .env"
fi

# Validate required config
source .env
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://your-project.supabase.co" ]; then
    echo ""
    echo "❌ Error: Supabase is not configured!"
    echo ""
    echo "Edit the .env file and add your Supabase credentials:"
    echo "   nano $INSTALL_DIR/.env"
    echo ""
    echo "Then run: docker-compose up -d"
    exit 1
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
