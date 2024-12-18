// server.js
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const WebSocket = require("ws");
const http = require("http");

const app = express();
const PORT = 5000;

// Enhanced CORS configuration
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ 
    server,
    path: "/ws", // Added correct WebSocket path for routing
});

let sessions = {};

wss.on("connection", (socket, req) => {
    console.log("New WebSocket connection established");

    socket.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received message:", data);

            // Add logic to forward signals/messages between broadcaster and receiver
            if (data.type === "signal" && data.sessionId) {
                // Send signal data to specific clients (e.g., viewer or broadcaster)
                // Extend session/sessionId management here
            }
        } catch (error) {
            console.error("Message parsing error:", error);
        }
    });

    socket.on("error", (error) => {
        console.error("WebSocket error:", error);
    });
});

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ 
        status: "WebSocket server running", 
        activeSessions: Object.keys(sessions).length 
    });
});

app.get("/create-session", (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = {}; // Add session management
    res.json({ sessionId });
});

// Important: Listen on all network interfaces
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
