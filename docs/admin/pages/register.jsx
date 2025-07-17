import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // For password visibility
import { LuLoader } from 'react-icons/lu'; // For spinner icon

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '...' }
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State for confirm password visibility

  // Basic email validation regex
  const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

  // More robust password strength check
  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++; // Min length
    if (password.match(/[a-z]/)) strength++; // Lowercase
    if (password.match(/[A-Z]/)) strength++; // Uppercase
    if (password.match(/[0-9]/)) strength++; // Numbers
    if (password.match(/[^a-zA-Z0-9]/)) strength++; // Special characters

    if (strength === 0) return { text: '', color: '' };
    if (strength < 3) return { text: 'Weak', color: 'text-red-500' };
    if (strength === 3) return { text: 'Moderate', color: 'text-orange-500' };
    if (strength >= 4) return { text: 'Strong', color: 'text-green-500' };
    return { text: '', color: '' };
  };

  const handleRegister = async () => {
    setMessage(null); // Clear previous messages

    if (!isValidEmail(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    // Optional: Add stronger password criteria checks here
    const { text: strengthText } = getPasswordStrength(password);
    if (strengthText === 'Weak') {
      setMessage({ type: 'error', text: 'Please choose a stronger password. Consider adding uppercase letters, numbers, or symbols.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords don't match." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        // You can add data for the user profile if needed, e.g.:
        // options: {
        //   data: {
        //     full_name: 'John Doe',
        //   }
        // }
      });
      setLoading(false);

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        // Pass a success message to the login page via state
        navigate('/login', { state: { fromRegister: true, message: 'Registration successful! Please check your email to confirm your account.' } });
      }
    } catch (err) {
      setLoading(false);
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
      console.error("Registration error:", err);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transition-all">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Create an Account</h2>

        {/* Message Display (with dismiss button) */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg text-sm flex justify-between items-center ${
              message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
            role="alert" // ARIA role for alerts
            aria-live="assertive" // Ensures screen readers announce the message
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

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            id="email" // Associate label with input
            placeholder="your@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoComplete="username"
            required // HTML5 validation
          />
          {!isValidEmail(email) && email.length > 0 && (
            <p className="text-red-500 text-xs mt-1">Please enter a valid email format.</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password" // Associate label with input
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              autoComplete="new-password"
              required
            />
            <button
              type="button" // Important to prevent form submission
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          {password.length > 0 && (
            <p className={`text-xs mt-1 ${passwordStrength.color}`}>
              Password Strength: {passwordStrength.text}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword" // Associate label with input
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          {password !== confirmPassword && confirmPassword.length > 0 && (
            <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
          )}
        </div>

        <button
          onClick={handleRegister}
          disabled={loading || !email || !password || !confirmPassword || !isValidEmail(email) || password !== confirmPassword}
          className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          aria-live="polite" // Announce changes to screen readers when disabled state changes
        >
          {loading && <LuLoader className="animate-spin" />} {/* Spinner icon */}
          {loading ? 'Registering...' : 'Register'}
        </button>

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-gray-600">Already have an account?</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-lg text-sm font-medium transition"
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}