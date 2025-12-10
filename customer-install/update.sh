#!/bin/bash
# ============================================
# SleepNest CRM - Update Script
# ============================================
#
# Updates the CRM to the latest version with zero downtime.
#
# Usage:
#   ./update.sh           # Update to latest
#   ./update.sh v1.2.3    # Update to specific version
#
# The script:
# 1. Pulls the latest Docker image
# 2. Restarts services with the new image
# 3. Runs any pending database migrations
#
# Your data is preserved - only the application code is updated.
#

set -e

VERSION="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "🔄 SleepNest CRM Updater"
echo "========================"
echo ""
echo "📁 Working directory: $SCRIPT_DIR"
echo "🏷️  Target version: $VERSION"
echo ""

# Check for docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose is required"
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Run the installer first or create .env manually"
    exit 1
fi

# Update the version in .env if specified
if [ "$VERSION" != "latest" ]; then
    echo "📝 Updating .env to use version: $VERSION"
    sed -i "s|sleepnest-crm:.*|sleepnest-crm:$VERSION|g" .env
fi

# Show current status
echo "📊 Current status:"
docker-compose ps
echo ""

# Pull new image
echo "📦 Pulling new image..."
docker-compose pull

# Get current image digest
OLD_DIGEST=$(docker-compose images -q server 2>/dev/null | head -1)

# Restart with new image (rolling update)
echo ""
echo "🚀 Restarting services..."
docker-compose up -d --force-recreate --no-deps server worker

# Wait for health check
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check new status
echo ""
echo "📊 New status:"
docker-compose ps

# Get new image digest
NEW_DIGEST=$(docker-compose images -q server 2>/dev/null | head -1)

echo ""
echo "============================================"
echo "✅ Update Complete!"
echo "============================================"
echo ""

if [ "$OLD_DIGEST" != "$NEW_DIGEST" ]; then
    echo "🆕 New version deployed successfully"
else
    echo "ℹ️  Already running the latest version"
fi

echo ""
echo "🌐 Your CRM is running at: $(grep SERVER_URL .env | cut -d= -f2)"
echo ""
echo "📋 Useful commands:"
echo "   docker-compose logs -f server   # View server logs"
echo "   docker-compose ps               # Check status"
echo ""
