const socket = io();
const peerConnection = new RTCPeerConnection();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  });

peerConnection.ontrack = event => {
  remoteVideo.srcObject = event.streams[0];
};

peerConnection.onicecandidate = event => {
  if (event.candidate) {
    socket.emit('signal', { candidate: event.candidate });
  }
};

socket.on('signal', async data => {
  if (data.description) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
    if (data.description.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { description: answer });
    }
  } else if (data.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error('Error adding received ICE candidate', e);
    }
  }
});

async function makeCall() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { description: offer });
}

// Call automatically when ready
makeCall();
