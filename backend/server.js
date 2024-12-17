const express = require("express");
const { v4: uuidv4 } = require("crypto"); // To generate unique random strings
const cors = require("cors");
const WebSocket = require("ws");

const app = express();
const PORT = 5000;

// CORS Setup for local testing
app.use(cors());

// WebSocket Server
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

let sessions = {}; // Store broadcasters and viewers

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    const data = JSON.parse(message);
    const { type, sessionId } = data;

    switch (type) {
      case "broadcaster":
        // Register broadcaster
        sessions[sessionId] = socket;
        console.log(`Broadcaster started for session: ${sessionId}`);
        break;

      case "viewer":
        // Send broadcaster signaling to the viewer
        if (sessions[sessionId]) {
          sessions[sessionId].send(JSON.stringify(data));
          console.log(`Viewer joined session: ${sessionId}`);
        } else {
          socket.send(JSON.stringify({ error: "Invalid session" }));
        }
        break;

      case "signal":
        // Pass signals between broadcaster and viewer
        const targetSocket = sessions[sessionId];
        if (targetSocket) {
          targetSocket.send(JSON.stringify(data));
        }
        break;

      default:
        console.log("Invalid message type");
    }
  });

  socket.on("close", () => {
    // Clean up sessions when broadcaster disconnects
    Object.keys(sessions).forEach((key) => {
      if (sessions[key] === socket) delete sessions[key];
    });
  });
});

// Route to get random sessionId
app.get("/create-session", (req, res) => {
  const sessionId = uuidv4();
  res.json({ sessionId });
});

server.listen(PORT, () =>
  console.log(`Signaling server running on http://localhost:${PORT}`)
);
