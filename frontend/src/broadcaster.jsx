import React, { useEffect, useRef, useState } from "react";

function Broadcaster({ sessionId }) {
    const videoRef = useRef(null);
    const isSharingStarted = useRef(false);
    const [socket, setSocket] = useState(null);
    const [stream, setStream] = useState(null);

    useEffect(() => {
        let socketInstance = new WebSocket("ws://localhost:5000/ws");
        setSocket(socketInstance);

        socketInstance.onopen = () => {
            console.log("Broadcaster WebSocket connected");
            socketInstance.send(JSON.stringify({ type: "broadcaster", sessionId }));
        };

        socketInstance.onclose = () => {
            console.log("Broadcaster WebSocket disconnected");
        }

        socketInstance.onerror = (error) => {
            console.log("Broadcaster WebSocket error:", error);
        }

        return () => {
            if (stream) {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
            }
            if (socketInstance) {
                socketInstance.close();
                socketInstance.onopen = null;
                socketInstance.onclose = null;
                socketInstance.onerror = null;
            }
        }
    }, [sessionId]);

    useEffect(() => {
        if (!isSharingStarted.current) {
            startScreenSharing();
            isSharingStarted.current = true;
        }
    }, [stream]);

    const startScreenSharing = async () => {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });
            setStream(displayStream);
            if (videoRef.current) {
                videoRef.current.srcObject = displayStream;
            }
        } catch (err) {
            console.error("Error starting screen share:", err);
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