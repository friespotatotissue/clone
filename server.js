const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000
});

// Serve static files from the piano directory
app.use('/piano', express.static(path.join(__dirname, 'piano')));
// Serve audio files from the audio directory under the piano path
app.use('/piano/audio', express.static(path.join(__dirname, 'audio')));
app.use(express.static(__dirname));

// Add CORS headers for Railway deployment
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Send initial connection status
    socket.emit('hi', {
        m: "hi",
        u: { name: "Anonymous", color: "#777" },
        t: Date.now()
    });

    // Handle incoming messages
    socket.on('message', (data) => {
        try {
            // Broadcast the message to all other clients
            socket.broadcast.emit('message', data);
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    // Handle note events
    socket.on('n', (data) => {
        socket.broadcast.emit('n', data);
    });

    // Handle channel events
    socket.on('ch', (data) => {
        socket.broadcast.emit('ch', data);
    });

    // Handle participant events
    socket.on('p', (data) => {
        socket.broadcast.emit('p', data);
    });

    // Handle timing events
    socket.on('t', (data) => {
        socket.emit('t', {
            m: "t",
            t: Date.now(),
            e: data.e
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        socket.broadcast.emit('bye', { p: socket.id });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server is ready`);
}); 