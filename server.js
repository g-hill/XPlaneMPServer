const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();

// Use environment variable for port, defaulting to 3000
const port = process.env.PORT || 3000;
const ip = '192.168.86.44';  // Replace with your actual local IP
app.listen(port, ip, () => {
    console.log(`Server running at http://${ip}:${port}/`);
});

// Middleware
app.use(bodyParser.json());

// In-memory storage for connected users
let connectedUsers = new Map();

// Basic rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_INTERVAL = 60000; // 1 minute in milliseconds

function rateLimiter(req, res, next) {
    const ip = req.ip;
    const currentTime = Date.now();
    const userRequests = requestCounts.get(ip) || [];
    const recentRequests = userRequests.filter(time => currentTime - time < RATE_INTERVAL);

    if (recentRequests.length >= RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    recentRequests.push(currentTime);
    requestCounts.set(ip, recentRequests);
    next();
}

app.use(rateLimiter);

// Existing endpoints...
app.post('/connect', (req, res) => {
    const { username, ipAddress } = req.body;
    if (!username || !ipAddress) {
        return res.status(400).json({ error: 'Username and IP address are required' });
    }

    connectedUsers.set(username, ipAddress);
    console.log(`User ${username} connected with IP ${ipAddress}`);
    res.json({ message: 'Connected successfully', users: Array.from(connectedUsers.keys()) });
});

app.get('/users', (req, res) => {
    res.json(Array.from(connectedUsers.keys()));
});

app.post('/request-connection', (req, res) => {
    const { requester, target } = req.body;
    if (!requester || !target) {
        return res.status(400).json({ error: 'Requester and target usernames are required' });
    }

    if (!connectedUsers.has(target)) {
        return res.status(404).json({ error: 'Target user not found' });
    }

    const targetIP = connectedUsers.get(target);
    res.json({ message: 'Connection info retrieved', targetIP });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', connectedUsers: connectedUsers.size });
});

// For HTTP
app.listen(port, () => {
    console.log(`X-Plane 12 Bridge Server running on port ${port}`);
});

// For HTTPS (uncomment and configure when you have SSL certificates)
/*
const httpsOptions = {
    key: fs.readFileSync('/path/to/private/key.pem'),
    cert: fs.readFileSync('/path/to/certificate.pem')
};

https.createServer(httpsOptions, app).listen(443, () => {
    console.log('HTTPS Server running on port 443');
});
*/