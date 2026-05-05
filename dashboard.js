// ── Palette ──
const SEG_COLORS = ['#3B82F6', '#10D9A0', '#8B5CF6', '#FB923C', '#F43F5E', '#FBBF24'];

const CAT_CFG = {
  'Food and Drink':  { label: 'Food & Dining',  icon: '🍽', color: '#FB923C' },
  'Travel':          { label: 'Transport',       icon: '🚊', color: '#3B82F6' },
  'Shops':           { label: 'Shopping',        icon: '🛍', color: '#8B5CF6' },
  'Recreation':      { label: 'Entertainment',   icon: '🎮', color: '#10D9A0' },
  'Service':         { label: 'Subscriptions',   icon: '📱', color: '#F43F5E' },
  'Healthcare':      { label: 'Health',          icon: '💊', color: '#EC4899' },
  'Payment':         { label: 'Payments',        icon: '💳', color: '#FBBF24' },
};

function catCfg(key) {
  return CAT_CFG[key] || { label: key, icon: '📊', color: '#6B7280' };
}

// ── State ──
const State = { user: null, accounts: [], totalBalance: 0, transactions: [] };

// ── Escape ──
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ── Format ──
function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(str) {
  const d = new Date(str + 'T12:00:00');
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Auth ──
async function getAuthHeaders() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return {};
  return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

async function authFetch(url, opts = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  if (res.status === 401) {
    await supabaseClient.auth.signOut();
    window.location.href = '/login.html';
    throw new Error('Session expired');
  }
  return res;
}

// ── Count-up ──
function countUp(el, target, duration, formatter) {
  const start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = formatter(target * e);
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

function countUpCurrency(el, target, duration = 1300) {
  countUp(el, target, duration, n => fmt(n));
}

// ── Sparkline ──
let _spkId = 0;
function sparkline(values, color, w = 60, h = 22) {
  const nonZero = values.some(v => v > 0);
  if (values.length < 2 || !nonZero) return `<svg width="${w}" height="${h}"></svg>`;
  const id = 'sg' + (_spkId++);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * (w - 4) + 2).toFixed(1);
    const y = (h - 4 - ((v - min) / range) * (h - 8)).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  const area = `2,${h} ${pts} ${w - 2},${h}`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#${id})"/>
    <polyline points="${pts}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ── Weekly buckets ──
function weeklyBuckets(transactions, catKey, n = 4) {
  const now = Date.now();
  const buckets = Array(n).fill(0);
  transactions.forEach(tx => {
    if (tx.amount <= 0) return;
    if ((tx.category?.[0] || 'Other') !== catKey) return;
    const daysAgo = (now - new Date(tx.date + 'T12:00:00')) / 86400000;
    const wi = n - 1 - Math.floor(daysAgo / 7);
    if (wi >= 0 && wi < n) buckets[wi] += tx.amount;
  });
  return buckets;
}

// ── State switcher ──
function setState(s) {
  document.getElementById('state-loading').hidden = s !== 'loading';
  document.getElementById('state-empty').hidden   = s !== 'empty';
  document.getElementById('state-data').hidden    = s !== 'data';
}

// ── Entry animation ──
function animateReveal() {
  document.querySelectorAll('#state-data .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('in'), i * 90);
  });
}

// ── Donut chart ──
function buildSegments(accounts) {
  const map = {};
  accounts.forEach(acc => {
    const key = acc.institution_name || 'Unknown';
    map[key] = (map[key] || 0) + (acc.balances?.current || 0);
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], i) => ({ name, amount, color: SEG_COLORS[i % SEG_COLORS.length] }));
}

function renderDonut(segments, total) {
  const wrap = document.getElementById('donut-svg-wrap');
  const legend = document.getElementById('donut-legend');
  const R = 80, CX = 100, CY = 100, C = 2 * Math.PI * R, GAP = 1.8;

  let offsetFrac = 0.25;
  const circles = segments.map((seg, i) => {
    const frac = seg.amount / total;
    const dashLen = Math.max(frac * C - GAP, 0);
    const offset = offsetFrac * C;
    offsetFrac += frac;
    return `<circle class="dseg"
      cx="${CX}" cy="${CY}" r="${R}"
      fill="none" stroke="${seg.color}" stroke-width="13"
      stroke-linecap="butt"
      stroke-dasharray="0 ${C}"
      stroke-dashoffset="${offset}"
      data-target="${dashLen}" data-c="${C}"
      data-name="${esc(seg.name)}" data-amount="${seg.amount}"
      data-pct="${(frac * 100).toFixed(1)}"
      style="pointer-events:stroke;cursor:pointer;
             transition:stroke-dasharray 0.9s cubic-bezier(0.34,1.1,0.64,1) ${i * 0.07}s, opacity 0.18s"/>`;
  });

  wrap.insertAdjacentHTML('afterbegin',
    `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible;display:block">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="13"/>
      ${circles.join('')}
    </svg>`
  );

  // Animate in (double-rAF to ensure paint)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrap.querySelectorAll('.dseg').forEach(seg => {
      const t = parseFloat(seg.dataset.target), c = parseFloat(seg.dataset.c);
      seg.style.strokeDasharray = `${t} ${c - t}`;
    });
  }));

  // Legend
  legend.innerHTML = segments.map(s =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${s.color}"></div>
       <span>${esc(s.name)}</span>
     </div>`
  ).join('');

  // Hover interaction
  const hoverEl  = document.getElementById('donut-hover');
  const defaultEl = document.getElementById('donut-default');
  const totalEl  = document.getElementById('donut-total');

  countUpCurrency(totalEl, total, 1400);

  wrap.querySelectorAll('.dseg').forEach(seg => {
    seg.addEventListener('mouseenter', () => {
      wrap.querySelectorAll('.dseg').forEach(s => { s.style.opacity = s === seg ? '1' : '0.2'; });
      document.getElementById('hov-name').textContent = seg.dataset.name;
      document.getElementById('hov-val').textContent  = fmt(parseFloat(seg.dataset.amount));
      document.getElementById('hov-pct').textContent  = seg.dataset.pct + '%';
      hoverEl.classList.add('vis');
      defaultEl.style.opacity = '0';
    });
    seg.addEventListener('mouseleave', () => {
      wrap.querySelectorAll('.dseg').forEach(s => { s.style.opacity = '1'; });
      hoverEl.classList.remove('vis');
      defaultEl.style.opacity = '1';
    });
  });
}

// ── Accounts list ──
function renderAccounts(accounts, segments) {
  const list = document.getElementById('accounts-list');
  const totalEl = document.getElementById('acct-total-val');

  // Group by institution
  const byBank = {};
  accounts.forEach(acc => {
    const key = acc.institution_name || 'Unknown';
    if (!byBank[key]) byBank[key] = [];
    byBank[key].push(acc);
  });

  list.innerHTML = Object.entries(byBank).map(([bank, accs], i) => {
    const bal = accs.reduce((s, a) => s + (a.balances?.current || 0), 0);
    const color = SEG_COLORS[i % SEG_COLORS.length];
    const types = [...new Set(accs.map(a => a.subtype || a.type || 'account'))].join(', ');
    return `<div class="acct-row">
      <div class="acct-left">
        <div class="acct-dot" style="background:${color}"></div>
        <div>
          <div class="acct-name">${esc(bank)}</div>
          <div class="acct-type">${esc(types)}</div>
        </div>
      </div>
      <div class="acct-bal" style="color:${color}">${fmt(bal)}</div>
    </div>`;
  }).join('');

  countUpCurrency(totalEl, State.totalBalance, 1400);
}

// ── Drain section ──
function renderDrain(transactions) {
  const grid = document.getElementById('drain-grid');
  const totalEl = document.getElementById('drain-total');
  const card = document.getElementById('drain-card');

  const spending = transactions.filter(t => t.amount > 0);
  if (!spending.length) { card.classList.add('hidden'); return; }

  const catMap = {};
  spending.forEach(tx => {
    const key = tx.category?.[0] || 'Other';
    if (key === 'Transfer') return;
    catMap[key] = (catMap[key] || 0) + tx.amount;
  });

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalSpent = sorted.reduce((s, [, v]) => s + v, 0);
  const maxAmt = sorted[0]?.[1] || 1;

  countUpCurrency(totalEl, totalSpent, 1100);

  grid.innerHTML = sorted.map(([catKey, amount]) => {
    const cfg = catCfg(catKey);
    const pct = ((amount / totalSpent) * 100).toFixed(1);
    const barPct = ((amount / maxAmt) * 100).toFixed(1);
    const spk = sparkline(weeklyBuckets(transactions, catKey), cfg.color, 60, 22);
    return `<div class="drain-item">
      <div class="drain-top">
        <div class="drain-left">
          <span class="drain-icon">${cfg.icon}</span>
          <span class="drain-name">${esc(cfg.label)}</span>
        </div>
        <div class="drain-right">
          <div class="drain-amt" style="color:${cfg.color}">${fmt(amount)}</div>
          <div class="drain-pct">${pct}% of spend</div>
        </div>
      </div>
      <div class="drain-track">
        <div class="drain-fill" style="background:${cfg.color}" data-target="${barPct}"></div>
      </div>
      <div class="drain-spk">${spk}</div>
    </div>`;
  }).join('');

  // Trigger bar animations after paint
  setTimeout(() => {
    grid.querySelectorAll('.drain-fill').forEach(b => { b.style.width = b.dataset.target + '%'; });
  }, 200);
}

// ── Transactions ──
function renderTransactions(transactions) {
  const container = document.getElementById('tx-list');
  const recent = transactions.slice(0, 8);

  if (!recent.length) {
    container.innerHTML = '<div class="tx-empty">No transactions yet</div>';
    return;
  }

  container.innerHTML = `<ul class="tx-list-inner">${recent.map(tx => {
    const isNeg = tx.amount > 0;
    const merchant = tx.merchant_name || tx.name || 'Unknown';
    const key = tx.category?.[0] || 'Other';
    const icon = catCfg(key).icon;
    return `<li class="tx-row">
      <div class="tx-left">
        <div class="tx-ico">${icon}</div>
        <div style="min-width:0">
          <div class="tx-merchant">${esc(merchant)}</div>
          <div class="tx-meta">${fmtDate(tx.date)}${tx.institution_name ? ' · ' + esc(tx.institution_name) : ''}</div>
        </div>
      </div>
      <div class="tx-amt ${isNeg ? 'neg' : 'pos'}">${isNeg ? '−' : '+'}${fmt(Math.abs(tx.amount))}</div>
    </li>`;
  }).join('')}</ul>`;
}

// ── Connect bank ──
async function connectBank(source) {
  const btn = source === 'empty'
    ? document.getElementById('empty-connect-btn')
    : document.getElementById('link-cta-btn');

  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Connecting…`; }

  try {
    const res  = await authFetch('/api/create-link-token', { method: 'POST' });
    const data = await res.json();
    if (!data.link_token) { showToast('Could not initialize connection.', 'error'); resetBtn(btn, source); return; }

    Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken) => {
        await authFetch('/api/exchange-token', {
          method: 'POST',
          body: JSON.stringify({ public_token: publicToken }),
        });
        showToast('Bank connected!', 'success');
        loadDashboardData();
      },
      onExit: () => resetBtn(btn, source),
    }).open();
  } catch {
    showToast('Connection failed. Try again.', 'error');
    resetBtn(btn, source);
  }
}

function resetBtn(btn, source) {
  if (!btn) return;
  btn.disabled = false;
  if (source === 'empty') {
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg> Connect Bank Account`;
  } else {
    btn.textContent = 'Link Account';
  }
}

// ── Load data ──
async function loadDashboardData() {
  setState('loading');
  try {
    const [balRes, txRes] = await Promise.all([authFetch('/api/balances'), authFetch('/api/transactions')]);
    const balData = await balRes.json();
    const txData  = await txRes.json();

    State.accounts     = balData.accounts || [];
    State.totalBalance = balData.total_balance || 0;
    State.transactions = txData.transactions || [];

    if (!State.accounts.length) { setState('empty'); return; }

    setState('data');

    const segments = buildSegments(State.accounts);
    renderDonut(segments, State.totalBalance);
    renderAccounts(State.accounts, segments);
    renderDrain(State.transactions);
    renderTransactions(State.transactions);

    setTimeout(animateReveal, 60);
  } catch {
    showToast('Failed to load dashboard.', 'error');
    setState('empty');
  }
}

// ── Toast ──
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 250); }, 4000);
}

// ── Logout ──
async function handleLogout() {
  await supabaseClient.auth.signOut();
  navigateTo('/login.html');
}

// ── Init user ──
async function initUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  State.user = session.user;

  const email = session.user.email || '';
  const name  = session.user.user_metadata?.full_name || email.split('@')[0] || 'there';
  const initials = name.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent   = name;
  document.getElementById('user-email').textContent  = email;

  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = name.split(' ')[0];
  document.getElementById('greeting').textContent     = `${greet}, ${firstName}.`;
  document.getElementById('greeting-sub').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  loadDashboardData();
});
