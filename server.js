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
    
    // Send initial connection status in array format
    socket.emit('message', [{
        m: "hi",
        u: { 
            _id: socket.id,
            name: "Anonymous",
            color: "#777"
        },
        t: Date.now(),
        p: socket.id
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
                    case "t":
                        // Handle timing message
                        socket.emit('message', [{
                            m: "t",
                            t: Date.now(),
                            e: msg.e
                        }]);
                        break;
                    case "ch":
                        // Handle channel join/update
                        const channelMsg = {
                            m: "ch",
                            p: socket.id,
                            ch: {
                                _id: msg._id || "lobby",
                                settings: {
                                    visible: true,
                                    chat: true,
                                    crownsolo: false,
                                    color: "#ecfaed"
                                }
                            },
                            ppl: []
                        };
                        socket.emit('message', [channelMsg]);
                        socket.broadcast.emit('message', [channelMsg]);
                        break;
                    case "n":
                        // Handle note message
                        socket.broadcast.emit('message', [{
                            m: "n",
                            n: msg.n,
                            t: msg.t,
                            p: socket.id
                        }]);
                        break;
                    default:
                        // Broadcast other messages
                        socket.broadcast.emit('message', [msg]);
                }
            });
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        io.emit('message', [{
            m: "bye",
            p: socket.id
        }]);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server is ready`);
}); 