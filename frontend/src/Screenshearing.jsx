import { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import io from "socket.io-client";

const socket = io("http://15.235.186.205:3004");

const ScreenSharing = () => {
    const [shareId, setShareId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(false);
    const localVideoRef = useRef(null);
    const remoteStreams = useRef({});
    const peerConnections = useRef({});
    const candidateQueues = useRef({});
    const localStream = useRef(null);
    const STUN_SERVERS = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    // Function to start screen sharing
    const startStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            localStream.current = stream;
            localVideoRef.current.srcObject = stream;

            stream.getTracks().forEach((track) => {
                for (const peer of Object.values(peerConnections.current)) {
                    peer.addTrack(track, stream);
                }
            });
        } catch (error) {
            console.error("Error starting screen sharing:", error);
        }
    };

    useEffect(() => {
        if (!joinedRoom) return;

        // When a user connects
        socket.on("user-connected", (userId) => {
            console.log("User connected:", userId);
            if (!peerConnections.current[userId]) {
                connectToPeer(userId);
            }
        });

        // Handle incoming signals
        socket.on("signal", (data) => {
            console.log("Signal received:", data);

            const peer = peerConnections.current[data.source];
            if (data.type === "offer") {
                handleOffer(data);
            } else if (data.type === "answer") {
                peer.setRemoteDescription(new RTCSessionDescription(data.description));
            } else if (data.type === "candidate") {
                if (peer) {
                    // If the remote description is already set, add the candidate
                    if (peer.remoteDescription) {
                        peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
                        // Otherwise, queue the candidate for later
                        if (!candidateQueues.current[data.source]) {
                            candidateQueues.current[data.source] = [];
                        }
                        candidateQueues.current[data.source].push(data.candidate);
                    }
                } else {
                    console.error("Peer not found for ICE candidate");
                }
            }
        });


        // Handle user disconnections
        socket.on("user-disconnected", (userId) => {
            console.log("User disconnected:", userId);
            if (remoteStreams.current[userId]) {
                delete remoteStreams.current[userId];
            }
            if (peerConnections.current[userId]) {
                peerConnections.current[userId].close();
                delete peerConnections.current[userId];
            }
        });

        return () => {
            socket.disconnect();
            if (localStream.current) {
                localStream.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, [joinedRoom]);

    // Handle incoming remote tracks
    const handleTrack = (event, source) => {
        const [remoteStream] = event.streams;
        remoteStreams.current[source] = remoteStream;

        // Set video element's srcObject dynamically
        const videoElement = document.getElementById(`remoteVideo-${source}`);
        if (videoElement) {
            videoElement.srcObject = remoteStream;
        }

        console.log(`Remote track received from: ${source}`);
    };

    const connectToPeer = (peerId) => {
        if (peerConnections.current[peerId]) return;

        const peer = new RTCPeerConnection(STUN_SERVERS);
        peerConnections.current[peerId] = peer;

        // Add local tracks to the peer connection
        localStream.current
            .getTracks()
            .forEach((track) => peer.addTrack(track, localStream.current));

        // Handle ICE candidate events
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("signal", {
                    target: peerId,
                    type: "candidate",
                    candidate: event.candidate,
                });
            }
        };

        // Handle incoming remote tracks
        peer.ontrack = (event) => handleTrack(event, peerId);

        // Add a queue to handle delayed ICE candidates
        peer.oniceconnectionstatechange = () => {
            if (peer.iceConnectionState === "connected") {
                console.log(`Peer connection with ${peerId} established`);
            }
        };

        // Create and send the offer
        peer.createOffer()
            .then((offer) => {
                peer.setLocalDescription(offer);
                socket.emit("signal", {
                    target: peerId,
                    type: "offer",
                    description: offer,
                });
            })
            .catch((error) => console.error("Error creating offer:", error));
    };

    const handleOffer = (data) => {
        const peer = new RTCPeerConnection(STUN_SERVERS);
        peerConnections.current[data.source] = peer;

        if (localStream.current) {
            localStream.current
                .getTracks()
                .forEach((track) => peer.addTrack(track, localStream.current));
        }

        peer.setRemoteDescription(new RTCSessionDescription(data.description))
            .then(() => {
                // Handle queued candidates once the remote description is set
                if (candidateQueues.current[data.source]) {
                    candidateQueues.current[data.source].forEach((candidate) => {
                        peer.addIceCandidate(new RTCIceCandidate(candidate));
                    });
                    candidateQueues.current[data.source] = [];
                }
                return peer.createAnswer();
            })
            .then((answer) => {
                peer.setLocalDescription(answer);
                socket.emit("signal", {
                    target: data.source,
                    type: "answer",
                    description: answer,
                });
            })
            .catch((error) => console.error("Error handling offer:", error));
    };

    const handleJoinRoom = (id, isCreate = false) => {
        if (id.trim() !== "") {
            socket.emit("join-room", id);
            setJoinedRoom(true);
            setShareId(id);
            if (isCreate) {
                startStream();
            }
        }
    };

    const handleCreateRoom = () => {
        const newRoomId = uuidv4();
        setShareId(newRoomId);
        handleJoinRoom(newRoomId, true);
    };

    const handleJoinExistingRoom = () => {
        if (roomId.trim() !== "") {
            handleJoinRoom(roomId, false);
        } else {
            alert("Please enter a valid Room ID.");
        }
    };

    return (
        <div>
            <h1>Screen Sharing</h1>
            {!joinedRoom ? (
                <div>
                    <button onClick={handleCreateRoom}>Create Room & Share</button>
                    <div style={{ margin: "20px 0" }}>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Enter Room ID to Join"
                        />
                        <button onClick={handleJoinExistingRoom}>Join Room</button>
                    </div>
                </div>
            ) : (
                <div>
                    <h2>Share ID (Room ID): {shareId}</h2>
                    <video ref={localVideoRef} id="localVideo" autoPlay playsInline muted></video>
                    {Object.keys(remoteStreams.current).map((userId) => (
                        <video
                            key={userId}
                            id={`remoteVideo-${userId}`}
                            autoPlay
                            playsInline
                        ></video>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ScreenSharing;
