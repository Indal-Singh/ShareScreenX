const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const cors = require('cors');

const app = express();
const PORT = 5000;

// HTTP server
const server = http.createServer(app);

// Attach Socket.IO to the server
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for testing; restrict in production
    },
});

let sessions = {};

// Handle Socket.IO connections
io.on("connection", (socket) => {
    console.log("✅ A new client connected:", socket.id);

    // Handle joining a session
    socket.on("joinSession", (data) => {
        const { type, sessionId } = data;

        if (!sessions[sessionId]) {
            sessions[sessionId] = { broadcaster: null, viewers: [] };
        }

        if (type === "broadcaster") {
            sessions[sessionId].broadcaster = socket.id;
            console.log(`🎥 Broadcaster joined session: ${sessionId}`);
        } else if (type === "viewer") {
            sessions[sessionId].viewers.push(socket.id);
            console.log(`👁 Viewer joined session: ${sessionId}`);
        }

        // Notify all clients in the session about the update
        io.to(socket.id).emit("joinedSession", { sessionId });
    });

    // Handle signaling messages
    socket.on("signal", (data) => {
        const { targetId, signal } = data;

        if (targetId) {
            io.to(targetId).emit("signal", {
                senderId: socket.id,
                signal,
            });
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`❌ Client disconnected: ${socket.id}`);

        // Clean up sessions
        for (const sessionId in sessions) {
            const session = sessions[sessionId];
            if (session.broadcaster === socket.id) {
                delete sessions[sessionId]; // Remove the entire session
                console.log(`🎬 Session ended: ${sessionId}`);
            } else {
                const viewerIndex = session.viewers.indexOf(socket.id);
                if (viewerIndex !== -1) {
                    session.viewers.splice(viewerIndex, 1);
                    console.log(`👁 Viewer left session: ${sessionId}`);
                }
            }
        }
    });
});
app.use(cors());
// Endpoint to create a session
app.get("/create-session", (req, res) => {
    const sessionId = uuidv4();
    res.json({ sessionId });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
