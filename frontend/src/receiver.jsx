import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function Receiver({ sessionId }) {
    const [socket, setSocket] = useState(null);
    const videoRef = useRef(null);
    const peerRef = useRef(null); // Single PeerConnection
    const [remoteStream, setRemoteStream] = useState(new MediaStream()); // Empty MediaStream

    useEffect(() => {
        const socketInstance = io("http://localhost:5000");
        setSocket(socketInstance);

        // Join the room as a viewer
        socketInstance.emit("joinRoom", sessionId);

        // Create RTCPeerConnection
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
            ],
        });

        // Handle ICE candidates from the Broadcaster
        peer.onicecandidate = ({ candidate }) => {
            if (candidate) {
                socketInstance.emit("signal", { roomId: sessionId, targetId: sessionId, data: candidate });
            }
        };

        // Handle remote tracks and attach them to the video element
        peer.ontrack = (event) => {
            console.log("Received remote stream:", event.streams[0]);
            setRemoteStream(event.streams[0]); // Update state with the incoming stream
        };

        // Handle incoming signaling data
        socketInstance.on("signal", async ({ senderId, data }) => {
            if (data.type === "offer") {
                await peer.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socketInstance.emit("signal", { roomId: sessionId, targetId: senderId, data: answer });
            } else if (data.candidate) {
                await peer.addIceCandidate(new RTCIceCandidate(data));
            }
        });

        peerRef.current = peer;

        return () => {
            socketInstance.disconnect();
            peer.close();
        };
    }, [sessionId]);

    // Attach remoteStream to the video element when it updates
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <div>
            <h2>Receiving Broadcast from Session: {sessionId}</h2>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
        </div>
    );
}

export default Receiver;
