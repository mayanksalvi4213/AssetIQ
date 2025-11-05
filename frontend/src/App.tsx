import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.tsx";
import OcrPage from "./pages/OcrPage.tsx"; 
import Dashboard from "./pages/Dashboard.tsx";
import { LoginForm } from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import ForgotPassword from "./pages/ForgotPassword";
// import LoginPage from "./pages/LoginPage";   // create later
// import RegisterPage from "./pages/RegisterPage"; // create later
import LabConfiguration from "./pages/Labconfiguration.tsx";
import LabFloorPlan from "./pages/Labplan.tsx";
import AllAssets from "./pages/AllAssets.tsx";
import Reports from "./pages/Reports.tsx";
import Issues from "./pages/Issues.tsx";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ocr" element={<OcrPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Future pages */}
        { <Route path="/login" element={<LoginForm />} /> }
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/lab-configuration" element={<LabConfiguration />} />
        <Route path="/lab-plan" element={<LabFloorPlan />} />
        <Route path="/assets" element={<AllAssets />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/dashboard/issues" element={<Issues />} />
        {/* <Route path="/register" element={<RegisterPage />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
