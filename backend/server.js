const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; // Keeps track of peers in each room

io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Handle joining a room
    socket.on("joinRoom", (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        rooms[roomId].push(socket.id);
        socket.join(roomId);

        console.log(`${socket.id} joined room: ${roomId}`);
        console.log("Current room members:", rooms[roomId]);

        // Notify other clients in the room
        io.to(roomId).emit("roomUpdate", { roomId, clients: rooms[roomId] });
    });

    // Relay signaling data (offer/answer/ICE candidates) within the room
    socket.on("signal", ({ roomId, targetId, data }) => {
        io.to(targetId).emit("signal", { senderId: socket.id, data });
    });

    // Handle disconnections and room cleanup
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId]; // Remove empty rooms
            } else {
                io.to(roomId).emit("roomUpdate", { roomId, clients: rooms[roomId] });
            }
        }
    });
});

server.listen(5000, () => console.log("Server running on port 5000"));
