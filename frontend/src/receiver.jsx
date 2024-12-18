import React, { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";

function Receiver({ sessionId }) {
    const videoRef = useRef(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null); // Prevent duplicate peer creation
    const [connectionStatus, setConnectionStatus] = useState("Connecting");

    useEffect(() => {
        const connectWebSocket = () => {
            // Cleanup old socket if it exists before retrying
            if (socketRef.current) {
                console.warn("Closing existing WebSocket before retry.");
                socketRef.current.close();
                socketRef.current = null; // Clear reference
            }

            const socket = new WebSocket("ws://localhost:5000/ws");

            socket.onopen = () => {
                console.log("Receiver WebSocket connected");
                setConnectionStatus("Connected");

                socket.send(
                    JSON.stringify({
                        type: "viewer",
                        sessionId,
                    })
                );
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "signal") {
                        handleSignal(data.signal);
                    } else if (data.type === "noBroadcaster") {
                        setConnectionStatus("No Broadcaster Available");
                    } else {
                        console.log("Unhandled message type:", data.type);
                    }
                } catch (error) {
                    console.error("Message processing error:", error);
                }
            };

            socket.onerror = (error) => {
                console.error("Receiver WebSocket error:", error);
                setConnectionStatus("Connection Failed");
            };

            socket.onclose = () => {
                if (socketRef.current) {
                    console.warn("WebSocket disconnected. Retrying...");
                    setTimeout(connectWebSocket, 3000); // Retry connection
                }
                setConnectionStatus("Disconnected");
            };

            socketRef.current = socket;
        };

        const handleSignal = (signal) => {
            if (peerRef.current) {
                console.warn("Peer already exists, skipping re-initialization.");
                return;
            }

            const peer = new SimplePeer({
                initiator: false,
                trickle: false,
            });

            peer.on("signal", (peerSignal) => {
                socketRef.current?.send(
                    JSON.stringify({
                        type: "signal",
                        sessionId,
                        signal: peerSignal,
                    })
                );
            });

            peer.on("stream", (stream) => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setConnectionStatus("Stream Active");
                }
            });

            peer.on("error", (error) => {
                console.error("Peer connection error:", error);
                setConnectionStatus("Connection Failed");
            });

            peer.signal(signal);
            peerRef.current = peer; // Track peer to prevent duplicates
        };

        connectWebSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null; // Clear on unmount
            }
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null; // Clear on unmount
            }
        };
    }, [sessionId]);

    return (
        <div>
            <h2>Receiver</h2>
            <div>Connection Status: {connectionStatus}</div>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: "100%", backgroundColor: "black" }}
            />
        </div>
    );
}

export default Receiver;
