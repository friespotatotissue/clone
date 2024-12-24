// Configuration for WebSocket connection
window.MPP = window.MPP || {};
MPP.serverConfig = {
    // Get the WebSocket URL based on the current window location
    getWebSocketURL: function() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}`;
    }
}; 