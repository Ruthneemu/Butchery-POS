import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';
import Layout from '../components/layout';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiUser, FiMail, FiLock, FiBell, FiBriefcase, FiKey, FiAlertCircle, FiLogOut, FiSave, FiEdit, FiTrash2, FiRefreshCcw } from 'react-icons/fi';
import Modal from '../components/Modal'; // Assuming you have a reusable Modal component

// You might want to create a reusable Modal component
// If you don't have one, here's a basic example:
// components/Modal.js
/*
import React from 'react';

const Modal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
        {actions && (
          <div className="flex justify-end p-4 border-t space-x-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
*/


export default function Settings() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState(false);

  // Business settings states (to be stored in a separate table)
  const [businessSettings, setBusinessSettings] = useState({
    business_name: '',
    address: '',
    phone: '',
    kra_pin: '',
    receipt_footer_msg: '',
    default_currency: 'KES', // Default for Kenya
    tax_rate_percent: 16,   // Default VAT rate in Kenya
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState({
    profile: false,
    email: false,
    password: false,
    notifications: false,
    business: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const navigate = useNavigate();

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authUser) {
      setUser(authUser);
      setEmail(authUser.email || '');
      setNewEmail(authUser.email || '');
      setName(authUser.user_metadata?.full_name || '');
      setNotificationPreferences(authUser.user_metadata?.notification_preferences || false);

      // Fetch business settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', authUser.id)
        .single(); // Assuming one settings record per user

      if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching business settings:', settingsError.message);
        toast.error('Failed to load business settings.');
      } else if (settingsData) {
        setBusinessSettings(settingsData);
      } else {
        // If no settings exist, initialize with defaults
        setBusinessSettings(prev => ({ ...prev }));
      }

    } else if (authError) {
      console.error(authError.message);
      toast.error('Failed to load user data.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleUpdate = async (type) => {
    setIsSaving(prev => ({ ...prev, [type]: true }));

    let updatePromise;
    let successMessage = 'Update successful!';

    try {
      if (type === 'profile') {
        updatePromise = supabase.auth.updateUser({ data: { full_name: name } });
      } else if (type === 'email') {
        if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
          toast.error('Please enter a valid email address.');
          setIsSaving(prev => ({ ...prev, email: false }));
          return;
        }
        updatePromise = supabase.auth.updateUser({ email: newEmail });
        successMessage = 'Email updated. Please verify your new email address via the link sent to it.';
      } else if (type === 'password') {
        if (!newPassword || newPassword.length < 6) {
          toast.error('Password must be at least 6 characters long.');
          setIsSaving(prev => ({ ...prev, password: false }));
          return;
        }
        updatePromise = supabase.auth.updateUser({ password: newPassword });
        successMessage = 'Password updated successfully!';
      } else if (type === 'notifications') {
        updatePromise = supabase.auth.updateUser({ data: { notification_preferences: notificationPreferences } });
      } else if (type === 'business') {
        const payload = { ...businessSettings, user_id: user.id };
        if (businessSettings.id) { // If settings already exist, update
          updatePromise = supabase.from('business_settings').update(payload).eq('id', businessSettings.id);
        } else { // Otherwise, insert new settings
          updatePromise = supabase.from('business_settings').insert(payload).single();
        }
        successMessage = 'Business settings updated!';
      }

      const { error } = await updatePromise;

      if (error) {
        toast.error(`Error updating ${type}: ${error.message}`);
        console.error(`Update ${type} error:`, error.message);
      } else {
        toast.success(successMessage);
        // Update local state if needed
        if (type === 'email') setEmail(newEmail);
        if (type === 'password') setNewPassword('');
        if (type === 'business' && !businessSettings.id && error === null) {
            // If it was an insert, ensure the ID is set for future updates
            const { data: newSettingsData } = await supabase.from('business_settings').select('id').eq('user_id', user.id).single();
            if (newSettingsData) setBusinessSettings(prev => ({ ...prev, id: newSettingsData.id }));
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred during update.');
      console.error('Unexpected update error:', err);
    } finally {
      setIsSaving(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.info('You have been logged out.');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to log out.');
      console.error('Logout error:', error.message);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteModal(false); // Close modal
    if (!user) {
      toast.error('No user is currently logged in.');
      return;
    }

    try {
      // Supabase's client-side API does not directly support deleting other users.
      // This action typically requires an Admin context (e.g., a Supabase Edge Function).
      // For a basic setup, you might temporarily enable "DELETE" on auth.users in RLS
      // or implement a secure Edge Function. The client-side `api.deleteUser` is deprecated.
      // For now, we'll simulate or instruct the user.
      // If you are using a server-side function/edge function:
      // const { error } = await supabase.functions.invoke('delete-user-function', { body: { userId: user.id } });

      // For a simple client-side test (not recommended for production without careful RLS/security)
      // Note: This requires the `anon` key to have `DELETE` permission on `auth.users` for the `delete_user_by_id` policy,
      // which is highly insecure for production apps. A safer approach is to use a server-side function.
      const { error } = await supabase.rpc('delete_user_by_id', { user_id_to_delete: user.id });

      if (error) {
        toast.error(`Error deleting account: ${error.message}. This action often requires elevated privileges.`);
        console.error('Delete account error:', error.message);
      } else {
        toast.success('Your account has been deleted successfully.');
        navigate('/login');
      }
    } catch (err) {
      toast.error('An unexpected error occurred during account deletion.');
      console.error('Unexpected delete account error:', err);
    }
  };

  if (loading) {
    return (
      <Layout breadcrumb="Settings">
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-8 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-blue-200 rounded w-full"></div>
              </div>
            ))}
            <div className="h-10 bg-red-200 rounded w-full"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout breadcrumb="Settings">
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Please Log In</h2>
            <p className="mb-6 text-gray-600">You must be logged in to view your settings.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Go to Login
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumb="Settings">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={true} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
      <div className="flex justify-center p-6 bg-gray-50 min-h-screen">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl space-y-8">
          <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">⚙️ Application Settings</h1>

          {/* Profile Settings */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center mb-4">
              <FiUser className="mr-2 text-blue-500" />Profile Information
            </h2>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your full name"
                disabled={isSaving.profile}
              />
            </div>
            <button
              onClick={() => handleUpdate('profile')}
              disabled={isSaving.profile}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.profile ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isSaving.profile ? <><FiRefreshCcw className="animate-spin mr-2" /> Updating...</> : <><FiSave className="mr-2" /> Update Profile</>}
            </button>
          </div>

          {/* Email Settings */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center mb-4">
              <FiMail className="mr-2 text-green-500" />Email Address
            </h2>
            <p className="text-sm text-gray-600">Your current email: <span className="font-semibold">{email}</span></p>
            <div>
              <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
              <input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                placeholder="Enter new email address"
                disabled={isSaving.email}
              />
            </div>
            <button
              onClick={() => handleUpdate('email')}
              disabled={isSaving.email || newEmail === email || !newEmail.trim()}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.email || newEmail === email || !newEmail.trim() ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              {isSaving.email ? <><FiRefreshCcw className="animate-spin mr-2" /> Updating...</> : <><FiEdit className="mr-2" /> Update Email</>}
            </button>
          </div>

          {/* Password Settings */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center mb-4">
              <FiLock className="mr-2 text-purple-500" />Password
            </h2>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter new password (min 6 characters)"
                disabled={isSaving.password}
              />
            </div>
            <button
              onClick={() => handleUpdate('password')}
              disabled={isSaving.password || newPassword.length < 6}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.password || newPassword.length < 6 ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
            >
              {isSaving.password ? <><FiRefreshCcw className="animate-spin mr-2" /> Updating...</> : <><FiEdit className="mr-2" /> Update Password</>}
            </button>
          </div>

          {/* Notification Preferences */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center mb-4">
              <FiBell className="mr-2 text-orange-500" />Notification Preferences
            </h2>
            <div className="flex items-center gap-3">
              <input
                id="notifications"
                type="checkbox"
                checked={notificationPreferences}
                onChange={() => setNotificationPreferences(!notificationPreferences)}
                className="h-5 w-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                disabled={isSaving.notifications}
              />
              <label htmlFor="notifications" className="text-base text-gray-700 cursor-pointer">
                Receive important email notifications (e.g., low stock alerts, sales reports).
              </label>
            </div>
            <button
              onClick={() => handleUpdate('notifications')}
              disabled={isSaving.notifications}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.notifications ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
            >
              {isSaving.notifications ? <><FiRefreshCcw className="animate-spin mr-2" /> Saving...</> : <><FiSave className="mr-2" /> Save Preferences</>}
            </button>
          </div>

          {/* Business Information Settings */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center mb-4">
              <FiBriefcase className="mr-2 text-indigo-500" />Business Information
            </h2>
            <div>
              <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                id="business_name"
                type="text"
                value={businessSettings.business_name}
                onChange={e => setBusinessSettings({ ...businessSettings, business_name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Prime Cuts Butchery"
                disabled={isSaving.business}
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                id="address"
                type="text"
                value={businessSettings.address}
                onChange={e => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., 123 Main Street, Nairobi"
                disabled={isSaving.business}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={businessSettings.phone}
                onChange={e => setBusinessSettings({ ...businessSettings, phone: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., +254 7XX XXX XXX"
                disabled={isSaving.business}
              />
            </div>
            <div>
              <label htmlFor="kra_pin" className="block text-sm font-medium text-gray-700 mb-1">KRA PIN (Optional)</label>
              <input
                id="kra_pin"
                type="text"
                value={businessSettings.kra_pin}
                onChange={e => setBusinessSettings({ ...businessSettings, kra_pin: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Your KRA Personal Identification Number"
                disabled={isSaving.business}
              />
            </div>
            <div>
              <label htmlFor="receipt_footer_msg" className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer Message</label>
              <textarea
                id="receipt_footer_msg"
                value={businessSettings.receipt_footer_msg}
                onChange={e => setBusinessSettings({ ...businessSettings, receipt_footer_msg: e.target.value })}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Thank you for your purchase! Fresh meat, happy you."
                disabled={isSaving.business}
              ></textarea>
            </div>
            <button
              onClick={() => handleUpdate('business')}
              disabled={isSaving.business}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.business ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {isSaving.business ? <><FiRefreshCcw className="animate-spin mr-2" /> Saving...</> : <><FiSave className="mr-2" /> Save Business Info</>}
            </button>
          </div>

          {/* System Preferences */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center mb-4">
              <FiKey className="mr-2 text-cyan-500" />System Preferences
            </h2>
            <div>
              <label htmlFor="default_currency" className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
              <input
                id="default_currency"
                type="text"
                value={businessSettings.default_currency}
                onChange={e => setBusinessSettings({ ...businessSettings, default_currency: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="e.g., KES"
                disabled={isSaving.business}
              />
            </div>
            <div>
              <label htmlFor="tax_rate_percent" className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
              <input
                id="tax_rate_percent"
                type="number"
                step="0.01"
                value={businessSettings.tax_rate_percent}
                onChange={e => setBusinessSettings({ ...businessSettings, tax_rate_percent: parseFloat(e.target.value) || 0 })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="e.g., 16"
                disabled={isSaving.business}
              />
            </div>
            <button
              onClick={() => handleUpdate('business')}
              disabled={isSaving.business}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.business ? 'bg-cyan-300 cursor-not-allowed' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}
            >
              {isSaving.business ? <><FiRefreshCcw className="animate-spin mr-2" /> Save System Prefs</> : <><FiSave className="mr-2" /> Save System Preferences</>}
            </button>
            {/* Future: 2FA Setup */}
            <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200 text-gray-700">
              <h3 className="text-lg font-semibold mb-2">Two-Factor Authentication (2FA)</h3>
              <p className="text-sm">For enhanced security, consider enabling 2FA. This feature is coming soon!</p>
              {/* <button className="mt-3 bg-gray-400 text-white py-2 px-4 rounded cursor-not-allowed">Enable 2FA</button> */}
            </div>
          </div>


          {/* Danger Zone */}
          <div className="border border-red-300 bg-red-50 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-red-700 flex items-center mb-4">
              <FiAlertCircle className="mr-2" />Danger Zone
            </h2>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-red-600 text-white py-2.5 px-4 rounded-md hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center"
            >
              <FiTrash2 className="mr-2" /> Delete Account
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-gray-800 text-white py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-200 font-medium flex items-center justify-center"
            >
              <FiLogOut className="mr-2" /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Account Deletion">
        <p className="text-gray-700 mb-4">
          Are you absolutely sure you want to delete your account? This action is irreversible and all your data will be permanently lost.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAccount}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Delete Permanently
          </button>
        </div>
      </Modal>
    </Layout>
  );
}