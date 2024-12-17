import React, { useEffect, useRef } from "react";

function Broadcaster({ sessionId }) {
  const peerRef = useRef(null);
  const isSharingStarted = useRef(false);

  useEffect(() => {
    if (!isSharingStarted.current) {
      startScreenSharing();
      isSharingStarted.current = true; // Prevent multiple calls
    }
  }, []);

  const startScreenSharing = async () => {
    try {
      // Prompt user to select the screen/window
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      console.log("Screen sharing started", stream);

      // Initialize or send the stream to a peer
      // (Code to initialize peer and share stream here)
      peerRef.current = stream; // Storing the stream for cleanup or later use
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  return <div>Broadcasting session ID: {sessionId}</div>;
}

export default Broadcaster;
