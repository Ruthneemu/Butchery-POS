import { useState } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRegister = async () => {
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords don't match" });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: "Password must be at least 6 characters" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Registration successful! Please check your email to confirm.' });
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-semibold mb-6 text-center">Register</h2>

          {message && (
            <div
              className={`mb-4 p-3 rounded ${
                message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 mb-6 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoComplete="new-password"
          />
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/settings" className="text-blue-600 hover:underline">
              Login
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
