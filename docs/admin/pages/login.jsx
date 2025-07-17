import { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // For password visibility
import { LuLoader } from 'react-icons/lu'; // For spinner icon

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '...' }
  const [mode, setMode] = useState('login'); // 'login' | 'reset' | 'update'
  const [showPassword, setShowPassword] = useState(false); // State for password visibility (login)
  const [showNewPassword, setShowNewPassword] = useState(false); // State for password visibility (update)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State for confirm password visibility (update)

  const navigate = useNavigate();
  const location = useLocation(); // Hook to access location state

  // --- Initial Setup and URL Handling ---
  useEffect(() => {
    // Check for messages passed from other pages (e.g., Register)
    if (location.state?.message) {
      setMessage({ type: location.state.type || 'success', text: location.state.message });
      // Clear the message from history state to prevent it from reappearing on back/forward navigation
      navigate(location.pathname, { replace: true, state: {} });
    }

    const url = new URL(window.location.href);
    const hash = url.hash;
    const type = url.searchParams.get('type');

    if (hash.includes('update-password') || type === 'recovery') {
      setMode('update');
      // Clean the URL hash/params to prevent re-triggering this logic on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location, navigate]); // Depend on location to catch state changes

  // --- Supabase Auth State Change Listener ---
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
      }
      if (event === 'USER_UPDATED') {
        setMessage({
          type: 'success',
          text: 'Password updated successfully! Redirecting to login...'
        });
        // Give user time to read success message before redirecting
        await new Promise(resolve => setTimeout(resolve, 2000));
        setMode('login'); // Switch back to login form
        setNewPassword(''); // Clear new password fields
        setConfirmPassword('');
        setEmail(''); // Clear email field in case user wants to log in immediately
        setPassword(''); // Clear password field
        setMessage(null); // Clear success message
      }
      // If user is already logged in, redirect to dashboard (e.g., if they navigate back to login)
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]); // Depend on navigate

  // --- Validation Helpers ---
  const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const getPasswordStrength = (pwd) => {
    if (pwd.length === 0) return { text: '', color: '' };
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.match(/[a-z]/)) strength++;
    if (pwd.match(/[A-Z]/)) strength++;
    if (pwd.match(/[0-9]/)) strength++;
    if (pwd.match(/[^a-zA-Z0-9]/)) strength++;

    if (strength < 3) return { text: 'Weak', color: 'text-red-500' };
    if (strength === 3) return { text: 'Moderate', color: 'text-orange-500' };
    return { text: 'Strong', color: 'text-green-500' };
  };


  // --- Event Handlers ---
  const handleLogin = async () => {
    setMessage(null); // Clear previous messages

    if (!email || !password) {
      setMessage({ type: 'error', text: 'Email and password are required.' });
      return;
    }
    if (!isValidEmail(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) { // Client-side check for min length
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setMessage(null);

    if (!email || !isValidEmail(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login#update-password` // Ensure this matches your route
      });
      if (error) throw error;
      setMessage({
        type: 'success',
        text: 'Password reset link sent to your email! Please check your inbox and spam folder.'
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    const { text: strengthText } = getPasswordStrength(newPassword);
    if (strengthText === 'Weak') {
      setMessage({ type: 'error', text: 'Please choose a stronger password. Consider adding uppercase letters, numbers, or symbols.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // USER_UPDATED event listener will handle the success message and redirection
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Determine button disabled state
  const isLoginButtonDisabled = loading || !email || !password || !isValidEmail(email) || password.length < 6;
  const isResetButtonDisabled = loading || !email || !isValidEmail(email);
  const isUpdateButtonDisabled = loading || !newPassword || !confirmPassword || newPassword.length < 6 || newPassword !== confirmPassword;


  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-cover bg-center bg-no-repeat px-4 sm:px-6 md:px-8" style={{ backgroundImage: "url('/leaf.jpg')" }}>
      <div className="bg-white bg-opacity-90 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
          {mode === 'login' ? 'Login' : mode === 'reset' ? 'Reset Password' : 'Update Password'}
        </h2>

        {/* Message Display (with dismiss button) */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-md text-sm flex justify-between items-center ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
            role="alert"
            aria-live="assertive"
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-current hover:opacity-75 ml-2"
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </div>
        )}

        {mode === 'login' ? (
          <>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-login" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  id="email-login"
                  placeholder="your@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
                  autoComplete="email"
                  autoFocus // Auto-focus on initial load for login
                />
                {!isValidEmail(email) && email.length > 0 && (
                  <p className="text-red-500 text-xs mt-1">Please enter a valid email format.</p>
                )}
              </div>
              <div>
                <label htmlFor="password-login" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password-login"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {password.length > 0 && password.length < 6 && (
                  <p className="text-red-500 text-xs mt-1">Password must be at least 6 characters.</p>
                )}
              </div>
              <button
                onClick={handleLogin}
                disabled={isLoginButtonDisabled}
                className={`w-full text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                  isLoginButtonDisabled ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {loading && <LuLoader className="animate-spin" />}
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
            <button
              onClick={() => { setMode('reset'); setEmail(''); setPassword(''); setMessage(null); }} // Clear fields and messages on mode change
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
            <div>
              <label htmlFor="email-reset" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                id="email-reset"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400"
                autoComplete="email"
                autoFocus // Auto-focus when in reset mode
              />
              {!isValidEmail(email) && email.length > 0 && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid email format.</p>
              )}
            </div>
            <button
              onClick={handlePasswordReset}
              disabled={isResetButtonDisabled}
              className={`w-full text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                isResetButtonDisabled ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            >
              {loading && <LuLoader className="animate-spin" />}
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              onClick={() => { setMode('login'); setEmail(''); setMessage(null); }}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold"
            >
              Back to Login
            </button>
          </div>
        ) : ( // mode === 'update'
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">
              Please enter your new password below.
            </p>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="new-password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400 pr-10"
                  autoComplete="new-password"
                  autoFocus // Auto-focus when in update mode
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <p className={`text-xs mt-1 ${getPasswordStrength(newPassword).color}`}>
                  Password Strength: {getPasswordStrength(newPassword).text}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-new-password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                  aria-label={showConfirmPassword ? 'Hide confirm new password' : 'Show confirm new password'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {newPassword !== confirmPassword && confirmPassword.length > 0 && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
              )}
            </div>
            <button
              onClick={handlePasswordUpdate}
              disabled={isUpdateButtonDisabled}
              className={`w-full text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                isUpdateButtonDisabled ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            >
              {loading && <LuLoader className="animate-spin" />}
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            <button
              onClick={() => { setMode('login'); setNewPassword(''); setConfirmPassword(''); setMessage(null); }}
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