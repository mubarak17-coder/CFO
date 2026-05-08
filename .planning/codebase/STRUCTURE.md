# File & Directory Structure

```
HoldWise/
├── api/                        # Vercel serverless functions
│   ├── _shared.js              # Shared: Plaid client, Supabase client, auth, CORS, rate limiter
│   ├── create-link-token.js    # POST — generates Plaid Link token (DE config)
│   ├── exchange-token.js       # POST — exchanges public token, stores in plaid_items
│   ├── transactions.js         # GET — fetches transactions from all linked banks
│   └── balances.js             # GET — fetches balances from all linked banks
├── supabase/
│   └── migrations/
│       └── 20260401_create_plaid_items.sql  # plaid_items table with RLS
├── server.js                   # Express server (local dev — mirrors api/ routes)
├── index.html                  # Landing page (public)
├── login.html                  # Auth page (Supabase login/signup)
├── dashboard.html              # Main dashboard (charts, balances)
├── transactions.html           # Transaction history view
├── savings.html                # Savings tracker
├── settings.html               # User settings
├── dashboard.js                # Dashboard page logic (charts, sidebar nav)
├── package.json                # Dependencies: plaid, supabase-js, express, cors, dotenv
├── vercel.json                 # Vercel rewrites config
└── .env                        # Environment variables (not committed)
```

## Entry Points
- **Vercel production:** Each `api/*.js` file is an independent serverless function
- **Local dev:** `server.js` (Express, port 3000)
- **Client-side:** Each HTML page has its own inline `<script>` block

## Configuration Files
- `package.json` — dependencies, scripts (`npm start` / `npm run dev`)
- `vercel.json` — URL rewrites only (no build config needed)
- `.env` — all secrets and configuration

## Adding New Code
- New API endpoint → add `api/new-endpoint.js` (serverless) + mirror route in `server.js`
- New page → add `page.html` at root + add rewrite in `vercel.json` if clean URL needed
- New migration → add to `supabase/migrations/`
