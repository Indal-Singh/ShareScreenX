import React, { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";

function Receiver({ sessionId }) {
    const videoRef = useRef(null);
    const [peer, setPeer] = useState(null);
    const [socket, setSocket] = useState(null); // Store socket in state

    useEffect(() => {
        let currentPeer;
        let socketInstance;

        const initializeSocket = () => {
            socketInstance = new WebSocket("ws://localhost:5000");
            setSocket(socketInstance); // Update socket state

            console.log("Receiver sessionId:", sessionId);
            console.log("Socket state on mount:", socketInstance.readyState);

            socketInstance.onopen = () => {
                console.log("WebSocket connection opened");
                socketInstance.send(JSON.stringify({ type: "viewer", sessionId }));
            };

            socketInstance.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            socketInstance.onclose = () => {
                console.log("WebSocket connection closed");
            };

            socketInstance.onmessage = (message) => {
                const data = JSON.parse(message.data);
                if (data.type === "signal") {
                    if (!currentPeer) {
                        createPeer();
                    }
                    currentPeer.signal(data.signal);
                }
                if (data.type === "noBroadcaster") {
                    alert("No broadcaster available for this session.")
                }
            };
        }
        initializeSocket();

        const createPeer = () => {
            currentPeer = new SimplePeer({ initiator: false, trickle: false });

            currentPeer.on('error', err => console.error('peer error', err));
            currentPeer.on('signal', signal => {
                console.log("Sending Signal:", signal);
                if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
                    socketInstance.send(JSON.stringify({ type: 'signal', sessionId, signal }));
                } else {
                    console.error("Socket is not open. Cannot send signal.");
                }
            });
            currentPeer.on('stream', stream => {
                if (videoRef.current) videoRef.current.srcObject = stream;
            });
            setPeer(currentPeer);
        };

        return () => {
            console.log("Cleaning up Receiver component");
            if (currentPeer) {
                currentPeer.destroy();
            }
            if (socketInstance) {
                socketInstance.close();
                socketInstance.onopen = null;
                socketInstance.onmessage = null;
                socketInstance.onerror = null;
                socketInstance.onclose = null;
            }
        };
    }, [sessionId]);

    return (
        <div>
            <h2>Receiver</h2>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
        </div>
    );
}

export default Receiver;