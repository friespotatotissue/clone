const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Room = require('./structures/Room.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..'))); // Serve from root
app.use('/piano', express.static(path.join(__dirname, '..'))); // For piano-specific files
app.use('/audio', express.static(path.join(__dirname, '../audio'))); // For audio files

// Root route - redirect to piano
app.get('/', (req, res) => {
    res.redirect('/piano');
});

// Piano routes
app.get('/piano', (req, res) => {
    res.redirect('/piano/lobby');
});

app.get('/piano/:room', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Store rooms and participants
const rooms = new Map();
const participants = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('a user connected');

    // Create participant
    const participant = {
        _id: socket.id,
        name: "Anonymous",
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        room: null
    };
    participants.set(socket.id, participant);

    // Send initial hi message
    socket.emit('hi', {
        t: Date.now(),
        u: {
            _id: participant._id,
            name: participant.name,
            color: participant.color
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        const p = participants.get(socket.id);
        if (p && p.room) {
            const room = rooms.get(p.room);
            if (room) {
                room.removeParticipant(socket.id);
                if (room.count <= 0) {
                    rooms.delete(p.room);
                }
            }
        }
        participants.delete(socket.id);
    });

    // Handle note events
    socket.on('n', (msg) => {
        const p = participants.get(socket.id);
        if (p && p.room) {
            socket.to(p.room).emit('n', {
                n: msg.n,
                p: p._id,
                t: msg.t
            });
        }
    });

    // Handle cursor movement
    socket.on('m', (msg) => {
        const p = participants.get(socket.id);
        if (p && p.room) {
            socket.to(p.room).emit('m', {
                id: p._id,
                x: msg.x,
                y: msg.y
            });
        }
    });

    // Handle chat messages
    socket.on('a', (msg) => {
        const p = participants.get(socket.id);
        if (p && p.room) {
            io.to(p.room).emit('a', {
                a: msg.message,
                p: p,
                t: Date.now()
            });
        }
    });

    // Handle channel events
    socket.on('ch', (msg) => {
        const p = participants.get(socket.id);
        if (!p) return;

        // Leave old room if any
        if (p.room) {
            const oldRoom = rooms.get(p.room);
            if (oldRoom) {
                oldRoom.removeParticipant(socket.id);
                if (oldRoom.count <= 0) {
                    rooms.delete(p.room);
                }
            }
            socket.leave(p.room);
        }

        // Join or create new room
        const roomId = msg._id || 'lobby';
        let room = rooms.get(roomId);
        if (!room) {
            room = new Room(p, io, roomId, 0, msg.set);
            rooms.set(roomId, room);
        }

        // Join room
        socket.join(roomId);
        p.room = roomId;
        const pR = room.newParticipant(p);

        // Send room info
        socket.emit('ch', {
            ch: room.generateJSON(),
            p: pR.id,
            ppl: room.ppl
        });
    });

    // Handle note quota
    socket.on('nq', (msg) => {
        const p = participants.get(socket.id);
        if (p && p.room) {
            const room = rooms.get(p.room);
            if (room) {
                socket.emit('nq', {
                    allowance: room._id.toLowerCase().includes('black') ? 8000 : 200,
                    max: room._id.toLowerCase().includes('black') ? 24000 : 600,
                    histLen: room._id.toLowerCase().includes('black') ? 3 : 0
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
