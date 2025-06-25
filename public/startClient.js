function startClient() {
  room = document.getElementById("room").value.trim();
  if (!room) return alert("Room ID is required");

  isHost = false;
  console.log("Client joining room:", room);
  socket.emit("join", room);

  peerConnection = new RTCPeerConnection();

  peerConnection.ontrack = event => {
    console.log("Client received stream");
    video.srcObject = event.streams[0];
    video.style.display = "block";
    enableCursorSharing();
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      console.log("Client sending candidate");
      socket.emit("signal", { room, data: { candidate: event.candidate } });
    }
  };

  socket.on("signal", async ({ data }) => {
    console.log("Client received signal:", data);
    if (data.offer) {
      console.log("Client got offer, sending answer...");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { room, data: { answer } });
    } else if (data.candidate) {
      console.log("Client got ICE candidate");
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
}
