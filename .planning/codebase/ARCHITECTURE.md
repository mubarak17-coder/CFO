# Architecture

## Overview
HoldWise is a **server-rendered multi-page application** with a dual deployment strategy:
- **Production (Vercel):** Serverless functions in `api/` directory, static HTML pages
- **Local dev:** Express server (`server.js`) serving both static files and API routes

## Architecture Pattern
- **Frontend:** Static HTML pages with inline JavaScript (no framework, no bundler)
- **Backend:** Serverless API functions (Vercel) / Express routes (local)
- **Database:** Supabase (PostgreSQL + Auth)
- **External API:** Plaid for bank account linking and transaction sync

## Data Flow
```
Browser (HTML + inline JS)
  → Supabase Auth (login/signup)
  → API routes (Bearer JWT auth)
    → Plaid API (bank linking, transactions, balances)
    → Supabase DB (plaid_items table)
  ← JSON responses
  ← DOM manipulation (no virtual DOM, direct element updates)
```

## Key Architectural Decisions
1. **No frontend framework** — vanilla HTML/JS with CDN dependencies
2. **Dual deployment** — Express for local dev mirrors Vercel serverless functions
3. **Shared module** (`api/_shared.js`) — Plaid client, Supabase client, auth middleware, CORS, rate limiting shared across all API routes
4. **Multi-bank support** — `plaid_items` table allows N bank connections per user, all queried in parallel
5. **In-memory rate limiting** — resets per cold start (acceptable for serverless)

## Deployment Architecture
- **Vercel:** Auto-deploys from git. `api/*.js` → serverless functions. Root HTML files → static.
- **vercel.json:** Rewrites `/login` → `/login.html`, `/dashboard` → `/dashboard.html`
- **No build step** — no compilation, bundling, or transpilation needed

## Security Model
- All API routes require valid Supabase JWT
- `SUPABASE_SERVICE_ROLE_KEY` used server-side only (never exposed to client)
- RLS on `plaid_items` table ensures users can only access their own data
- Rate limiting on token creation and exchange endpoints
- CORS restricted to allowed origins
