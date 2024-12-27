import { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import io from "socket.io-client";

const socket = io("http://15.235.186.205:3004");

const ScreenSharing = () => {
    const [shareId, setShareId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(false);
    const [isSender, setIsSender] = useState(false);
    const localVideoRef = useRef(null);
    const remoteStreams = useRef({});
    const peerConnections = useRef({});
    const candidateQueues = useRef({});
    const localStream = useRef(null);
    const STUN_SERVERS = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

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

        socket.on("user-connected", (userId) => {
            console.log("User connected:", userId);
            if (isSender && !peerConnections.current[userId]) {
                connectToPeer(userId);
            }
        });

        socket.on("signal", (data) => {
            console.log("Signal received:", data);
            console.log(data,data.source, data.target);
            const peer = peerConnections.current[data.source];
            if (data.type === "offer" && !isSender) {
                handleOffer(data);
            } else if (data.type === "answer") {
                peer.setRemoteDescription(new RTCSessionDescription(data.description));
            } else if (data.type === "candidate") {
                if (peer) {
                    if (peer.remoteDescription) {
                        peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
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
    }, [joinedRoom, isSender]);

    const handleTrack = (event, source) => {
        const [remoteStream] = event.streams;
        remoteStreams.current[source] = remoteStream;

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

        if (isSender && localStream.current) {
            localStream.current
                .getTracks()
                .forEach((track) => peer.addTrack(track, localStream.current));
        }

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE as candidate candidate to:", peerId);
                
                socket.emit("signal", {
                    target: peerId,
                    type: "candidate",
                    candidate: event.candidate,
                });
            }
        };

        peer.ontrack = (event) => handleTrack(event, peerId);

        if (isSender) {
            console.log("Creating offer for:", peerId);
            
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
        }
    };

    const handleOffer = (data) => {
        console.log(data);
        const peer = new RTCPeerConnection(STUN_SERVERS);
        peerConnections.current[data.source] = peer;

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("signal", {
                    target: data.source,
                    type: "candidate",
                    candidate: event.candidate,
                });
            }
        };

        peer.ontrack = (event) => handleTrack(event, data.source);

        peer.setRemoteDescription(new RTCSessionDescription(data.description))
            .then(() => peer.createAnswer())
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

    const handleJoinRoom = (id, role) => {
        if (id.trim() !== "") {
            console.log("Joining room:", id, role);
            // Tell server if user is a creator or viewer
            socket.emit("join-room", { id, role });
            setJoinedRoom(true);
            setShareId(id);
            if (role === "creator") {
                startStream();
            }
        }
    };
    
    // For Room Creator
    const handleCreateRoom = () => {
        const newRoomId = uuidv4();
        setShareId(newRoomId);
        setIsSender(true);
        handleJoinRoom(newRoomId, "creator"); // Pass role as 'creator'
    };
    
    // For Viewers to Join
    const handleJoinAsViewer = () => {
        if (roomId.trim() !== "") {
            handleJoinRoom(roomId, "viewer"); // Pass role as 'viewer'
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
                        <button onClick={handleJoinAsViewer}>Join as Viewer</button>
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
