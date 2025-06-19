import { useState } from 'react';
import supabase from '../supabaseClient';
import { FcGoogle } from 'react-icons/fc';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email first' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ 
        type: 'success', 
        text: 'Password reset link sent to your email!' 
      });
      setShowForgotPassword(false);
    }
  };

  return (
    <div
      className="flex flex-col justify-center items-center min-h-screen w-full bg-cover bg-center bg-no-repeat px-4 sm:px-6 md:px-8"
      style={{ backgroundImage: "url('/leaf.jpg')" }}
    >
      <div className="bg-white bg-opacity-90 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
          {showForgotPassword ? 'Reset Password' : 'Login'}
        </h2>

        {message && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              message.type === 'error' 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {showForgotPassword ? (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoComplete="email"
            />
            <div className="flex space-x-3">
              <button
                onClick={handlePasswordReset}
                disabled={loading}
                className={`flex-1 text-white py-3 rounded-lg font-semibold ${
                  loading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold"
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoComplete="current-password"
              />
              <button
                onClick={handleLogin}
                disabled={loading}
                className={`w-full text-white py-3 rounded-lg font-semibold ${
                  loading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50"
            >
              <FcGoogle className="text-xl" />
              <span>Google</span>
            </button>

            <div className="mt-6 text-center">
              <p className="text-gray-600">Don't have an account?</p>
              <button
                onClick={() => (window.location.href = '/register')}
                className="mt-2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium px-4 py-2 rounded-lg text-sm transition duration-200"
              >
                Register
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}