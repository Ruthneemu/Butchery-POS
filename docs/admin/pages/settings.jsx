import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';
import Layout from '../components/layout';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiUser, FiMail, FiLock, FiBell, FiBriefcase, FiKey, FiAlertCircle, FiLogOut, FiSave, FiEdit, FiTrash2, FiRefreshCcw, FiShield, FiEye, FiEyeOff } from 'react-icons/fi';

// --- START: ConfirmationModal Component Definition ---
function ConfirmationModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
      <div className="relative p-6 bg-white rounded-lg shadow-xl max-w-sm mx-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}
// --- END: ConfirmationModal Component Definition ---

// Password strength indicator component
function PasswordStrengthIndicator({ password }) {
  const calculateStrength = (password) => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 15;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) strength += 15; // Uppercase letters
    if (/[a-z]/.test(password)) strength += 10; // Lowercase letters
    if (/[0-9]/.test(password)) strength += 15; // Numbers
    if (/[^A-Za-z0-9]/.test(password)) strength += 20; // Special characters
    
    return Math.min(strength, 100);
  };

  const getStrengthLabel = (strength) => {
    if (strength === 0) return '';
    if (strength < 30) return 'Weak';
    if (strength < 70) return 'Medium';
    return 'Strong';
  };

  const getStrengthColor = (strength) => {
    if (strength < 30) return 'bg-red-500';
    if (strength < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const strength = calculateStrength(password);
  const label = getStrengthLabel(strength);
  const color = getStrengthColor(strength);

  return (
    <div className="mt-2">
      <div className="flex justify-between text-sm mb-1">
        <span>Password strength:</span>
        <span className={`font-medium ${strength < 30 ? 'text-red-500' : strength < 70 ? 'text-yellow-500' : 'text-green-500'}`}>
          {label}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${color} transition-all duration-300`} 
          style={{ width: `${strength}%` }}
        ></div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Use 8+ characters with uppercase, lowercase, numbers & symbols
      </div>
    </div>
  );
}

export default function Settings() {
  // 'user' state will hold the authenticated user object
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [name, setName] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState(false);
  
  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Business settings states
  const [businessSettings, setBusinessSettings] = useState({
    business_name: '',
    address: '',
    phone: '',
    kra_pin: '',
    receipt_footer_msg: '',
    default_currency: 'KES',
    tax_rate_percent: 16,
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
  const [sessionExpired, setSessionExpired] = useState(false);

  const navigate = useNavigate();

  // Set up session management
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        // Session was refreshed, everything is fine
        console.log('Session refreshed');
      } else if (event === 'SIGNED_OUT' || (event === 'USER_UPDATED' && !session)) {
        // Session expired or user signed out
        setSessionExpired(true);
        toast.error('Your session has expired. Please log in again.');
        navigate('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    
    // Check if session is still valid
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      setSessionExpired(true);
      setLoading(false);
      toast.error('Your session has expired. Please log in again.');
      navigate('/login');
      return;
    }
    
    // Fetches the currently authenticated user from Supabase
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
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching business settings:', settingsError.message);
        toast.error('Failed to load business settings.');
      } else if (settingsData) {
        setBusinessSettings(settingsData);
      } else {
        setBusinessSettings(prev => ({ ...prev }));
      }

    } else if (authError) {
      console.error(authError.message);
      toast.error('Failed to load user data.');
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Verify current password before making sensitive changes
  const verifyCurrentPassword = async () => {
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return false;
    }

    try {
      // Try to sign in with current credentials to verify password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (error) {
        toast.error('Current password is incorrect');
        return false;
      }
      return true;
    } catch (err) {
      toast.error('Error verifying password');
      console.error('Password verification error:', err);
      return false;
    }
  };

  const handleUpdate = async (type) => {
    setIsSaving(prev => ({ ...prev, [type]: true }));

    let updatePromise;
    let successMessage = 'Update successful!';
    let passwordVerified = true;

    try {
      // For sensitive operations, verify current password first
      if (type === 'email' || type === 'password') {
        passwordVerified = await verifyCurrentPassword();
        if (!passwordVerified) {
          setIsSaving(prev => ({ ...prev, [type]: false }));
          return;
        }
      }

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
        if (businessSettings.id) {
          updatePromise = supabase.from('business_settings').update(payload).eq('id', businessSettings.id);
        } else {
          updatePromise = supabase.from('business_settings').insert(payload).single();
        }
        successMessage = 'Business settings updated!';
      }

      const { error } = await updatePromise;

      if (error) {
        // Check if the error is due to an expired session
        if (error.message.includes('session') || error.message.includes('token') || error.status === 401) {
          setSessionExpired(true);
          toast.error('Your session has expired. Please log in again.');
          navigate('/login');
        } else {
          toast.error(`Error updating ${type}: ${error.message}`);
          console.error(`Update ${type} error:`, error.message);
        }
      } else {
        toast.success(successMessage);
        // Update local state if needed
        if (type === 'email') setEmail(newEmail);
        if (type === 'password') {
          setNewPassword('');
          setCurrentPassword('');
        }
        if (type === 'business' && !businessSettings.id && error === null) {
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
    setShowDeleteModal(false);
    if (!user) {
      toast.error('No user is currently logged in.');
      return;
    }

    try {
      // Verify password before account deletion
      const passwordVerified = await verifyCurrentPassword();
      if (!passwordVerified) return;

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

  if (!user || sessionExpired) {
    return (
      <Layout breadcrumb="Settings">
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Please Log In</h2>
            <p className="mb-6 text-gray-600">
              {sessionExpired 
                ? 'Your session has expired. Please log in again.' 
                : 'You must be logged in to view your settings.'}
            </p>
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
            
            {/* Current Password Verification for Email Change */}
            <div>
              <label htmlFor="current-password-email" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  id="current-password-email"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 pr-10"
                  placeholder="Enter your current password"
                  disabled={isSaving.email}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <FiEyeOff className="h-5 w-5 text-gray-400" /> : <FiEye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
            
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
            
            {/* Current Password Verification */}
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 pr-10"
                  placeholder="Enter your current password"
                  disabled={isSaving.password}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <FiEyeOff className="h-5 w-5 text-gray-400" /> : <FiEye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 pr-10"
                  placeholder="Enter new password (min 6 characters)"
                  disabled={isSaving.password}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <FiEyeOff className="h-5 w-5 text-gray-400" /> : <FiEye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>
            <button
              onClick={() => handleUpdate('password')}
              disabled={isSaving.password || newPassword.length < 6 || !currentPassword}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${isSaving.password || newPassword.length < 6 || !currentPassword ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
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
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-300 bg-red-50 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-red-700 flex items-center mb-4">
              <FiAlertCircle className="mr-2" />Danger Zone
            </h2>
            <div className="mb-4">
              <label htmlFor="current-password-delete" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  id="current-password-delete"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 pr-10"
                  placeholder="Enter your current password to confirm account deletion"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <FiEyeOff className="h-5 w-5 text-gray-400" /> : <FiEye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={!currentPassword}
              className={`w-full py-2.5 px-4 rounded-md transition-colors duration-200 font-medium flex items-center justify-center
                ${!currentPassword ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
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
      <ConfirmationModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Account Deletion">
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
      </ConfirmationModal>
    </Layout>
  );
}