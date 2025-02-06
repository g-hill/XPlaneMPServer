const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// In-memory storage for connected users
let connectedUsers = new Map();

// Endpoint for user connection
app.post('/connect', (req, res) => {
    const { username, ipAddress } = req.body;
    if (!username || !ipAddress) {
        return res.status(400).json({ error: 'Username and IP address are required' });
    }

    connectedUsers.set(username, ipAddress);
    console.log(`User ${username} connected with IP ${ipAddress}`);
    res.json({ message: 'Connected successfully', users: Array.from(connectedUsers.keys()) });
});

// Endpoint to get all connected users
app.get('/users', (req, res) => {
    res.json(Array.from(connectedUsers.keys()));
});

// Endpoint to request a connection with another user
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

// Start the server
app.listen(port, () => {
    console.log(`X-Plane 12 Bridge Server running on port ${port}`);
});