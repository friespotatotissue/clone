const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use('/piano', express.static(path.join(__dirname)));

// Root route - redirect to piano
app.get('/', (req, res) => {
    res.redirect('/piano');
});

// Piano routes
app.get('/piano', (req, res) => {
    res.redirect('/piano/lobby');
});

app.get('/piano/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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

    // Handle channel events
    socket.on('ch', (msg) => {
        socket.join(msg._id);
        socket.room = msg._id;
        socket.broadcast.to(msg._id).emit('ch', {
            ch: {
                _id: msg._id,
                settings: msg.set || {}
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 