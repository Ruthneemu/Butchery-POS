import React from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from "../supabaseClient";
import Layout from "../components/layout";


const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError) {
  console.error("Error getting session:", sessionError.message);
} else {
  console.log("Current Supabase session:", session);
}     
    const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error.message);
      } else {
        navigate('/login');
      }
    };
    

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
    >
      Logout
    </button>
  );
};

export default LogoutButton;
