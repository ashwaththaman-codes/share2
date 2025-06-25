// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

io.on("connection", socket => {
  socket.on("join", room => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("signal", ({ room, data }) => {
    socket.to(room).emit("signal", { data });
  });

  socket.on("mouseMove", ({ room, x, y }) => {
    socket.to(room).emit("mouseMove", { x, y });
  });

  socket.on("mouseClick", ({ room, button }) => {
    socket.to(room).emit("mouseClick", { button });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
