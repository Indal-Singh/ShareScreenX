import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000");

const App = () => {
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);  // Camera off by default

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const peerConnections = useRef({});
  const localStream = useRef(null);

  const STUN_SERVERS = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // Start media stream when room is joined
  const startStream = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.current = stream;
        if (localVideoRef.current) {
            if(isCameraOn)
            {
                localVideoRef.current.srcObject = stream;
            }
            else
            {
                localVideoRef.current.srcObject = null;
            }
          console.log('Media stream is set to video element');
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
  };

  useEffect(() => {
    socket.on("user-connected", (userId) => {
      console.log("User connected:", userId);
      connectToPeer(userId);
    });

    socket.on("signal", (data) => {
      if (!peerConnections.current[data.source]) return;

      if (data.type === "offer") {
        handleOffer(data);
      } else if (data.type === "answer") {
        peerConnections.current[data.source].setRemoteDescription(
          new RTCSessionDescription(data.description)
        );
      } else if (data.type === "candidate") {
        peerConnections.current[data.source].addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    });

    socket.on("user-disconnected", (userId) => {
      console.log("User disconnected:", userId);
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
  }, []);

  const connectToPeer = (peerId) => {
    const peer = new RTCPeerConnection(STUN_SERVERS);
    peerConnections.current[peerId] = peer;

    localStream.current
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream.current));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          target: peerId,
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
      if (!remoteVideoRefs.current[peerId]) {
        const videoElement = document.createElement("video");
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        document.getElementById("remote-videos").appendChild(videoElement);
        videoElement.srcObject = event.streams[0];
        remoteVideoRefs.current[peerId] = videoElement;
      }
    };

    peer.createOffer().then((offer) => {
      peer.setLocalDescription(offer);
      socket.emit("signal", {
        target: peerId,
        type: "offer",
        description: offer,
      });
    });
  };

  const handleOffer = (data) => {
    const peer = new RTCPeerConnection(STUN_SERVERS);
    peerConnections.current[data.source] = peer;

    localStream.current
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream.current));

    peer.ontrack = (event) => {
      if (!remoteVideoRefs.current[data.source]) {
        const videoElement = document.createElement("video");
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        document.getElementById("remote-videos").appendChild(videoElement);
        videoElement.srcObject = event.streams[0];
        remoteVideoRefs.current[data.source] = videoElement;
      }
    };

    peer.setRemoteDescription(new RTCSessionDescription(data.description));
    peer.createAnswer().then((answer) => {
      peer.setLocalDescription(answer);
      socket.emit("signal", {
        target: data.source,
        type: "answer",
        description: answer,
      });
    });
  };

  const handleJoinRoom = () => {
    if (roomId.trim() !== "") {
      socket.emit("join-room", roomId);
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
                className={`mx-2 px-4 py-2 rounded ${
                  isMicOn ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {isMicOn ? "Mute Mic" : "Unmute Mic"}
              </button>
              <button
                onClick={toggleCamera}
                className={`mx-2 px-4 py-2 rounded ${
                  isCameraOn ? "bg-green-500" : "bg-red-500"
                }`}
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
          <div id="remote-videos" className="grid grid-cols-3 gap-4"></div>
        </div>
      )}
    </div>
  );
};

export default App;
