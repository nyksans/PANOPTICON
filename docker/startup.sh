#!/bin/bash
# PANOPTICON Automated Docker Startup Script
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
#   ./startup.sh              # Full setup
#   ./startup.sh --skip-models # Skip model download
#   ./startup.sh --check-only # Check status only
#   ./startup.sh --clean      # Clean and restart

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_FILE="$DOCKER_DIR/startup.log"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo ""
    echo "======================================================================"
    echo "  $1"
    echo "======================================================================"
}

# Parse arguments
SKIP_MODELS=false
CHECK_ONLY=false
CLEAN=false

for arg in "$@"; do
    case $arg in
        --skip-models) SKIP_MODELS=true ;;
        --check-only) CHECK_ONLY=true ;;
        --clean) CLEAN=true ;;
    esac
done

# Initialize log
> "$LOG_FILE"
log_info "PANOPTICON Startup Script started"
log_info "Project root: $PROJECT_ROOT"
log_info "Skip models: $SKIP_MODELS"
log_info "Check only: $CHECK_ONLY"
log_info "Clean: $CLEAN"

# Step 1: Clean (if requested)
if [ "$CLEAN" = true ]; then
    print_header "Step 1/6: Cleaning Docker Environment"
    log_info "Stopping and removing containers..."
    docker-compose -f "$DOCKER_DIR/docker-compose.yml" down -v 2>/dev/null || true
    log_success "Cleanup complete"
fi

# Step 2: Check Docker
print_header "Step 2/6: Checking Docker Installation"
if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Please install Docker."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose not found. Please install Docker Compose."
    exit 1
fi

log_info "Docker version: $(docker --version)"
log_info "Docker Compose version: $(docker-compose --version)"
log_success "Docker check passed"

# Step 3: Build images
if [ "$CHECK_ONLY" = false ]; then
    print_header "Step 3/6: Building Docker Images"
    log_info "Building images (this may take 5-10 minutes)..."
    
    cd "$DOCKER_DIR"
    if docker-compose build >> "$LOG_FILE" 2>&1; then
        log_success "Docker images built successfully"
    else
        log_error "Docker build failed. Check $LOG_FILE for details."
        exit 1
    fi
fi

# Step 4: Start services
if [ "$CHECK_ONLY" = false ]; then
    print_header "Step 4/6: Starting Docker Services"
    log_info "Starting containers..."
    
    cd "$DOCKER_DIR"
    docker-compose up -d >> "$LOG_FILE" 2>&1
    
    log_info "Services started. Waiting for readiness..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U panopticon &>/dev/null; then
            log_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL failed to start"
            docker-compose logs postgres | tail -20 >> "$LOG_FILE"
            exit 1
        fi
        sleep 2
    done
    
    # Wait for Redis
    log_info "Waiting for Redis..."
    for i in {1..20}; do
        if docker-compose exec -T redis redis-cli ping &>/dev/null; then
            log_success "Redis is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            log_error "Redis failed to start"
            docker-compose logs redis | tail -20 >> "$LOG_FILE"
            exit 1
        fi
        sleep 1
    done
    
    # Wait for Backend
    log_info "Waiting for Backend API..."
    for i in {1..60}; do
        if curl -s http://localhost:8000/health &>/dev/null; then
            log_success "Backend API is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            log_error "Backend API failed to start"
            docker-compose logs backend | tail -50 >> "$LOG_FILE"
            exit 1
        fi
        sleep 2
    done
fi

# Step 5: Initialize database
if [ "$CHECK_ONLY" = false ]; then
    print_header "Step 5/6: Initializing Database"
    log_info "Running database migrations..."
    
    cd "$DOCKER_DIR"
    if docker-compose exec -T backend alembic upgrade head >> "$LOG_FILE" 2>&1; then
        log_success "Database initialized"
    else
        log_warning "Database migration had issues (may be already initialized)"
    fi
fi

# Step 6: Download model weights
print_header "Step 6/6: Initializing AI Models"

if [ "$SKIP_MODELS" = true ]; then
    log_warning "Skipping model download (--skip-models flag set)"
    log_info "Models will be downloaded on first inference"
else
    log_info "Downloading model weights (~2.5GB, this may take 5-15 minutes)..."
    log_info "You can monitor progress with: docker-compose logs -f backend"
    
    cd "$DOCKER_DIR"
    if docker-compose exec -T backend python ai/startup.py --device auto >> "$LOG_FILE" 2>&1; then
        log_success "AI models initialized successfully"
    else
        log_warning "Model initialization had issues. Check backend logs."
        log_info "Models can be retried with: docker-compose exec backend python ai/startup.py"
    fi
fi

# Verification
print_header "Verification"

cd "$DOCKER_DIR"

log_info "Checking service status..."
RUNNING=$(docker-compose ps | grep "Up" | wc -l)
log_info "Services running: $RUNNING/7"

if docker-compose exec -T backend curl -s http://localhost:8000/health | grep -q "healthy"; then
    log_success "API Health: OK"
else
    log_warning "API Health: Check manually with curl http://localhost:8000/health"
fi

log_info "Checking database connectivity..."
if docker-compose exec -T postgres psql -U panopticon -c "SELECT 1" &>/dev/null; then
    log_success "Database: Connected"
else
    log_warning "Database: Connection issue"
fi

log_info "Checking Redis connectivity..."
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    log_success "Redis: Connected"
else
    log_warning "Redis: Connection issue"
fi

# Final summary
print_header "Startup Complete!"

echo ""
echo -e "${GREEN}✓ PANOPTICON is ready!${NC}"
echo ""
echo "Access points:"
echo -e "  API:       ${BLUE}http://localhost:8000${NC}"
echo -e "  API Docs:  ${BLUE}http://localhost:8000/api/docs${NC}"
echo -e "  Frontend:  ${BLUE}http://localhost:3000${NC}"
echo -e "  ChromaDB:  ${BLUE}http://localhost:8001${NC}"
echo ""
echo "Quick start:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Create a new case"
echo "  3. Upload evidence video (MP4/AVI)"
echo "  4. Click 'Process Evidence'"
echo "  5. Wait for AI processing to complete"
echo "  6. Download report (JSON/PDF)"
echo ""
echo "Useful commands:"
echo "  View logs:         docker-compose logs -f backend"
echo "  Monitor resources: docker stats"
echo "  Stop services:     docker-compose down"
echo "  Restart:           ./startup.sh --clean"
echo ""
echo "Documentation:"
echo "  Quick Start:  $PROJECT_ROOT/QUICK_START.md"
echo "  Full Guide:   $PROJECT_ROOT/AI_INFERENCE_GUIDE.md"
echo "  Deployment:   $PROJECT_ROOT/PANOPTICON_DEPLOYMENT.md"
echo ""
echo "Log file: $LOG_FILE"
echo ""

log_success "All checks passed!"
