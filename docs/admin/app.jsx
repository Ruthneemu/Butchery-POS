import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/style.css'; // ensure correct path to Tailwind CSS
import {
  BrowserRouter as Router,
  Routes,
  Route, 
  Navigate 
} from 'react-router-dom';
import { useAuth } from './hooks/useAuth'
import Dashboard from './pages/dashboard';
import Inventory from './pages/inventory';
import Reports from './pages/reports';
import Sales from './pages/sales';
import Register from './pages/register';
import Settings from './pages/settings';
import Login from './pages/login';
import Layout from './components/layout';

// Import Settings page


const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />

  return children
}

const App = () => {
  return (
    <Router>
      <Routes>
      <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
  <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
  <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
  <Route path="/register" element={<Register />} />
        <Route path="/layout" element={<Layout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
cc        {/* Add more routes as needed */}
       
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
