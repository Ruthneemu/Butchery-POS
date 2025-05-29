import { useState } from 'react';
import supabase from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleLogin = async () => {
    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    }
  };

  return (
    <div
      className="flex flex-col justify-center items-center min-h-screen w-full bg-cover bg-center bg-no-repeat px-4 sm:px-6 md:px-8 overflow-auto"
      style={{ backgroundImage: "url('/leaf.jpg')" }} // image in /public/leaf.jpg
    >
      <div className="bg-white bg-opacity-90 backdrop-blur-md p-5 sm:p-8 rounded-2xl shadow-xl w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg transition-all duration-300">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">Login</h2>

        {message && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
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
          className="w-full p-3 text-base mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoComplete="email"
          inputMode="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 text-base mb-5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoComplete="current-password"
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full text-white text-base py-3 rounded-lg font-semibold shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 ${
            loading
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:ring-blue-500'
          }`}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <div className="mt-5 text-center">
          <button
            onClick={() => (window.location.href = '/register')}
            className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium px-4 py-2 rounded-lg text-sm transition duration-200"
          >
            Don't have an account? Register
          </button>
        </div>
      </div>
    </div>
  );
}
