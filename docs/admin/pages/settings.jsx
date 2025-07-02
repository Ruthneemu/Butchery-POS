import { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch user information when component mounts
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setEmail(user?.email || '');
      setNewEmail(user?.email || '');
      setName(user?.user_metadata?.full_name || ''); // Assuming full name is stored in user_metadata
    });
  }, []);

  // Handle email update
  const updateEmail = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });
    if (error) alert('Error updating email: ' + error.message);
    else {
      alert('Email updated successfully!');
      setEmail(newEmail); // Update email in the UI
    }
    setLoading(false);
  };

  // Handle password update
  const updatePassword = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) alert('Error updating password: ' + error.message);
    else alert('Password updated successfully!');
    setLoading(false);
  };

  // Handle notification preferences update
  const updateNotificationPreferences = async () => {
    // You can store this in the user metadata
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { notification_preferences: notificationPreferences }, // Assuming this is stored in user_metadata
    });
    if (error) alert('Error updating notifications: ' + error.message);
    else alert('Notification preferences updated successfully!');
    setLoading(false);
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete your account?");
    if (confirmDelete) {
      const { error } = await supabase.auth.api.deleteUser(user.id);
      if (error) alert('Error deleting account: ' + error.message);
      else {
        alert('Your account has been deleted.');
        navigate('/login');
      }
    }
  };

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        {/* Breadcrumb Navigation */}
        <nav className="w-full bg-white p-4 mb-6 rounded-md shadow-md">
          <ol className="list-reset flex text-sm text-gray-600">
            <li className="mr-2">
              <a href="/" className="text-blue-500 hover:text-blue-700">Home</a>
            </li>
            <li>/</li>
            <li className="mx-2">Settings</li>
          </ol>
        </nav>

        {user ? (
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md text-center">
            <h2 className="text-xl font-bold mb-4">Welcome, {user.email}</h2>

            {/* Profile Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700">Profile Information</h3>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => {
                  supabase.auth.updateUser({
                    data: { full_name: name }, // Update full name in metadata
                  }).then(() => alert('Profile updated!'));
                }}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded"
              >
                Update Profile
              </button>
            </div>

            {/* Email Update */}
            <div className="mb-6">
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700">New Email Address</label>
              <input
                type="email"
                id="newEmail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your new email"
              />
              <button
                onClick={updateEmail}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
                disabled={loading || newEmail === email}
              >
                {loading ? 'Updating Email...' : 'Update Email'}
              </button>
            </div>

            {/* Password Update */}
            <div className="mb-6">
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your new password"
              />
              <button
                onClick={updatePassword}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
                disabled={loading || newPassword === ''}
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>

            {/* Notification Preferences */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700">Notification Preferences</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={notificationPreferences}
                  onChange={() => setNotificationPreferences(!notificationPreferences)}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700">Enable Email Notifications</label>
              </div>
              <button
                onClick={updateNotificationPreferences}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded mt-4"
              >
                Save Preferences
              </button>
            </div>

            {/* Account Deletion */}
            <div className="mt-6">
              <button
                onClick={handleDeleteAccount}
                className="w-full bg-red-500 text-white px-4 py-2 rounded mt-4"
              >
                Delete Account
              </button>
            </div>

            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded mt-4">
              Logout
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
            <h2 className="text-2xl font-semibold mb-6 text-center">Please Login</h2>
            <p className="mb-4 text-center">You must be logged in to access this page</p>
            <button onClick={() => navigate('/login')} className="w-full bg-blue-500 text-white px-4 py-2 rounded">
              Go to Login Page
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
