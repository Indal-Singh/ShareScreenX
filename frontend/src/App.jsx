import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Meeting from "./Meeting";
import Screenshearing from "./Screenshearing";

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Screenshearing />} />
                <Route path="/meeting" element={<Meeting />} />
            </Routes>
        </Router>
    );
}

export default App;