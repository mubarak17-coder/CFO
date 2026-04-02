# Code Conventions

## Naming
- **Files:** kebab-case (`create-link-token.js`, `dashboard.html`)
- **Functions:** camelCase (`checkRateLimit`, `getUser`, `requireAuth`)
- **Variables:** camelCase (`plaidClient`, `accessToken`, `thirtyDaysAgo`)
- **Constants:** UPPER_SNAKE_CASE (`ALLOWED_ORIGINS`, `PORT`)
- **CSS classes:** kebab-case (`sidebar-link`, `nav-item`)
- **Shared module prefix:** `_` (`_shared.js` — convention for non-route files in `api/`)

## Code Style
- 2-space indentation
- Single quotes for strings
- Semicolons used consistently
- No formatter/linter configured (no .eslintrc, .prettierrc)
- CommonJS `require()` / `module.exports` (not ES modules)

## Error Handling Pattern
- Try/catch wrapping entire handler body
- Early returns for auth failures and validation (guard clauses)
- Generic error messages to client (`"Failed to fetch transactions"`)
- Detailed error logging server-side (`console.error`)
- `Promise.allSettled` for multi-bank queries (partial failures don't break the whole response)

## API Handler Pattern (Vercel serverless)
```js
const { plaidClient, supabase, getUser, setCors } = require('./_shared');
module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  // ... handler logic
};
```

## HTML/CSS Patterns
- Inline `<style>` blocks per page (no shared CSS file)
- CSS custom properties for theming (`--bg`, `--card-bg`, `--text`)
- Dark theme by default
- Inline `<script>` blocks per page (no bundler, no shared JS file)
- CDN dependencies loaded via `<script src="...">` tags
- Supabase client initialized inline in each page

## Comment Style
- Section headers: `// --- Section Name ---`
- Inline comments for non-obvious logic
- No JSDoc or formal documentation
