const socket = io();
const roomId = prompt("Enter Room ID:");
const password = prompt("Enter Room Password:");

socket.emit('join-room', { roomId, password });

socket.on('room-error', msg => alert(msg));

const peerConnection = new RTCPeerConnection();
// Everything else (WebRTC setup) same as before...

// Mouse control
document.addEventListener('mousemove', (e) => {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  socket.emit('mouse-move', { x, y });
});

socket.on('mouse-move', ({ x, y }) => {
  // This part won’t work in browser — handled by local agent
  console.log("Mouse moved to:", x, y);
});
