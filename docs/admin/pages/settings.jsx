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
    <div className="p-6">
      {user ? (
        <div>
          <h2 className="text-xl font-bold mb-2">Welcome, {user.email}</h2>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">
            Logout
          </button>
        </div>
      ) : (
        <div className="max-w-sm">
          <h2 className="text-xl font-bold mb-4">Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <button onClick={handleLogin} className="bg-blue-500 text-white px-4 py-2 rounded">
            Login
          </button>
        </div>
      )}
    </div>
  );
}
