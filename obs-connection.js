const { io } = require('socket.io-client');

const connectToHost = "ccr.students.mtu.edu";
const connectToPath = "/ri3d26/socket.io";

const socket = io(connectToHost, {
    path: connectToPath
});

socket.on('connect', () => {
    console.log('Connected to server via socket.io');
});

socket.on('error', (error) => {
    console.error('Socket.io error:', error);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
});

console.log(`Socket.io client connecting to ${connectToHost} with path ${connectToPath}`);