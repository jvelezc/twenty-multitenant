#!/bin/bash
# ============================================
# Deploy Twenty Multi-tenant to DigitalOcean Container Registry
# ============================================
#
# Prerequisites:
# 1. Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/
# 2. Create .env.deploy with your secrets (copy from .env.deploy.example)
# 3. Create a container registry in DigitalOcean dashboard
#
# Usage:
#   ./scripts/deploy-to-digitalocean.sh [tag]
#
# Example:
#   ./scripts/deploy-to-digitalocean.sh v1.0.0
#   ./scripts/deploy-to-digitalocean.sh latest

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load secrets from .env.deploy if it exists
if [ -f "$ROOT_DIR/.env.deploy" ]; then
    echo "Loading secrets from .env.deploy..."
    export $(grep -v '^#' "$ROOT_DIR/.env.deploy" | xargs)
else
    echo "ERROR: .env.deploy not found!"
    echo "Copy .env.deploy.example to .env.deploy and fill in your values."
    exit 1
fi

# Validate required environment variables
if [ -z "$DIGITALOCEAN_ACCESS_TOKEN" ]; then
    echo "ERROR: DIGITALOCEAN_ACCESS_TOKEN is not set"
    exit 1
fi

if [ -z "$DIGITALOCEAN_REGISTRY" ]; then
    echo "ERROR: DIGITALOCEAN_REGISTRY is not set"
    exit 1
fi

# Set defaults
IMAGE_NAME="${DOCKER_IMAGE_NAME:-sleepnest-crm}"
IMAGE_TAG="${1:-${DOCKER_IMAGE_TAG:-latest}}"
FULL_IMAGE_NAME="$DIGITALOCEAN_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "============================================"
echo "Deploying to DigitalOcean Container Registry"
echo "============================================"
echo "Registry: $DIGITALOCEAN_REGISTRY"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo "Full path: $FULL_IMAGE_NAME"
echo "============================================"

# Authenticate with DigitalOcean Container Registry
echo ""
echo "Step 1: Authenticating with DigitalOcean Container Registry..."

# Use docker login with email and token (dependency-free approach)
DOCKER_EMAIL="${DIGITALOCEAN_EMAIL:-jose@gentlebirth.com}"
echo "Logging in as: $DOCKER_EMAIL"
echo "$DIGITALOCEAN_ACCESS_TOKEN" | docker login registry.digitalocean.com -u "$DOCKER_EMAIL" --password-stdin

# Build the Docker image
echo ""
echo "Step 2: Building Docker image..."
cd "$ROOT_DIR"

# Use the existing Dockerfile from twenty-docker package
docker build \
    -f packages/twenty-docker/twenty/Dockerfile \
    -t "$FULL_IMAGE_NAME" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    .

# Also tag as latest if not already
if [ "$IMAGE_TAG" != "latest" ]; then
    docker tag "$FULL_IMAGE_NAME" "$DIGITALOCEAN_REGISTRY/$IMAGE_NAME:latest"
fi

# Push to registry
echo ""
echo "Step 3: Pushing to DigitalOcean Container Registry..."
docker push "$FULL_IMAGE_NAME"

if [ "$IMAGE_TAG" != "latest" ]; then
    docker push "$DIGITALOCEAN_REGISTRY/$IMAGE_NAME:latest"
fi

echo ""
echo "============================================"
echo "SUCCESS! Image pushed to:"
echo "  $FULL_IMAGE_NAME"
echo ""
echo "Customers can pull with:"
echo "  docker pull $FULL_IMAGE_NAME"
echo "============================================"
