# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- JavaScript (ES2020+) - All server and client code
- HTML5 - Page templates with inline CSS and JS
- CSS3 - Inline `<style>` blocks in each HTML page (no external stylesheets)

**Secondary:**
- None

## Runtime

**Environment:**
- Node.js (no `.nvmrc` or `.node-version` present; no version pinned)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express `^4.21.0` - HTTP server and API routing (`server.js`)
- Vercel Serverless Functions - Production deployment uses `api/*.js` handler exports

**Testing:**
- None configured (no test framework, no test scripts, no test files)

**Build/Dev:**
- No build step - plain JavaScript served directly, no bundler/transpiler
- No TypeScript, no Babel, no Webpack/Vite/esbuild
- `npm start` / `npm run dev` both run `node server.js`

## Key Dependencies

**Critical (production):**
- `@supabase/supabase-js` `^2.100.1` - Authentication (server-side JWT verification via service role key)
- `plaid` `^26.0.0` - Bank account linking and financial data (transactions, balances)
- `express` `^4.21.0` - HTTP server for local development
- `cors` `^2.8.5` - CORS middleware for Express
- `dotenv` `^16.4.5` - Environment variable loading from `.env`

**Dev Dependencies:**
- None declared in `package.json`

## CDN Dependencies (Client-Side)

Loaded via `<script>` tags in HTML pages (not managed by npm):
- `@supabase/supabase-js@2` via `cdn.jsdelivr.net` - Used on all pages for client-side auth
- Plaid Link SDK via `cdn.plaid.com/link/v2/stable/link-initialize.js` - Used on `dashboard.html` for bank connection UI

## Configuration

**Environment:**
- `.env` file loaded by `dotenv` in `server.js` (local development)
- `.env.example` documents required variables
- Vercel environment variables used in production (serverless functions access `process.env` directly)

**Required env vars:**
- `PLAID_CLIENT_ID` - Plaid API client ID
- `PLAID_SECRET` - Plaid API secret key
- `PLAID_ENV` - Plaid environment (`sandbox`, `development`, or `production`)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)
- `ALLOWED_ORIGINS` - Comma-separated allowed CORS origins
- `PORT` - Server port (defaults to 3000)

**Build:**
- No build configuration files exist
- `vercel.json` contains URL rewrites only: `/login` -> `/login.html`, `/dashboard` -> `/dashboard.html`

## Platform Requirements

**Development:**
- Node.js (any recent LTS should work; no version pinned)
- npm
- Plaid sandbox credentials
- Supabase project with auth enabled

**Production:**
- Vercel (serverless functions in `api/` directory)
- Supabase hosted instance
- Plaid API credentials (sandbox/development/production)

## Architecture Notes

The project has a dual-mode server setup:
- **Local development:** `server.js` runs an Express server that serves static HTML and handles API routes inline
- **Production (Vercel):** Static HTML files are served by Vercel's CDN; API routes are handled by serverless functions in `api/` directory

The `api/` serverless functions and `server.js` contain duplicated logic for the same endpoints. The `api/` versions store Plaid tokens in Supabase user metadata, while `server.js` stores them in an in-memory Map.

---

*Stack analysis: 2026-04-01*
