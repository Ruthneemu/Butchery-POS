import { useState, useEffect } from 'react';
import  supabase  from '../supabaseClient';
import Layout from "../components/layout";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert('Login failed: ' + error.message);
    else window.location.reload();
  };

  const handleLogout = async () => {
  await supabase.auth.signOut();
  navigate('/login');
};

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      {user ? (
        <div className="bg-white p-6 rounded shadow-md w-full max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Welcome, {user.email}</h2>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">
            Logout
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-semibold mb-6 text-center">Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-6 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={handleLogin} className="w-full bg-blue-500 text-white px-4 py-2 rounded">
            Login
          </button>
        </div>
      )}
    </div>
  );
}
