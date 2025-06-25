const socket = io();
let peerConnection;
let room = "";
const video = document.getElementById("video");
const fakeCursor = document.getElementById("fakeCursor");

function startHost() {
  room = document.getElementById("room").value.trim();
  if (!room) return alert("Enter room code");
  socket.emit("join", room);

  navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    video.style.display = "block";

    peerConnection = new RTCPeerConnection();

    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("signal", { room, data: { candidate: event.candidate } });
      }
    };

    socket.on("signal", async ({ data }) => {
      if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit("signal", { room, data: { offer } });
    });

    socket.on("mouseMove", ({ x, y }) => {
      const bounds = video.getBoundingClientRect();
      fakeCursor.style.left = bounds.left + x * bounds.width + "px";
      fakeCursor.style.top = bounds.top + y * bounds.height + "px";
      fakeCursor.style.display = "block";
    });

    socket.on("mouseClick", ({ button }) => {
      console.log("Mouse click:", button);
    });

  }).catch(err => {
    alert("Error sharing screen: " + err.message);
  });
}

function startClient() {
  room = document.getElementById("room").value.trim();
  if (!room) return alert("Enter room code");
  socket.emit("join", room);

  peerConnection = new RTCPeerConnection();

  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
    video.style.display = "block";
    setupCursorControl();
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("signal", { room, data: { candidate: event.candidate } });
    }
  };

  socket.on("signal", async ({ data }) => {
    if (data.offer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { room, data: { answer } });
    } else if (data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
}

function setupCursorControl() {
  video.addEventListener("mousemove", e => {
    const bounds = video.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width).toFixed(3);
    const y = ((e.clientY - bounds.top) / bounds.height).toFixed(3);
    socket.emit("mouseMove", { room, x, y });
  });

  video.addEventListener("click", () => {
    socket.emit("mouseClick", { room, button: "left" });
  });
}
