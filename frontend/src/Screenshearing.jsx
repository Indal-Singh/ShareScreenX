import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import io from "socket.io-client";

const socket = io("http://15.235.186.205:3004");

const ScreenSharing = () => {
    const [shareId, setShareId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(false);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnections = useRef({});
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
            console.error("Error starting screen sharing stream:", error);
        }
    };

    const handleTrack = (event, source) => {
        const [remoteStream] = event.streams;
        remoteVideoRef.current.srcObject = remoteStream;
        console.log(`Remote track received from: ${source}`);
    };

    const handleOffer = (data) => {
        const peer = new RTCPeerConnection(STUN_SERVERS);
        peerConnections.current[data.source] = peer;

        // Add tracks from the local stream
        localStream.current
            .getTracks()
            .forEach((track) => peer.addTrack(track, localStream.current));

        // Handle track events for remote peers
        peer.ontrack = (event) => handleTrack(event, data.source);

        peer.setRemoteDescription(new RTCSessionDescription(data.description));

        // Create an answer once the offer is received and set the local description
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

    socket.on("signal", (data) => {
        console.log("Signal received:", data);
        if (data.type === "offer") {
            handleOffer(data);
        } else if (data.type === "answer") {
            const peer = peerConnections.current[data.source];
            if (peer) {
                peer.setRemoteDescription(new RTCSessionDescription(data.description));
            }
        } else if (data.type === "candidate") {
            const peer = peerConnections.current[data.source];
            if (peer) {
                peer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((error) =>
                    console.error("Error adding ICE candidate:", error)
                );
            }
        }
    });

    const handleJoinRoom = (id, isCreate = false) => {
        if (id.trim() !== "") {
            socket.emit("join-room", id);
            console.log("Joining room:", id);
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
                    <video ref={remoteVideoRef} id="remoteVideo" autoPlay playsInline></video>
                </div>
            )}
        </div>
    );
};

export default ScreenSharing;
