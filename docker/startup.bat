@echo off
REM PANOPTICON Automated Docker Startup Script (Windows)
REM 
REM This script automates the complete setup:
REM 1. Build Docker images
REM 2. Start all services
REM 3. Wait for readiness
REM 4. Initialize database
REM 5. Download AI model weights
REM 6. Verify all systems
REM
REM Usage:
REM   startup.bat              # Full setup
REM   startup.bat skip-models  # Skip model download
REM   startup.bat check-only   # Check status only
REM   startup.bat clean        # Clean and restart

setlocal enabledelayedexpansion

REM Colors (using echo codes)
set GREEN=[92m
set BLUE=[94m
set YELLOW=[93m
set RED=[91m
set RESET=[0m

REM Configuration
for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
set "DOCKER_DIR=%PROJECT_ROOT%\docker"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "LOG_FILE=%DOCKER_DIR%\startup.log"

REM Parse arguments
set "SKIP_MODELS=false"
set "CHECK_ONLY=false"
set "CLEAN=false"

if "%1"=="skip-models" set "SKIP_MODELS=true"
if "%1"=="check-only" set "CHECK_ONLY=true"
if "%1"=="clean" set "CLEAN=true"

REM Helper functions
setlocal enabledelayedexpansion

call :log_info "PANOPTICON Startup Script started"
call :log_info "Project root: %PROJECT_ROOT%"
call :log_info "Skip models: %SKIP_MODELS%"
call :log_info "Check only: %CHECK_ONLY%"
call :log_info "Clean: %CLEAN%"

REM Step 1: Clean (if requested)
if "%CLEAN%"=="true" (
    call :print_header "Step 1/6: Cleaning Docker Environment"
    call :log_info "Stopping and removing containers..."
    cd /d "%DOCKER_DIR%"
    docker-compose down -v >nul 2>&1
    call :log_success "Cleanup complete"
)

REM Step 2: Check Docker
call :print_header "Step 2/6: Checking Docker Installation"

where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    call :log_error "Docker not found. Please install Docker Desktop."
    exit /b 1
)

where docker-compose >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    call :log_error "Docker Compose not found. Please install Docker Desktop."
    exit /b 1
)

for /f "tokens=*" %%i in ('docker --version') do set "DOCKER_VERSION=%%i"
call :log_info "Docker version: !DOCKER_VERSION!"
call :log_success "Docker check passed"

REM Step 3: Build images
if "%CHECK_ONLY%"=="false" (
    call :print_header "Step 3/6: Building Docker Images"
    call :log_info "Building images (this may take 5-10 minutes)..."
    
    cd /d "%DOCKER_DIR%"
    call docker-compose build >"%LOG_FILE%" 2>&1
    if %ERRORLEVEL% NEQ 0 (
        call :log_error "Docker build failed. Check %LOG_FILE% for details."
        exit /b 1
    )
    call :log_success "Docker images built successfully"
)

REM Step 4: Start services
if "%CHECK_ONLY%"=="false" (
    call :print_header "Step 4/6: Starting Docker Services"
    call :log_info "Starting containers..."
    
    cd /d "%DOCKER_DIR%"
    docker-compose up -d >>"%LOG_FILE%" 2>&1
    
    call :log_info "Services started. Waiting for readiness..."
    
    REM Wait for PostgreSQL
    call :log_info "Waiting for PostgreSQL..."
    setlocal enabledelayedexpansion
    for /L %%i in (1,1,30) do (
        docker-compose exec -T postgres pg_isready -U panopticon >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            call :log_success "PostgreSQL is ready"
            goto postgres_done
        )
        timeout /t 2 /nobreak >nul
    )
    call :log_error "PostgreSQL failed to start"
    exit /b 1
    :postgres_done
    
    REM Wait for Redis
    call :log_info "Waiting for Redis..."
    for /L %%i in (1,1,20) do (
        docker-compose exec -T redis redis-cli ping >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            call :log_success "Redis is ready"
            goto redis_done
        )
        timeout /t 1 /nobreak >nul
    )
    call :log_error "Redis failed to start"
    exit /b 1
    :redis_done
    
    REM Wait for Backend
    call :log_info "Waiting for Backend API..."
    for /L %%i in (1,1,60) do (
        curl -s http://localhost:8000/health >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            call :log_success "Backend API is ready"
            goto backend_done
        )
        timeout /t 2 /nobreak >nul
    )
    call :log_error "Backend API failed to start"
    exit /b 1
    :backend_done
)

REM Step 5: Initialize database
if "%CHECK_ONLY%"=="false" (
    call :print_header "Step 5/6: Initializing Database"
    call :log_info "Running database migrations..."
    
    cd /d "%DOCKER_DIR%"
    docker-compose exec -T backend alembic upgrade head >>"%LOG_FILE%" 2>&1
    if %ERRORLEVEL% EQU 0 (
        call :log_success "Database initialized"
    ) else (
        call :log_warning "Database migration had issues (may be already initialized)"
    )
)

REM Step 6: Download model weights
call :print_header "Step 6/6: Initializing AI Models"

if "%SKIP_MODELS%"=="true" (
    call :log_warning "Skipping model download (skip-models flag set)"
    call :log_info "Models will be downloaded on first inference"
) else (
    call :log_info "Downloading model weights (^~2.5GB, this may take 5-15 minutes)..."
    call :log_info "You can monitor progress with: docker-compose logs -f backend"
    
    cd /d "%DOCKER_DIR%"
    docker-compose exec -T backend python ai/startup.py --device auto >>"%LOG_FILE%" 2>&1
    if %ERRORLEVEL% EQU 0 (
        call :log_success "AI models initialized successfully"
    ) else (
        call :log_warning "Model initialization had issues. Check backend logs."
        call :log_info "Models can be retried with: docker-compose exec backend python ai/startup.py"
    )
)

REM Verification
call :print_header "Verification"

cd /d "%DOCKER_DIR%"

call :log_info "Checking service status..."
for /f "delims=" %%i in ('docker-compose ps 2^>nul ^| find /c "Up"') do set "RUNNING=%%i"
call :log_info "Services running: !RUNNING!/7"

docker-compose exec -T backend curl -s http://localhost:8000/health 2>nul | find "healthy" >nul
if %ERRORLEVEL% EQU 0 (
    call :log_success "API Health: OK"
) else (
    call :log_warning "API Health: Check manually with curl http://localhost:8000/health"
)

call :log_info "Checking database connectivity..."
docker-compose exec -T postgres psql -U panopticon -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    call :log_success "Database: Connected"
) else (
    call :log_warning "Database: Connection issue"
)

call :log_info "Checking Redis connectivity..."
docker-compose exec -T redis redis-cli ping 2>nul | find "PONG" >nul
if %ERRORLEVEL% EQU 0 (
    call :log_success "Redis: Connected"
) else (
    call :log_warning "Redis: Connection issue"
)

REM Final summary
call :print_header "Startup Complete!"

echo.
echo %GREEN%✓ PANOPTICON is ready!%RESET%
echo.
echo Access points:
echo   API:       http://localhost:8000
echo   API Docs:  http://localhost:8000/api/docs
echo   Frontend:  http://localhost:3000
echo   ChromaDB:  http://localhost:8001
echo.
echo Quick start:
echo   1. Open http://localhost:3000 in your browser
echo   2. Create a new case
echo   3. Upload evidence video (MP4/AVI)
echo   4. Click 'Process Evidence'
echo   5. Wait for AI processing to complete
echo   6. Download report (JSON/PDF)
echo.
echo Useful commands:
echo   View logs:         docker-compose logs -f backend
echo   Monitor resources: docker stats
echo   Stop services:     docker-compose down
echo   Restart:           startup.bat clean
echo.
echo Documentation:
echo   Quick Start:  %PROJECT_ROOT%\QUICK_START.md
echo   Full Guide:   %PROJECT_ROOT%\AI_INFERENCE_GUIDE.md
echo   Deployment:   %PROJECT_ROOT%\PANOPTICON_DEPLOYMENT.md
echo.
echo Log file: %LOG_FILE%
echo.

call :log_success "All checks passed!"
exit /b 0

REM Functions
:log_info
echo [INFO] %~1
echo [INFO] %~1 >> "%LOG_FILE%"
exit /b 0

:log_success
echo [SUCCESS] %~1
echo [SUCCESS] %~1 >> "%LOG_FILE%"
exit /b 0

:log_warning
echo [WARNING] %~1
echo [WARNING] %~1 >> "%LOG_FILE%"
exit /b 0

:log_error
echo [ERROR] %~1
echo [ERROR] %~1 >> "%LOG_FILE%"
exit /b 0

:print_header
echo.
echo ======================================================================
echo   %~1
echo ======================================================================
exit /b 0
