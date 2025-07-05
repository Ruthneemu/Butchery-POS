import { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' | 'reset' | 'update'

  const navigate = useNavigate();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = url.hash;
    const type = url.searchParams.get('type');

    if (hash.includes('update-password') || type === 'recovery') {
      setMode('update');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
      }
      if (event === 'USER_UPDATED') {
        setMessage({
          type: 'success',
          text: 'Password updated successfully! Redirecting...'
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        setMode('login');
        setNewPassword('');
        setConfirmPassword('');
        setMessage(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    setLoading(false);
    if (error) setMessage({ type: 'error', text: error.message });
    else navigate('/dashboard');
  };

  const handlePasswordReset = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setMessage(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login#update-password`
      });
      if (error) throw error;
      setMessage({
        type: 'success',
        text: 'Password reset link sent to your email! Please check your inbox.'
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setMessage(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-cover bg-center bg-no-repeat px-4 sm:px-6 md:px-8" style={{ backgroundImage: "url('/leaf.jpg')" }}>
      <div className="bg-white bg-opacity-90 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
          {mode === 'login' ? 'Login' : mode === 'reset' ? 'Reset Password' : 'Update Password'}
        </h2>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.text}
          </div>
        )}

        {mode === 'login' ? (
          <>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
                autoComplete="email"
                autoFocus
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
                autoComplete="current-password"
              />
              <button
                onClick={handleLogin}
                disabled={loading}
                className={`w-full text-white py-3 rounded-lg font-semibold ${
                  loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
            <button
              onClick={() => setMode('reset')}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Forgot Password?
            </button>

            <div className="mt-6 text-center">
              <p className="text-gray-600">Don't have an account?</p>
              <button
                onClick={() => navigate('/register')}
                className="mt-2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium px-4 py-2 rounded-lg text-sm transition duration-200"
              >
                Register
              </button>
            </div>
          </>
        ) : mode === 'reset' ? (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
              autoComplete="email"
              autoFocus
            />
            <button
              onClick={handlePasswordReset}
              disabled={loading}
              className={`w-full text-white py-3 rounded-lg font-semibold ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              onClick={() => setMode('login')}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">
              Please enter your new password below.
            </p>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
              autoComplete="new-password"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
              autoComplete="new-password"
            />
            <button
              onClick={handlePasswordUpdate}
              disabled={loading}
              className={`w-full text-white py-3 rounded-lg font-semibold ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            <button
              onClick={() => setMode('login')}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}