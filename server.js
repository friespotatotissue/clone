const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure WebSocket server with proper headers
const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,
    clientTracking: true,
    handleProtocols: (protocols, req) => {
        return protocols[0];
    }
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

// WebSocket connection handling
wss.on('connection', function connection(ws, req) {
    console.log('New client connected');
    
    // Send initial connection status
    const hiMessage = JSON.stringify([{
        m: "hi",
        u: { name: "Anonymous", color: "#777" },
        t: Date.now()
    }]);
    ws.send(hiMessage);

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);
            // Broadcast the message to all connected clients
            wss.clients.forEach(function each(client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message.toString());
                }
            });
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    // Handle client disconnection
    ws.on('close', function close() {
        console.log('Client disconnected');
    });
});

// Error handling
wss.on('error', function error(error) {
    console.error('WebSocket server error:', error);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server is ready`);
}); 