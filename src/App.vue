<template>
    <div id="app">
        <!-- LOGIN -->
        <div v-if="view === 'login'" class="auth-screen">
            <div class="auth-card">
                <div class="brand">
                    <div class="brand-mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2v20" />
                            <path d="M2 12h20" />
                            <circle cx="12" cy="12" r="9" />
                        </svg>
                    </div>
                    <div class="brand-text">
                        <span class="brand-name">AI Assessor</span>
                        <span class="brand-sub">System Status</span>
                    </div>
                </div>
                <h2 class="auth-title">Sign in</h2>
                <p class="auth-lead">Authorized personnel only. Operations control for status.aiassessor.ca.</p>
                <form @submit.prevent="login" class="auth-form">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input
                            v-model="form.username"
                            type="text"
                            id="username"
                            required
                            autocomplete="username"
                            placeholder="Enter username"
                        />
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input
                            v-model="form.password"
                            type="password"
                            id="password"
                            required
                            autocomplete="current-password"
                            placeholder="Enter password"
                        />
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
                        {{ loading ? 'Signing in...' : 'Sign in' }}
                    </button>
                </form>
                <div v-if="error" class="alert alert-error">{{ error }}</div>
                <div v-if="success" class="alert alert-success">{{ success }}</div>
            </div>
            <p class="auth-footer">
                &copy; {{ year }} AI Assessor Inc. &middot; Edmonton, Alberta &middot;
                <a href="https://www.aiassessor.ca" target="_blank" rel="noopener">aiassessor.ca</a>
            </p>
        </div>

        <!-- DASHBOARD -->
        <div v-else-if="view === 'dashboard'" class="dashboard">
            <header class="topbar">
                <div class="topbar-inner">
                    <div class="brand brand-compact">
                        <div class="brand-mark" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 2v20" />
                                <path d="M2 12h20" />
                                <circle cx="12" cy="12" r="9" />
                            </svg>
                        </div>
                        <div class="brand-text">
                            <span class="brand-name">AI Assessor</span>
                            <span class="brand-sub">System Status</span>
                        </div>
                    </div>
                    <div class="topbar-actions">
                        <span class="who">Signed in as <strong>{{ adminName }}</strong></span>
                        <button class="btn btn-ghost" @click="logout" :disabled="loading">Sign out</button>
                    </div>
                </div>
            </header>

            <main class="content">
                <!-- Overall status banner -->
                <section :class="['summary', `summary-${overallStatus}`]">
                    <div class="summary-icon" aria-hidden="true">
                        <span class="pulse"></span>
                    </div>
                    <div class="summary-text">
                        <div class="summary-headline">{{ overallHeadline }}</div>
                        <div class="summary-sub">
                            {{ counts.up }} operational &middot;
                            {{ counts.degraded }} degraded &middot;
                            {{ counts.down }} offline &middot;
                            {{ counts.paused }} paused
                        </div>
                    </div>
                    <div class="summary-meta">
                        <span class="meta-label">Last refresh</span>
                        <span class="meta-value">{{ lastRefreshLabel }}</span>
                    </div>
                </section>

                <!-- Monitor management -->
                <section class="panel">
                    <div class="panel-head">
                        <div>
                            <h2 class="panel-title">Monitors</h2>
                            <p class="panel-sub">Probes that drive the AI Assessor 99.9% SLA dashboard.</p>
                        </div>
                        <button class="btn btn-primary" @click="openAdd" v-if="!addOpen">
                            + Add monitor
                        </button>
                    </div>

                    <!-- Add / edit form -->
                    <form v-if="addOpen" class="monitor-form" @submit.prevent="submitMonitor">
                        <div class="monitor-form-grid">
                            <div class="form-group">
                                <label>Name</label>
                                <input v-model="draft.name" required placeholder="AI Assessor — Web App" />
                            </div>
                            <div class="form-group">
                                <label>Type</label>
                                <select v-model="draft.type">
                                    <option value="HTTP">HTTP / HTTPS</option>
                                    <option value="TLS">TLS / TCP port</option>
                                </select>
                            </div>
                            <div class="form-group form-wide">
                                <label>Target URL or host:port</label>
                                <input v-model="draft.target" required placeholder="https://www.aiassessor.ca/api/health" />
                            </div>
                            <div class="form-group">
                                <label>Interval (seconds)</label>
                                <input v-model.number="draft.interval_seconds" type="number" min="30" step="30" />
                            </div>
                        </div>
                        <div class="monitor-form-actions">
                            <button type="button" class="btn btn-ghost" @click="closeForm">Cancel</button>
                            <button type="submit" class="btn btn-primary" :disabled="loading">
                                {{ editingId ? 'Save changes' : 'Create monitor' }}
                            </button>
                        </div>
                    </form>

                    <!-- Monitor cards -->
                    <div class="monitor-grid" v-if="monitors.length">
                        <article
                            v-for="m in monitors"
                            :key="m.id"
                            :class="['monitor-card', `status-${cardStatus(m)}`]"
                        >
                            <div class="monitor-head">
                                <span :class="['status-pill', `pill-${cardStatus(m)}`]">
                                    <span class="dot"></span>
                                    {{ statusLabel(m) }}
                                </span>
                                <span class="type-pill">{{ (m.type || 'HTTP').toUpperCase() }}</span>
                            </div>
                            <h3 class="monitor-name">{{ m.name }}</h3>
                            <a class="monitor-target" :href="m.target.startsWith('http') ? m.target : null" target="_blank" rel="noopener">
                                {{ m.target }}
                            </a>
                            <div class="monitor-stats">
                                <div class="stat">
                                    <span class="stat-label">Response</span>
                                    <span class="stat-value">{{ m.last_response_time_ms != null ? m.last_response_time_ms + ' ms' : '—' }}</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Last check</span>
                                    <span class="stat-value">{{ formatRelative(m.last_checked_at) }}</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Interval</span>
                                    <span class="stat-value">{{ m.interval_seconds || 60 }}s</span>
                                </div>
                            </div>
                            <div class="monitor-actions">
                                <button class="btn btn-sm btn-ghost" @click="openEdit(m)">Edit</button>
                                <button class="btn btn-sm btn-ghost" @click="togglePause(m)">
                                    {{ m.paused ? 'Resume' : 'Pause' }}
                                </button>
                                <button class="btn btn-sm btn-danger-ghost" @click="removeMonitor(m)">Delete</button>
                            </div>
                        </article>
                    </div>
                    <div v-else class="empty">
                        <div class="empty-title">No monitors yet</div>
                        <div class="empty-sub">Click <strong>Add monitor</strong> to start probing AI Assessor services.</div>
                    </div>
                </section>

                <div v-if="error" class="alert alert-error toast">{{ error }}</div>
                <div v-if="success" class="alert alert-success toast">{{ success }}</div>
            </main>

            <footer class="footer">
                <span>
                    AI Assessor Inc. &middot; status.aiassessor.ca &middot;
                    SLA target 99.9% &middot;
                    <a href="https://www.aiassessor.ca" target="_blank" rel="noopener">aiassessor.ca</a>
                </span>
            </footer>
        </div>

        <!-- LOADING -->
        <div v-else class="auth-screen">
            <div class="auth-card center">
                <div class="brand">
                    <div class="brand-mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2v20" />
                            <path d="M2 12h20" />
                            <circle cx="12" cy="12" r="9" />
                        </svg>
                    </div>
                    <div class="brand-text">
                        <span class="brand-name">AI Assessor</span>
                        <span class="brand-sub">System Status</span>
                    </div>
                </div>
                <p class="auth-lead" style="margin-top: 1.5rem;">Loading control panel&hellip;</p>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const api = axios.create({ withCredentials: true });

export default {
    name: 'App',
    data() {
        return {
            view: 'loading',
            loading: false,
            error: '',
            success: '',
            adminName: '',
            form: { username: '', password: '' },
            monitors: [],
            counts: { up: 0, down: 0, degraded: 0, paused: 0 },
            addOpen: false,
            editingId: null,
            draft: this.emptyDraft(),
            lastRefresh: null,
            year: new Date().getFullYear(),
            pollHandle: null
        };
    },
    computed: {
        overallStatus() {
            if (this.counts.down > 0) return 'down';
            if (this.counts.degraded > 0) return 'degraded';
            if (this.counts.up === 0 && this.monitors.length > 0) return 'paused';
            return 'up';
        },
        overallHeadline() {
            if (this.overallStatus === 'down') return 'Some systems are offline';
            if (this.overallStatus === 'degraded') return 'Some systems are degraded';
            if (this.overallStatus === 'paused') return 'All monitors paused';
            return 'All systems operational';
        },
        lastRefreshLabel() {
            if (!this.lastRefresh) return '—';
            return dayjs(this.lastRefresh).fromNow();
        }
    },
    async mounted() {
        await this.bootstrap();
    },
    beforeUnmount() {
        if (this.pollHandle) clearInterval(this.pollHandle);
    },
    methods: {
        emptyDraft() {
            return {
                name: '',
                target: '',
                type: 'HTTP',
                interval_seconds: 60,
                paused: false
            };
        },
        async bootstrap() {
            try {
                const res = await api.get('/api/session');
                if (res.data && res.data.authenticated) {
                    await this.loadDashboard();
                    this.startPolling();
                    this.view = 'dashboard';
                } else {
                    this.view = 'login';
                }
            } catch (err) {
                this.view = 'login';
            }
        },
        async login() {
            this.error = '';
            this.success = '';
            this.loading = true;
            try {
                await api.post('/api/login', this.form);
                this.success = 'Signed in.';
                this.form.password = '';
                await this.loadDashboard();
                this.startPolling();
                this.view = 'dashboard';
            } catch (err) {
                this.error = this.errMsg(err) || 'Invalid credentials.';
            } finally {
                this.loading = false;
            }
        },
        async logout() {
            this.loading = true;
            try {
                await api.post('/api/logout');
            } catch (e) { /* ignore */ }
            this.stopPolling();
            this.adminName = '';
            this.monitors = [];
            this.counts = { up: 0, down: 0, degraded: 0, paused: 0 };
            this.form = { username: '', password: '' };
            this.view = 'login';
            this.success = 'Signed out.';
            this.loading = false;
        },
        async loadDashboard() {
            try {
                const [adminRes, dashRes] = await Promise.all([
                    api.get('/api/admin'),
                    api.get('/api/dashboard')
                ]);
                this.adminName = adminRes.data.username || 'admin';
                this.monitors = dashRes.data.monitors || [];
                this.counts = dashRes.data.status || this.counts;
                this.lastRefresh = new Date();
            } catch (err) {
                if (err.response && err.response.status === 401) {
                    this.view = 'login';
                    return;
                }
                this.error = this.errMsg(err) || 'Failed to load dashboard.';
            }
        },
        startPolling() {
            this.stopPolling();
            this.pollHandle = setInterval(() => {
                if (this.view === 'dashboard') this.loadDashboard();
            }, 30000);
        },
        stopPolling() {
            if (this.pollHandle) {
                clearInterval(this.pollHandle);
                this.pollHandle = null;
            }
        },
        cardStatus(m) {
            if (m.paused) return 'paused';
            const s = (m.last_status || '').toLowerCase();
            if (s === 'up' || s === 'online' || s === 'ok') return 'up';
            if (s === 'degraded' || s === 'warn') return 'degraded';
            if (s === 'down' || s === 'offline' || s === 'error') return 'down';
            return 'unknown';
        },
        statusLabel(m) {
            if (m.paused) return 'Paused';
            const s = this.cardStatus(m);
            if (s === 'up') return 'Operational';
            if (s === 'degraded') return 'Degraded';
            if (s === 'down') return 'Offline';
            return 'Pending';
        },
        formatRelative(ts) {
            if (!ts) return '—';
            return dayjs(ts).fromNow();
        },
        openAdd() {
            this.editingId = null;
            this.draft = this.emptyDraft();
            this.addOpen = true;
        },
        openEdit(m) {
            this.editingId = m.id;
            this.draft = {
                name: m.name,
                target: m.target,
                type: m.type || 'HTTP',
                interval_seconds: m.interval_seconds || 60,
                paused: !!m.paused
            };
            this.addOpen = true;
        },
        closeForm() {
            this.addOpen = false;
            this.editingId = null;
            this.draft = this.emptyDraft();
        },
        async submitMonitor() {
            this.error = '';
            this.success = '';
            this.loading = true;
            try {
                if (this.editingId) {
                    await api.put(`/api/monitors/${encodeURIComponent(this.editingId)}`, this.draft);
                    this.success = 'Monitor updated.';
                } else {
                    await api.post('/api/monitors', this.draft);
                    this.success = 'Monitor created.';
                }
                this.closeForm();
                await this.loadDashboard();
            } catch (err) {
                this.error = this.errMsg(err) || 'Failed to save monitor.';
            } finally {
                this.loading = false;
            }
        },
        async togglePause(m) {
            this.loading = true;
            try {
                await api.put(`/api/monitors/${encodeURIComponent(m.id)}`, { ...m, paused: !m.paused });
                await this.loadDashboard();
            } catch (err) {
                this.error = this.errMsg(err) || 'Failed to update monitor.';
            } finally {
                this.loading = false;
            }
        },
        async removeMonitor(m) {
            if (!confirm(`Delete monitor "${m.name}"? This cannot be undone.`)) return;
            this.loading = true;
            try {
                await api.delete(`/api/monitors/${encodeURIComponent(m.id)}`);
                this.success = 'Monitor deleted.';
                await this.loadDashboard();
            } catch (err) {
                this.error = this.errMsg(err) || 'Failed to delete monitor.';
            } finally {
                this.loading = false;
            }
        },
        errMsg(err) {
            if (err && err.response && err.response.data) {
                return err.response.data.error || err.response.data.message || '';
            }
            return err && err.message ? err.message : '';
        }
    }
};
</script>

<style>
:root {
    --aa-green: #16a34a;
    --aa-green-600: #15803d;
    --aa-green-700: #166534;
    --aa-green-50: #f0fdf4;
    --aa-green-100: #dcfce7;
    --aa-amber: #f59e0b;
    --aa-amber-50: #fffbeb;
    --aa-red: #dc2626;
    --aa-red-50: #fef2f2;
    --aa-gray-50: #f8fafc;
    --aa-gray-100: #f1f5f9;
    --aa-gray-200: #e2e8f0;
    --aa-gray-300: #cbd5e1;
    --aa-gray-500: #64748b;
    --aa-gray-700: #334155;
    --aa-gray-900: #0f172a;
    --aa-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
    --aa-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
    --aa-radius: 12px;
}

* { box-sizing: border-box; }

html, body, #app {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background: var(--aa-gray-50);
    color: var(--aa-gray-900);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
}

a { color: var(--aa-green-600); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ───────── Brand ───────── */
.brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
.brand-compact { gap: 0.6rem; }
.brand-mark {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--aa-green);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
}
.brand-compact .brand-mark { width: 36px; height: 36px; border-radius: 10px; }
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-name { font-weight: 700; font-size: 1.05rem; color: var(--aa-gray-900); }
.brand-sub { font-size: 0.78rem; color: var(--aa-gray-500); letter-spacing: 0.04em; text-transform: uppercase; }

/* ───────── Auth screen ───────── */
.auth-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background:
        radial-gradient(circle at 20% 0%, rgba(22, 163, 74, 0.10), transparent 60%),
        radial-gradient(circle at 80% 100%, rgba(22, 163, 74, 0.08), transparent 60%),
        var(--aa-gray-50);
}
.auth-card {
    width: 100%;
    max-width: 420px;
    background: white;
    border: 1px solid var(--aa-gray-200);
    border-radius: var(--aa-radius);
    box-shadow: var(--aa-shadow);
    padding: 2rem;
}
.auth-card.center { text-align: center; }
.auth-title { margin: 1.25rem 0 0.25rem; font-size: 1.35rem; }
.auth-lead { margin: 0 0 1.25rem; color: var(--aa-gray-500); font-size: 0.9rem; }
.auth-form { display: flex; flex-direction: column; gap: 0.9rem; }
.auth-footer { margin-top: 1.25rem; color: var(--aa-gray-500); font-size: 0.8rem; }

/* ───────── Forms ───────── */
.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
.form-group label { font-size: 0.8rem; font-weight: 600; color: var(--aa-gray-700); }
.form-group input,
.form-group select {
    padding: 0.65rem 0.8rem;
    border: 1px solid var(--aa-gray-300);
    border-radius: 8px;
    font-size: 0.95rem;
    background: white;
    color: var(--aa-gray-900);
    transition: border-color 0.15s, box-shadow 0.15s;
}
.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--aa-green);
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

/* ───────── Buttons ───────── */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    background: white;
    color: var(--aa-gray-900);
    line-height: 1;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-block { width: 100%; padding: 0.7rem 1rem; }
.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }
.btn-primary {
    background: var(--aa-green);
    color: white;
    border-color: var(--aa-green);
}
.btn-primary:hover:not(:disabled) { background: var(--aa-green-600); border-color: var(--aa-green-600); }
.btn-ghost {
    background: white;
    color: var(--aa-gray-700);
    border-color: var(--aa-gray-200);
}
.btn-ghost:hover:not(:disabled) { background: var(--aa-gray-100); }
.btn-danger-ghost {
    background: white;
    color: var(--aa-red);
    border-color: var(--aa-gray-200);
}
.btn-danger-ghost:hover:not(:disabled) { background: var(--aa-red-50); border-color: var(--aa-red); }

/* ───────── Alerts ───────── */
.alert {
    margin-top: 1rem;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    font-size: 0.88rem;
}
.alert-error { background: var(--aa-red-50); color: #991b1b; border: 1px solid #fecaca; }
.alert-success { background: var(--aa-green-50); color: var(--aa-green-700); border: 1px solid var(--aa-green-100); }
.toast {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 50;
    box-shadow: var(--aa-shadow);
    max-width: 360px;
}

/* ───────── Dashboard ───────── */
.dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--aa-gray-50);
}
.topbar {
    background: white;
    border-bottom: 1px solid var(--aa-gray-200);
    box-shadow: var(--aa-shadow-sm);
    position: sticky;
    top: 0;
    z-index: 10;
}
.topbar-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.9rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}
.topbar-actions { display: flex; align-items: center; gap: 0.85rem; }
.who { color: var(--aa-gray-500); font-size: 0.85rem; }
.who strong { color: var(--aa-gray-900); }

.content {
    flex: 1;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ───────── Summary banner ───────── */
.summary {
    background: white;
    border-radius: var(--aa-radius);
    border: 1px solid var(--aa-gray-200);
    padding: 1.1rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: var(--aa-shadow-sm);
    border-left: 5px solid var(--aa-green);
}
.summary-up { border-left-color: var(--aa-green); }
.summary-degraded { border-left-color: var(--aa-amber); }
.summary-down { border-left-color: var(--aa-red); }
.summary-paused { border-left-color: var(--aa-gray-300); }

.summary-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--aa-green-100);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
}
.summary-degraded .summary-icon { background: var(--aa-amber-50); }
.summary-down .summary-icon { background: var(--aa-red-50); }

.pulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--aa-green);
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6);
    animation: pulse 2s infinite;
}
.summary-degraded .pulse { background: var(--aa-amber); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
.summary-down .pulse { background: var(--aa-red); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
.summary-paused .pulse { background: var(--aa-gray-500); animation: none; }

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6); }
    70% { box-shadow: 0 0 0 14px rgba(22, 163, 74, 0); }
    100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}

.summary-text { flex: 1; }
.summary-headline { font-size: 1.1rem; font-weight: 700; color: var(--aa-gray-900); }
.summary-sub { font-size: 0.85rem; color: var(--aa-gray-500); margin-top: 0.15rem; }
.summary-meta { text-align: right; }
.meta-label { display: block; font-size: 0.72rem; color: var(--aa-gray-500); text-transform: uppercase; letter-spacing: 0.04em; }
.meta-value { display: block; font-size: 0.9rem; color: var(--aa-gray-700); margin-top: 0.15rem; }

/* ───────── Panel ───────── */
.panel {
    background: white;
    border-radius: var(--aa-radius);
    border: 1px solid var(--aa-gray-200);
    padding: 1.25rem;
    box-shadow: var(--aa-shadow-sm);
}
.panel-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
}
.panel-title { margin: 0; font-size: 1.1rem; }
.panel-sub { margin: 0.2rem 0 0; color: var(--aa-gray-500); font-size: 0.85rem; }

/* ───────── Monitor form ───────── */
.monitor-form {
    background: var(--aa-gray-50);
    border: 1px solid var(--aa-gray-200);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    margin-bottom: 1rem;
}
.monitor-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
}
.form-wide { grid-column: 1 / -1; }
.monitor-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
}

/* ───────── Monitor cards ───────── */
.monitor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 0.95rem;
}
.monitor-card {
    background: white;
    border: 1px solid var(--aa-gray-200);
    border-radius: 10px;
    padding: 1rem 1.1rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    transition: transform 0.12s, box-shadow 0.12s;
    border-top: 3px solid var(--aa-gray-300);
}
.monitor-card:hover { transform: translateY(-1px); box-shadow: var(--aa-shadow); }
.monitor-card.status-up { border-top-color: var(--aa-green); }
.monitor-card.status-degraded { border-top-color: var(--aa-amber); }
.monitor-card.status-down { border-top-color: var(--aa-red); }
.monitor-card.status-paused { border-top-color: var(--aa-gray-300); opacity: 0.85; }
.monitor-card.status-unknown { border-top-color: var(--aa-gray-300); }

.monitor-head { display: flex; justify-content: space-between; align-items: center; }

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.pill-up { background: var(--aa-green-100); color: var(--aa-green-700); }
.pill-degraded { background: var(--aa-amber-50); color: #92400e; }
.pill-down { background: var(--aa-red-50); color: #991b1b; }
.pill-paused { background: var(--aa-gray-100); color: var(--aa-gray-700); }
.pill-unknown { background: var(--aa-gray-100); color: var(--aa-gray-500); }
.status-pill .dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: currentColor;
}

.type-pill {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--aa-gray-500);
    background: var(--aa-gray-100);
    padding: 0.18rem 0.5rem;
    border-radius: 6px;
    letter-spacing: 0.04em;
}

.monitor-name { margin: 0; font-size: 1rem; font-weight: 700; color: var(--aa-gray-900); }
.monitor-target {
    font-size: 0.83rem;
    color: var(--aa-gray-500);
    word-break: break-all;
}

.monitor-stats {
    display: flex;
    gap: 1rem;
    border-top: 1px solid var(--aa-gray-100);
    padding-top: 0.65rem;
    margin-top: 0.25rem;
}
.stat { display: flex; flex-direction: column; gap: 0.1rem; }
.stat-label { font-size: 0.68rem; color: var(--aa-gray-500); text-transform: uppercase; letter-spacing: 0.04em; }
.stat-value { font-size: 0.85rem; font-weight: 600; color: var(--aa-gray-700); }

.monitor-actions {
    display: flex;
    gap: 0.4rem;
    justify-content: flex-end;
    border-top: 1px solid var(--aa-gray-100);
    padding-top: 0.65rem;
    margin-top: 0.1rem;
    flex-wrap: wrap;
}

/* ───────── Empty + footer ───────── */
.empty {
    text-align: center;
    padding: 2rem 1rem;
    border: 1px dashed var(--aa-gray-300);
    border-radius: 10px;
    background: var(--aa-gray-50);
}
.empty-title { font-weight: 700; color: var(--aa-gray-700); }
.empty-sub { color: var(--aa-gray-500); font-size: 0.88rem; margin-top: 0.25rem; }

.footer {
    text-align: center;
    color: var(--aa-gray-500);
    font-size: 0.78rem;
    padding: 1rem;
    border-top: 1px solid var(--aa-gray-200);
    background: white;
}

/* ───────── Responsive ───────── */
@media (max-width: 640px) {
    .summary { flex-direction: column; align-items: flex-start; }
    .summary-meta { text-align: left; }
    .monitor-form-grid { grid-template-columns: 1fr; }
    .topbar-inner { flex-wrap: wrap; }
    .who { display: none; }
}
</style>
