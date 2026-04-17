# Setup Requirements

Install the following **before** running `install.sh`.

## Required Software

| Tool | Version | Download |
|------|---------|----------|
| Git | Any | https://git-scm.com/download/win |
| Node.js | 20 LTS or newer | https://nodejs.org |
| PostgreSQL | 15 or newer | https://www.postgresql.org/download/windows/ |

> **Note:** Run `install.sh` in **Git Bash** (not PowerShell or CMD).
> Git Bash is included with the Git for Windows installer.

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd AG_DSD

# 2. Run the install script (in Git Bash)
bash install.sh
```

The script will:
- Install npm dependencies for `backend`, `dashboard`, and `driver-app`
- Copy `backend/.env.example` → `backend/.env`
- Generate the Prisma client
- Optionally run database migrations

## After Install

1. **Edit `backend/.env`** and fill in:
   - `DATABASE_URL` — your PostgreSQL connection string
     e.g. `postgresql://postgres:yourpassword@localhost:5432/olmos_dsd`
   - `JWT_SECRET` — any long random string
   - `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` — QuickBooks Online credentials (optional for local dev)

2. **Create the database** in PostgreSQL:
   ```sql
   CREATE DATABASE olmos_dsd;
   ```

3. **Run migrations** (if you skipped during install):
   ```bash
   cd backend && npx prisma migrate deploy
   ```

## Running the App

| Service | Command | URL |
|---------|---------|-----|
| Backend API | `cd backend && npm run dev` | http://localhost:3001 |
| Dashboard | `cd dashboard && npm run dev` | http://localhost:5173 |
| Driver App (Expo) | `cd driver-app && npm start` | Expo Dev Tools |
