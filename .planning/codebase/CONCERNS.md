# Concerns & Technical Debt

## Security

### High Priority
- **Access tokens in Supabase** — `plaid_items.access_token` is stored as plain text. Supabase encrypts at rest, but consider application-level encryption for defense in depth.
- **No input sanitization on HTML pages** — transaction names/amounts rendered via `innerHTML` or `textContent` (verify no XSS vectors when displaying Plaid data).
- **CORS fallback to `*`** — In `_shared.js`, if origin doesn't match allowed list, falls back to `Access-Control-Allow-Origin: *`. Should reject unknown origins instead.

### Medium Priority
- **No CSRF protection** — POST endpoints rely solely on Bearer token auth (acceptable for API-only, but verify no cookie-based auth leakage).
- **Rate limiter resets on cold start** — In-memory `Map` in serverless functions means rate limiting is unreliable in production. Consider Supabase or Redis-based rate limiting.
- **Service role key exposure risk** — `SUPABASE_SERVICE_ROLE_KEY` gives full DB access. Ensure it's never logged or included in error responses.

## Code Quality

### Duplication
- **Supabase client init duplicated** — initialized in every HTML page's inline script AND in `_shared.js` AND in `server.js` (3 separate inits).
- **CSS duplicated across pages** — each HTML file has its own `<style>` block with repeated theme variables and layout styles. No shared stylesheet.
- **Auth pattern duplicated** — `getUser()` in `_shared.js` and `requireAuth()` in `server.js` do the same thing differently.

### Architecture Concerns
- **No shared client-side JS** — each HTML page has its own inline `<script>` with duplicated Supabase init, fetch helpers, and UI logic.
- **Dual code paths** — `server.js` and `api/*.js` must be kept in sync manually. Changes to one must be mirrored in the other.
- **No build step** — works for now but limits ability to add TypeScript, CSS modules, or tree-shaking.

## Performance
- **Sequential transaction retry** — `PRODUCT_NOT_READY` retry loop waits up to 10 seconds (5 retries x 2s). With multiple banks, this multiplies.
- **No pagination** — transactions capped at 100 per bank. Users with high transaction volume won't see all data.
- **No caching** — every page load re-fetches all data from Plaid. Consider caching transactions in Supabase.

## Missing Features
- **No bank unlinking** — users can link banks but there's no UI or API to remove a linked bank (`plaid_items` row).
- **No webhook handling** — Plaid webhooks for transaction updates, errors, and item status changes are not handled.
- **No error recovery UI** — if a bank connection breaks (e.g., re-auth needed), the user has no way to know or fix it.
- **No transaction search/filter** — only last 30 days, no category filtering, no search.

## Dependency Risks
- **No lockfile pinning strategy** — `package.json` uses `^` ranges. Consider pinning exact versions.
- **Client CDN dependencies** — Supabase JS and Chart.js loaded from CDN with no SRI hashes. Supply chain risk if CDN is compromised.
- **plaid v26** — relatively recent, but no automated dependency update process.

## Accessibility
- **No semantic HTML landmarks** — pages lack `<main>`, `<nav>`, proper heading hierarchy.
- **No ARIA attributes** — interactive elements (sidebar links, buttons) lack accessibility labels.
- **Color contrast** — dark theme may not meet WCAG AA contrast ratios (not verified).
- **No keyboard navigation** — sidebar and interactive elements not fully keyboard-accessible.
