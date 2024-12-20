import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://15.235.186.205:3004");

const Meeting = () => {
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true); // Camera off by default
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState({});

    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const localStream = useRef(null);

    const STUN_SERVERS = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    const startStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localStream.current = stream;
            if (localVideoRef.current) {
                if (isCameraOn) {
                    localVideoRef.current.srcObject = stream;
                } else {
                    localVideoRef.current.srcObject = null;
                }
                console.log("Media stream is set to video element");
            }
        } catch (error) {
            console.error("Error accessing media devices:", error);
        }
    };

    // A simple check in the useEffect hook to correctly trigger offers
useEffect(() => {
    if (!joinedRoom) return;

    socket.on("user-connected", (userId) => {
        console.log("User connected:", userId);
        // Only initiate an offer for the new user joining, if not already connected
        if (!peerConnections.current[userId]) {
            connectToPeer(userId);
        }
    });

    socket.on("signal", (data) => {
        console.log("Signal received:", data);
        if (!peerConnections.current[data.source]) {
            console.log("Peer connection not found, creating connection...");
        }
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
        setConnectedUsers((prevUsers) => prevUsers.filter((id) => id !== userId));
        if (remoteVideoRefs.current[userId]) {
            remoteVideoRefs.current[userId].remove();
            delete remoteVideoRefs.current[userId];
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


    const handleTrack = (event, peerId) => {
        setRemoteStreams((prevStreams) => ({
            ...prevStreams,
            [peerId]: event.streams[0],
        }));
    };

    const connectToPeer = (peerId) => {
        if (peerConnections.current[peerId]) return; // Ensure we don't create multiple connections
    
        const peer = new RTCPeerConnection(STUN_SERVERS);
        peerConnections.current[peerId] = peer;
    
        // Add tracks from the local stream
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
    
        // Handle incoming tracks
        peer.ontrack = (event) => handleTrack(event, peerId);
    
        // Create an offer and send it to the remote peer
        peer.createOffer().then((offer) => {
            peer.setLocalDescription(offer);
            socket.emit("signal", {
                target: peerId,
                type: "offer",
                description: offer,
            });
        }).catch(error => console.error('Error creating offer:', error));
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
    
        // Create an answer once offer is received and set local description
        peer.createAnswer().then((answer) => {
            peer.setLocalDescription(answer);
            socket.emit("signal", {
                target: data.source,
                type: "answer",
                description: answer,
            });
        }).catch(error => console.error('Error creating answer:', error));
    };
    

    const handleJoinRoom = () => {
        if (roomId.trim() !== "") {
            socket.emit("join-room", roomId);
            console.log("Joining room:", roomId);
            setJoinedRoom(true);
            startStream();  // Start stream after joining room
        }
    };

    const toggleMic = () => {
        const audioTrack = localStream.current
            .getTracks()
            .find((track) => track.kind === "audio");
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMicOn(audioTrack.enabled);
        }
    };

    const toggleCamera = () => {
        const videoTrack = localStream.current
            .getTracks()
            .find((track) => track.kind === "video");
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsCameraOn(videoTrack.enabled);
        }
    };

    const leaveRoom = () => {
        socket.disconnect();
        localStream.current
            .getTracks()
            .forEach((track) => track.stop());
        window.location.reload(); // Refresh to reset state
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center">
            {!joinedRoom ? (
                <div className="text-center">
                    <h1 className="text-3xl mb-4">Join a Room</h1>
                    <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Enter Room ID"
                        className="p-2 border border-gray-700 rounded mb-4"
                    />
                    <button
                        onClick={handleJoinRoom}
                        className="bg-blue-500 px-4 py-2 rounded"
                    >
                        Join
                    </button>
                </div>
            ) : (
                <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            className="w-32 h-32 border border-gray-700 rounded"
                        />
                        <div>
                            <button
                                onClick={toggleMic}
                                className={`mx-2 px-4 py-2 rounded ${isMicOn ? "bg-green-500" : "bg-red-500"}`}
                            >
                                {isMicOn ? "Mute Mic" : "Unmute Mic"}
                            </button>
                            <button
                                onClick={toggleCamera}
                                className={`mx-2 px-4 py-2 rounded ${isCameraOn ? "bg-green-500" : "bg-red-500"}`}
                            >
                                {isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
                            </button>
                            <button
                                onClick={leaveRoom}
                                className="mx-2 px-4 py-2 bg-red-500 rounded"
                            >
                                Leave Room
                            </button>
                        </div>
                    </div>

                    <div id="remote-videos" className="grid grid-cols-3 gap-4">
                        {Object.keys(remoteStreams).map((peerId) => (
                            <div key={peerId}>
                                <video
                                    autoPlay
                                    muted={false}  // Set to false for remote video
                                    ref={(el) => {
                                        if (el) {
                                            el.srcObject = remoteStreams[peerId];
                                        }
                                    }}
                                    className="w-full h-full border border-gray-700 rounded"
                                />
                            </div>
                        ))}
                    </div>

                    {connectedUsers.length > 0 ? (
                        <div>Users connected: {connectedUsers.join(", ")}</div>
                    ) : (
                        <div>No users connected</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Meeting;
