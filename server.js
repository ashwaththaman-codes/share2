const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Track hosts per room
const rooms = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join', ({ room, isHost }) => {
    if (isHost) {
      if (rooms.has(room)) {
        socket.emit('error', 'Room already has a host');
        return;
      }
      rooms.set(room, socket.id);
    } else if (!rooms.has(room)) {
      socket.emit('no-host', 'No host found in room: ' + room);
      return;
    }

    socket.join(room);
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('signal', ({ room, data }) => {
    socket.to(room).emit('signal', { id: socket.id, data });
  });

  socket.on('mouseMove', ({ room, x, y }) => {
    socket.to(room).emit('mouseMove', { x, y });
  });

  socket.on('mouseClick', ({ room, button }) => {
    socket.to(room).emit('mouseClick', { button });
  });

  socket.on('leave', room => {
    socket.leave(room);
    if (rooms.get(room) === socket.id) {
      rooms.delete(room);
      socket.to(room).emit('user-disconnected', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach((hostId, room) => {
      if (hostId === socket.id) {
        rooms.delete(room);
        socket.to(room).emit('user-disconnected', socket.id);
      }
    });
  });

  socket.on('error', err => {
    console.error('Socket error:', err);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
