import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function Broadcaster({ sessionId }) {
    const videoRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const isScreenShared = useRef(false); // Prevent multiple screen-sharing executions

    useEffect(() => {
        // Initialize Socket.IO connection only once
        if (!socket) {
            const socketInstance = io("http://localhost:5000");
            setSocket(socketInstance);

            socketInstance.on("connect", () => {
                console.log("🎥 Broadcaster connected:", socketInstance.id);
                socketInstance.emit("joinSession", { type: "broadcaster", sessionId });
            });

            socketInstance.on("joinedSession", (data) => {
                console.log("Broadcaster session confirmed:", data);
            });

            return () => {
                socketInstance.disconnect();
            };
        }
    }, [socket, sessionId]); // Dependency ensures it runs once per session

    useEffect(() => {
        // Prevent multiple screen shares
        if (!isScreenShared.current) {
            startScreenShare();
            isScreenShared.current = true;
        }
    }, []);

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });
            if (videoRef.current) videoRef.current.srcObject = stream;
            console.log("🎥 Screen sharing started!");
        } catch (error) {
            console.error("❌ Screen sharing error:", error);
        }
    };

    return (
        <div>
            <h2>Broadcasting session ID: {sessionId}</h2>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%" }} />
        </div>
    );
}

export default Broadcaster;
