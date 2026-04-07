const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();
const port = parseInt(process.env.PORT, 10) || 3001;
const host = '0.0.0.0';
const adminFile = path.join(__dirname, 'admin.json');
const monitorsFile = path.join(__dirname, 'monitors.json');

function isAdminCreated() {
  return fs.existsSync(adminFile);
}

function getAdmin() {
  if (!isAdminCreated()) return null;
  try {
    return JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
  } catch (error) {
    console.error('Failed to read admin file:', error);
    return null;
  }
}

function loadMonitors() {
  if (!fs.existsSync(monitorsFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(monitorsFile, 'utf-8')) || [];
  } catch (error) {
    console.error('Failed to read monitors file:', error);
    return [];
  }
}

function saveMonitors(monitors) {
  try {
    fs.writeFileSync(monitorsFile, JSON.stringify(monitors, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write monitors file:', error);
    return false;
  }
}

async function performMonitorCheck(monitor) {
  const result = {
    ...monitor,
    status: 'offline',
    responseTimeMs: null,
    lastChecked: new Date().toISOString(),
    paused: monitor.paused === true
  };

  if (result.paused) {
    result.status = 'paused';
    return result;
  }

  if (monitor.type === 'HTTP') {
    const start = Date.now();

    try {
      const response = await axios.get(monitor.target, {
        timeout: 8000,
        validateStatus: () => true
      });
      result.responseTimeMs = Date.now() - start;
      result.status = response.status >= 200 && response.status < 400 ? 'online' : 'offline';
    } catch (error) {
      result.responseTimeMs = Date.now() - start;
      result.status = 'offline';
    }
  } else if (monitor.type === 'TLS') {
    const target = monitor.target.startsWith('http') ? monitor.target : `https://${monitor.target}`;
    const start = Date.now();

    try {
      const response = await axios.get(target, {
        timeout: 8000,
        validateStatus: () => true
      });
      result.responseTimeMs = Date.now() - start;
      result.status = response.status >= 200 && response.status < 400 ? 'online' : 'offline';
    } catch (error) {
      result.responseTimeMs = Date.now() - start;
      result.status = 'offline';
    }
  } else if (monitor.type === 'Database') {
    try {
      fs.accessSync(monitor.target, fs.constants.R_OK);
      result.status = 'online';
      result.responseTimeMs = 0;
    } catch (error) {
      result.status = 'degraded';
      result.responseTimeMs = null;
    }
  } else {
    result.responseTimeMs = null;
    result.status = 'offline';
  }

  return result;
}

app.use(express.json());

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// API endpoint for creating first admin
app.post('/api/admin/create', (req, res) => {
  const { username, password } = req.body;

  if (isAdminCreated()) {
    return res.status(400).json({ error: 'Admin account already exists' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    fs.writeFileSync(adminFile, JSON.stringify({ username, password }, null, 2), 'utf-8');
    return res.json({ success: true, message: 'Admin created successfully', username });
  } catch (error) {
    console.error('Failed to create admin:', error);
    return res.status(500).json({ error: 'Failed to create admin account' });
  }
});

app.get('/api/admin/exists', (req, res) => {
  res.json({ exists: isAdminCreated() });
});

app.get('/api/admin', (req, res) => {
  const admin = getAdmin();
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  res.json({ username: admin.username });
});

app.get('/api/dashboard', async (req, res) => {
  const admin = getAdmin();
  const rawMonitors = loadMonitors();
  const checks = await Promise.all(rawMonitors.map(performMonitorCheck));
  const activeChecks = checks.filter((item) => item.status === 'online' || item.status === 'degraded').length;
  const alerts = checks.filter((item) => item.status !== 'online' && item.status !== 'paused').length;
  const pausedCount = checks.filter((item) => item.status === 'paused').length;

  res.json({
    status: 'online',
    uptimeSeconds: Math.floor(process.uptime()),
    adminUser: admin?.username || null,
    nodeVersion: process.version,
    platform: process.platform,
    monitoredServices: checks.length,
    activeChecks,
    alerts,
    pausedMonitors: pausedCount,
    lastUpdated: new Date().toISOString()
  });
});

app.get('/api/monitors', async (req, res) => {
  const rawMonitors = loadMonitors();
  const monitors = await Promise.all(rawMonitors.map(performMonitorCheck));
  res.json({ monitors });
});

app.post('/api/monitors', async (req, res) => {
  const { name, target, type } = req.body;

  if (!name || !target || !type) {
    return res.status(400).json({ error: 'Name, target, and type are required' });
  }

  const validTypes = ['HTTP', 'TLS', 'Database'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Type must be one of HTTP, TLS, Database' });
  }

  const monitors = loadMonitors();
  const id = `monitor-${Date.now()}`;
  const monitor = {
    id,
    name,
    target,
    type,
    paused: false,
    status: 'pending',
    responseTimeMs: null,
    lastChecked: new Date().toISOString()
  };

  const checkedMonitor = await performMonitorCheck(monitor);
  monitors.unshift(checkedMonitor);

  if (!saveMonitors(monitors)) {
    return res.status(500).json({ error: 'Failed to save monitor' });
  }

  res.json({ monitor: checkedMonitor });
});

app.put('/api/monitors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, target, type, paused } = req.body;
  const validTypes = ['HTTP', 'TLS', 'Database'];

  if (!name || !target || !type) {
    return res.status(400).json({ error: 'Name, target, and type are required' });
  }

  if (paused !== undefined && typeof paused !== 'boolean') {
    return res.status(400).json({ error: 'Paused must be true or false' });
  }

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Type must be one of HTTP, TLS, Database' });
  }

  const monitors = loadMonitors();
  const index = monitors.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Monitor not found' });
  }

  monitors[index] = {
    ...monitors[index],
    name,
    target,
    type,
    paused: paused === true
  };

  const updatedMonitor = await performMonitorCheck(monitors[index]);
  monitors[index] = updatedMonitor;

  if (!saveMonitors(monitors)) {
    return res.status(500).json({ error: 'Failed to save monitor' });
  }

  res.json({ monitor: updatedMonitor });
});

app.delete('/api/monitors/:id', (req, res) => {
  const { id } = req.params;
  const monitors = loadMonitors();
  const index = monitors.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Monitor not found' });
  }

  monitors.splice(index, 1);

  if (!saveMonitors(monitors)) {
    return res.status(500).json({ error: 'Failed to delete monitor' });
  }

  res.json({ success: true });
});

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'running' });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, host, () => {
  console.log(`Server running on port ${port}`);
});
