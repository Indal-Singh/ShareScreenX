import React, { useState } from "react";
import Broadcaster from "./broadcaster";
import Receiver from "./receiver";

function App() {
  const [isBroadcaster, setIsBroadcaster] = useState(null);
  const [sessionId, setSessionId] = useState("");

  const startSession = async () => {
    const res = await fetch("http://localhost:5000/create-session");
    const data = await res.json();
    setSessionId(data.sessionId);
    setIsBroadcaster(true);
  };

  const joinSession = () => {
    setIsBroadcaster(false);
  };

  return (
    <div>
      <h1>ShareScreenX</h1>
      {!isBroadcaster && sessionId === "" && (
        <>
          <button onClick={startSession}>Start Sharing</button>
          <button onClick={() => setSessionId(prompt("Enter session ID"))}>
            Join Session
          </button>
        </>
      )}
      {isBroadcaster && <Broadcaster sessionId={sessionId} />}
      {sessionId && !isBroadcaster && <Receiver sessionId={sessionId} />}
    </div>
  );
}

export default App;
