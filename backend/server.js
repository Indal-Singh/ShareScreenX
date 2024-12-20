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

const PORT = 3004;

// Store users in a room
const rooms = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
  
    // Check and log the current users before joining
    console.log(`Current users in room ${roomId}:`, rooms[roomId]);
  
    rooms[roomId].push(socket.id); // Add the user to the room
    socket.join(roomId); // Join the room
  
    // Emit the "user-connected" event to all others in the room
    socket.to(roomId).emit("user-connected", socket.id);
    
    // Send a message if no other users are connected in the room
    if (rooms[roomId].length === 1) {
      console.log(`Room ${roomId} is empty, no users are connected.`);
    } else {
      console.log(`Room ${roomId} has ${rooms[roomId].length} users connected.`);
    }
  
    // Signal handling logic here
    socket.on("signal", (data) => {
      io.to(data.target).emit("signal", {
        source: socket.id,
        ...data,
      });
    });
  
    // Handling user disconnection
    socket.on("disconnect", () => {
      console.log(`User ${socket.id} disconnected from room ${roomId}`);
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      socket.to(roomId).emit("user-disconnected", socket.id);
      
      // If no more users left, remove the room from the object (optional)
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} has been deleted.`);
      }
    });  
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
