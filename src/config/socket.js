import { io } from 'socket.io-client';

const socket = io(window.location.origin, {
    path: '/hungr/socket.io',
    autoConnect: false
});

export default socket;
