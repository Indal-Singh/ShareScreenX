const express = require("express");
const { v4: uuidv4 } = require('uuid');
const cors = require("cors");
const WebSocket = require("ws");

const app = express();
const PORT = 5000;

app.use(cors());

const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

let sessions = {};

wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        const data = JSON.parse(message);
        const { type, sessionId } = data;

        switch (type) {
            case "broadcaster":
                sessions[sessionId] = { broadcaster: socket }; // Store broadcaster socket
                console.log(`Broadcaster started for session: ${sessionId}`);
                break;

            case "viewer":
                if (sessions[sessionId] && sessions[sessionId].broadcaster) { // Check if broadcaster exists
                    sessions[sessionId].broadcaster.send(JSON.stringify(data));
                    console.log(`Viewer joined session: ${sessionId}`);
                } else {
                    // Important: Send message back to viewer that session is not available
                    socket.send(JSON.stringify({ type: "noBroadcaster", sessionId }));
                    console.log(`No broadcaster for session: ${sessionId}`);
                    socket.close(); // Close the viewer's socket as no broadcaster is present
                }
                break;

            case "signal":
                if (sessions[sessionId] && sessions[sessionId].broadcaster) {
                    sessions[sessionId].broadcaster.send(JSON.stringify(data));
                }
                break;

            default:
                console.log("Invalid message type");
        }
    });

    socket.on("close", () => {
        // Clean up sessions (improved)
        for (const sessionId in sessions) {
            if (sessions[sessionId].broadcaster === socket) {
                delete sessions[sessionId];
                console.log(`Broadcaster disconnected, session ${sessionId} closed.`);
                break; // Important: Exit loop after finding the broadcaster
            }
        }
    });
});

app.get("/create-session", (req, res) => {
    const sessionId = uuidv4();
    res.json({ sessionId });
});

server.listen(PORT, () =>
    console.log(`Signaling server running on http://localhost:${PORT}`)
);