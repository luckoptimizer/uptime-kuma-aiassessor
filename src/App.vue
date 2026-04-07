<template>
    <div id="app">
        <div v-if="!adminExists" class="admin-setup">
            <div class="container">
                <h1>Uptime Kuma AI Assessor</h1>
                <h2>Create First Admin Account</h2>
                <form @submit.prevent="createAdmin">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input 
                            v-model="form.username" 
                            type="text" 
                            id="username" 
                            required 
                            placeholder="Enter admin username"
                        />
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input 
                            v-model="form.password" 
                            type="password" 
                            id="password" 
                            required 
                            placeholder="Enter admin password"
                        />
                    </div>
                    <button type="submit" :disabled="loading">
                        {{ loading ? 'Creating...' : 'Create Admin' }}
                    </button>
                </form>
                <div v-if="error" class="error">{{ error }}</div>
                <div v-if="success" class="success">{{ success }}</div>
            </div>
        </div>
        <div v-else class="dashboard">
            <div class="dashboard-header">
                <div>
                    <h1>{{ adminName ? 'Welcome back, ' + adminName + '!' : 'Welcome to Uptime Kuma AI Assessor' }}</h1>
                    <p>Your admin account is configured successfully.</p>
                </div>
                <div class="status-pill" :class="dashboardStats?.status === 'online' ? 'online' : 'offline'">
                    {{ dashboardStats ? dashboardStats.status.toUpperCase() : 'LOADING' }}
                </div>
            </div>

                <div v-if="failingMonitorCount > 0" class="notification-banner">
                    <strong>Warning:</strong> {{ failingMonitorCount }} failing monitor(s) detected. Review the monitor list below.
                </div>

            <div v-if="dashboardLoading" class="dashboard-loading">Loading dashboard...</div>
            <div v-else class="dashboard-grid">
                <div class="card">
                    <h2>System Uptime</h2>
                    <p>{{ formatUptime(dashboardStats.uptimeSeconds) }}</p>
                </div>
                <div class="card">
                    <h2>Active Checks</h2>
                    <p>{{ dashboardStats.activeChecks }}</p>
                </div>
                <div class="card">
                    <h2>Monitored Services</h2>
                    <p>{{ dashboardStats.monitoredServices }}</p>
                </div>
                <div class="card">
                    <h2>Current Alerts</h2>
                    <p>{{ dashboardStats.alerts }}</p>
                </div>
                <div class="card wide-card">
                    <h2>Environment</h2>
                    <p>Node {{ dashboardStats.nodeVersion }}</p>
                    <p>{{ dashboardStats.platform }}</p>
                </div>
                <div class="card wide-card">
                    <h2>Last Updated</h2>
                    <p>{{ dashboardStats.lastUpdated }}</p>
                </div>
            </div>

            <div class="monitor-section">
                <div class="monitor-form-card">
                    <h2>Create Monitor</h2>
                    <form @submit.prevent="createMonitor">
                        <div class="form-group">
                            <label for="monitor-name">Monitor Name</label>
                            <input id="monitor-name" v-model="newMonitor.name" type="text" required placeholder="API Health Check" />
                        </div>
                        <div class="form-group">
                            <label for="monitor-target">Target URL / Host</label>
                            <input id="monitor-target" v-model="newMonitor.target" type="text" required placeholder="https://example.com" />
                        </div>
                        <div class="form-group">
                            <label for="monitor-type">Type</label>
                            <select id="monitor-type" v-model="newMonitor.type" required>
                                <option value="HTTP">HTTP</option>
                                <option value="TLS">TLS</option>
                                <option value="Database">Database</option>
                            </select>
                        </div>
                        <button type="submit" :disabled="monitorLoading">
                            {{ monitorLoading ? 'Adding Monitor...' : 'Add Monitor' }}
                        </button>
                        <div v-if="monitorError" class="error">{{ monitorError }}</div>
                        <div v-if="monitorSuccess" class="success">{{ monitorSuccess }}</div>
                    </form>
                </div>

                <h2>Monitor List</h2>
                <div class="monitor-grid">
                    <div v-for="monitor in monitorList" :key="monitor.id" class="monitor-card" :class="{ editing: monitor.isEditing }">
                        <template v-if="monitor.isEditing">
                            <div class="monitor-card-header">
                                <div class="monitor-name">Edit Monitor</div>
                            </div>
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" v-model="monitor.editName" />
                            </div>
                            <div class="form-group">
                                <label>Target</label>
                                <input type="text" v-model="monitor.editTarget" />
                            </div>
                            <div class="form-group">
                                <label>Type</label>
                                <select v-model="monitor.editType">
                                    <option value="HTTP">HTTP</option>
                                    <option value="TLS">TLS</option>
                                    <option value="Database">Database</option>
                                </select>
                            </div>
                            <div class="monitor-card-actions">
                                <button type="button" class="secondary" @click="saveMonitor(monitor)" :disabled="monitorLoading">Save</button>
                                <button type="button" @click="toggleEditMonitor(monitor)">Cancel</button>
                            </div>
                        </template>
                        <template v-else>
                            <div class="monitor-card-header">
                                <div class="monitor-name">{{ monitor.name }}</div>
                                <div class="monitor-status" :class="monitor.status">
                                    {{ monitor.status.toUpperCase() }}
                                </div>
                            </div>
                            <div class="monitor-target">{{ monitor.target }}</div>
                            <div class="monitor-meta">
                                <span>{{ monitor.type }}</span>
                                <span>{{ monitor.responseTimeMs !== null ? monitor.responseTimeMs + ' ms' : 'N/A' }}</span>
                                <span>{{ formatRelative(monitor.lastChecked) }}</span>
                            </div>
                            <div class="monitor-card-actions">
                                <button type="button" class="secondary" @click="toggleEditMonitor(monitor)">Edit</button>
                                <button type="button" class="secondary" @click="togglePauseMonitor(monitor)" :disabled="monitorLoading">
                                    {{ monitor.paused ? 'Resume' : 'Pause' }}
                                </button>
                                <button type="button" class="secondary" @click="togglePauseMonitor(monitor)" :disabled="monitorLoading">
                                    {{ monitor.paused ? 'Resume' : 'Pause' }}
                                </button>
                                <button type="button" class="danger" @click="deleteMonitor(monitor)">Delete</button>
                            </div>
                        </template>
                    </div>
                    <div v-if="!dashboardLoading && monitorList.length === 0" class="monitor-empty">
                        No monitors available yet.
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    name: 'App',
    data() {
        return {
            adminExists: false,
            adminName: '',
            dashboardStats: null,
            monitorList: [],
            dashboardLoading: false,
            loading: false,
            monitorLoading: false,
            error: '',
            success: '',
            monitorError: '',
            monitorSuccess: '',
            refreshIntervalId: null,
            newMonitor: {
                name: '',
                target: '',
                type: 'HTTP'
            },
            form: {
                username: '',
                password: ''
            }
        };
    },
    mounted() {
        this.checkAdminExists();
        this.startRefreshTimer();
    },
    beforeUnmount() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
        }
    },
    computed: {
        failingMonitorCount() {
            return this.monitorList.filter((m) => m.status === 'offline' || m.status === 'degraded').length;
        }
    },
    methods: {
        async checkAdminExists() {
            try {
                const response = await axios.get('/api/admin/exists');
                this.adminExists = response.data.exists;

                if (this.adminExists) {
                    await this.loadAdminInfo();
                    await this.loadDashboardStats();
                    await this.loadMonitorList();
                }
            } catch (e) {
                console.error('Error checking admin status:', e);
                this.adminExists = false;
            }
        },
        async loadAdminInfo() {
            try {
                const response = await axios.get('/api/admin');
                this.adminName = response.data.username || '';
            } catch (e) {
                console.error('Error loading admin info:', e);
            }
        },
        async loadDashboardStats() {
            this.dashboardLoading = true;
            try {
                const response = await axios.get('/api/dashboard');
                this.dashboardStats = response.data;
            } catch (e) {
                console.error('Error loading dashboard:', e);
                this.dashboardStats = {
                    status: 'offline',
                    uptimeSeconds: 0,
                    activeChecks: 0,
                    monitoredServices: 0,
                    alerts: 0,
                    nodeVersion: '',
                    platform: '',
                    lastUpdated: ''
                };
            } finally {
                this.dashboardLoading = false;
            }
        },
        async loadMonitorList() {
            try {
                const response = await axios.get('/api/monitors');
                this.monitorList = (response.data.monitors || []).map((monitor) => ({
                    ...monitor,
                    paused: monitor.paused === true,
                    isEditing: false,
                    editName: monitor.name,
                    editTarget: monitor.target,
                    editType: monitor.type
                }));
            } catch (e) {
                console.error('Error loading monitor list:', e);
                this.monitorList = [];
            }
        },
        async createAdmin() {
            this.loading = true;
            this.error = '';
            this.success = '';
            
            try {
                const response = await axios.post('/api/admin/create', {
                    username: this.form.username,
                    password: this.form.password
                });
                
                this.success = 'Admin account created successfully!';
                this.form.username = '';
                this.form.password = '';
                this.adminExists = true;
                this.adminName = response.data.username || '';
                await this.loadDashboardStats();
                await this.loadMonitorList();
            } catch (error) {
                this.error = error.response?.data?.error || 'Error creating admin account';
            } finally {
                this.loading = false;
            }
        },
        async createMonitor() {
            this.monitorLoading = true;
            this.monitorError = '';
            this.monitorSuccess = '';

            try {
                await axios.post('/api/monitors', {
                    name: this.newMonitor.name,
                    target: this.newMonitor.target,
                    type: this.newMonitor.type
                });

                this.monitorSuccess = 'Monitor added successfully.';
                this.newMonitor = { name: '', target: '', type: 'HTTP' };
                await this.loadMonitorList();
                await this.loadDashboardStats();
            } catch (error) {
                this.monitorError = error.response?.data?.error || 'Error adding monitor';
            } finally {
                this.monitorLoading = false;
            }
        },
        async toggleEditMonitor(monitor) {
            monitor.isEditing = !monitor.isEditing;
            monitor.editName = monitor.name;
            monitor.editTarget = monitor.target;
            monitor.editType = monitor.type;
            this.monitorError = '';
            this.monitorSuccess = '';
        },
        async saveMonitor(monitor) {
            this.monitorLoading = true;
            this.monitorError = '';
            this.monitorSuccess = '';

            try {
                await axios.put(`/api/monitors/${monitor.id}`, {
                    name: monitor.editName,
                    target: monitor.editTarget,
                    type: monitor.editType
                });

                this.monitorSuccess = 'Monitor updated successfully.';
                await this.loadMonitorList();
                await this.loadDashboardStats();
            } catch (error) {
                this.monitorError = error.response?.data?.error || 'Error updating monitor';
            } finally {
                this.monitorLoading = false;
            }
        },
        async deleteMonitor(monitor) {
            if (!confirm(`Delete monitor '${monitor.name}'?`)) {
                return;
            }

            this.monitorLoading = true;
            this.monitorError = '';
            this.monitorSuccess = '';

            try {
                await axios.delete(`/api/monitors/${monitor.id}`);
                this.monitorSuccess = 'Monitor deleted successfully.';
                await this.loadMonitorList();
                await this.loadDashboardStats();
            } catch (error) {
                this.monitorError = error.response?.data?.error || 'Error deleting monitor';
            } finally {
                this.monitorLoading = false;
            }
        },
        async togglePauseMonitor(monitor) {
            this.monitorLoading = true;
            this.monitorError = '';
            this.monitorSuccess = '';

            try {
                await axios.put(`/api/monitors/${monitor.id}`, {
                    name: monitor.editName,
                    target: monitor.editTarget,
                    type: monitor.editType,
                    paused: !monitor.paused
                });

                this.monitorSuccess = monitor.paused ? 'Monitor resumed.' : 'Monitor paused.';
                await this.loadMonitorList();
                await this.loadDashboardStats();
            } catch (error) {
                this.monitorError = error.response?.data?.error || 'Error toggling pause';
            } finally {
                this.monitorLoading = false;
            }
        },
        async startRefreshTimer() {
            if (this.refreshIntervalId) {
                clearInterval(this.refreshIntervalId);
            }

            this.refreshIntervalId = setInterval(async () => {
                if (!this.adminExists) return;
                await this.loadDashboardStats();
                await this.loadMonitorList();
            }, 30000);
        },
        formatUptime(seconds) {
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hrs}h ${mins}m ${secs}s`;
        },
        formatRelative(timestamp) {
            if (!timestamp) return '';
            const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
            if (diff < 60) return 'just now';
            if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            return Math.floor(diff / 86400) + 'd ago';
        }
    }
};
</script>

<style>
body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
}

#app {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
}

h1 {
    margin-top: 0;
    text-align: center;
    color: #333;
}

h2 {
    text-align: center;
    color: #666;
    font-size: 1.2rem;
}

.form-group {
    margin-bottom: 1rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: bold;
}

input[type="text"],
input[type="password"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
}

input[type="text"]:focus,
input[type="password"]:focus {
    outline: none;
    border-color: #4CAF50;
    box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
}

button {
    width: 100%;
    padding: 0.75rem;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    font-weight: bold;
}

button:hover:not(:disabled) {
    background-color: #45a049;
}

button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.dashboard {
    width: 100%;
    max-width: 1000px;
    padding: 2rem;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
}

.status-pill {
    padding: 0.75rem 1rem;
    border-radius: 999px;
    font-weight: bold;
    color: white;
    min-width: 120px;
    text-align: center;
}

.status-pill.online {
    background-color: #2e7d32;
}

.status-pill.offline {
    background-color: #c62828;
}

.dashboard-loading {
    padding: 2rem;
    font-size: 1rem;
    color: #666;
    text-align: center;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
}

.card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
    text-align: left;
}

.card h2 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    color: #333;
}

.card p {
    margin: 0;
    font-size: 1.5rem;
    color: #111;
    word-break: break-word;
}

.wide-card {
    grid-column: span 2;
}

.monitor-section {
    margin-top: 2rem;
}

.monitor-form-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
}

.monitor-form-card h2 {
    margin-top: 0;
    margin-bottom: 1rem;
}

.monitor-form-card .form-group {
    margin-bottom: 1rem;
}

.monitor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
}

.monitor-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    padding: 1.25rem;
}

.monitor-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
}

.monitor-name {
    font-weight: 700;
    color: #333;
}

.monitor-status {
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
}

.monitor-status.online {
    background-color: #2e7d32;
}

.monitor-status.degraded {
    background-color: #f9a825;
}

.monitor-status.offline {
    background-color: #c62828;
}

.monitor-status.paused {
    background-color: #607d8b;
}

.monitor-target {
    margin-bottom: 0.75rem;
    color: #555;
    word-break: break-word;
}

.monitor-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    color: #666;
    font-size: 0.95rem;
}

.monitor-card-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.monitor-card-actions button {
    padding: 0.65rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: bold;
}

.monitor-card-actions .secondary {
    background: #eceff1;
    color: #333;
}

.monitor-card-actions .danger {
    background: #c62828;
    color: white;
}

.notification-banner {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
}

.monitor-card.editing {
    border: 1px solid #2196f3;
}

.notification-banner {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
}

.monitor-empty {
    grid-column: 1 / -1;
    padding: 1.5rem;
    background: #fcfcfc;
    border: 1px dashed #ddd;
    border-radius: 12px;
    text-align: center;
    color: #777;
}

.error {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: #ffebee;
    color: #c62828;
    border-radius: 4px;
    text-align: center;
}

.success {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: #e8f5e9;
    color: #2e7d32;
    border-radius: 4px;
    text-align: center;
}

.dashboard {
    text-align: center;
    color: #333;
}
</style>