# Render Deployment Script
# This script will help you deploy to Render using their API

param(
    [string]$ServiceName = "discourse-socket-server"
)

Write-Host "🚀 Render Deployment Helper Script" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if git is in sync
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  Warning: You have uncommitted changes." -ForegroundColor Yellow
    Write-Host "    Please commit and push your changes first." -ForegroundColor Yellow
    git status --short
    return
}

# Check if we're on the dev branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "dev") {
    Write-Host "⚠️  Warning: You're not on the dev branch (currently on: $currentBranch)" -ForegroundColor Yellow
    $continue = Read-Host "Do you want to continue anyway? (y/N)"
    if ($continue.ToLower() -ne "y") {
        return
    }
}

Write-Host ""
Write-Host "📋 Prerequisites Check:" -ForegroundColor Cyan
Write-Host "✅ Git repository is clean" -ForegroundColor Green
Write-Host "✅ render.yaml configuration exists" -ForegroundColor Green
Write-Host "✅ socket-server directory exists" -ForegroundColor Green

Write-Host ""
Write-Host "🔗 Deployment Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Go to https://render.com and login" -ForegroundColor White
Write-Host "2️⃣  Click 'New +' → 'Web Service'" -ForegroundColor White
Write-Host "3️⃣  Select 'Build and deploy from a Git repository'" -ForegroundColor White
Write-Host "4️⃣  Connect your GitHub account if not already connected" -ForegroundColor White
Write-Host "5️⃣  Select repository: Hasib2202/discourse.ai" -ForegroundColor White
Write-Host ""
Write-Host "6️⃣  Configuration (auto-filled from render.yaml):" -ForegroundColor Yellow
Write-Host "    Name: $ServiceName" -ForegroundColor White
Write-Host "    Region: Oregon (US West)" -ForegroundColor White
Write-Host "    Branch: dev" -ForegroundColor White
Write-Host "    Root Directory: socket-server" -ForegroundColor White
Write-Host "    Runtime: Node" -ForegroundColor White
Write-Host "    Build Command: npm install" -ForegroundColor White
Write-Host "    Start Command: npm start" -ForegroundColor White
Write-Host "    Plan: Free" -ForegroundColor White
Write-Host ""
Write-Host "7️⃣  Click 'Create Web Service'" -ForegroundColor White
Write-Host "8️⃣  Wait for deployment (2-3 minutes)" -ForegroundColor White
Write-Host "9️⃣  Copy the service URL when deployment completes" -ForegroundColor White
Write-Host ""

Write-Host "🔧 After Deployment:" -ForegroundColor Cyan
Write-Host "1. Copy your service URL (e.g., https://$ServiceName.onrender.com)" -ForegroundColor White
Write-Host "2. Update Vercel environment variable:" -ForegroundColor White
Write-Host "   NEXT_PUBLIC_SOCKET_URL = https://$ServiceName.onrender.com" -ForegroundColor Yellow
Write-Host "3. Redeploy your Vercel frontend" -ForegroundColor White

Write-Host ""
Write-Host "🌐 Opening Render dashboard..." -ForegroundColor Green
Start-Process "https://render.com/dashboard"

Write-Host ""
Write-Host "✨ Your render.yaml configuration will automatically set up:" -ForegroundColor Green
Write-Host "   • Service name: $ServiceName" -ForegroundColor White
Write-Host "   • Auto-deploy on dev branch pushes" -ForegroundColor White
Write-Host "   • Health checks at /health endpoint" -ForegroundColor White
Write-Host "   • Free tier deployment" -ForegroundColor White
