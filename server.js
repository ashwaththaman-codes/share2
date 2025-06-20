const rooms = {};

io.on('connection', socket => {
  socket.on('join-room', ({ roomId, password }) => {
    if (rooms[roomId] && rooms[roomId].password !== password) {
      socket.emit('room-error', 'Incorrect password');
      return;
    }

    socket.join(roomId);
    rooms[roomId] = { password };

    socket.to(roomId).emit('peer-connected');

    socket.on('signal', data => {
      socket.to(roomId).emit('signal', data);
    });

    socket.on('mouse-move', data => {
      socket.to(roomId).emit('mouse-move', data);
    });
  });
});
