import React, { useState } from "react";
import Broadcaster from "./broadcaster";
import Receiver from "./receiver";

function App() {
    const [role, setRole] = useState(null);
    const [sessionId, setSessionId] = useState("");

    const createSession = () => {
        const id = prompt("Enter session ID to create:");
        if (id) {
            setSessionId(id);
            setRole("broadcaster");
        }
    };

    const joinSession = () => {
        const id = prompt("Enter session ID to join:");
        if (id) {
            setSessionId(id);
            setRole("receiver");
        }
    };

    return (
        <div>
            {!role ? (
                <>
                    <button onClick={createSession}>Start a Broadcast</button>
                    <button onClick={joinSession}>Join a Broadcast</button>
                </>
            ) : role === "broadcaster" ? (
                <Broadcaster sessionId={sessionId} />
            ) : (
                <Receiver sessionId={sessionId} />
            )}
        </div>
    );
}

export default App;
