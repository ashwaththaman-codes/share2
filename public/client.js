const socket = io({ transports: ['websocket'], upgrade: false });
let peerConnection;
let room = "";
const video = document.getElementById("video");
const fakeCursor = document.getElementById("fakeCursor");
const roomInput = document.getElementById("room");
const hostButton = document.querySelector('button[onclick="startHost()"]');
const clientButton = document.querySelector('button[onclick="startClient()"]');
const statusDiv = document.getElementById("status");

function updateUI(state, message) {
  statusDiv.textContent = message;
  roomInput.disabled = state === "connected";
  hostButton.disabled = state === "connected";
  clientButton.disabled = state === "connected";
  if (state === "error") {
    video.style.display = "none";
    fakeCursor.style.display = "none";
  }
}

function startHost() {
  room = roomInput.value.trim();
  if (!room) return alert("Please enter a room code");
  updateUI("connected", "Starting session...");

  if (!navigator.mediaDevices || !window.RTCPeerConnection) {
    updateUI("error", "Your browser does not support WebRTC.");
    return;
  }

  navigator.mediaDevices.getDisplayMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.style.display = "block";
      updateUI("connected", "Hosting session in room: " + room);

      stream.getVideoTracks()[0].onended = () => {
        video.srcObject = null;
        video.style.display = "none";
        fakeCursor.style.display = "none";
        peerConnection?.close();
        updateUI("disconnected", "Session ended. Enter a room code to start or join again.");
        socket.emit("leave", room);
      };

      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit("signal", { room, data: { candidate: event.candidate } });
        }
      };

      socket.on("signal", async ({ data }) => {
        try {
          if (data.answer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          } else if (data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (err) {
          console.error("Signaling error:", err);
          updateUI("error", "Connection error. Please try again.");
        }
      });

      socket.on("no-host", () => {
        updateUI("error", "No host found in room: " + room);
      });

      socket.on("user-disconnected", () => {
        video.srcObject = null;
        video.style.display = "none";
        fakeCursor.style.display = "none";
        updateUI("disconnected", "Client disconnected. Waiting for new clients.");
      });

      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => socket.emit("signal", { room, data: { offer: peerConnection.localDescription } }))
        .catch(err => {
          console.error("Offer creation error:", err);
          updateUI("error", "Failed to create offer. Please try again.");
        });

      let lastMove = 0;
      socket.on("mouseMove", ({ x, y }) => {
        if (Date.now() - lastMove < 50) return;
        lastMove = Date.now();
        const bounds = video.getBoundingClientRect();
        fakeCursor.style.left = bounds.left + x * bounds.width + "px";
        fakeCursor.style.top = bounds.top + y * bounds.height + "px";
        fakeCursor.style.display = "block";
      });

      socket.on("mouseClick", ({ button }) => {
        console.log("Mouse click:", button);
      });

      socket.emit("join", { room, isHost: true });
    })
    .catch(err => {
      console.error("Screen sharing error:", err);
      updateUI("error", "Error sharing screen: " + err.message);
    });
}

function startClient() {
  room = roomInput.value.trim();
  if (!room) return alert("Please enter a room code");
  updateUI("connected", "Connecting to session...");

  if (!window.RTCPeerConnection) {
    updateUI("error", "Your browser does not support WebRTC.");
    return;
  }

  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
    video.style.display = "block";
    setupCursorControl();
    updateUI("connected", "Connected to session in room: " + room);
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("signal", { room, data: { candidate: event.candidate } });
    }
  };

  socket.on("signal", async ({ data }) => {
    try {
      if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("signal", { room, data: { answer: peerConnection.localDescription } });
      } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.error("Signaling error:", err);
      updateUI("error", "Connection error. Please try again.");
    }
  });

  socket.on("no-host", () => {
    updateUI("error", "No host found in room: " + room);
  });

  socket.on("user-disconnected", () => {
    video.srcObject = null;
    video.style.display = "none";
    updateUI("disconnected", "Host disconnected. Enter a room code to join another session.");
  });

  socket.emit("join", { room, isHost: false });
}

function setupCursorControl() {
  let lastMove = 0;
  video.addEventListener("mousemove", e => {
    if (Date.now() - lastMove < 50) return;
    lastMove = Date.now();
    const bounds = video.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width).toFixed(3);
    const y = ((e.clientY - bounds.top) / bounds.height).toFixed(3);
    socket.emit("mouseMove", { room, x, y });
  });

  video.addEventListener("click", () => {
    socket.emit("mouseClick", { room, button: "left" });
  });
}

socket.on("connect_error", () => {
  updateUI("error", "Failed to connect to the server. Please check your connection.");
});
