import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Meeting from "./Meeting";
import Screenshearing from "./Screenshearing";
import Header from "./componnets/Header";
import Footer from "./componnets/Footer";

const App = () => {
    return (
        <>
            <Header />
            <Router>
                <Routes>
                    <Route path="/" element={<Screenshearing />} />
                    <Route path="/meeting" element={<Meeting />} />
                </Routes>
            </Router>
            <Footer />
        </>
    );
}

export default App;