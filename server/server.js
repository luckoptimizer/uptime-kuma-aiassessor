const express = require('express');
const path = require('path');
const app = express();
const port = parseInt(process.env.PORT, 10) || 3001;
const host = '0.0.0.0';

app.use(express.json());

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// API endpoint for creating first admin
app.post('/api/admin/create', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // TODO: Add database logic to create admin user
  res.json({ success: true, message: 'Admin created successfully' });
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
