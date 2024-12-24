// Configuration for Socket.IO connection
window.MPP = window.MPP || {};
MPP.serverConfig = {
    // Get the Socket.IO URL based on the current window location
    getWebSocketURL: function() {
        return window.location.origin;
    }
}; 