import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/style.css'; // ensure correct path to Tailwind CSS
import {
  BrowserRouter as Router,
  Routes,
  Route 
} from 'react-router-dom';
import Dashboard from './pages/dashboard';
import Inventory from './pages/inventory';
import Reports from './pages/reports';
import Sales from './pages/sales';
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/sales" element={<Sales />} />
        {/* Add more routes as needed */}
       
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
