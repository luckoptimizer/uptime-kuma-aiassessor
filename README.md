# status.aiassessor.ca

Custom status page for [AI Assessor](https://aiassessor.ca). Vue 3 + Express, deployed on Render, monitor state persisted in Supabase.

## Why this exists

We need an honest place to publish AI Assessor's uptime against the 99.9% SLA. The original implementation had a broken auth flow (admin file written to Render's ephemeral disk → wiped on every redeploy → users saw "create your first account" forever, then "welcome back" once they re-submitted credentials). This rewrite fixes that.

## SLA reality check

The 99.9% SLA target is **not achievable on Render's free plan**: the free web service spins down after ~15 minutes of inactivity, which by itself burns several percent of monthly uptime. To actually meet 99.9% you need:

- Render Starter ($7/mo) or higher — no spin-down
- Health-check pings (this status page already polls AI Assessor every minute)
- A second region or external uptime monitor for redundancy

We currently run on free for cost reasons. The status page is honest about real uptime — it does not claim availability we don't have.

## Architecture

```
Browser ──► Render web service (Vue 3 SPA + Express API)
                    │
                    ├──► HMAC-signed session cookie (HttpOnly, SameSite=Lax)
                    │
                    └──► Supabase REST (status_monitors table, service_role key, RLS-locked)
```

- **Auth**: env-based (`ADMIN_USERNAME` + bcrypt `ADMIN_PASSWORD_HASH`). No on-disk admin file. Sessions are HMAC-signed cookies, 7-day TTL.
- **Persistence**: monitors live in Supabase Postgres (`public.status_monitors`). RLS blocks anon/authenticated; only the backend's service-role key can read/write.
- **Deploy**: Dockerfile + `render.yaml` (autoDeploy from `main`).

## Local dev

```bash
cp .env.example .env
# generate a bcrypt hash for ADMIN_PASSWORD_HASH:
npm run hash-password -- yourpassword
# generate a session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# fill in .env, then:
npm install
npm run build
npm start
# open http://localhost:3001
```

For frontend hot-reload run `npm run dev` (Vite) in one terminal and `npm start` in another.

## Deploy to Render

1. Push to `main` (Render auto-deploys).
2. In the Render dashboard, set these env vars on the `status-aiassessor` service:
   - `ADMIN_USERNAME` — login username
   - `ADMIN_PASSWORD_HASH` — output of `npm run hash-password -- <password>`
   - `SESSION_SECRET` — `render.yaml` auto-generates this; rotate to invalidate all sessions
   - `SUPABASE_URL` — `https://ctxcznwnjliuywwucamr.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API
   - `NODE_ENV=production`
3. Health check path is `/api/health`. Render uses this to know the service is live.

## Supabase migration

`supabase/migrations/0001_status_monitors.sql` is the in-repo parity copy of the migration applied to project `ctxcznwnjliuywwucamr`. If you spin up a new Supabase project, run it via the SQL editor or the Supabase CLI.

## API surface

Public:
- `GET /api/health` — liveness probe
- `GET /api/public/status` — **read-only status board** (monitors + summary). No auth. This is what the public landing page renders. The `?apikey=` query string is stripped from each monitor target before it is exposed.
- `GET /api/admin/exists` — always `{exists:true, mode:'env'}` (legacy compatibility)
- `GET /api/session` — `{authenticated:boolean}`
- `POST /api/login` — `{username, password}` → sets session cookie
- `POST /api/logout` — clears cookie

Authenticated (session cookie required):
- `GET /api/admin` — `{username}`
- `GET /api/dashboard` — `{monitors, status}`
- `GET /api/monitors` — list
- `POST /api/monitors` — create
- `PUT /api/monitors/:id` — update
- `DELETE /api/monitors/:id` — remove

## What got fixed

- Removed file-based admin (was wiped on every Render redeploy).
- Replaced "admin exists?" UI toggle with a real 3-state machine: loading → login → dashboard.
- Added bcrypt password verification + HMAC-signed session cookies (HttpOnly, Secure in prod, SameSite=Lax).
- Protected mutating endpoints behind `requireAuth`. Previously `/api/admin` leaked the username publicly.
- Moved monitor state to Supabase so it survives redeploys and free-plan disk wipes.
- Removed unused deps (socket.io, sqlite3, redbean-node).

## Public status board (no login)

The status board is now **public** — visitors see live monitor health without an account. Login still exists, but only gates *management* (add / edit / pause / delete). Admins reach it via the **Admin** button in the top bar.

- `GET /api/public/status` serves a cached snapshot maintained by a server-side probe loop (every `PROBE_INTERVAL_MS`, default 60s), so page views never trigger live probing and the board stays fresh even when nobody is logged in.
- The probe runner sends **no auth headers**, so every monitor target must return 2xx/3xx unauthenticated. The Supabase Auth health check therefore appends the **public anon key** (`?apikey=`) — that key already ships in the client bundle, so it is safe to expose; it is stripped from the public API response regardless.
- **Content-aware checks:** a monitor may set `expect_contains` (text). When set, a 2xx response whose body does **not** contain that string is treated as **down**. This exists for on-device ML model artifacts: inference runs in the browser (TF.js), so there is no model server to ping — but the static `model.json`/weights must load, and the SPA returns 200 HTML for a missing file. The model monitor checks the body really is the model JSON.

### Monitors

Eight default monitors (seeded on first boot, mirrored in the live `status_monitors` table):

| id | target | covers |
|---|---|---|
| aiassessor-web | Vercel app | the actual valuation SPA |
| aiassessor-marketing | www.aiassessor.ca | marketing site |
| aiassessor-apex | aiassessor.ca | apex DNS / redirect |
| aiassessor-backend | functions/v1/make-server-1f5b90ba/health | Stripe checkout, analytics, KV — the SLA-critical backend |
| supabase-edge | functions/v1/health | edge function runtime |
| supabase-auth | auth/v1/health?apikey=… | GoTrue auth API |
| supabase-storage | storage/v1/status | Supabase Storage |
| aiassessor-model-alberta | …/tfjs_alberta_model/model.json | the shipped **on-device Alberta ML model** — content-checked for `modelTopology`, so a missing model served as 200 HTML reads as down |
| status-self | status.aiassessor.ca/api/health | this status page itself |
