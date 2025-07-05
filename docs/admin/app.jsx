import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/style.css'; // Tailwind CSS
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from './hooks/useAuth';

import Dashboard from './pages/dashboard';
import Inventory from './pages/inventory';
import Reports from './pages/reports';
import Sales from './pages/sales';
import Register from './pages/register';
import Settings from './pages/settings';
import Login from './pages/login';
import Payment from './pages/payment';  
import Employee from './pages/employee';
import Customer from './pages/customer';
import Layout from './components/layout';

// ✅ ProtectedRoute updated to allow Supabase password recovery mode
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // ✅ Allow if in password recovery mode
  const isRecoveryMode =
    new URLSearchParams(location.search).get('type') === 'recovery';

  if (loading) return <div>Loading...</div>;

  if (!user && !isRecoveryMode) {
    return <Navigate to="/login" />;
  }

  return children;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee"
          element={
            <ProtectedRoute>
              <Employee />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer"
          element={
            <ProtectedRoute>
              <Customer />
            </ProtectedRoute>
          }
        />
         <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route path="/register" element={<Register />} />
        <Route path="/layout" element={<Layout />} />

        {/* Default fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
