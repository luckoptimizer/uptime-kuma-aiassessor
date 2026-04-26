/* eslint-disable no-console */
/**
 * status.aiassessor.ca - Express backend
 *
 * Auth model
 *   - Admin credentials come from env vars (ADMIN_USERNAME, ADMIN_PASSWORD_HASH).
 *     This is ephemeral-disk-safe: Render free plan wipes the container's disk
 *     on every restart/deploy, so we cannot persist admin to a JSON file.
 *   - Login issues an HMAC-signed cookie session ("sk_session"). All write
 *     endpoints and the unmasked admin info require it.
 *
 * Monitor persistence
 *   - If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, monitors are
 *     persisted in the public.status_monitors table.
 *   - Otherwise the server falls back to in-memory defaults (read-only seed).
 *   - On first boot with an empty table, the default AI Assessor monitors
 *     are seeded automatically.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const app = express();
const port = parseInt(process.env.PORT, 10) || 3001;
const host = '0.0.0.0';

// ───────── Config ─────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'luckoptimizer';
// bcrypt hash for password "luckoptimizer" — used only if ADMIN_PASSWORD_HASH is unset.
const FALLBACK_HASH = '$2b$10$IAZxM9mpKkXHHH4YBxXX5OsG9A.Aiifa44BpLfAfRGMycwZM1pjN.';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || FALLBACK_HASH;

const SESSION_SECRET = process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString('hex'); // ephemeral if unset; rotates on every restart
const SESSION_COOKIE = 'sk_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// ───────── Default monitors (seeded on first boot) ─────────
const defaultMonitors = [
  {
    id: 'aiassessor-web',
    name: 'AI Assessor — Web Application',
    type: 'HTTP',
    target: 'https://aiassessorplatformdesign-qsb9.vercel.app',
    interval_seconds: 60,
    paused: false
  },
  {
    id: 'aiassessor-marketing',
    name: 'AI Assessor — Marketing Site',
    type: 'HTTP',
    target: 'https://www.aiassessor.ca',
    interval_seconds: 60,
    paused: false
  },
  {
    id: 'supabase-edge',
    name: 'AI Assessor — Supabase Edge Functions',
    type: 'HTTP',
    target: 'https://ctxcznwnjliuywwucamr.supabase.co/functions/v1/health',
    interval_seconds: 60,
    paused: false
  },
  {
    id: 'supabase-auth',
    name: 'AI Assessor — Supabase Auth API',
    type: 'HTTP',
    target: 'https://ctxcznwnjliuywwucamr.supabase.co/auth/v1/health',
    interval_seconds: 60,
    paused: false
  },
  {
    id: 'status-self',
    name: 'AI Assessor — Status Page',
    type: 'HTTP',
    target: 'https://status.aiassessor.ca/api/health',
    interval_seconds: 60,
    paused: false
  }
];

let inMemoryMonitors = defaultMonitors.map((m) => ({ ...m }));

// ───────── Middleware ─────────
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// trust X-Forwarded-Proto on Render so cookies get Secure flag right
app.set('trust proxy', 1);

// ───────── Sessions (HMAC cookie) ─────────
function signSession(payload) {
  const body = JSON.stringify(payload);
  const b64 = Buffer.from(body).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  return `${b64}.${mac}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [b64, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  return verifySession(token);
}

function setSessionCookie(res, payload) {
  const token = signSession(payload);
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session || session.user !== ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.session = session;
  next();
}

// ───────── Supabase persistence ─────────
function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function loadMonitorsFromStore() {
  if (!supabaseEnabled) return inMemoryMonitors;
  try {
    const url = `${SUPABASE_URL}/rest/v1/status_monitors?select=*&order=created_at.asc`;
    const response = await axios.get(url, {
      headers: supabaseHeaders(),
      timeout: 6000,
      validateStatus: () => true
    });
    if (response.status === 200) {
      if (!Array.isArray(response.data) || response.data.length === 0) {
        await seedDefaultMonitors();
        return defaultMonitors.map((m) => ({ ...m }));
      }
      return response.data;
    }
    console.error('[supabase] loadMonitors non-200:', response.status, response.data);
    return inMemoryMonitors;
  } catch (error) {
    console.error('[supabase] loadMonitors failed:', error.message);
    return inMemoryMonitors;
  }
}

async function seedDefaultMonitors() {
  if (!supabaseEnabled) return;
  try {
    const url = `${SUPABASE_URL}/rest/v1/status_monitors`;
    await axios.post(url, defaultMonitors, {
      headers: supabaseHeaders(),
      timeout: 6000,
      validateStatus: () => true
    });
    console.log('[supabase] seeded', defaultMonitors.length, 'default monitors');
  } catch (error) {
    console.error('[supabase] seed failed:', error.message);
  }
}

async function upsertMonitorInStore(monitor) {
  if (!supabaseEnabled) {
    const idx = inMemoryMonitors.findIndex((m) => m.id === monitor.id);
    if (idx >= 0) inMemoryMonitors[idx] = monitor;
    else inMemoryMonitors.unshift(monitor);
    return monitor;
  }
  const url = `${SUPABASE_URL}/rest/v1/status_monitors?on_conflict=id`;
  const response = await axios.post(url, monitor, {
    headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    timeout: 6000,
    validateStatus: () => true
  });
  if (response.status >= 400) {
    throw new Error(`supabase upsert failed: ${response.status} ${JSON.stringify(response.data)}`);
  }
  return Array.isArray(response.data) ? response.data[0] : response.data;
}

async function deleteMonitorInStore(id) {
  if (!supabaseEnabled) {
    inMemoryMonitors = inMemoryMonitors.filter((m) => m.id !== id);
    return;
  }
  const url = `${SUPABASE_URL}/rest/v1/status_monitors?id=eq.${encodeURIComponent(id)}`;
  const response = await axios.delete(url, {
    headers: supabaseHeaders(),
    timeout: 6000,
    validateStatus: () => true
  });
  if (response.status >= 400) {
    throw new Error(`supabase delete failed: ${response.status}`);
  }
}

// ───────── Probe runner ─────────
async function probeMonitor(monitor) {
  if (monitor.paused) {
    return { last_status: 'paused', last_response_time_ms: null };
  }
  const type = (monitor.type || '').toString().toLowerCase();
  const start = Date.now();
  try {
    if (type === 'http' || type === 'tls' || type === 'https') {
      const target = monitor.target.startsWith('http')
        ? monitor.target
        : `https://${monitor.target}`;
      const res = await axios.get(target, {
        timeout: 9000,
        validateStatus: () => true,
        maxRedirects: 5
      });
      const ms = Date.now() - start;
      const ok = res.status >= 200 && res.status < 400;
      const degraded = ms > 3000;
      return {
        last_status: ok ? (degraded ? 'degraded' : 'up') : 'down',
        last_response_time_ms: ms
      };
    }
    return { last_status: 'unknown', last_response_time_ms: null };
  } catch (error) {
    return {
      last_status: 'down',
      last_response_time_ms: Date.now() - start
    };
  }
}

async function refreshAllMonitors() {
  const monitors = await loadMonitorsFromStore();
  const updated = await Promise.all(
    monitors.map(async (m) => {
      const probe = await probeMonitor(m);
      const next = {
        ...m,
        last_status: probe.last_status,
        last_response_time_ms: probe.last_response_time_ms,
        last_checked_at: new Date().toISOString()
      };
      try {
        await upsertMonitorInStore(next);
      } catch (e) {
        console.error('[probe] upsert failed for', m.id, e.message);
      }
      return next;
    })
  );
  return updated;
}

function summarizeStatus(monitors) {
  const counts = { up: 0, down: 0, degraded: 0, paused: 0 };
  for (const m of monitors) {
    if (m.paused) { counts.paused += 1; continue; }
    const s = (m.last_status || '').toLowerCase();
    if (s === 'up' || s === 'online' || s === 'ok') counts.up += 1;
    else if (s === 'degraded' || s === 'warn') counts.degraded += 1;
    else if (s === 'down' || s === 'offline' || s === 'error') counts.down += 1;
  }
  return counts;
}

// ───────── Public endpoints ─────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'status.aiassessor.ca', time: new Date().toISOString() });
});

// Legacy compatibility — UI used to use this to decide "create admin" vs "login".
app.get('/api/admin/exists', (req, res) => {
  res.json({ exists: true, mode: 'env' });
});

app.get('/api/session', (req, res) => {
  const session = getSession(req);
  res.json({ authenticated: Boolean(session && session.user === ADMIN_USERNAME) });
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (username !== ADMIN_USERNAME) {
      // dummy compare to keep timing-similar
      await bcrypt.compare(password, FALLBACK_HASH);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    setSessionCookie(res, {
      user: ADMIN_USERNAME,
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS
    });
    return res.json({ ok: true, username: ADMIN_USERNAME });
  } catch (error) {
    console.error('[login] failed:', error.message);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Compatibility shim — legacy clients may call /api/admin/create. Treat as login.
app.post('/api/admin/create', async (req, res) => {
  return app._router.handle({ ...req, url: '/api/login', originalUrl: '/api/login' }, res, () => {});
});

// ───────── Authenticated endpoints ─────────
app.get('/api/admin', requireAuth, (req, res) => {
  res.json({ username: ADMIN_USERNAME });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const monitors = await refreshAllMonitors();
    res.json({ monitors, status: summarizeStatus(monitors) });
  } catch (error) {
    console.error('[dashboard] failed:', error.message);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

app.get('/api/monitors', requireAuth, async (req, res) => {
  try {
    const monitors = await loadMonitorsFromStore();
    res.json({ monitors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const VALID_TYPES = ['HTTP', 'TLS', 'Database'];

app.post('/api/monitors', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.target) {
      return res.status(400).json({ error: 'name and target are required' });
    }
    const type = VALID_TYPES.includes(body.type) ? body.type : 'HTTP';
    const monitor = {
      id: body.id || crypto.randomBytes(6).toString('hex'),
      name: String(body.name),
      target: String(body.target),
      type,
      interval_seconds: parseInt(body.interval_seconds, 10) || 60,
      paused: Boolean(body.paused)
    };
    const saved = await upsertMonitorInStore(monitor);
    res.json({ monitor: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/monitors/:id', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.target) {
      return res.status(400).json({ error: 'name and target are required' });
    }
    const type = VALID_TYPES.includes(body.type) ? body.type : 'HTTP';
    const monitor = {
      id: req.params.id,
      name: String(body.name),
      target: String(body.target),
      type,
      interval_seconds: parseInt(body.interval_seconds, 10) || 60,
      paused: Boolean(body.paused),
      last_status: body.last_status || null,
      last_response_time_ms: body.last_response_time_ms != null ? parseInt(body.last_response_time_ms, 10) : null,
      last_checked_at: body.last_checked_at || null
    };
    const saved = await upsertMonitorInStore(monitor);
    res.json({ monitor: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/monitors/:id', requireAuth, async (req, res) => {
  try {
    await deleteMonitorInStore(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ───────── Static frontend ─────────
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  console.warn('[startup] dist/ not found — frontend will not be served. Run `npm run build`.');
}

// ───────── Boot ─────────
app.listen(port, host, async () => {
  console.log(`[startup] status.aiassessor.ca listening on http://${host}:${port}`);
  console.log(`[startup] supabase: ${supabaseEnabled ? 'enabled' : 'disabled (in-memory only)'}`);
  console.log(`[startup] admin user: ${ADMIN_USERNAME}`);
  if (ADMIN_PASSWORD_HASH === FALLBACK_HASH) {
    console.warn('[startup] WARNING: using fallback password hash. Set ADMIN_PASSWORD_HASH in env.');
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('[startup] WARNING: SESSION_SECRET not set — sessions will invalidate on every restart.');
  }
  // Warm up monitors in the background; don't block boot.
  refreshAllMonitors().catch((err) => console.error('[startup] initial probe failed:', err.message));
});
