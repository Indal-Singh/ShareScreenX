import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function Broadcaster({ sessionId }) {
    const [socket, setSocket] = useState(null);
    const videoRef = useRef(null);
    const peerRefs = useRef({}); // Stores peer connections for each receiver
    const [localStream, setLocalStream] = useState(null);

    useEffect(() => {
        const socketInstance = io("http://localhost:5000");
        setSocket(socketInstance);

        // Join the room as a broadcaster
        socketInstance.emit("joinRoom", sessionId);

        socketInstance.on("signal", ({ senderId, data }) => {
            if (!peerRefs.current[senderId]) {
                const peer = createPeerConnection(senderId, socketInstance);
                peerRefs.current[senderId] = peer;
            }
            peerRefs.current[senderId].setRemoteDescription(new RTCSessionDescription(data));
        });

        return () => {
            socketInstance.disconnect();
            Object.values(peerRefs.current).forEach((peer) => peer.close());
        };
    }, [sessionId]);

    const createPeerConnection = (receiverId, socket) => {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
            ],
        });

        // Send ICE candidates to the Receiver
        peer.onicecandidate = ({ candidate }) => {
            if (candidate) {
                socket.emit("signal", { roomId: sessionId, targetId: receiverId, data: candidate });
            }
        };

        peer.onnegotiationneeded = async () => {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit("signal", { roomId: sessionId, targetId: receiverId, data: offer });
        };

        // Attach the local stream to the Peer Connection
        if (localStream) {
            localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
        }

        return peer;
    };

    const startScreenSharing = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);

            // Display local stream in the video element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Attach the stream tracks to all current peers
            Object.values(peerRefs.current).forEach((peer) =>
                stream.getTracks().forEach((track) => peer.addTrack(track, stream))
            );
        } catch (error) {
            console.error("Error sharing screen:", error);
        }
    };

    return (
        <div>
            <h2>Broadcasting Session: {sessionId}</h2>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%" }} />
            <button onClick={startScreenSharing}>Start Screen Sharing</button>
        </div>
    );
}

export default Broadcaster;
