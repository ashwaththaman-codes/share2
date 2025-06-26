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
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).send('OK');
});

// Track hosts and pending signals per room
const rooms = new Map();
const pendingSignals = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join', ({ room, isHost }) => {
    console.log(`Join request: room=${room}, isHost=${isHost}, socket=${socket.id}`);
    if (isHost) {
      if (rooms.has(room)) {
        console.log(`Host rejected: room ${room} already has a host`);
        socket.emit('error', 'Room already has a host');
        return;
      }
      rooms.set(room, socket.id);
      console.log(`Host added: room=${room}, host=${socket.id}`);
      // Send any pending signals to the new host
      if (pendingSignals.has(room)) {
        pendingSignals.get(room).forEach(signal => {
          console.log(`Sending pending signal to host ${socket.id}:`, signal);
          socket.emit('signal', signal);
        });
        pendingSignals.delete(room);
      }
    } else if (!rooms.has(room)) {
      console.log(`No host in room: ${room}`);
      socket.emit('no-host', 'No host found in room: ' + room);
      return;
    }

    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('signal', ({ room, data }) => {
    console.log(`Signal from ${socket.id} to room ${room}:`, JSON.stringify(data, null, 2));
    const targetSocket = io.sockets.adapter.rooms.get(room);
    if (targetSocket && targetSocket.size > 1) {
      socket.to(room).emit('signal', { id: socket.id, data });
    } else {
      console.log(`No other users in room ${room}, buffering signal from ${socket.id}`);
      if (!pendingSignals.has(room)) {
        pendingSignals.set(room, []);
      }
      pendingSignals.get(room).push({ id: socket.id, data });
    }
  });

  socket.on('mouseMove', ({ room, x, y }) => {
    socket.to(room).emit('mouseMove', { x, y });
  });

  socket.on('mouseClick', ({ room, button }) => {
    socket.to(room).emit('mouseClick', { button });
  });

  socket.on('leave', room => {
    console.log(`Leave request: room=${room}, socket=${socket.id}`);
    socket.leave(room);
    if (rooms.get(room) === socket.id) {
      rooms.delete(room);
      pendingSignals.delete(room);
      socket.to(room).emit('user-disconnected', socket.id);
      console.log(`Host removed: room=${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach((hostId, room) => {
      if (hostId === socket.id) {
        rooms.delete(room);
        pendingSignals.delete(room);
        socket.to(room).emit('user-disconnected', socket.id);
        console.log(`Host disconnected: room=${room}`);
      }
    });
  });

  socket.on('error', err => {
    console.error('Socket error:', err);
  });
});

// Explicitly bind to process.env.PORT
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// Ensure server responds to Render's port detection
server.on('listening', () => {
  console.log(`Server confirmed listening on port ${port}`);
});
