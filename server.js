const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join', room => {
    socket.join(room);
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('signal', (data) => {
    const { room, signal } = data;
    socket.to(room).emit('signal', { id: socket.id, signal });
  });

  socket.on('mouseMove', data => {
    socket.broadcast.emit('mouseMove', data);
  });

  socket.on('mouseClick', () => {
    socket.broadcast.emit('mouseClick');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

