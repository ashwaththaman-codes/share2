// public/client.js
const socket = io();
let peerConnection;
let video = document.getElementById("video");
let room = "";
let isHost = false;

// Join room from URL if available
window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("room")) {
    document.getElementById("room").value = urlParams.get("room");
  }
};

function startHost() {
  room = document.getElementById("room").value.trim() || generateRoomCode();
  isHost = true;
  window.history.pushState({}, "", `?room=${room}`);
  socket.emit("join", room);

  navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    video.style.display = "block";

    peerConnection = new RTCPeerConnection();
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    peerConnection.onicecandidate = e => {
      if (e.candidate) socket.emit("signal", { room, data: { candidate: e.candidate } });
    };

    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit("signal", { room, data: { offer } });
    });

    socket.on("signal", async ({ data }) => {
      if (data.answer) await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socket.on("mouseMove", ({ x, y }) => moveFakeCursor(x, y));
    socket.on("mouseClick", ({ button }) => console.log("Client clicked:", button));
  });
}

function startClient() {
  room = document.getElementById("room").value.trim();
  isHost = false;
  socket.emit("join", room);

  peerConnection = new RTCPeerConnection();

  peerConnection.ontrack = e => {
    video.srcObject = e.streams[0];
    video.style.display = "block";
    enableCursorSharing();
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit("signal", { room, data: { candidate: e.candidate } });
  };

  socket.on("signal", async ({ data }) => {
    if (data.offer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { room, data: { answer } });
    }
    if (data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
}

function generateRoomCode() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  document.getElementById("room").value = code;
  return code;
}

function enableCursorSharing() {
  video.addEventListener("mousemove", e => {
    const bounds = video.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width).toFixed(3);
    const y = ((e.clientY - bounds.top) / bounds.height).toFixed(3);
    socket.emit("mouseMove", { room, x, y });
  });

  video.addEventListener("click", e => {
    socket.emit("mouseClick", { room, button: "left" });
  });
}

function moveFakeCursor(x, y) {
  const cursor = document.getElementById("fakeCursor");
  const bounds = video.getBoundingClientRect();
  cursor.style.left = bounds.left + x * bounds.width + "px";
  cursor.style.top = bounds.top + y * bounds.height + "px";
  cursor.style.display = "block";
}
