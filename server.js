require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');

const app = express();

// --- CORS: restrict to known origins ---
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

app.use(express.json());

// --- Rate limiting ---
const loginAttempts = new Map(); // key: IP, value: { count, resetAt }

function rateLimiter(maxAttempts, windowMs) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (entry && now < entry.resetAt) {
      if (entry.count >= maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return res.status(429).json({
          error: `Too many requests. Try again in ${retryAfter} seconds.`,
        });
      }
      entry.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now >= entry.resetAt) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000);

// --- Supabase server client (for verifying JWTs) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// --- Auth middleware: verify Supabase JWT on protected routes ---
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  if (!supabase) {
    return res.status(500).json({ error: 'Auth service not configured' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// --- Plaid client setup ---
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

// --- Per-user token storage (use a database in production) ---
const userTokens = new Map(); // key: user.id, value: { accessToken, itemId }

// --- Static files (exclude protected pages) ---
app.use(express.static(path.join(__dirname), {
  index: false, // don't auto-serve index.html for /
}));

// --- Public pages ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// Dashboard: served as static file, but auth is enforced on all /api/* routes
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// --- Protected API routes (all require valid Supabase JWT) ---

// Rate-limited: max 5 requests per minute per IP for token creation
app.post('/api/create-link-token', requireAuth, rateLimiter(10, 60000), async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: 'Holdwise',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

app.post('/api/exchange-token', requireAuth, rateLimiter(5, 60000), async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token || typeof public_token !== 'string') {
      return res.status(400).json({ error: 'Invalid public_token' });
    }
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    // Store per user, not globally
    userTokens.set(req.user.id, {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

app.get('/api/balances', requireAuth, async (req, res) => {
  try {
    const tokens = userTokens.get(req.user.id);
    if (!tokens) {
      return res.json({ accounts: [], total_balance: 0 });
    }
    const response = await plaidClient.accountsBalanceGet({ access_token: tokens.accessToken });
    const accounts = response.data.accounts;
    const total_balance = accounts.reduce((sum, a) => sum + (a.balances.current || 0), 0);
    res.json({ accounts, total_balance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const tokens = userTokens.get(req.user.id);
    if (!tokens) {
      return res.json({ transactions: [] });
    }
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let attempts = 0;
    while (attempts < 5) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: tokens.accessToken,
          start_date: thirtyDaysAgo.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          options: { count: 50, offset: 0 },
        });
        return res.json({ transactions: response.data.transactions });
      } catch (e) {
        if (e.response?.data?.error_code === 'PRODUCT_NOT_READY' && attempts < 4) {
          attempts++;
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw e;
        }
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
