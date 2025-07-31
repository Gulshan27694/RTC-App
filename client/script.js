const socket = io();
const peers = {};
const roomId = window.location.pathname.split("/").pop();

const localVideo = document.createElement("video");
localVideo.autoplay = true;
localVideo.muted = true;
document.getElementById("videos").appendChild(localVideo);

let localStream;

//  Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localStream = stream;
  localVideo.srcObject = stream;

  socket.emit("join-room", roomId);

  socket.on("existing-users", users => {
    users.forEach(userId => {
      const peer = createPeer(userId);
      peers[userId] = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    });
  });

  socket.on("user-joined", userId => {
    const peer = createPeer(userId);
    peers[userId] = peer;
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
  });

  socket.on("offer", async ({ from, offer }) => {
    const peer = createPeer(from);
    peers[from] = peer;
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { target: from, answer });
  });

  socket.on("answer", async ({ from, answer }) => {
    await peers[from].setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on("ice-candidate", ({ from, candidate }) => {
    if (peers[from]) {
      peers[from].addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  socket.on("user-left", userId => {
    if (peers[userId]) {
      peers[userId].close();
      delete peers[userId];
    }
    const video = document.getElementById(userId);
    if (video) video.remove();
  });
});

// Create peer connection
function createPeer(userId) {
  const peer = new RTCPeerConnection();

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", { target: userId, candidate: e.candidate });
    }
  };

  peer.ontrack = e => {
    let video = document.getElementById(userId);
    if (!video) {
      video = document.createElement("video");
      video.id = userId;
      video.autoplay = true;
      document.getElementById("videos").appendChild(video);
    }
    video.srcObject = e.streams[0];
  };

  peer.createOffer().then(offer => {
    peer.setLocalDescription(offer);
    socket.emit("offer", { target: userId, offer });
  });

  return peer;
}

// Screen sharing
document.getElementById("shareScreenBtn").onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];

  for (const peer of Object.values(peers)) {
    const sender = peer.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(screenTrack);
  }

  localVideo.srcObject = screenStream;

  screenTrack.onended = async () => {
    const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const camTrack = camStream.getVideoTracks()[0];

    for (const peer of Object.values(peers)) {
      const sender = peer.getSenders().find(s => s.track.kind === 'video');
      if (sender) sender.replaceTrack(camTrack);
    }

    localVideo.srcObject = camStream;
    localStream = camStream;
  };
};

// File upload
function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) return alert("Select a file");

  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomId', roomId);

  fetch('/upload', {
    method: 'POST',
    body: formData
  }).then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log("Uploaded:", data);
      }
    });
}

socket.on('file-uploaded', (data) => {
  const fileList = document.getElementById('fileList');
  const link = document.createElement('a');
  link.href = data.url;
  link.textContent = `📁 Download: ${data.name}`;
  link.target = "_blank";
  fileList.appendChild(link);
  fileList.appendChild(document.createElement('br'));
});

// Whiteboard
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
ctx.lineWidth = 2;
ctx.strokeStyle = "#000";
let drawing = false;

canvas.addEventListener("mousedown", e => {
  drawing = true;
  draw(e.offsetX, e.offsetY, false);
});

canvas.addEventListener("mousemove", e => {
  if (drawing) draw(e.offsetX, e.offsetY, true);
});

canvas.addEventListener("mouseup", () => drawing = false);
canvas.addEventListener("mouseleave", () => drawing = false);

function draw(x, y, isDrawing) {
  if (isDrawing) {
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  socket.emit("draw", { x, y, isDrawing });
}

socket.on("draw", ({ x, y, isDrawing }) => {
  if (isDrawing) {
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
});

function clearBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("clear-board");
}

socket.on("clear-board", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
