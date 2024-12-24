const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the piano directory
app.use('/piano', express.static(path.join(__dirname, 'piano')));
// Serve audio files from the audio directory under the piano path
app.use('/piano/audio', express.static(path.join(__dirname, 'audio')));
app.use(express.static(__dirname));

// WebSocket connection handling
wss.on('connection', function connection(ws) {
    console.log('New client connected');

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

    // Send initial hi message
    const hiMessage = JSON.stringify([{
        m: "hi",
        u: { name: "Anonymous", color: "#777" },
        t: Date.now()
    }]);
    ws.send(hiMessage);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 