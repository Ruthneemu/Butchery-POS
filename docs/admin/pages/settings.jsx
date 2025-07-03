import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';
import Layout from '../components/layout';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState(false);
  const [loadingState, setLoadingState] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setEmail(user.email || '');
        setNewEmail(user.email || '');
        setName(user.user_metadata?.full_name || '');
        setNotificationPreferences(user.user_metadata?.notification_preferences || false);
      } else if (error) {
        console.error(error.message);
      }
    };
    fetchUser();
  }, []);

  const handleUpdate = async (type) => {
    setLoadingState(type);

    let updateData = {};
    if (type === 'profile') updateData = { data: { full_name: name } };
    if (type === 'email') updateData = { email: newEmail };
    if (type === 'password') updateData = { password: newPassword };
    if (type === 'notifications') updateData = { data: { notification_preferences: notificationPreferences } };

    const { error } = await supabase.auth.updateUser(updateData);
    if (error) alert(`Error: ${error.message}`);
    else {
      let msg = 'Update successful!';
      if (type === 'email') msg = 'Email updated. Please verify your new email.';
      if (type === 'password') msg = 'Password updated successfully!';
      alert(msg);
      if (type === 'email') setEmail(newEmail);
      if (type === 'password') setNewPassword('');
    }

    setLoadingState('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete your account?');
    if (confirmDelete && user) {
      const { error } = await supabase.auth.api.deleteUser(user.id);
      if (error) alert(`Error deleting account: ${error.message}`);
      else {
        alert('Your account has been deleted.');
        navigate('/login');
      }
    }
  };

  return (
    <Layout breadcrumb="Settings">
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        {user ? (
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md space-y-8">
            <h2 className="text-xl font-bold text-center">Account Settings</h2>

            {/* Profile */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-3 mb-2 border rounded"
              />
              <button
                onClick={() => handleUpdate('profile')}
                disabled={loadingState === 'profile'}
                className="w-full bg-blue-500 text-white py-2 rounded"
              >
                {loadingState === 'profile' ? 'Updating...' : 'Update Profile'}
              </button>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
              <input
                id="email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full p-3 mb-2 border rounded"
              />
              <button
                onClick={() => handleUpdate('email')}
                disabled={loadingState === 'email' || newEmail === email}
                className="w-full bg-blue-500 text-white py-2 rounded"
              >
                {loadingState === 'email' ? 'Updating...' : 'Update Email'}
              </button>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                id="password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full p-3 mb-2 border rounded"
              />
              <button
                onClick={() => handleUpdate('password')}
                disabled={loadingState === 'password' || newPassword.length < 6}
                className="w-full bg-blue-500 text-white py-2 rounded"
              >
                {loadingState === 'password' ? 'Updating...' : 'Update Password'}
              </button>
            </div>

            {/* Notifications */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  id="notifications"
                  type="checkbox"
                  checked={notificationPreferences}
                  onChange={() => setNotificationPreferences(!notificationPreferences)}
                />
                <label htmlFor="notifications" className="text-sm text-gray-700">Enable Email Notifications</label>
              </div>
              <button
                onClick={() => handleUpdate('notifications')}
                disabled={loadingState === 'notifications'}
                className="w-full bg-blue-500 text-white py-2 rounded"
              >
                {loadingState === 'notifications' ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="space-y-2">
              <button
                onClick={handleDeleteAccount}
                className="w-full bg-red-500 text-white py-2 rounded"
              >
                Delete Account
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-gray-800 text-white py-2 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-4 text-center">Please Login</h2>
            <p className="mb-4 text-center">You must be logged in to view this page.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-500 text-white py-2 rounded"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
