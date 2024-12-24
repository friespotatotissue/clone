const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO configuration
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true,  // Allow Engine.IO 3 compatibility
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    path: '/socket.io/',  // Explicit path
    connectTimeout: 45000,
    // Add debug logs
    logger: {
        debug: (...args) => console.log('Socket.IO [debug]:', ...args),
        info: (...args) => console.log('Socket.IO [info]:', ...args),
        error: (...args) => console.log('Socket.IO [error]:', ...args),
    }
});

// Serve static files from the piano directory
app.use('/piano', express.static(path.join(__dirname, 'piano')));
// Serve audio files from the audio directory under the piano path
app.use('/piano/audio', express.static(path.join(__dirname, 'audio')));
// Serve images from the images directory
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static(__dirname));

// Add CORS headers for Railway deployment
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Store rooms and participants
const rooms = new Map();
const participants = new Map();

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function createRoom(id, settings = {}) {
    const isLobby = id.toLowerCase().includes('lobby');
    const room = {
        _id: id,
        settings: {
            chat: settings.chat !== undefined ? settings.chat : true,
            color: settings.color || '#206694',
            crownsolo: settings.crownsolo !== undefined ? settings.crownsolo : false,
            lobby: isLobby,
            visible: settings.visible !== undefined ? settings.visible : true
        },
        crown: null,
        ppl: [],
        count: 0
    };
    rooms.set(id, room);
    return room;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Create participant
    const participant = {
        _id: socket.id,
        name: "Anonymous",
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        room: null
    };
    participants.set(socket.id, participant);

    // Send initial hi message
    socket.emit('message', [{
        m: "hi",
        u: {
            _id: participant._id,
            name: participant.name,
            color: participant.color
        },
        t: Date.now()
    }]);

    // Handle incoming messages
    socket.on('message', (data) => {
        try {
            const messages = Array.isArray(data) ? data : [data];
            
            messages.forEach(msg => {
                switch(msg.m) {
                    case "hi":
                        // Already handled in connection
                        break;

                    case "ch": {
                        const p = participants.get(socket.id);
                        if (!p) return;

                        // Leave old room if any
                        if (p.room) {
                            const oldRoom = rooms.get(p.room);
                            if (oldRoom) {
                                oldRoom.ppl = oldRoom.ppl.filter(x => x._id !== p._id);
                                oldRoom.count--;
                                if (oldRoom.count <= 0) {
                                    rooms.delete(p.room);
                                }
                                socket.leave(p.room);
                            }
                        }

                        // Join or create new room
                        let roomId = msg._id || 'lobby';
                        // Only append -original if it's not already there
                        if (!roomId.endsWith('-original')) {
                            roomId += '-original';
                        }
                        let room = rooms.get(roomId);
                        if (!room) {
                            room = createRoom(roomId, msg.set);
                        }

                        // Add participant to room
                        const participantRoom = {
                            id: generateId(),
                            _id: p._id,
                            name: p.name,
                            color: p.color,
                            x: 0,
                            y: 0
                        };
                        room.ppl.push(participantRoom);
                        room.count++;
                        p.room = roomId;

                        // Join socket room
                        socket.join(roomId);

                        // Set crown if needed
                        if (!room.settings.lobby && room.count === 1) {
                            room.crown = {
                                participantId: participantRoom.id,
                                userId: p._id,
                                time: new Date()
                            };
                        }

                        // Send room info
                        socket.emit('message', [{
                            m: "ch",
                            ch: {
                                _id: room._id,
                                settings: room.settings,
                                count: room.count,
                                crown: room.crown
                            },
                            p: participantRoom.id,
                            ppl: room.ppl
                        }]);

                        // Broadcast new participant to others in room
                        socket.to(roomId).emit('message', [{
                            m: "p",
                            id: participantRoom.id,
                            name: p.name,
                            color: p.color,
                            x: 0,
                            y: 0,
                            _id: p._id
                        }]);

                        // Send note quota
                        socket.emit('message', [{
                            m: "nq",
                            allowance: room._id.toLowerCase().includes('black') ? 8000 : 200,
                            max: room._id.toLowerCase().includes('black') ? 24000 : 600,
                            histLen: room._id.toLowerCase().includes('black') ? 3 : 0
                        }]);
                        break;
                    }

                    case "a": {
                        const p = participants.get(socket.id);
                        if (!p || !p.room) return;
                        const room = rooms.get(p.room);
                        if (!room) return;
                        const pR = room.ppl.find(x => x._id === p._id);
                        if (!pR) return;

                        const message = {
                            m: "a",
                            a: msg.message.substring(0, 255).replace(/\r?\n|\r/g, ''),
                            p: pR
                        };
                        io.to(p.room).emit('message', [message]);
                        break;
                    }

                    case "n": {
                        const p = participants.get(socket.id);
                        if (!p || !p.room) return;
                        const room = rooms.get(p.room);
                        if (!room) return;
                        const pR = room.ppl.find(x => x._id === p._id);
                        if (!pR) return;

                        socket.to(p.room).emit('message', [{
                            m: "n",
                            n: msg.n,
                            p: pR.id,
                            t: msg.t
                        }]);
                        break;
                    }

                    case "m": {
                        const p = participants.get(socket.id);
                        if (!p || !p.room) return;
                        const room = rooms.get(p.room);
                        if (!room) return;
                        const pR = room.ppl.find(x => x._id === p._id);
                        if (!pR) return;

                        pR.x = msg.x;
                        pR.y = msg.y;
                        socket.to(p.room).emit('message', [{
                            m: "m",
                            id: pR.id,
                            x: msg.x,
                            y: msg.y
                        }]);
                        break;
                    }

                    case "t":
                        socket.emit('message', [{
                            m: "t",
                            t: Date.now(),
                            e: msg.e
                        }]);
                        break;

                    case "+ls": {
                        const p = participants.get(socket.id);
                        if (!p) return;
                        const publicRooms = Array.from(rooms.values())
                            .filter(r => r.settings.visible)
                            .map(r => ({
                                _id: r._id,
                                settings: r.settings,
                                count: r.count,
                                crown: r.crown
                            }));
                        socket.emit('message', [{
                            m: "ls",
                            c: true,
                            u: publicRooms
                        }]);
                        break;
                    }

                    case "userset": {
                        const p = participants.get(socket.id);
                        if (!p || !p.room) return;
                        const room = rooms.get(p.room);
                        if (!room) return;
                        const pR = room.ppl.find(x => x._id === p._id);
                        if (!pR) return;

                        if (msg.set.name) {
                            const name = msg.set.name.substring(0, 250);
                            p.name = name;
                            pR.name = name;
                        }
                        
                        io.to(p.room).emit('message', [{
                            m: "p",
                            id: pR.id,
                            name: p.name,
                            color: p.color,
                            _id: p._id
                        }]);
                        break;
                    }
                }
            });
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const p = participants.get(socket.id);
        if (p && p.room) {
            const room = rooms.get(p.room);
            if (room) {
                const pR = room.ppl.find(x => x._id === p._id);
                if (pR) {
                    room.ppl = room.ppl.filter(x => x._id !== p._id);
                    room.count--;
                    if (room.count <= 0) {
                        rooms.delete(p.room);
                    }
                    io.to(p.room).emit('message', [{
                        m: "bye",
                        p: pR.id
                    }]);
                }
            }
        }
        participants.delete(socket.id);
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server is ready`);
}); 