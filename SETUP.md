# Setup Guide

This guide will help you set up the Rental AI Suite application.

## Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- PostgreSQL 16+ (or Docker for easy setup)

## Quick Setup (Recommended)

Run the automated setup script:

```bash
./setup.sh
```

This script will:
1. Create a `.env` file from `.env.example`
2. Generate a secure `SESSION_SECRET`
3. Optionally start PostgreSQL with Docker
4. Install dependencies
5. Run database migrations

## Manual Setup

### 1. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your configuration:

#### Required Variables

- **DATABASE_URL**: PostgreSQL connection string
  - Docker: `postgresql://postgres:postgres@localhost:5432/rental_ai_suite`
  - Local: `postgresql://username:password@localhost:5432/database_name`

- **SESSION_SECRET**: Secret for session encryption
  - Generate with: `openssl rand -base64 32`

- **CLIENT_ID**: OIDC client identifier (for authentication)

- **ISSUER_URL** or **OIDC_ISSUER_URL**: OIDC issuer URL
  - Example: `https://your-auth-provider.com/oidc`

#### Optional Variables

- **AI_INTEGRATIONS_OPENAI_API_KEY**: OpenAI API key (for AI features)
- **AI_INTEGRATIONS_OPENAI_BASE_URL**: OpenAI API base URL (defaults to OpenAI)
- **PORT**: Server port (defaults to 5001)

### 2. Database Setup

#### Option A: Docker (Easiest)

```bash
docker-compose up -d postgres
```

This starts PostgreSQL on port 5432 with:
- Database: `rental_ai_suite`
- Username: `postgres`
- Password: `postgres`

#### Option B: Local PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb rental_ai_suite
```

#### Option C: Cloud Database

Use a managed PostgreSQL service:
- [Supabase](https://supabase.com) (free tier available)
- [Neon](https://neon.tech) (free tier available)
- [Railway](https://railway.app) (free tier available)

Copy the connection string to `DATABASE_URL` in your `.env` file.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Database Migrations

```bash
npm run db:push
```

This creates all necessary tables in your database.

### 5. Start the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check that `DATABASE_URL` is correct in `.env`
- Verify database exists: `psql -l` (or `docker exec -it rental-postgres psql -U postgres -l`)

### OIDC Authentication Issues

- Ensure `CLIENT_ID` and `ISSUER_URL` are set correctly
- Verify your OIDC provider is accessible
- Check that the callback URL matches your application URL

### Port Already in Use

Change the `PORT` in `.env` or stop the process using port 5001:

```bash
# macOS/Linux
lsof -ti:5001 | xargs kill -9
```

## Development Tips

- Use `npm run dev` for hot-reload development
- Database changes require `npm run db:push` to update schema
- Check logs in the terminal for debugging
- Use Docker Compose to easily reset the database: `docker-compose down -v && docker-compose up -d`
