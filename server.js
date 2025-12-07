// A minimal WebSocket Game Server for Slither Clone
// Run using: node server.js

const WebSocket = require('ws');

// Create server on port 3000
const wss = new WebSocket.Server({ port: 3000 });

console.log("Slither Server running on port 3000");

// Game State
let players = {};
let food = [];

// Generate random food
for(let i=0; i<50; i++) {
    food.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    });
}

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    console.log(`Player connected: ${id}`);

    // Initial state
    players[id] = { id, x: 400, y: 300, name: "Guest" };
    
    // Send ID to player
    ws.send(JSON.stringify({ type: 'init', id }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                players[id].name = data.name;
            }
            
            if (data.type === 'input') {
                // VERY simple movement (teleport to mouse)
                // In a real game, you would calculate vectors here
                players[id].x = data.x;
                players[id].y = data.y;
            }
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${id}`);
        delete players[id];
    });
});

// Game Loop (20 ticks per second)
setInterval(() => {
    // Broadcast state to all clients
    const packet = JSON.stringify({
        type: 'update',
        players: players,
        food: food
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(packet);
        }
    });
}, 50);
