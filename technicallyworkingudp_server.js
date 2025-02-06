const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const connectedClients = new Map();
const XPLANE_PORT = 49000;
const BIND_ADDRESS = '0.0.0.0';

function parseXPlaneData(msg) {
    // Log the first few bytes of the packet to see what we're dealing with
    console.log(`Packet header: ${msg.slice(0, 10).toString('hex')}`);

    if (msg.length >= 5) {
        const header = msg.slice(0, 5).toString('ascii');
        console.log(`Potential header: ${header}`);
    }

    // Try to parse any floating point numbers in the packet
    const floats = [];
    for (let i = 0; i < msg.length - 3; i += 4) {
        floats.push(msg.readFloatLE(i));
    }
    console.log(`Potential float values: ${floats.slice(0, 5).join(', ')}...`);

    return {
        length: msg.length,
        firstBytes: msg.slice(0, 20).toString('hex')
    };
}

function broadcastToAllClients(message, excludeAddress = null) {
    connectedClients.forEach((clientInfo, clientAddress) => {
        if (clientAddress !== excludeAddress) {
            const [address, port] = clientAddress.split(':');
            server.send(message, parseInt(port), address, (err) => {
                if (err) {
                    console.error(`Error sending to ${address}:${port}:`, err);
                } else {
                    console.log(`Relayed packet to ${address}:${port}`);
                }
            });
        }
    });
}

server.on('error', (err) => {
    console.log(`Server error:\n${err.stack}`);
    server.close();
});

server.on('message', (msg, rinfo) => {
    const clientAddress = `${rinfo.address}:${rinfo.port}`;

    if (!connectedClients.has(clientAddress)) {
        connectedClients.set(clientAddress, { lastSeen: Date.now() });
        console.log(`New client connected: ${clientAddress}`);
    } else {
        connectedClients.get(clientAddress).lastSeen = Date.now();
    }

    console.log(`Received packet from ${clientAddress}, length: ${msg.length}`);
    const packetInfo = parseXPlaneData(msg);
    console.log('Packet info:', packetInfo);

    // Relay the original message to all other clients
    broadcastToAllClients(msg, clientAddress);
});

server.on('listening', () => {
    const address = server.address();
    console.log(`X-Plane relay server listening on ${address.address}:${address.port}`);
});

// Clean up inactive clients every 30 seconds
setInterval(() => {
    const now = Date.now();
    connectedClients.forEach((clientInfo, clientAddress) => {
        if (now - clientInfo.lastSeen > 60000) { // 60 seconds timeout
            connectedClients.delete(clientAddress);
            console.log(`Client ${clientAddress} timed out and was removed`);
        }
    });
}, 30000);

server.bind(XPLANE_PORT, BIND_ADDRESS);