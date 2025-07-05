import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRegister = async () => {
    setMessage(null);

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords don't match" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password 
    });
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transition-all">
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
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoComplete="new-password"
        />
        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-3 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>

        <div className="mt-6 flex flex-col items-center gap-3">
          <p>Already have an account?</p>
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
}            onClick={() => navigate('/login')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-lg text-sm font-medium transition"
          >
             Login
          </button>
        </div>
      </div>
    </div>
  );
}