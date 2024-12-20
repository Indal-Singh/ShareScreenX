const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;

// Store users in a room
const rooms = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    rooms[roomId].push(socket.id);
    socket.join(roomId);

    // Notify other users in the room
    socket.to(roomId).emit("user-connected", socket.id);

    // Handle signaling events
    socket.on("signal", (data) => {
      io.to(data.target).emit("signal", {
        source: socket.id,
        ...data,
      });
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
