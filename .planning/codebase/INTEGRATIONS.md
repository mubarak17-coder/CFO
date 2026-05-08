# External Integrations

## Plaid API
- **Library:** `plaid` v26.0.0 (plaid-node SDK)
- **Products:** Transactions (primary), Account Balances
- **Endpoints used:**
  - `linkTokenCreate` — generates Link tokens for bank connection UI
  - `itemPublicTokenExchange` — exchanges public token for access token
  - `transactionsGet` — fetches transaction history (30-day window)
  - `accountsBalanceGet` — fetches account balances
  - `itemGet` / `institutionsGetById` — fetches institution metadata
- **Country:** DE (Germany) with `de` language, `holdwise` link customization
- **OAuth:** PSD2-compliant redirect flow via `PLAID_REDIRECT_URI`
- **Environment:** Configurable via `PLAID_ENV` (sandbox/development/production)

## Supabase
- **Library:** `@supabase/supabase-js` v2.100.1
- **Auth:** JWT-based via `supabase.auth.getUser(token)` — Bearer token in Authorization header
- **Database:** `plaid_items` table stores multi-bank access tokens per user (with RLS)
- **Client:** Server-side client initialized with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

## Environment Variables Required
| Variable | Purpose |
|---|---|
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid API secret |
| `PLAID_ENV` | Plaid environment (sandbox/development/production) |
| `PLAID_REDIRECT_URI` | OAuth redirect URI for PSD2 German bank flows |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (client-side, in HTML) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins |

## Authentication Flow
1. Client sends Supabase JWT in `Authorization: Bearer <token>` header
2. Server verifies JWT via `supabase.auth.getUser()`
3. User ID from JWT used as `client_user_id` for Plaid and `user_id` for DB queries

## Third-Party CDN Dependencies (Client-Side)
- Supabase JS (loaded via CDN in HTML pages)
- Chart.js (dashboard charts)
- No bundler — all client dependencies loaded via `<script>` tags
