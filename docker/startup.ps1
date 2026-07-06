#
# PANOPTICON Automated Docker Startup Script (PowerShell)
# 
# This script automates the complete setup:
# 1. Build Docker images
# 2. Start all services
# 3. Wait for readiness
# 4. Initialize database
# 5. Download AI model weights
# 6. Verify all systems
#
# Usage:
#   .\startup.ps1                    # Full setup
#   .\startup.ps1 -SkipModels        # Skip model download
#   .\startup.ps1 -CheckOnly         # Check status only
#   .\startup.ps1 -Clean             # Clean and restart
#
# Note: May require: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned

param(
    [switch]$SkipModels = $false,
    [switch]$CheckOnly = $false,
    [switch]$Clean = $false
)

# Colors
$Colors = @{
    'Info'    = 'Cyan'
    'Success' = 'Green'
    'Warning' = 'Yellow'
    'Error'   = 'Red'
}

# Configuration
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DockerDir = Join-Path $ProjectRoot "docker"
$BackendDir = Join-Path $ProjectRoot "backend"
$LogFile = Join-Path $DockerDir "startup.log"

# Initialize log
"Startup initiated at $(Get-Date)" | Out-File $LogFile -Force

# Helper functions
function Write-Log {
    param(
        [string]$Message,
        [string]$Type = 'Info'
    )
    $timestamp = $(Get-Date -Format "HH:mm:ss")
    $color = $Colors[$Type]
    Write-Host "[$Type] $Message" -ForegroundColor $color
    "[$timestamp] [$Type] $Message" | Add-Content $LogFile
}

function Print-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "=" * 70 -ForegroundColor Cyan
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Step 0: Clean (if requested)
if ($Clean) {
    Print-Header "Step 0/6: Cleaning Docker Environment"
    Write-Log "Stopping and removing containers..." "Info"
    Push-Location $DockerDir
    docker-compose down -v 2>$null
    Pop-Location
    Write-Log "Cleanup complete" "Success"
}

# Step 1: Check Docker
Print-Header "Step 1/6: Checking Docker Installation"

if (-not (Test-CommandExists "docker")) {
    Write-Log "Docker not found. Please install Docker Desktop." "Error"
    exit 1
}

if (-not (Test-CommandExists "docker-compose")) {
    Write-Log "Docker Compose not found. Please install Docker Desktop." "Error"
    exit 1
}

$DockerVersion = & docker --version
Write-Log "Docker version: $DockerVersion" "Info"
Write-Log "Docker check passed" "Success"

# Step 2: Build images
if (-not $CheckOnly) {
    Print-Header "Step 2/6: Building Docker Images"
    Write-Log "Building images (this may take 5-10 minutes)..." "Info"
    
    Push-Location $DockerDir
    $output = docker-compose build 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Docker build failed. Check $LogFile for details." "Error"
        Pop-Location
        exit 1
    }
    Write-Log "Docker images built successfully" "Success"
    Pop-Location
}

# Step 3: Start services
if (-not $CheckOnly) {
    Print-Header "Step 3/6: Starting Docker Services"
    Write-Log "Starting containers..." "Info"
    
    Push-Location $DockerDir
    docker-compose up -d 2>&1 | Tee-Object -FilePath $LogFile -Append
    
    Write-Log "Services started. Waiting for readiness..." "Info"
    
    # Wait for PostgreSQL
    Write-Log "Waiting for PostgreSQL..." "Info"
    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        $test = docker-compose exec -T postgres pg_isready -U panopticon 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "PostgreSQL is ready" "Success"
            break
        }
        $attempt++
        if ($attempt -eq $maxAttempts) {
            Write-Log "PostgreSQL failed to start" "Error"
            docker-compose logs postgres | Select-Object -Last 20 | Add-Content $LogFile
            Pop-Location
            exit 1
        }
        Start-Sleep -Seconds 2
    }
    
    # Wait for Redis
    Write-Log "Waiting for Redis..." "Info"
    $attempt = 0
    while ($attempt -lt 20) {
        $test = docker-compose exec -T redis redis-cli ping 2>$null
        if ($test -eq "PONG") {
            Write-Log "Redis is ready" "Success"
            break
        }
        $attempt++
        if ($attempt -eq 20) {
            Write-Log "Redis failed to start" "Error"
            docker-compose logs redis | Select-Object -Last 20 | Add-Content $LogFile
            Pop-Location
            exit 1
        }
        Start-Sleep -Seconds 1
    }
    
    # Wait for Backend
    Write-Log "Waiting for Backend API..." "Info"
    $attempt = 0
    while ($attempt -lt 60) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -ErrorAction Stop -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Log "Backend API is ready" "Success"
                break
            }
        }
        catch {
            # API not ready yet
        }
        $attempt++
        if ($attempt -eq 60) {
            Write-Log "Backend API failed to start" "Error"
            docker-compose logs backend | Select-Object -Last 50 | Add-Content $LogFile
            Pop-Location
            exit 1
        }
        Start-Sleep -Seconds 2
    }
}

# Step 4: Initialize database
if (-not $CheckOnly) {
    Print-Header "Step 4/6: Initializing Database"
    Write-Log "Running database migrations..." "Info"
    
    Push-Location $DockerDir
    $output = docker-compose exec -T backend alembic upgrade head 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Database initialized" "Success"
    }
    else {
        Write-Log "Database migration had issues (may be already initialized)" "Warning"
    }
    Pop-Location
}

# Step 5: Download model weights
Print-Header "Step 5/6: Initializing AI Models"

if ($SkipModels) {
    Write-Log "Skipping model download (-SkipModels flag set)" "Warning"
    Write-Log "Models will be downloaded on first inference" "Info"
}
else {
    Write-Log "Downloading model weights (~2.5GB, this may take 5-15 minutes)..." "Info"
    Write-Log "You can monitor progress with: docker-compose logs -f backend" "Info"
    
    Push-Location $DockerDir
    $output = docker-compose exec -T backend python ai/startup.py --device auto 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -eq 0) {
        Write-Log "AI models initialized successfully" "Success"
    }
    else {
        Write-Log "Model initialization had issues. Check backend logs." "Warning"
        Write-Log "Models can be retried with: docker-compose exec backend python ai/startup.py" "Info"
    }
    Pop-Location
}

# Step 6: Verification
Print-Header "Verification"

Push-Location $DockerDir

Write-Log "Checking service status..." "Info"
$running = docker-compose ps 2>$null | Select-String "Up" | Measure-Object | Select-Object -ExpandProperty Count
Write-Log "Services running: $running/7" "Info"

try {
    $health = Invoke-WebRequest -Uri "http://localhost:8000/health" -ErrorAction Stop
    if ($health.Content -like "*healthy*") {
        Write-Log "API Health: OK" "Success"
    }
}
catch {
    Write-Log "API Health: Check manually with curl http://localhost:8000/health" "Warning"
}

Write-Log "Checking database connectivity..." "Info"
$dbTest = docker-compose exec -T postgres psql -U panopticon -c "SELECT 1" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Log "Database: Connected" "Success"
}
else {
    Write-Log "Database: Connection issue" "Warning"
}

Write-Log "Checking Redis connectivity..." "Info"
$redisTest = docker-compose exec -T redis redis-cli ping 2>$null
if ($redisTest -eq "PONG") {
    Write-Log "Redis: Connected" "Success"
}
else {
    Write-Log "Redis: Connection issue" "Warning"
}

Pop-Location

# Final summary
Print-Header "Startup Complete!"

Write-Host ""
Write-Host "✓ PANOPTICON is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:8000"
Write-Host "  API Docs:  http://localhost:8000/api/docs"
Write-Host "  Frontend:  http://localhost:3000"
Write-Host "  ChromaDB:  http://localhost:8001"
Write-Host ""
Write-Host "Quick start:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000 in your browser"
Write-Host "  2. Create a new case"
Write-Host "  3. Upload evidence video (MP4/AVI)"
Write-Host "  4. Click 'Process Evidence'"
Write-Host "  5. Wait for AI processing to complete"
Write-Host "  6. Download report (JSON/PDF)"
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:         docker-compose logs -f backend"
Write-Host "  Monitor resources: docker stats"
Write-Host "  Stop services:     docker-compose down"
Write-Host "  Restart:           .\startup.ps1 -Clean"
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  Quick Start:  $ProjectRoot\QUICK_START.md"
Write-Host "  Full Guide:   $ProjectRoot\AI_INFERENCE_GUIDE.md"
Write-Host "  Deployment:   $ProjectRoot\PANOPTICON_DEPLOYMENT.md"
Write-Host ""
Write-Host "Log file: $LogFile"
Write-Host ""

Write-Log "All checks passed!" "Success"
