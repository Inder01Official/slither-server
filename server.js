const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// Serve static files from current directory
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 2500;
const TICK_RATE = 30; // Updates per second

// Game State
let players = {};
let food = [];
const FOOD_COUNT = 300;

// Utils
const rand = (min, max) => Math.random() * (max - min) + min;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Initialize Food
function spawnFood() {
    while (food.length < FOOD_COUNT) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * MAP_SIZE;
        food.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            c: `hsl(${Math.random()*360}, 70%, 60%)`, // Color
            s: rand(5, 8), // Size
            v: rand(1, 3)  // Value (growth)
        });
    }
}
spawnFood();

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join', (data) => {
        // Create Player
        players[socket.id] = {
            id: socket.id,
            name: data.name.substring(0, 12).replace(/[^a-zA-Z0-9 ]/g, '') || "Snake",
            x: 0, y: 0,
            angle: Math.random() * Math.PI * 2,
            seg: [], // Segments
            score: 10, // Initial length/mass
            boost: false,
            speed: 5,
            hue: Math.floor(Math.random() * 360)
        };
        
        // Initialize segments
        for(let i=0; i<10; i++) {
            players[socket.id].seg.push({x:0, y:0});
        }

        socket.emit('init', { id: socket.id });
    });

    socket.on('input', (data) => {
        if (players[socket.id]) {
            players[socket.id].angle = data.angle;
            players[socket.id].boost = data.boost;
        }
    });

    socket.on('ping', (cb) => { if(typeof cb === 'function') cb(); });

    socket.on('disconnect', () => {
        delete players[socket.id];
        console.log('Player disconnected:', socket.id);
    });
});

// Physics Loop
setInterval(() => {
    spawnFood(); // Replenish food

    Object.values(players).forEach(p => {
        // 1. Move Head
        const speed = p.boost && p.score > 20 ? 8 : 4;
        
        // Boosting costs mass
        if (p.boost && p.score > 20) {
            p.score -= 0.1;
        }

        p.x += Math.cos(p.angle) * speed;
        p.y += Math.sin(p.angle) * speed;

        // Map Boundaries (Circle)
        if (dist({x:0, y:0}, p) > MAP_SIZE) {
            // Push back
            const angleToCenter = Math.atan2(p.y, p.x);
            p.x = Math.cos(angleToCenter) * MAP_SIZE;
            p.y = Math.sin(angleToCenter) * MAP_SIZE;
        }

        // 2. Move Body (Simple trail constraint)
        // Head is already moved, update segment 0 to follow head, 1 to follow 0...
        const segmentDist = 6; // Distance between joints
        
        // Logic: Pull segments
        let targetX = p.x;
        let targetY = p.y;
        
        // Ensure segments array matches score/length
        const targetLen = Math.floor(p.score);
        while(p.seg.length < targetLen) p.seg.push({x: p.seg[p.seg.length-1].x, y: p.seg[p.seg.length-1].y});
        while(p.seg.length > targetLen) p.seg.pop();

        for (let i = 0; i < p.seg.length; i++) {
            const seg = p.seg[i];
            const dx = seg.x - targetX;
            const dy = seg.y - targetY;
            const d = Math.hypot(dx, dy);
            
            if (d > 0) {
                const f = (d - segmentDist) / d; // Spring force
                seg.x -= dx * f;
                seg.y -= dy * f;
            }
            targetX = seg.x;
            targetY = seg.y;
        }
        
        // 3. Eat Food
        for (let i = food.length - 1; i >= 0; i--) {
            if (dist(p, food[i]) < p.score/2 + food[i].s) { // Radius based collision
                p.score += food[i].v;
                food.splice(i, 1);
            }
        }
        
        // 4. Collision with other players (Simplified)
        // If head hits any segment of another player -> Reset
        Object.values(players).forEach(other => {
            if (p.id !== other.id) {
                for (let seg of other.seg) {
                    if (dist(p, seg) < 10) { // Hit
                        // Drop food where died
                        for(let k=0; k<p.score; k+=2) {
                             food.push({
                                id: Math.random(),
                                x: p.seg[Math.floor(k)%p.seg.length].x + rand(-20,20),
                                y: p.seg[Math.floor(k)%p.seg.length].y + rand(-20,20),
                                c: '#ffcc00', s: 8, v: 2
                             });
                        }
                        // Respawn
                        p.score = 10;
                        p.x = rand(-500, 500);
                        p.y = rand(-500, 500);
                        p.seg = [];
                        for(let i=0; i<10; i++) p.seg.push({x:p.x, y:p.y});
                        break;
                    }
                }
            }
        });
        
        // Add current radius for rendering
        p.s = 10 + (p.score * 0.1);
        if(p.s > 25) p.s = 25; // Cap size
    });

    // Broadcast State
    io.emit('state', { players, food });

}, 1000 / TICK_RATE);

http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
