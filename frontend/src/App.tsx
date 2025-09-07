import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.tsx";
import OcrPage from "./pages/OcrPage.tsx"; 
import Dashboard from "./pages/Dashboard.tsx";
import { LoginForm } from "./pages/Login.tsx";
// import LoginPage from "./pages/LoginPage";   // create later
// import RegisterPage from "./pages/RegisterPage"; // create later

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ocr" element={<OcrPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Future pages */}
        { <Route path="/login" element={<LoginForm />} /> }
        {/* <Route path="/register" element={<RegisterPage />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
