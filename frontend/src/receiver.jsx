import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import SimplePeer from "simple-peer";

function Receiver({ sessionId }) {
    const videoRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("Connecting");
    const peerRef = useRef(null);

    useEffect(() => {
        const socketInstance = io("http://localhost:5000");
        setSocket(socketInstance);

        socketInstance.on("connect", () => {
            console.log("👁 Receiver connected:", socketInstance.id);
            socketInstance.emit("joinSession", { type: "viewer", sessionId });
        });

        socketInstance.on("joinedSession", (data) => {
            console.log("Viewer session confirmed:", data);
            setConnectionStatus("Connected");
        });

        socketInstance.on("signal", ({ senderId, signal }) => {
            if (!peerRef.current) {
                const peer = new SimplePeer({ initiator: false, trickle: false });

                peer.on("signal", (peerSignal) => {
                    socketInstance.emit("signal", {
                        targetId: senderId,
                        signal: peerSignal,
                    });
                });

                peer.on("stream", (stream) => {
                    videoRef.current.srcObject = stream;
                    setConnectionStatus("Stream Active");
                });

                peerRef.current = peer;
            }
            peerRef.current.signal(signal);
        });

        return () => {
            socketInstance.disconnect();
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
