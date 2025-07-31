const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;

    // WebRTC setup
    const peer = new RTCPeerConnection();
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    socket.emit("join-room", "test-room");

    socket.on("user-connected", userId => {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit("signal", { target: userId, signal: offer });
      });
    });

    socket.on("signal", async ({ from, signal }) => {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      if (signal.type === 'offer') {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", { target: from, signal: answer });
      }
    });
    
    async function startScreenShare() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];

    const sender = peer.getSenders().find(s => s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(screenTrack);
      console.log("Screen sharing started.");
    }
  } catch (err) {
    console.error("Screen sharing error:", err);
  }
}

  });
