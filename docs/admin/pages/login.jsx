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
  const [passwordStrength, setPasswordStrength] = useState(0);

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

  useEffect(() => {
    if (newPassword.length === 0) {
      setPasswordStrength(0);
    } else if (newPassword.length < 6) {
      setPasswordStrength(1);
    } else if (newPassword.length < 10) {
      setPasswordStrength(2);
    } else {
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      setPasswordStrength(hasSpecialChar && hasNumber ? 4 : 3);
    }
  }, [newPassword]);

  const handleLogin = async () => {
    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMessage({ type: 'error', text: error.message });
    else navigate('/dashboard');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
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
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password should be at least 6 characters' });
      return;
    }

    setMessage(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      // The USER_UPDATED event in the auth listener will handle the success case
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
              Forgot password?
            </button>

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
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Google</span>
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
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
              autoFocus
            />
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div
                className={`h-2.5 rounded-full ${
                  passwordStrength === 0 ? 'bg-gray-200' :
                  passwordStrength === 1 ? 'bg-red-500' :
                  passwordStrength === 2 ? 'bg-yellow-500' :
                  passwordStrength === 3 ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{ width: `${passwordStrength * 25}%` }}
              ></div>
            </div>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
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