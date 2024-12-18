import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import SimplePeer from "simple-peer";

function Receiver({ sessionId }) {
    const videoRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const peerRef = useRef(null);

    useEffect(() => {
        const socketInstance = io("http://localhost:5000");
        setSocket(socketInstance);

        socketInstance.on("connect", () => {
            console.log("👁 Receiver connected:", socketInstance.id);
            socketInstance.emit("joinSession", { type: "viewer", sessionId });
        });

        socketInstance.on("signal", ({ senderId, signal }) => {
            if (!peerRef.current) {
                const peer = new SimplePeer({
                    initiator: false,
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

                peer.on("stream", (stream) => {
                    console.log("🎥 Stream received:", stream);
                    if (videoRef.current) videoRef.current.srcObject = stream;
                });

                peerRef.current = peer;
            }

            // Handle incoming signaling data
            peerRef.current.signal(signal);
        });

        return () => {
            socketInstance.disconnect();
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };
    }, [sessionId]);

    return (
        <div>
            <h2>Receiver</h2>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%", backgroundColor: "black" }} />
        </div>
    );
}

export default Receiver;
