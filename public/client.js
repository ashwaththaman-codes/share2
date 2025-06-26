const socket = io({
  transports: ['websocket'],
  upgrade: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
let peerConnection;
let room = "";
const video = document.getElementById("video");
const fakeCursor = document.getElementById("fakeCursor");
const roomInput = document.getElementById("room");
const hostButton = document.querySelector('button[onclick="startHost()"]');
const clientButton = document.querySelector('button[onclick="startClient()"]');
const statusDiv = document.getElementById("status");

function updateUI(state, message) {
  console.log(`UI Update: ${state} - ${message}`);
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
        console.log("Screen sharing stopped");
        video.srcObject = null;
        video.style.display = "none";
        fakeCursor.style.display = "none";
        peerConnection?.close();
        updateUI("disconnected", "Session ended. Enter a room code to start or join again.");
        socket.emit("leave", room);
      };

      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          // Free TURN server (example, replace with your own credentials)
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
          }
        ]
      });

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          console.log("Host sending ICE candidate:", event.candidate);
          socket.emit("signal", { room, data: { candidate: event.candidate } });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log("Host WebRTC state:", peerConnection.connectionState);
        if (peerConnection.connectionState === "failed") {
          updateUI("error", "Host connection failed. Please try again.");
        }
      };

      socket.on("signal", async ({ data }) => {
        try {
          console.log("Host received signal:", data);
          if (data.answer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          } else if (data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (err) {
          console.error("Host signaling error:", err);
          updateUI("error", "Host connection error: " + err.message);
        }
      });

      socket.on("no-host", () => {
        console.log("No host in room:", room);
        updateUI("error", "No host found in room: " + room);
      });

      socket.on("user-disconnected", () => {
        console.log("Client disconnected");
        video.srcObject = null;
        video.style.display = "none";
        fakeCursor.style.display = "none";
        updateUI("disconnected", "Client disconnected. Waiting for new clients.");
      });

      peerConnection.createOffer()
        .then(offer => {
          console.log("Host created offer:", offer);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          console.log("Host sending offer");
          socket.emit("signal", { room, data: { offer: peerConnection.localDescription } });
        })
        .catch(err => {
          console.error("Host offer creation error:", err);
          updateUI("error", "Failed to create offer: " + err.message);
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
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // Free TURN server (example, replace with your own credentials)
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  });

  peerConnection.ontrack = event => {
    console.log("Client received stream:", event.streams[0]);
    video.srcObject = event.streams[0];
    video.style.display = "block";
    setupCursorControl();
    updateUI("connected", "Connected to session in room: " + room);
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      console.log("Client sending ICE candidate:", event.candidate);
      socket.emit("signal", { room, data: { candidate: event.candidate } });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("Client WebRTC state:", peerConnection.connectionState);
    if (peerConnection.connectionState === "failed") {
      updateUI("error", "Connection failed. Please try again.");
    } else if (peerConnection.connectionState === "connected") {
      console.log("Client successfully connected to host");
    }
  };

  socket.on("signal", async ({ data }) => {
    try {
      console.log("Client received signal:", data);
      if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log("Client sending answer:", peerConnection.localDescription);
        socket.emit("signal", { room, data: { answer: peerConnection.localDescription } });
      } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.error("Client signaling error:", err);
      updateUI("error", "Connection error: " + err.message);
    }
  });

  socket.on("no-host", () => {
    console.log("No host in room:", room);
    updateUI("error", "No host found in room: " + room);
  });

  socket.on("user-disconnected", () => {
    console.log("Host disconnected");
    video.srcObject = null;
    video.style.display = "none";
    updateUI("disconnected", "Host disconnected. Enter a room code to join another session.");
  });

  socket.emit("join", { room, isHost: false });

  // Extended timeout for slower networks
  setTimeout(() => {
    if (peerConnection.connectionState !== "connected") {
      console.log("Connection timeout after 20 seconds");
      updateUI("error", "Connection timed out. Please try again.");
    }
  }, 20000);
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

socket.on("connect_error", err => {
  console.error("Socket.IO connect error:", err);
  updateUI("error", "Failed to connect to the server: " + err.message);
});

socket.on("connect", () => {
  console.log("Socket.IO connected");
});

socket.on("reconnect_attempt", attempt => {
  console.log("Socket.IO reconnect attempt:", attempt);
});
