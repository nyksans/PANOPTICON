# PANOPTICON Docker Setup Guide
## Complete Automated Deployment

---

## Overview

Three startup scripts are provided for different operating systems:

| Script | Platform | Usage |
|--------|----------|-------|
| `startup.sh` | Linux/macOS | `bash docker/startup.sh` |
| `startup.ps1` | Windows (PowerShell) | `.\docker\startup.ps1` |
| `startup.bat` | Windows (CMD) | `docker\startup.bat` |

All scripts perform identical operations:
1. ✅ Check Docker installation
2. ✅ Build Docker images
3. ✅ Start all services
4. ✅ Wait for service readiness
5. ✅ Initialize database
6. ✅ Download AI model weights (~2.5 GB)
7. ✅ Verify all systems

---

## Prerequisites

### System Requirements
- **OS:** Windows 10+, macOS, or Linux
- **RAM:** 16 GB minimum (GPU: 24 GB recommended)
- **Disk:** 50 GB free space (for models + processing)
- **Docker:** Version 20.10+

### Software Installation

#### Windows
1. **Docker Desktop for Windows**
   - Download: https://www.docker.com/products/docker-desktop
   - Install and restart
   - Verify: `docker --version`

2. **PowerShell** (for startup.ps1)
   - Pre-installed on Windows 10+
   - Verify: `powershell --version`

#### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Verify
docker --version
```

#### Linux (Ubuntu/Debian)
```bash
# Install Docker
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Verify
docker --version
docker-compose --version
```

---

## Quick Start (5 Minutes)

### Windows PowerShell
```powershell
# Navigate to project
cd c:\2026proj\SIC\ CAPSTONE

# Allow script execution (one-time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run setup
.\docker\startup.ps1
```

### Windows CMD
```batch
cd c:\2026proj\SIC CAPSTONE
docker\startup.bat
```

### Linux/macOS
```bash
cd /path/to/SIC\ CAPSTONE
bash docker/startup.sh
```

**Expected duration:** 5-15 minutes depending on internet speed

---

## Script Options

### Skip Model Download
Use when you want to start services without waiting for model download (~5 min faster):

```powershell
# PowerShell
.\docker\startup.ps1 -SkipModels

# Bash
bash docker/startup.sh --skip-models

# CMD
docker\startup.bat skip-models
```

Models will download automatically on first inference.

### Check-Only Mode
Verify system without making changes:

```powershell
# PowerShell
.\docker\startup.ps1 -CheckOnly

# Bash
bash docker/startup.sh --check-only

# CMD
docker\startup.bat check-only
```

### Clean Restart
Remove all containers and volumes, then start fresh:

```powershell
# PowerShell
.\docker\startup.ps1 -Clean

# Bash
bash docker/startup.sh --clean

# CMD
docker\startup.bat clean
```

---

## What Each Step Does

### Step 1: Docker Check
- Verifies Docker and Docker Compose are installed
- Confirms versions
- Fails early if Docker is missing

### Step 2: Build Images
- Builds `panopticon-backend` image
- Builds `panopticon-frontend` image
- Builds supporting service images
- **Time:** 5-10 minutes (cached on subsequent runs)

### Step 3: Start Services
- Launches PostgreSQL (database)
- Launches Redis (cache/queue)
- Launches ChromaDB (vector database)
- Launches Backend API
- Launches Celery Worker
- Launches Frontend
- **Waits for:** Database, Redis, API readiness

### Step 4: Database Initialization
- Runs Alembic migrations
- Creates tables and schema
- Sets up initial configuration

### Step 5: Model Download
- Downloads YOLOv8x (130 MB)
- Downloads SAM 2 (323-897 MB)
- Downloads FastReID (95 MB)
- Downloads fallback models
- **Total:** ~2.5 GB
- **Time:** 5-15 minutes (depends on internet)
- **Cached:** Forever (reused on restart)

### Step 6: Verification
- Tests API health endpoint
- Tests database connectivity
- Tests Redis connectivity
- Reports final status

---

## Access Points After Startup

Once complete, access via:

| Service | URL |
|---------|-----|
| **Frontend UI** | http://localhost:3000 |
| **API** | http://localhost:8000 |
| **API Documentation** | http://localhost:8000/api/docs |
| **Vector Database** | http://localhost:8001 |
| **Database** | localhost:5432 (psql) |
| **Redis** | localhost:6379 |

---

## First Evidence Processing

1. **Open UI:** http://localhost:3000
2. **Create Case:**
   - Click "New Case"
   - Enter case number & title
   - Click "Create"

3. **Upload Evidence:**
   - Click "Upload Evidence"
   - Select case
   - Choose MP4/AVI video file
   - Click "Upload"

4. **Process:**
   - Click "Process Evidence"
   - Wait for processing (30 sec - 5 min depending on video length)
   - Watch progress bar

5. **View Results:**
   - Click "View Detections"
   - See persons, objects, events
   - Download report (JSON/PDF/HTML/CSV)

---

## Monitoring

### View Logs
```bash
# Backend API
docker-compose logs -f backend

# All services
docker-compose logs -f

# Specific service
docker-compose logs -f worker

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Monitor Resources
```bash
# CPU, RAM, Network usage
docker stats

# Stop monitoring: Ctrl+C
```

### Check Service Status
```bash
# All services
docker-compose ps

# Specific container
docker inspect panopticon_api
```

---

## Troubleshooting

### Docker Not Found
**Error:** `docker: command not found`

**Solution:**
1. Install Docker Desktop
2. Restart computer
3. Verify: `docker --version`

### Port Already in Use
**Error:** `port 8000 is already in use`

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process or use different port
docker-compose down
# Edit docker-compose.yml to use different ports
```

### Out of Disk Space
**Error:** `no space left on device`

**Solution:**
```bash
# Clean up Docker
docker system prune -a

# Or manually delete containers/images
docker-compose down -v
docker image prune -a
```

### GPU Not Detected
**Error:** Models run on CPU instead of GPU

**Solution:**
```bash
# Check NVIDIA support
docker-compose exec backend python -c "
import torch
print(f'CUDA available: {torch.cuda.is_available()}')
"

# Install NVIDIA Container Runtime if needed
# See: https://github.com/NVIDIA/nvidia-docker
```

### Model Download Fails
**Error:** Connection timeout during model download

**Solution:**
```bash
# Retry manually
docker-compose exec backend python ai/startup.py --device auto

# Or skip and download later
.\docker\startup.ps1 -SkipModels

# Models will download on first inference
```

### Database Connection Error
**Error:** `could not connect to database`

**Solution:**
```bash
# Check PostgreSQL status
docker-compose logs postgres

# Restart database
docker-compose restart postgres

# Full restart
docker-compose down -v
.\docker\startup.ps1 -Clean
```

### API Slow to Start
**Symptom:** Takes >60 seconds for API to become ready

**Causes:**
1. System is downloading models (expected first time)
2. Database migrations are running
3. Insufficient system resources

**Solution:**
```bash
# Monitor logs
docker-compose logs -f backend

# Wait for logs to show "Application startup complete"
# May take 2-5 minutes on first run with model download
```

---

## Commands After Startup

### Stop Services
```bash
docker-compose down
# Services stop but volumes persist (data retained)
```

### Stop and Remove Everything
```bash
docker-compose down -v
# Deletes all volumes (data lost)
```

### Restart All Services
```bash
docker-compose restart
```

### Restart Specific Service
```bash
docker-compose restart backend
docker-compose restart worker
```

### View Specific Logs
```bash
# Last 50 lines
docker-compose logs --tail=50 backend

# Continuous follow
docker-compose logs -f backend

# Timestamps
docker-compose logs --timestamps backend
```

---

## Performance Tuning

### Increase Resource Limits
Edit `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '4'           # Increase from default
          memory: 8G          # Increase from default
        reservations:
          cpus: '2'
          memory: 4G
```

Then restart:
```bash
docker-compose up -d backend
```

### Enable GPU Support
```bash
# Install NVIDIA Container Runtime
# On Linux:
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-runtime

# Update docker-compose.yml to use GPU
# runtime: nvidia
# And restart
```

---

## Backup and Restore

### Backup Database
```bash
# Export database
docker-compose exec postgres pg_dump -U panopticon panopticon > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U panopticon < backup.sql
```

### Backup Evidence
```bash
# Backup storage directory
tar -czf evidence_backup.tar.gz storage/

# Restore
tar -xzf evidence_backup.tar.gz
```

---

## Production Deployment

For production, use `PANOPTICON_DEPLOYMENT.md`:

```bash
# SSL/HTTPS setup
# Load balancing
# Kubernetes deployment
# Monitoring & alerts
# Scaling recommendations
```

---

## Script Details

### startup.sh (Bash)
- **Supports:** Linux, macOS
- **Features:** Colored output, progress tracking, error handling
- **Logs to:** `docker/startup.log`

### startup.ps1 (PowerShell)
- **Supports:** Windows 10+
- **Features:** Native Windows compatibility, colored output, progress
- **Logs to:** `docker/startup.log`
- **Note:** May require `Set-ExecutionPolicy` first run

### startup.bat (CMD)
- **Supports:** Windows 7+
- **Features:** Basic compatibility, no external dependencies
- **Logs to:** `docker/startup.log`
- **Note:** Limited color support in Windows CMD

---

## FAQ

**Q: How long does startup take?**
A: 5-15 minutes depending on model download. First run downloads ~2.5GB. Subsequent runs: 2-3 minutes.

**Q: Do I need GPU?**
A: GPU is optional. CPU mode works, inference is slower (~3 FPS vs 120 FPS on GPU).

**Q: Can I skip model download?**
A: Yes, use `-SkipModels` flag. Models download on first inference.

**Q: How much disk space needed?**
A: ~50 GB total (models + processing). Can increase as needed.

**Q: Can I run on my laptop?**
A: Yes, minimum 16 GB RAM required. CPU mode works, will be slow for video processing.

**Q: How do I update?**
A: Pull latest code, rebuild images: `docker-compose build` then `docker-compose up -d`

**Q: How do I debug issues?**
A: Check logs: `docker-compose logs -f backend` for detailed error messages.

**Q: Can I use existing Docker containers?**
A: No, these services are designed to work together. Use `docker-compose down -v` to clean.

**Q: Is it safe to delete `storage/` directory?**
A: Yes, it contains processed evidence. Database holds metadata. Safe to delete.

---

## Next Steps

1. **Run startup script** (this page)
2. **Upload evidence** (Quick Start guide)
3. **View results** (UI or API)
4. **Deploy to production** (Deployment guide)

---

## Support

- **Logs:** `docker/startup.log`
- **Documentation:** See `INDEX.md`
- **Issues:** Review troubleshooting section above

---

**Status:** ✅ Ready to Deploy

Choose your startup script above and run it. PANOPTICON will be operational in minutes.
