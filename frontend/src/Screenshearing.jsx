import { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import io from "socket.io-client";
import { PhoneOff, Expand, Maximize2, QrCode } from "lucide-react";
import QrScanner from 'qr-scanner';

const socket = io("http://15.235.186.205:3004");

const ScreenSharing = () => {
    const [shareId, setShareId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(false);
    const [isSender, setIsSender] = useState(false);
    const [isScreenExpanded, setIsScreenExpanded] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [ScanQrModal, setScanQrModal] = useState(false);
    const [scanQrResult, setScanQrResult] = useState("");
    const localVideoRef = useRef(null);
    const remoteStreams = useRef({});
    const peerConnections = useRef({});
    const candidateQueues = useRef({});
    const localStream = useRef(null);
    const scanQRVideoRef = useRef(null);
    const qrScannerRef = useRef(null); 
    const STUN_SERVERS = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    const initializeScanner = () => {
        if (scanQRVideoRef.current && !qrScannerRef.current) {
            // Initialize QrScanner
            qrScannerRef.current = new QrScanner(
                scanQRVideoRef.current,
                (result) => {
                    console.log("Scanned QR Code:", result.data);
                    setScanQrResult(result.data);
                },
                {
                    returnDetailedScanResult: true, // Optional settings
                }
            );
        }
    };

    const startScanner = () => {
        console.log("Starting Scanning QR Code");
        
        if (qrScannerRef.current) {
            qrScannerRef.current
                .start()
                .then(() => console.log("Scanner started"))
                .catch((error) => console.error("Camera error:", error));
        }
    };

    const stopScanner = () => {
        if (qrScannerRef.current) {
            qrScannerRef.current.stop();
        }
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
        if (ScanQrModal) {
            console.log("Scanning QR Code");
            initializeScanner();
            startScanner();
        } else {
            stopScanner();
        }
        if (!joinedRoom) return;
        socket.on("user-connected", (userId) => {
            console.log("User connected:", userId);
            if (isSender && !peerConnections.current[userId]) {
                connectToPeer(userId);
            }
        });

        socket.on("signal", (data) => {
            console.log("Signal received:", data);
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
            if (qrScannerRef.current) {
                qrScannerRef.current.destroy();
                qrScannerRef.current = null;
            }

        };
    }, [joinedRoom, isSender, ScanQrModal]);

    const handleTrack = (event, source) => {
        const [remoteStream] = event.streams;

        if (remoteStream) {
            console.log('Remote stream received:', remoteStream);
            let videoElement = document.getElementById(`video-${source}`);
            if (!videoElement) {
                videoElement = document.createElement('video');
                videoElement.id = `video-${source}`;
                videoElement.autoplay = true;
                videoElement.playsInline = true;

                const container = document.getElementById('remoteStreamContainer');
                container.appendChild(videoElement);
            }

            videoElement.srcObject = remoteStream;

            // Force playback
            videoElement.play().catch(err => console.error('Error forcing video playback:', err));

            console.log(`Video added for source: ${source}`);
        } else {
            console.error('No valid remote stream provided.');
        }
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
        console.log('offer', data);
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
                console.log("Answer sent to:", data.source);
            })
            .catch((error) => console.error("Error handling offer:", error));
    };

    const handleJoinRoom = (id, role) => {
        if (id.trim() !== "") {
            console.log("Joining room:", id, role);
            // Tell server if user is a creator or viewer
            socket.emit("join-room", id);
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

    const toggleFullScreen = () => {
        const elem = document.getElementById('remoteStreamContainer');
        if (!elem) {
            console.error('Element with ID "remoteStreamContainer" not found.');
            return;
        }

        if (!document.fullscreenElement) {
            setIsScreenExpanded(true);
            elem.requestFullscreen().catch(err => {
                setIsScreenExpanded(false);
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            setIsScreenExpanded(false);
            document.exitFullscreen().catch(err => {
                console.error(`Error attempting to exit fullscreen: ${err.message}`);
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Screen Sharing</h1>
                {!joinedRoom ? (
                    <>
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <button
                                onClick={handleCreateRoom}
                                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors mb-6"
                            >
                                Create Room & Share
                            </button>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    placeholder="Enter Room ID to Join"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    onClick={handleJoinAsViewer}
                                    className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Join as Viewer
                                </button>
                                <button
                                    onClick={() => setScanQrModal(true)}
                                    className="w-full bg-yellow-600 text-white py-3 px-6 rounded-lg hover:bg-yellow-700 transition-colors"
                                >
                                    Scan QR Code to Join
                                </button>
                            </div>
                        </div>

                        {/* model for QR Code Scanner */}
                        <div>
                            {ScanQrModal && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                                    <div className="bg-white p-6 rounded-lg shadow-lg relative">
                                        <button
                                            style={{ top: '-17px', right: '-17px' }}
                                            onClick={() => setScanQrModal(false)}
                                            className="absolute bg-gray-800 text-white p-2 rounded-full"
                                        >
                                            X
                                        </button>
                                        <video ref={scanQRVideoRef} className="w-60"></video>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold text-gray-700">
                                Share ID (Room ID): <span className="text-blue-600">{shareId}</span>
                            </h2>
                        </div>

                        {isSender ? (
                            <video
                                ref={localVideoRef}
                                id="localVideo"
                                autoPlay
                                playsInline
                                muted
                                className="w-full rounded-lg bg-black"
                            />
                        ) : (
                            <div
                                id="remoteStreamContainer"
                                className="w-full rounded-lg bg-black min-h-[400px] relative"
                            >
                                <button
                                    onClick={toggleFullScreen}
                                    className="absolute top-2 right-2 bg-gray-800 text-white p-2 rounded-full z-10"
                                >
                                    {
                                        isScreenExpanded ? <Expand size={24} /> : <Maximize2 size={24} />
                                    }
                                </button>
                            </div>
                        )}
                        <div className="flex justify-center mt-6 gap-4">
                            {!isSender ? (<>
                                <button onClick={toggleFullScreen}
                                    className="hover:bg-gray-200 transition-colors rounded-lg"
                                >
                                    {
                                        isScreenExpanded ? <Expand size={32} className="text-gray-600 p-2" /> : <Maximize2 size={32} className="text-gray-600 p-2" />
                                    }
                                </button>
                            </>) : <>
                                <button
                                    className="hover:bg-gray-200 transition-colors rounded-lg"
                                >
                                    {
                                        isScreenExpanded ? <Expand size={32} className="text-gray-600 p-2" /> : <QrCode size={32} onClick={() => setShowQrModal(true)} className="text-gray-600 p-2" />
                                    }
                                </button>
                            </>}
                            <button
                                onClick={() => window.location.reload()}
                                className="hover:bg-red-700 transition-colors rounded-lg bg-red-600"
                            >
                                <PhoneOff size={32} className="p-2 text-white" />
                            </button>
                        </div>
                        {isSender && (
                            <div>
                                {showQrModal && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                                        <div className="bg-white p-6 rounded-lg shadow-lg relative">
                                            <button
                                                style={{ top: '-17px', right: '-17px' }}
                                                onClick={() => setShowQrModal(false)}
                                                className="absolute bg-gray-800 text-white p-2 rounded-full"
                                            >
                                                X
                                            </button>
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${shareId}`}
                                                alt="QR Code"
                                                className="mx-auto"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScreenSharing;
