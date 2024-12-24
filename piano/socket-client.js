// Socket.IO client configuration
window.MPP = window.MPP || {};

MPP.socket = {
    init: function() {
        // Get the server URL from the current location
        const protocol = window.location.protocol;
        const host = window.location.host;
        const serverUrl = `${protocol}//${host}`;

        // Socket.IO client configuration
        const socket = io(serverUrl, {
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            query: {},
            // Enable debug logs
            debug: true
        });

        // Connection event handlers
        socket.on('connect', () => {
            console.log('Socket.IO Connected:', socket.id);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket.IO Connection Error:', error);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO Disconnected:', reason);
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Socket.IO Reconnection Attempt:', attemptNumber);
        });

        return socket;
    }
}; 