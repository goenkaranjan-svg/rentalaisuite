# PropMan.ai - AI-Powered Property Management Platform

## Overview

PropMan.ai is a full-stack property management application that helps landlords and property managers handle properties, leases, maintenance requests, payments, and tenant screening. It features AI integrations for lease document generation, maintenance request analysis, chat assistance, and image generation. The app uses Replit Auth for authentication with role-based access (manager vs tenant).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Structure
- **Monorepo** with three main directories: `client/`, `server/`, and `shared/`
- `shared/` contains database schemas and API route definitions used by both frontend and backend
- TypeScript throughout the entire stack

### Frontend (`client/src/`)
- **React** with **Vite** as the build tool
- **Wouter** for client-side routing (lightweight alternative to React Router)
- **TanStack React Query** for server state management and API data fetching
- **Shadcn/ui** (new-york style) with **Radix UI** primitives for the component library
- **Tailwind CSS** for styling with a professional blue/indigo enterprise theme
- **Recharts** for dashboard analytics charts
- **react-hook-form** with **zod** resolvers for form validation
- Path aliases: `@/` maps to `client/src/`, `@shared/` maps to `shared/`
- Pages: Dashboard, Properties, Maintenance, Leases, Messages, Login
- Custom hooks in `client/src/hooks/` wrap API calls with React Query patterns

### Backend (`server/`)
- **Express.js** on Node.js with HTTP server
- **TypeScript** compiled with **tsx** for development, **esbuild** for production builds
- Routes registered in `server/routes.ts` using a shared API definition from `shared/routes.ts`
- Storage layer in `server/storage.ts` implements a `DatabaseStorage` class with interface `IStorage`
- Database seeding in `server/seed.ts` runs on startup if no data exists

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- **Drizzle ORM** for schema definitions and queries
- **drizzle-kit** for migrations (`npm run db:push` to push schema)
- Schema defined in `shared/schema.ts` with models split into `shared/models/`
- Key tables: `users`, `sessions`, `properties`, `leases`, `maintenance_requests`, `payments`, `screenings`, `conversations`, `messages`
- Sessions stored in PostgreSQL via `connect-pg-simple`

### Authentication
- **Replit Auth** via OpenID Connect (OIDC)
- Session management with `express-session` and PostgreSQL session store
- Auth files in `server/replit_integrations/auth/`
- First user to sign up automatically becomes a "manager"; subsequent users default to "tenant"
- The `users` and `sessions` tables are mandatory for Replit Auth — do not drop them

### AI Integrations (`server/replit_integrations/`)
- **OpenAI** client configured with `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables
- **Chat** (`chat/`): Conversation and message storage with streaming chat completions
- **Image** (`image/`): Image generation using `gpt-image-1` model
- **Audio** (`audio/`): Voice chat with speech-to-text, text-to-speech, and audio streaming via AudioWorklet
- **Batch** (`batch/`): Batch processing utility with rate limiting and retries for bulk LLM operations
- Backend uses OpenAI for lease document generation and maintenance request analysis

### API Structure
- All API routes prefixed with `/api/`
- Shared route definitions in `shared/routes.ts` with Zod schemas for input/output validation
- RESTful CRUD endpoints for: properties, leases, maintenance requests, payments, screenings
- Special AI endpoints: `/api/leases/:id/generate-doc`, `/api/maintenance/:id/analyze`
- Auth endpoints: `/api/auth/user`, `/api/login`, `/api/logout`
- Chat/conversation endpoints: `/api/conversations`
- Image generation: `/api/generate-image`

### Build & Deploy
- **Development**: `npm run dev` — runs tsx with Vite dev server middleware (HMR)
- **Production build**: `npm run build` — Vite builds client to `dist/public/`, esbuild bundles server to `dist/index.cjs`
- **Production start**: `npm start` — serves built files with Express static middleware
- SPA fallback: all non-API routes serve `index.html`

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required, database must be provisioned)
- `SESSION_SECRET` — Secret for Express session encryption
- `AI_INTEGRATIONS_OPENAI_API_KEY` — API key for OpenAI-compatible AI services
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Base URL for OpenAI API (Replit AI proxy)
- `ISSUER_URL` — OIDC issuer URL for Replit Auth (defaults to `https://replit.com/oidc`)
- `REPL_ID` — Replit environment identifier (set automatically by Replit)

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **openai** — OpenAI SDK for AI features
- **passport** + **openid-client** — Authentication via OIDC
- **connect-pg-simple** — PostgreSQL session storage
- **p-limit** + **p-retry** — Rate limiting and retry logic for batch AI operations
- **zod** + **drizzle-zod** — Schema validation shared between client and server
- **recharts** — Charting library for dashboard analytics
- **date-fns** — Date formatting utilities
- **wouter** — Lightweight client-side router
- **react-hook-form** — Form state management