import { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import io from "socket.io-client";

const socket = io("http://15.235.186.205:3004");

const ScreenSharing = () => {
    const [shareId, setShareId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(false);
    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const peerConnections = useRef({});
    const localStream = useRef(null);
    const STUN_SERVERS = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    // Function to start sharing screen
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
            console.error("Error starting screen sharing stream:", error);
        }
    };

    useEffect(() => {
        if (!joinedRoom) return;

        socket.on("user-connected", (userId) => {
            console.log("User connected:", userId);
            if (!peerConnections.current[userId]) {
                connectToPeer(userId);
            }
        });

        socket.on("signal", (data) => {
            console.log("Signal received:", data);
            if (data.type === "offer") {
                handleOffer(data);
            } else if (data.type === "answer") {
                peerConnections.current[data.source].setRemoteDescription(new RTCSessionDescription(data.description));
            } else if (data.type === "candidate") {
                peerConnections.current[data.source].addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        socket.on("user-disconnected", (userId) => {
            console.log("User disconnected:", userId);
            if (remoteVideoRefs.current[userId]) {
                delete remoteVideoRefs.current[userId]; // Delete video reference
            }
            if (peerConnections.current[userId]) {
                peerConnections.current[userId].close(); // Close connection
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

    const handleTrack = (event, source) => {
        const [remoteStream] = event.streams;
        remoteVideoRefs.current[source] = remoteStream;
        console.log(`Remote track received from: ${source}`);
    };

    const connectToPeer = (peerId) => {
        if (peerConnections.current[peerId]) return; // Avoid multiple connections

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

        // Create and send the offer
        peer.createOffer().then((offer) => {
            peer.setLocalDescription(offer);
            socket.emit("signal", {
                target: peerId,
                type: "offer",
                description: offer,
            });
        }).catch((error) => console.error("Error creating offer:", error));
    };

    const handleOffer = (data) => {
        const peer = new RTCPeerConnection(STUN_SERVERS);
        peerConnections.current[data.source] = peer;

        localStream.current
            .getTracks()
            .forEach((track) => peer.addTrack(track, localStream.current));

        peer.ontrack = (event) => handleTrack(event, data.source);
        peer.setRemoteDescription(new RTCSessionDescription(data.description));

        peer.createAnswer()
            .then((answer) => {
                peer.setLocalDescription(answer);
                socket.emit("signal", {
                    target: data.source,
                    type: "answer",
                    description: answer,
                });
            })
            .catch((error) => console.error("Error creating answer:", error));
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
                    {Object.keys(remoteVideoRefs.current).map((userId) => (
                        <video key={userId} ref={(el) => remoteVideoRefs.current[userId] = el} autoPlay playsInline></video>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ScreenSharing;
