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

    // Track active sockets for disconnection purposes
    const remoteAddress = req.socket.remoteAddress;
    console.log(`Client connected: ${remoteAddress}`);
    
    socket.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received message:", data);

            if (data.type === "signal" && data.sessionId) {
                // Your logic to manage connections/messages between broadcaster and viewer
                console.log(`Signal message received for session ${data.sessionId}`);
            }
        } catch (error) {
            console.error("Message parsing error:", error);
        }
    });

    // Handle WebSocket errors
    socket.on("error", (error) => {
        console.error(`WebSocket error from ${remoteAddress}:`, error);
    });

    // Handle WebSocket disconnections
    socket.on("close", (code, reason) => {
        console.log(`Client disconnected: ${remoteAddress}`);
        console.log(`Disconnection reason: ${reason} (Code: ${code})`);

        // Optionally, clean up resources for disconnected clients or sessions
        Object.keys(sessions).forEach((sessionId) => {
            if (sessions[sessionId][remoteAddress]) {
                delete sessions[sessionId][remoteAddress];
                console.log(`Removed disconnected client from session ${sessionId}`);
            }
        });
    });
});

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ 
        status: "WebSocket server running", 
        activeSessions: Object.keys(sessions).length 
    });
});

// Endpoint to create a new session
app.get("/create-session", (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = {}; // Store session data for managing clients
    res.json({ sessionId });
});

// Listen for HTTP connections
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
