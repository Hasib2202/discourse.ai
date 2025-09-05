#!/usr/bin/env node

/**
 * Render Deployment Helper
 * This script helps you deploy to Render by guiding through the process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkPrerequisites() {
    log('🚀 Render Deployment Helper', 'green');
    log('===============================', 'green');
    log('');
    
    // Check if render.yaml exists
    if (!fs.existsSync('render.yaml')) {
        log('❌ render.yaml not found!', 'red');
        process.exit(1);
    }
    
    // Check if socket-server directory exists
    if (!fs.existsSync('socket-server')) {
        log('❌ socket-server directory not found!', 'red');
        process.exit(1);
    }
    
    // Check git status
    try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
            log('⚠️  Warning: You have uncommitted changes.', 'yellow');
            log('   Please commit and push your changes first.', 'yellow');
            process.exit(1);
        }
    } catch (error) {
        log('⚠️  Warning: Could not check git status', 'yellow');
    }
    
    // Check current branch
    try {
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        if (currentBranch !== 'dev') {
            log(`⚠️  Warning: You're not on the dev branch (currently on: ${currentBranch})`, 'yellow');
        }
    } catch (error) {
        log('⚠️  Could not determine current branch', 'yellow');
    }
    
    log('📋 Prerequisites Check:', 'cyan');
    log('✅ render.yaml configuration exists', 'green');
    log('✅ socket-server directory exists', 'green');
    log('✅ Git repository is clean', 'green');
    log('');
}

function showDeploymentSteps() {
    log('🔗 Deployment Steps:', 'cyan');
    log('');
    log('1️⃣  Go to https://render.com and login', 'white');
    log('2️⃣  Click "New +" → "Web Service"', 'white');
    log('3️⃣  Select "Build and deploy from a Git repository"', 'white');
    log('4️⃣  Connect your GitHub account if not already connected', 'white');
    log('5️⃣  Select repository: Hasib2202/discourse.ai', 'white');
    log('');
    log('6️⃣  Configuration (auto-filled from render.yaml):', 'yellow');
    log('    Name: discourse-socket-server', 'white');
    log('    Region: Oregon (US West)', 'white');
    log('    Branch: dev', 'white');
    log('    Root Directory: socket-server', 'white');
    log('    Runtime: Node', 'white');
    log('    Build Command: npm install', 'white');
    log('    Start Command: npm start', 'white');
    log('    Plan: Free', 'white');
    log('');
    log('7️⃣  Click "Create Web Service"', 'white');
    log('8️⃣  Wait for deployment (2-3 minutes)', 'white');
    log('9️⃣  Copy the service URL when deployment completes', 'white');
    log('');
}

function showPostDeployment() {
    log('🔧 After Deployment:', 'cyan');
    log('1. Copy your service URL (e.g., https://discourse-socket-server.onrender.com)', 'white');
    log('2. Update Vercel environment variable:', 'white');
    log('   NEXT_PUBLIC_SOCKET_URL = https://discourse-socket-server.onrender.com', 'yellow');
    log('3. Redeploy your Vercel frontend', 'white');
    log('');
    
    log('✨ Your render.yaml configuration will automatically set up:', 'green');
    log('   • Service name: discourse-socket-server', 'white');
    log('   • Auto-deploy on dev branch pushes', 'white');
    log('   • Health checks at /health endpoint', 'white');
    log('   • Free tier deployment', 'white');
    log('');
}

function openRenderDashboard() {
    log('🌐 Opening Render dashboard...', 'green');
    
    const { spawn } = require('child_process');
    const url = 'https://render.com/dashboard';
    
    let command;
    switch (process.platform) {
        case 'darwin': // macOS
            command = 'open';
            break;
        case 'win32': // Windows
            command = 'start';
            break;
        default: // Linux and others
            command = 'xdg-open';
            break;
    }
    
    try {
        if (process.platform === 'win32') {
            spawn('cmd', ['/c', 'start', url], { detached: true });
        } else {
            spawn(command, [url], { detached: true });
        }
    } catch (error) {
        log('Could not open browser automatically. Please visit:', 'yellow');
        log(url, 'cyan');
    }
}

// Main execution
function main() {
    checkPrerequisites();
    showDeploymentSteps();
    showPostDeployment();
    openRenderDashboard();
    
    log('🎉 Ready to deploy! Follow the steps above.', 'green');
}

if (require.main === module) {
    main();
}

module.exports = { checkPrerequisites, showDeploymentSteps, showPostDeployment };
