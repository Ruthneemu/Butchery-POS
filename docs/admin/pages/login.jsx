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
    const { error } = await supabase.auth.signUp({ email, password });
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
      <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('leaf.jpg')" }}>
      <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-12">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md sm:max-w-lg md:max-w-xl transition-all duration-300">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Create an Account</h2>

          {message && (
            <div
              className={`mb-4 p-4 rounded-lg text-sm ${
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
            className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleRegister}
            disabled={loading}
            className={`w-full text-white py-3 rounded-lg font-semibold shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 ${
              loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:ring-blue-500'
            }`}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/settings" className="text-blue-600 hover:underline font-medium">
              Login
            </a>
          </p>
        </div>
      </div>
      </div>
    </Layout>
  );
}
