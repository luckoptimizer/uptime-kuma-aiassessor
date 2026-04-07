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
            <h1>{{ adminName ? 'Welcome back, ' + adminName + '!' : 'Welcome to Uptime Kuma AI Assessor' }}</h1>
            <p>Your admin account is configured successfully.</p>
            <p>Dashboard functionality will be added soon.</p>
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
            loading: false,
            error: '',
            success: '',
            form: {
                username: '',
                password: ''
            }
        };
    },
    mounted() {
        this.checkAdminExists();
    },
    methods: {
        async checkAdminExists() {
            try {
                const response = await axios.get('/api/admin/exists');
                this.adminExists = response.data.exists;

                if (this.adminExists) {
                    await this.loadAdminInfo();
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
            } catch (error) {
                this.error = error.response?.data?.error || 'Error creating admin account';
            } finally {
                this.loading = false;
            }
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