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
#   .\scripts\deploy-to-digitalocean.ps1 [-Tag "v1.0.0"]
#
# Example:
#   .\scripts\deploy-to-digitalocean.ps1
#   .\scripts\deploy-to-digitalocean.ps1 -Tag "v1.0.0"

param(
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# Load secrets from .env.deploy
$EnvFile = Join-Path $RootDir ".env.deploy"
if (Test-Path $EnvFile) {
    Write-Host "Loading secrets from .env.deploy..." -ForegroundColor Cyan
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
} else {
    Write-Host "ERROR: .env.deploy not found!" -ForegroundColor Red
    Write-Host "Copy .env.deploy.example to .env.deploy and fill in your values."
    exit 1
}

# Validate required environment variables
if (-not $env:DIGITALOCEAN_ACCESS_TOKEN) {
    Write-Host "ERROR: DIGITALOCEAN_ACCESS_TOKEN is not set" -ForegroundColor Red
    exit 1
}

if (-not $env:DIGITALOCEAN_REGISTRY) {
    Write-Host "ERROR: DIGITALOCEAN_REGISTRY is not set" -ForegroundColor Red
    exit 1
}

# Set defaults
$ImageName = if ($env:DOCKER_IMAGE_NAME) { $env:DOCKER_IMAGE_NAME } else { "sleepnest-crm" }
$ImageTag = $Tag
$FullImageName = "$env:DIGITALOCEAN_REGISTRY/${ImageName}:${ImageTag}"

Write-Host "============================================" -ForegroundColor Green
Write-Host "Deploying to DigitalOcean Container Registry" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Registry: $env:DIGITALOCEAN_REGISTRY"
Write-Host "Image: ${ImageName}:${ImageTag}"
Write-Host "Full path: $FullImageName"
Write-Host "============================================" -ForegroundColor Green

# Authenticate with DigitalOcean Container Registry
Write-Host ""
Write-Host "Step 1: Authenticating with DigitalOcean Container Registry..." -ForegroundColor Cyan

# Use docker login with email and token (dependency-free approach)
$dockerEmail = if ($env:DIGITALOCEAN_EMAIL) { $env:DIGITALOCEAN_EMAIL } else { "jose@gentlebirth.com" }
Write-Host "Logging in as: $dockerEmail"
$env:DIGITALOCEAN_ACCESS_TOKEN | docker login registry.digitalocean.com -u $dockerEmail --password-stdin

# Build the Docker image
Write-Host ""
Write-Host "Step 2: Building Docker image..." -ForegroundColor Cyan
Push-Location $RootDir

try {
    $BuildDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $VcsRef = git rev-parse --short HEAD 2>$null
    if (-not $VcsRef) { $VcsRef = "unknown" }

    docker build `
        -f packages/twenty-docker/twenty/Dockerfile `
        -t $FullImageName `
        --build-arg BUILD_DATE="$BuildDate" `
        --build-arg VCS_REF="$VcsRef" `
        .

    # Also tag as latest if not already
    if ($ImageTag -ne "latest") {
        docker tag $FullImageName "$env:DIGITALOCEAN_REGISTRY/${ImageName}:latest"
    }

    # Push to registry
    Write-Host ""
    Write-Host "Step 3: Pushing to DigitalOcean Container Registry..." -ForegroundColor Cyan
    docker push $FullImageName

    if ($ImageTag -ne "latest") {
        docker push "$env:DIGITALOCEAN_REGISTRY/${ImageName}:latest"
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "SUCCESS! Image pushed to:" -ForegroundColor Green
    Write-Host "  $FullImageName"
    Write-Host ""
    Write-Host "Customers can pull with:" -ForegroundColor Yellow
    Write-Host "  docker pull $FullImageName"
    Write-Host "============================================" -ForegroundColor Green
}
finally {
    Pop-Location
}
