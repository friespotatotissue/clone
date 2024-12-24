const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use('/piano', express.static(path.join(__dirname)));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    // Handle note events
    socket.on('n', (msg) => {
        socket.broadcast.emit('n', msg);
    });

    // Handle cursor movement
    socket.on('m', (msg) => {
        socket.broadcast.emit('m', msg);
    });

    // Handle chat messages
    socket.on('a', (msg) => {
        io.emit('a', msg);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 