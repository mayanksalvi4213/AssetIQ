import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage.tsx";
import OcrPage from "./pages/OcrPage.tsx"; 
import Dashboard from "./pages/Dashboard.tsx";
import { LoginForm } from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import ForgotPassword from "./pages/ForgotPassword";
import Settings from "./pages/Settings.tsx";
// import LoginPage from "./pages/LoginPage";   // create later
// import RegisterPage from "./pages/RegisterPage"; // create later
import LabConfiguration from "./pages/Labconfiguration.tsx";
import LabFloorPlan from "./pages/Labplan.tsx";
import AllAssets from "./pages/AllAssets.tsx";
import Reports from "./pages/Reports.tsx";
import WarrantyExpiry from "./pages/WarrantyExpiry.tsx";
import Issues from "./pages/Issues.tsx";
import Documents from "./pages/Documents.tsx";
import Transfers from "./pages/Transfers.tsx";

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          
          {/* Asset Management - All roles */}
          <Route path="/assets" element={<ProtectedRoute><AllAssets /></ProtectedRoute>} />
          <Route path="/ocr" element={<ProtectedRoute><OcrPage /></ProtectedRoute>} />
          
          {/* Lab Management - HOD and Lab Incharge */}
          <Route path="/lab-configuration" element={
            <ProtectedRoute allowedRoles={['HOD', 'Lab Incharge']}>
              <LabConfiguration />
            </ProtectedRoute>
          } />
          <Route path="/lab-plan" element={
            <ProtectedRoute allowedRoles={['HOD', 'Lab Incharge']}>
              <LabFloorPlan />
            </ProtectedRoute>
          } />
          
          {/* Operations - All roles */}
          <Route path="/transfers" element={<ProtectedRoute><Transfers /></ProtectedRoute>} />
          <Route path="/dashboard/issues" element={<ProtectedRoute><Issues /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          <Route path="/dashboard/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          
          {/* Analytics - All roles */}
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/warranty-expiry" element={<ProtectedRoute><WarrantyExpiry /></ProtectedRoute>} />
          <Route path="/reports/warranty" element={<ProtectedRoute><WarrantyExpiry /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
