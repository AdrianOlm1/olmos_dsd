#!/usr/bin/env bash
# ============================================================
#  AG-DSD Installer
#  Run this script from the repo root after cloning:
#    git clone <repo-url>
#    cd AG_DSD
#    bash install.sh
#
#  Requirements (install these BEFORE running this script):
#    - Git         https://git-scm.com/download/win
#    - Node.js 20+ https://nodejs.org  (includes npm)
#    - PostgreSQL  https://www.postgresql.org/download/windows/
#
#  Run this script in Git Bash (not PowerShell or CMD).
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "=============================================="
echo "   AG-DSD  —  Install & Setup"
echo "=============================================="
echo ""

# ── 1. Check required tools ──────────────────────────────────

info "Checking required tools..."

if ! command -v node &>/dev/null; then
  error "Node.js not found. Download from https://nodejs.org and reopen Git Bash."
fi
NODE_VER=$(node -v)
success "Node.js $NODE_VER"

if ! command -v npm &>/dev/null; then
  error "npm not found. It should come with Node.js."
fi
NPM_VER=$(npm -v)
success "npm $NPM_VER"

if ! command -v git &>/dev/null; then
  error "Git not found. Download from https://git-scm.com/download/win"
fi
success "Git $(git --version | awk '{print $3}')"

# PostgreSQL check (psql may not be on PATH on Windows — warn, don't fail)
if command -v psql &>/dev/null; then
  success "PostgreSQL $(psql --version | awk '{print $3}')"
else
  warn "psql not found on PATH. Make sure PostgreSQL is installed and running."
  warn "Add PostgreSQL\\bin to your PATH or configure DATABASE_URL manually."
fi

echo ""

# ── 2. Backend dependencies ──────────────────────────────────

info "Installing backend dependencies..."
cd backend
npm install
success "backend/node_modules installed"

# ── 3. Dashboard dependencies ────────────────────────────────

info "Installing dashboard dependencies..."
cd ../dashboard
npm install
success "dashboard/node_modules installed"

# ── 4. Driver-app dependencies ───────────────────────────────

info "Installing driver-app dependencies..."
cd ../driver-app
npm install
success "driver-app/node_modules installed"

cd ..

echo ""

# ── 5. Backend .env setup ────────────────────────────────────

info "Setting up backend environment file..."

if [ -f backend/.env ]; then
  warn "backend/.env already exists — skipping copy."
else
  cp backend/.env.example backend/.env
  success "Created backend/.env from .env.example"
  echo ""
  echo -e "${YELLOW}  ACTION REQUIRED:${NC} Open backend/.env and fill in:"
  echo "    DATABASE_URL  — your PostgreSQL connection string"
  echo "    JWT_SECRET    — a long random string"
  echo "    QBO_CLIENT_ID / QBO_CLIENT_SECRET — QuickBooks Online app credentials"
  echo ""
fi

# ── 6. Prisma generate ───────────────────────────────────────

info "Generating Prisma client..."
cd backend
npx prisma generate
success "Prisma client generated"

echo ""

# ── 7. Database migration prompt ─────────────────────────────

echo -e "${YELLOW}----------------------------------------------${NC}"
echo -e "${YELLOW}  DATABASE SETUP${NC}"
echo -e "${YELLOW}----------------------------------------------${NC}"
echo ""
echo "  Before running migrations, make sure:"
echo "    1. PostgreSQL is running"
echo "    2. You have created the database:  olmos_dsd"
echo "       (or whatever name you set in DATABASE_URL)"
echo "    3. backend/.env has the correct DATABASE_URL"
echo ""

read -r -p "  Run database migrations now? [y/N] " RUN_MIGRATE
if [[ "$RUN_MIGRATE" =~ ^[Yy]$ ]]; then
  npx prisma migrate deploy
  success "Database migrations applied"
else
  warn "Skipped. Run manually later:  cd backend && npx prisma migrate deploy"
fi

cd ..

echo ""

# ── 8. Done ──────────────────────────────────────────────────

echo "=============================================="
echo -e "${GREEN}  Installation complete!${NC}"
echo "=============================================="
echo ""
echo "  To start the backend:"
echo "    cd backend && npm run dev"
echo ""
echo "  To start the dashboard:"
echo "    cd dashboard && npm run dev"
echo ""
echo "  To start the driver app (Expo):"
echo "    cd driver-app && npm start"
echo ""
echo "  Dashboard runs at:  http://localhost:5173"
echo "  Backend API at:     http://localhost:3001"
echo ""
