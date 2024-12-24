// Socket.IO client configuration
window.MPP = window.MPP || {};

MPP.socket = {
    instance: null,
    connectionAttempts: 0,
    maxReconnectAttempts: 5,
    
    init: function() {
        // If we already have an instance, return it
        if (this.instance && this.instance.connected) {
            return this.instance;
        }

        // Get the server URL from the current location
        const protocol = window.location.protocol;
        const host = window.location.host;
        const serverUrl = `${protocol}//${host}`;

        // Socket.IO client configuration
        const socket = io(serverUrl, {
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            query: {},
            // Enable debug logs
            debug: true
        });

        // Store the socket instance
        this.instance = socket;

        // Connection event handlers
        socket.on('connect', () => {
            console.log('Socket.IO Connected:', socket.id);
            this.connectionAttempts = 0;
        });

        socket.on('connect_error', (error) => {
            console.error('Socket.IO Connection Error:', error);
            this.connectionAttempts++;
            
            if (this.connectionAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached');
                socket.disconnect();
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO Disconnected:', reason);
            // Only attempt to reconnect if it wasn't an intentional disconnect
            if (reason !== 'io client disconnect') {
                this.connectionAttempts++;
            }
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Socket.IO Reconnection Attempt:', attemptNumber);
        });

        socket.on('error', (error) => {
            console.error('Socket.IO Error:', error);
        });

        return socket;
    },

    // Method to safely disconnect
    disconnect: function() {
        if (this.instance) {
            this.instance.disconnect();
            this.instance = null;
        }
    }
}; 