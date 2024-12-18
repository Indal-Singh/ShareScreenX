import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import SimplePeer from "simple-peer";

function Broadcaster({ sessionId }) {
    const videoRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const peerRefs = useRef({}); // Store peers for each viewer

    useEffect(() => {
        if (!socket) {
            const socketInstance = io("http://localhost:5000");
            setSocket(socketInstance);

            socketInstance.on("connect", () => {
                console.log("🎥 Broadcaster connected:", socketInstance.id);
                socketInstance.emit("joinSession", { type: "broadcaster", sessionId });
            });

            socketInstance.on("signal", ({ senderId, signal }) => {
                if (!peerRefs.current[senderId]) {
                    const peer = new SimplePeer({
                        initiator: true,
                        trickle: false,
                        config: {
                            iceServers: [
                                { urls: "stun:stun.l.google.com:19302" },
                                {
                                    urls: "turn:your-turn-server-url",
                                    username: "your-username",
                                    credential: "your-credential",
                                },
                            ],
                        },
                    });

                    peer.on("signal", (peerSignal) => {
                        socketInstance.emit("signal", {
                            targetId: senderId,
                            signal: peerSignal,
                        });
                    });

                    peerRefs.current[senderId] = peer;
                }

                // Handle incoming signaling data
                peerRefs.current[senderId].signal(signal);
            });

            return () => {
                socketInstance.disconnect();
                Object.values(peerRefs.current).forEach((peer) => peer.destroy());
                peerRefs.current = {};
            };
        }
    }, [socket, sessionId]);

    useEffect(() => {
        const startScreenShare = async () => {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true,
                });

                if (videoRef.current) videoRef.current.srcObject = stream;

                // Add tracks to peers
                Object.values(peerRefs.current).forEach((peer) =>
                    stream.getTracks().forEach((track) => peer.addTrack(track, stream))
                );
            } catch (error) {
                console.error("❌ Error sharing screen:", error);
            }
        };

        startScreenShare();
    }, []);

    return (
        <div>
            <h2>Broadcasting session ID: {sessionId}</h2>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%" }} />
        </div>
    );
}

export default Broadcaster;
