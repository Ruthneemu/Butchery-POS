import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/style.css'; // ensure correct path to Tailwind CSS
import {
  BrowserRouter as Router,
  Routes,
  Route 
} from 'react-router-dom';
import { useAuth } from './hooks/useAuth'
import Dashboard from './pages/dashboard';
import Inventory from './pages/inventory';
import Reports from './pages/reports';
import Sales from './pages/sales';
import Settings from './pages/settings';
import Login from './pages/login';

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
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          }
        />
       <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Layout><Inventory /></Layout>
            </ProtectedRoute>
          }
        />
        <Route 
        path="/reports"
        element={
          <protectedRoute>
            <Layout><Reports /></Layout>
          </protectedRoute>
        }
        />
         <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <Layout><Sales /></Layout>
            </ProtectedRoute>       
          }
          />
          <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout><Settings /></Layout>
            </ProtectedRoute>
          }
          />
        {/* Add more routes as needed */}
       
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
