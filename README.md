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
