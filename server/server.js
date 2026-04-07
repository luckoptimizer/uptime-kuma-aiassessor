const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = parseInt(process.env.PORT, 10) || 3001;
const host = '0.0.0.0';
const adminFile = path.join(__dirname, 'admin.json');

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

app.get('/api/dashboard', (req, res) => {
  const admin = getAdmin();
  res.json({
    status: 'online',
    uptimeSeconds: Math.floor(process.uptime()),
    adminUser: admin?.username || null,
    nodeVersion: process.version,
    platform: process.platform,
    monitoredServices: 0,
    activeChecks: 0,
    alerts: 0,
    lastUpdated: new Date().toISOString()
  });
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
