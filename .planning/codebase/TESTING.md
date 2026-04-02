# Testing

## Current State
**No testing infrastructure exists.**

- No test framework installed (no Jest, Mocha, Vitest, etc.)
- No test files anywhere in the codebase
- No `test` script in `package.json`
- No linting tools (ESLint, Prettier)
- No CI/CD pipeline configured
- No pre-commit hooks

## Testability Assessment

### Easily Testable
- **API handlers** (`api/*.js`) — pure request/response functions, can be unit tested with mocked Plaid/Supabase clients
- **`_shared.js` utilities** — `checkRateLimit()` is a pure function, easily unit testable
- **Auth middleware** (`getUser`, `requireAuth`) — testable with mocked Supabase responses

### Harder to Test
- **Inline `<script>` blocks in HTML** — tightly coupled to DOM, no module exports
- **Duplicated client-side logic** — Supabase client init repeated in each HTML page
- **Multi-bank parallel fetches** — integration tests needed for `Promise.allSettled` aggregation

## Recommended Testing Approach (Future)
1. Extract API handler logic into testable modules
2. Add Jest or Vitest for unit tests on API routes
3. Use Plaid sandbox for integration tests
4. Consider Playwright for E2E testing of the multi-page flow
