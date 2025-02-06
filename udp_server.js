const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const connectedClients = new Map();
const XPLANE_PORT = 49000;
const BIND_ADDRESS = '0.0.0.0';

let packetLog = new Map();

function logPacket(msg, address, isSent) {
    const action = isSent ? "Sent to" : "Received from";
    console.log(`${action} ${address}:`);
    console.log(`  Length: ${msg.length} bytes`);
    console.log('  Raw data (hex):');

    for (let i = 0; i < msg.length; i += 16) {
        const chunk = msg.slice(i, Math.min(i + 16, msg.length));
        const hex = chunk.toString('hex').match(/.{1,2}/g).join(' ');
        const ascii = chunk.toString().replace(/[^\x20-\x7E]/g, '.');
        console.log(`    ${hex.padEnd(48)} | ${ascii}`);
    }

    if (msg.length >= 4) {
        const messageType = msg.readUInt32LE(0);
        console.log(`  Message type: 0x${messageType.toString(16)}`);
    }

    console.log(''); // Empty line for readability
}

function comparePackets(sentMsg, receivedMsg) {
    if (sentMsg.length !== receivedMsg.length) {
        console.log("Packet lengths differ!");
        return;
    }

    let differences = [];
    for (let i = 0; i < sentMsg.length; i++) {
        if (sentMsg[i] !== receivedMsg[i]) {
            differences.push(i);
        }
    }

    if (differences.length > 0) {
        console.log("Differences found at bytes:", differences);
        differences.forEach(index => {
            console.log(`  Byte ${index}: Sent 0x${sentMsg[index].toString(16)}, Received 0x${receivedMsg[index].toString(16)}`);
        });
    } else {
        console.log("Packets are identical");
    }
}

server.on('message', (msg, rinfo) => {
    const clientAddress = `${rinfo.address}:${rinfo.port}`;

    if (!connectedClients.has(clientAddress)) {
        console.log(`New client connected: ${clientAddress}`);
        connectedClients.set(clientAddress, { lastSeen: Date.now() });
    } else {
        connectedClients.get(clientAddress).lastSeen = Date.now();
    }

    logPacket(msg, clientAddress, false);

    connectedClients.forEach((clientInfo, address) => {
        if (address !== clientAddress) {
            server.send(msg, 0, msg.length, parseInt(address.split(':')[1]), address.split(':')[0], (err) => {
                if (err) {
                    console.error(`Error sending to ${address}:`, err);
                } else {
                    logPacket(msg, address, true);

                    // Store sent packet for comparison
                    if (!packetLog.has(address)) {
                        packetLog.set(address, []);
                    }
                    packetLog.get(address).push(Buffer.from(msg));
                }
            });
        }
    });

    // Compare received packet with the last sent packet to this client
    if (packetLog.has(clientAddress) && packetLog.get(clientAddress).length > 0) {
        const lastSentPacket = packetLog.get(clientAddress).pop();
        console.log("Comparing last sent packet to received packet:");
        comparePackets(lastSentPacket, msg);
    }
});

server.on('listening', () => {
    const address = server.address();
    console.log(`X-Plane relay server listening on ${address.address}:${address.port}`);
});

server.on('error', (err) => {
    console.error(`Server error:\n${err.stack}`);
    server.close();
});

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