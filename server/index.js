const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize Express and HTTP server
const app = express();
const server = http.createServer(app);

// Set up Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const uploadPage = path.join(__dirname, 'client/upload.html');

app.get('/upload-view', (req, res) => {
  res.sendFile(uploadPage);
});


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('client'));
app.use('/uploads', express.static(uploadDir)); // Serve uploaded files

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


//file upload
app.post('/upload', upload.single('file'), (req, res) => {
  const roomId = req.body.roomId;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

  const fileUrl = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;

  // Emit only to users in the specific room
  io.to(roomId).emit('file-uploaded', { url: fileUrl, name: fileName });

  res.status(200).json({ success: true, url: fileUrl, name: fileName });
});


// Serve HTML for room-based URL
const clientPath = path.join(__dirname, 'client/index.html');
app.get('/room/:roomId', (req, res) => {
  res.sendFile(clientPath);
});

// Room state
const rooms = {};

// WebSocket connection handler
io.on('connection', socket => {
  console.log("User connected:", socket.id);

  // Join room
  socket.on("join-room", roomId => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    // Notify the new user of existing peers
    const others = rooms[roomId].filter(id => id !== socket.id);
    socket.emit("existing-users", others);

    // Notify others in the room
    socket.to(roomId).emit("user-joined", socket.id);
  });

  // WebRTC signaling
  socket.on("offer", ({ target, offer }) => {
    io.to(target).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ target, answer }) => {
    io.to(target).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    io.to(target).emit("ice-candidate", { from: socket.id, candidate });
  });

  // Whiteboard events
  socket.on("draw", data => {
    socket.to(socket.roomId).emit("draw", data);
  });

  socket.on("clear-board", () => {
    socket.to(socket.roomId).emit("clear-board");
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      socket.to(roomId).emit("user-left", socket.id);
      if (rooms[roomId].length === 0){ 
        delete rooms[roomId];
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(3000, () => {
  console.log(" RTC App server running at http://localhost:3000");
});
