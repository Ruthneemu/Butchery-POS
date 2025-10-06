import React, { useState, useEffect } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FiUser, FiLock, FiBell, FiLogOut, FiDollarSign, FiSmartphone, FiPrinter, FiDownload, FiSearch } from 'react-icons/fi';

export default function Payment() {
  // Data states
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [creditSales, setCreditSales] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({
    todaySales: 0,
    monthlySales: 0,
    inventoryValue: 0,
    profit: 0,
    outstandingCredit: 0
  });
  
  // Transaction-related states
  const [transactionItems, setTransactionItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Filter states
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // States for M-Pesa (simplified)
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState('');
  
  // States for payment records
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [filteredPaymentRecords, setFilteredPaymentRecords] = useState([]);
  const [paymentRecordsLoading, setPaymentRecordsLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentRecords, setShowPaymentRecords] = useState(true);
  
  // States for access control
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('cashier'); // cashier, admin
  const [loginCredentials, setLoginCredentials] = useState({
    email: '',
    password: ''
  });
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // States for notifications (simplified)
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // States for credit sales management
  const [showCreditManagement, setShowCreditManagement] = useState(false);
  const [selectedCreditSale, setSelectedCreditSale] = useState(null);
  const [creditPaymentAmount, setCreditPaymentAmount] = useState(0);
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);

  // Initialize Supabase auth and fetch initial data
  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        setUser(session.user);
        
        // Fetch user role from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          setUserRole(profileData.role);
        }
      }
      
      setLoading(false);
    };
    
    checkSession();
    
    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user || null);
        
        if (session) {
          // Fetch user role from profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          if (profileData) {
            setUserRole(profileData.role);
          }
        } else {
          setUserRole('cashier');
        }
        
        setLoading(false);
      }
    );
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fetch initial data when user is authenticated
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        await fetchCustomers();
        await fetchProducts();
        await fetchSales();
        await fetchCreditSales();
        await fetchFinancialSummary();
        await fetchPaymentRecords();
        await fetchNotifications();
      };
      fetchData();
    }
  }, [user, startDate, endDate]);

  // Filter payment records based on selected filter and search term
  useEffect(() => {
    let filtered = paymentRecords;
    
    // Apply payment method filter
    if (paymentFilter === 'cash') {
      filtered = filtered.filter(record => record.payment_method === 'cash');
    } else if (paymentFilter === 'mpesa') {
      filtered = filtered.filter(record => record.payment_method === 'mpesa');
    } else if (paymentFilter === 'credit') {
      filtered = filtered.filter(record => record.payment_method === 'credit');
    }
    
    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.receipt_number?.toLowerCase().includes(term) ||
        record.phone_number?.toLowerCase().includes(term) ||
        record.customer_name?.toLowerCase().includes(term) ||
        record.items?.some(item => item.name.toLowerCase().includes(term))
      );
    }
    
    setFilteredPaymentRecords(filtered);
  }, [paymentRecords, paymentFilter, searchTerm]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      if (data) setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) throw error;
      if (data) setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchSales = async () => {
    try {
      let query = supabase.from('sales').select(`
        *,
        customers(name),
        inventory(name, selling_price, cost_price)
      `);
      
      if (startDate) query = query.gte('created_at', startDate.toISOString());
      if (endDate) query = query.lte('created_at', endDate.toISOString());
      
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setSales(data);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const fetchCreditSales = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_sales')
        .select(`
          *,
          customers(name, phone)
        `)
        .eq('status', 'unpaid')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setCreditSales(data);
    } catch (error) {
      console.error('Error fetching credit sales:', error);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: todaySalesData, error: todayError } = await supabase
        .from('sales')
        .select('total')
        .gte('created_at', today.toISOString());
      
      if (todayError) throw todayError;
      
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const { data: monthlySalesData, error: monthlyError } = await supabase
        .from('sales')
        .select('total, quantity, price, cost_price')
        .gte('created_at', firstDayOfMonth.toISOString());
      
      if (monthlyError) throw monthlyError;
      
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity, selling_price');
      
      if (inventoryError) throw inventoryError;
      
      // Fetch outstanding credit
      const { data: creditData, error: creditError } = await supabase
        .from('credit_sales')
        .select('amount, paid_amount')
        .eq('status', 'unpaid');
      
      if (creditError) throw creditError;
      
      const todayTotal = todaySalesData?.reduce((sum, s) => sum + s.total, 0) || 0;
      const monthTotal = monthlySalesData?.reduce((sum, s) => sum + s.total, 0) || 0;

      const profit = monthlySalesData?.reduce((sum, s) => {
          const itemCostPrice = s.inventory?.cost_price || 0;
          return sum + (s.price - itemCostPrice) * s.quantity;
      }, 0) || 0;

      const inventoryValue = inventory?.reduce((sum, i) => sum + (i.quantity * i.selling_price), 0) || 0;
      
      // Calculate outstanding credit
      const outstandingCredit = creditData?.reduce((sum, credit) => {
        return sum + (credit.amount - (credit.paid_amount || 0));
      }, 0) || 0;

      setFinancialSummary({
        todaySales: todayTotal,
        monthlySales: monthTotal,
        inventoryValue,
        profit,
        outstandingCredit
      });
    } catch (error) {
      console.error('Error fetching financial summary:', error);
    }
  };

  const fetchPaymentRecords = async () => {
    setPaymentRecordsLoading(true);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('payment_records')
        .select(`
          *,
          customers(name)
        `)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setPaymentRecords(data);
    } catch (error) {
      console.error('Error fetching payment records:', error);
    } finally {
      setPaymentRecordsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      // For simplified version, use mock notifications
      const mockNotifications = [
        { id: 1, message: 'New payment received', read: false, created_at: new Date() },
        { id: 2, message: 'Low stock alert: Beef', read: false, created_at: new Date(Date.now() - 3600000) },
        { id: 3, message: 'Daily sales target achieved', read: true, created_at: new Date(Date.now() - 7200000) }
      ];
      
      setNotifications(mockNotifications);
      setUnreadNotifications(mockNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const addPaymentRecord = async (record) => {
    try {
      const { data, error } = await supabase
        .from('payment_records')
        .insert([record])
        .select();
      
      if (error) throw error;
      if (data) {
        // Update the payment records list
        setPaymentRecords(prev => [data[0], ...prev]);
        
        // Add notification
        const newNotification = {
          id: notifications.length + 1,
          message: `New payment received: KSh ${record.amount.toLocaleString()}`,
          read: false,
          created_at: new Date()
        };
        
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadNotifications(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error adding payment record:', error);
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
      setUnreadNotifications(prev => prev - 1);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
      setUnreadNotifications(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginCredentials.email,
        password: loginCredentials.password,
      });
      
      if (error) {
        console.error('Login error:', error);
        alert('Invalid credentials: ' + error.message);
      } else if (data.user) {
        setUser(data.user);
        setSession(data.session);
        setShowLoginModal(false);
        
        // Fetch user role from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        
        if (profileData) {
          setUserRole(profileData.role);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole('cashier');
      setLoginCredentials({ email: '', password: '' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCreditPayment = async () => {
    if (!selectedCreditSale || creditPaymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('credit_payments')
        .insert([{
          credit_sale_id: selectedCreditSale.id,
          amount: creditPaymentAmount,
          payment_method: 'cash',
          recorded_by: user.id
        }])
        .select();
      
      if (error) throw error;
      
      // Update credit sale record
      const newPaidAmount = (selectedCreditSale.paid_amount || 0) + creditPaymentAmount;
      const isFullyPaid = newPaidAmount >= selectedCreditSale.amount;
      
      const { error: updateError } = await supabase
        .from('credit_sales')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'partial',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCreditSale.id);
      
      if (updateError) throw updateError;
      
      // Add payment record
      await addPaymentRecord({
        payment_method: 'credit',
        amount: creditPaymentAmount,
        receipt_number: `CR${Date.now()}`,
        customer_name: selectedCreditSale.customers?.name || 'Customer',
        status: 'completed',
        credit_sale_id: selectedCreditSale.id,
        items: selectedCreditSale.items
      });
      
      // Show success message
      alert(`Payment of KSh ${creditPaymentAmount.toLocaleString()} recorded successfully`);
      
      // Reset and close modals
      setCreditPaymentAmount(0);
      setShowCreditPaymentModal(false);
      setSelectedCreditSale(null);
      
      // Refresh data
      await fetchCreditSales();
      await fetchFinancialSummary();
    } catch (error) {
      console.error('Error processing credit payment:', error);
      alert('An error occurred while processing the payment');
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Payment Records Report', 105, 15, { align: 'center' });
    
    // Add date range
    doc.setFontSize(12);
    const today = new Date().toLocaleDateString();
    doc.text(`Generated on: ${today}`, 105, 25, { align: 'center' });
    
    // Add payment statistics
    const totalPayments = paymentRecords.length;
    const totalAmount = paymentRecords.reduce((sum, record) => sum + record.amount, 0);
    const cashPayments = paymentRecords.filter(r => r.payment_method === 'cash').length;
    const mpesaPayments = paymentRecords.filter(r => r.payment_method === 'mpesa').length;
    const creditPayments = paymentRecords.filter(r => r.payment_method === 'credit').length;
    const averageTransaction = totalPayments > 0 ? totalAmount / totalPayments : 0;
    
    doc.setFontSize(14);
    doc.text('Payment Summary:', 14, 40);
    doc.setFontSize(10);
    doc.text(`Total Payments: ${totalPayments}`, 14, 50);
    doc.text(`Total Amount: KSh ${totalAmount.toLocaleString()}`, 14, 55);
    doc.text(`Cash Payments: ${cashPayments}`, 14, 60);
    doc.text(`M-Pesa Payments: ${mpesaPayments}`, 14, 65);
    doc.text(`Credit Payments: ${creditPayments}`, 14, 70);
    doc.text(`Average Transaction: KSh ${averageTransaction.toFixed(2)}`, 14, 75);
    
    // Add payment records table
    const tableColumn = ["Date", "Time", "Customer", "Amount", "Payment Method", "Receipt #"];
    const tableRows = filteredPaymentRecords.map(record => [
      new Date(record.created_at).toLocaleDateString(),
      new Date(record.created_at).toLocaleTimeString(),
      record.customer_name || 'Guest',
      `KSh ${record.amount.toLocaleString()}`,
      record.payment_method === 'mpesa' ? 'M-Pesa' :
      record.payment_method === 'credit' ? 'Credit' : 'Cash',
      record.receipt_number || ''
    ]);
    
    doc.autoTable(tableColumn, tableRows, { startY: 90 });
    
    // Save the PDF
    doc.save(`payment_records_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleAddItemToTransaction = async () => {
    const product = products.find(p => p.id === selectedProductId);
    if (product && itemQuantity > 0) {
      // Check if there's enough stock
      if (product.quantity < itemQuantity) {
        alert(`Not enough stock. Only ${product.quantity} units available.`);
        return;
      }
      
      const existingItemIndex = transactionItems.findIndex(item => item.product_id === selectedProductId);

      if (existingItemIndex > -1) {
        const updatedItems = [...transactionItems];
        const newQuantity = updatedItems[existingItemIndex].quantity + parseFloat(itemQuantity);
        
        // Check if there's enough stock for the additional quantity
        if (product.quantity < newQuantity) {
          alert(`Not enough stock. Only ${product.quantity} units available.`);
          return;
        }
        
        updatedItems[existingItemIndex].quantity = newQuantity;
        updatedItems[existingItemIndex].total = newQuantity * updatedItems[existingItemIndex].price;
        setTransactionItems(updatedItems);
      } else {
        setTransactionItems([
          ...transactionItems,
          {
            product_id: product.id,
            name: product.name,
            quantity: parseFloat(itemQuantity),
            price: product.selling_price,
            total: parseFloat(itemQuantity) * product.selling_price,
            cost_price: product.cost_price
          }
        ]);
      }
      setSelectedProductId('');
      setItemQuantity(1);
    } else {
      alert('Please select a product and enter a valid quantity.');
    }
  };

  const handleRemoveItem = (index) => {
    const updatedItems = transactionItems.filter((_, i) => i !== index);
    setTransactionItems(updatedItems);
  };

  const calculateGrandTotal = () => {
    return transactionItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateChange = () => {
    const total = calculateGrandTotal();
    return cashReceived > total ? cashReceived - total : 0;
  };

  const createCreditSaleRecord = async () => {
    if (transactionItems.length === 0) {
      alert('Please add items to the transaction.');
      return null;
    }
    
    if (!selectedCustomerId) {
      alert('Please select a customer for credit sale.');
      return null;
    }

    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      const creditSaleData = {
        customer_id: selectedCustomerId,
        items: transactionItems,
        amount: calculateGrandTotal(),
        paid_amount: 0,
        status: 'unpaid',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        created_by: user.id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('credit_sales')
        .insert([creditSaleData])
        .select();
      
      if (error) throw error;
      
      // Add notification
      const newNotification = {
        id: notifications.length + 1,
        message: `New credit sale: KSh ${calculateGrandTotal().toLocaleString()} for ${customer.name}`,
        read: false,
        created_at: new Date()
      };
      
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadNotifications(prev => prev + 1);
      
      return data[0];
    } catch (error) {
      console.error('Error creating credit sale record:', error);
      return null;
    }
  };

  const handleProcessPayment = async () => {
    const grandTotal = calculateGrandTotal();
    if (transactionItems.length === 0) {
      alert('Please add items to the transaction.');
      return;
    }
    if (paymentMethod === 'cash' && cashReceived < grandTotal) {
      alert('Cash received is less than the total amount.');
      return;
    }
    if (paymentMethod === 'credit' && !selectedCustomerId) {
        alert('Please select a customer for a credit/account sale.');
        return;
    }

    try {
      // Handle credit sales separately
      if (paymentMethod === 'credit') {
        const creditSale = await createCreditSaleRecord();
        if (creditSale) {
          alert('Credit sale recorded successfully!');
          await fetchCreditSales();
          await fetchFinancialSummary();
          
          // Reset transaction states
          setTransactionItems([]);
          setSelectedCustomerId('');
          setCustomerSearchTerm('');
          setPaymentMethod('cash');
          setCashReceived(0);
          setShowPaymentModal(false);
        }
        return;
      }
      
      // Generate receipt number
      const receiptNumber = paymentMethod === 'cash' 
        ? `CSH${Date.now()}` 
        : `MP${Date.now()}`;
      
      // Prepare sales data
      const salesData = transactionItems.map(item => ({
        customer_id: selectedCustomerId || null,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        payment_method: paymentMethod,
        cost_price: item.cost_price,
        receipt_number: receiptNumber,
        phone_number: paymentMethod === 'mpesa' ? mpesaPhoneNumber : null
      }));

      // Save sales to database
      const { error } = await supabase
        .from('sales')
        .insert(salesData);

      if (error) throw error;
      
      // Update inventory quantities
      for (const item of transactionItems) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const newQuantity = product.quantity - item.quantity;
          await supabase
            .from('inventory')
            .update({ quantity: newQuantity })
            .eq('id', item.product_id);
        }
      }
      
      // Add payment record
      await addPaymentRecord({
        payment_method: paymentMethod,
        amount: grandTotal,
        receipt_number: receiptNumber,
        phone_number: paymentMethod === 'mpesa' ? mpesaPhoneNumber : null,
        customer_name: selectedCustomerId 
          ? customers.find(c => c.id === selectedCustomerId)?.name 
          : 'Guest Customer',
        status: 'completed',
        items: transactionItems
      });
      
      alert('Payment successful!');
      await fetchSales();
      await fetchFinancialSummary();
      await fetchProducts(); // Refresh products to update inventory
      
      // Reset transaction states
      setTransactionItems([]);
      setSelectedCustomerId('');
      setCustomerSearchTerm('');
      setPaymentMethod('cash');
      setCashReceived(0);
      setMpesaPhoneNumber('');
      setShowPaymentModal(false);
      
    } catch (error) {
      console.error('Payment processing error:', error);
      alert('Error processing payment: ' + error.message);
    }
  };

  // Reusable card component for financial summary
  const SummaryCard = ({ title, value, color, icon }) => (
    <div className={`bg-white p-4 rounded shadow border-l-4 ${color}`}>
      <div className="flex items-center">
        <div className="mr-3 text-gray-500">
          {icon}
        </div>
        <div>
          <h3 className="font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold">KSh {value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );

  const filteredCustomers = customerSearchTerm
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()))
    : [];

  const selectedCustomerName = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)?.name
    : 'Guest Customer';

  // Show loading state while checking authentication
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show login modal if user is not authenticated
  if (!user) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-2xl font-bold text-center mb-6">Login to Butchery POS</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={loginCredentials.email}
                  onChange={(e) => setLoginCredentials({...loginCredentials, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={loginCredentials.password}
                  onChange={(e) => setLoginCredentials({...loginCredentials, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                />
              </div>
              
              <button
                onClick={handleLogin}
                disabled={loading || !loginCredentials.email || !loginCredentials.password}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
            
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>Default credentials:</p>
              <p>Email: admin@example.com, Password: password</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-6 max-w-screen-lg mx-auto">
        {/* Header with User Info and Notifications */}
        <div className="flex justify-between items-center bg-white shadow p-4 rounded">
          <div>
            <h1 className="text-2xl font-bold">Butchery POS System</h1>
            <p className="text-gray-600">Payment and Sales Management</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900"
              >
                <FiBell className="h-6 w-6" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b flex justify-between items-center">
                    <h3 className="text-sm font-medium">Notifications</h3>
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-gray-500">No notifications</p>
                    ) : (
                      notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`px-4 py-2 hover:bg-gray-50 cursor-pointer ${notification.read ? '' : 'bg-blue-50'}`}
                          onClick={() => markNotificationAsRead(notification.id)}
                        >
                          <p className="text-sm">{notification.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(notification.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="font-medium">{user ? user.email : 'Guest'}</p>
                <p className="text-xs text-gray-500 capitalize">{userRole}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                {user ? user.email.charAt(0).toUpperCase() : 'G'}
              </div>
              <button 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                <FiLogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap gap-4 items-end bg-white shadow p-4 rounded">
          <div>
            <label className="block text-sm font-medium">Start Date</label>
            <DatePicker
              selected={startDate}
              onChange={setStartDate}
              className="border p-2 rounded w-full"
              placeholderText="Select start date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">End Date</label>
            <DatePicker
              selected={endDate}
              onChange={setEndDate}
              className="border p-2 rounded w-full"
              placeholderText="Select end date"
            />
          </div>
        </div>

        {/* Financial Summary Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Today's Sales"
            value={financialSummary.todaySales}
            color="border-green-500"
            icon={<FiDollarSign className="h-6 w-6" />}
          />
          <SummaryCard
            title="Monthly Sales"
            value={financialSummary.monthlySales}
            color="border-blue-500"
            icon={<FiDollarSign className="h-6 w-6" />}
          />
          <SummaryCard
            title="Inventory Value"
            value={financialSummary.inventoryValue}
            color="border-purple-500"
            icon={<FiDollarSign className="h-6 w-6" />}
          />
          <SummaryCard
            title="Outstanding Credit"
            value={financialSummary.outstandingCredit}
            color="border-yellow-500"
            icon={<FiDollarSign className="h-6 w-6" />}
          />
        </div>

        {/* Payment Records Section */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Payment Records</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreditManagement(!showCreditManagement)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
              >
                {showCreditManagement ? 'Hide' : 'Show'} Credit Sales
              </button>
              <button
                onClick={exportToPDF}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                <FiDownload className="mr-1" />
                Export to PDF
              </button>
            </div>
          </div>
          
          {/* Filters and Search */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filter by:</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash Only</option>
                <option value="mpesa">M-Pesa Only</option>
                <option value="credit">Credit Only</option>
              </select>
            </div>
            
            <div className="flex-grow">
              <label className="block text-sm font-medium mb-1">Search:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by receipt, phone, customer, or item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border p-2 rounded w-full pl-10"
                />
                <FiSearch className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Payment Records Table */}
          {paymentRecordsLoading ? (
            <div className="text-center py-8">
              <p>Loading payment records...</p>
            </div>
          ) : filteredPaymentRecords.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded">
              <p>No payment records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPaymentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        KSh {record.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          record.payment_method === 'cash' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : record.payment_method === 'mpesa' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {record.payment_method === 'cash' ? 'Cash' : 
                           record.payment_method === 'mpesa' ? 'M-Pesa' : 'Credit'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.receipt_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Credit Sales Management */}
        {showCreditManagement && (
          <div className="bg-white rounded shadow p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Credit Sales Management</h2>
              <button
                onClick={fetchCreditSales}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                Refresh
              </button>
            </div>
            
            {creditSales.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded">
                <p>No outstanding credit sales</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paid
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {creditSales.map((creditSale) => (
                      <tr key={creditSale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {creditSale.customers?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          KSh {creditSale.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          KSh {(creditSale.paid_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          KSh {(creditSale.amount - (creditSale.paid_amount || 0)).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(creditSale.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            creditSale.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : creditSale.status === 'partial' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {creditSale.status === 'paid' ? 'Paid' : 
                             creditSale.status === 'partial' ? 'Partial' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedCreditSale(creditSale);
                              setCreditPaymentAmount(creditSale.amount - (creditSale.paid_amount || 0));
                              setShowCreditPaymentModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-2"
                            disabled={creditSale.status === 'paid'}
                          >
                            Record Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- Transaction Section --- */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">New Transaction</h2>

          {/* Customer Linking */}
          <div className="mb-4 relative">
            <label className="block text-sm font-medium mb-1">Link Customer:</label>
            <input
              type="text"
              placeholder="Search or select customer..."
              value={customerSearchTerm}
              onChange={(e) => {
                setCustomerSearchTerm(e.target.value);
                setSelectedCustomerId('');
              }}
              className="border p-2 rounded w-full mb-2"
            />
            {customerSearchTerm && filteredCustomers.length > 0 && (
              <div className="border border-gray-300 rounded max-h-40 overflow-y-auto bg-white absolute z-10 w-full">
                {filteredCustomers.map(customer => (
                  <div
                    key={customer.id}
                    className="p-2 cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerSearchTerm(customer.name);
                    }}
                  >
                    {customer.name} ({customer.phone})
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setSelectedCustomerId('');
                setCustomerSearchTerm('Guest Customer');
              }}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm mt-2"
            >
              Set as Guest
            </button>
            <p className="mt-2 text-sm text-gray-600">Selected: <span className="font-medium">{selectedCustomerName}</span></p>
          </div>

          {/* Product Selection */}
          <div className="flex gap-2 mb-4">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="border p-2 rounded flex-grow"
            >
              <option value="">Select Product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} (KSh {product.selling_price?.toLocaleString()}) - Stock: {product.quantity}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={itemQuantity}
              onChange={(e) => setItemQuantity(parseFloat(e.target.value))}
              placeholder="Quantity"
              className="border p-2 rounded w-24"
            />
            <button
              onClick={handleAddItemToTransaction}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Add Item
            </button>
          </div>

          {/* Transaction Items Display */}
          <div className="border rounded p-3 mb-4 max-h-60 overflow-y-auto">
            <h3 className="font-semibold mb-2">Items in Cart:</h3>
            {transactionItems.length === 0 ? (
              <p className="text-gray-500">No items added yet.</p>
            ) : (
              <ul>
                {transactionItems.map((item, index) => (
                  <li key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.quantity} x KSh {item.price?.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center">
                      <p className="font-bold mr-3">KSh {item.total?.toLocaleString()}</p>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 text-lg"
                      >
                        &times;
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Transaction Summary */}
          <div className="text-right text-2xl font-bold mb-4">
            Grand Total: KSh {calculateGrandTotal().toLocaleString()}
          </div>

          {/* Payment Button */}
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-blue-600 text-white w-full py-3 rounded text-lg font-semibold"
            disabled={transactionItems.length === 0}
          >
            Proceed to Payment
          </button>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Complete Payment</h2>
              <p className="text-lg font-bold mb-4">Amount Due: KSh {calculateGrandTotal().toLocaleString()}</p>
              <p className="text-md text-gray-700 mb-4">Paying for: {selectedCustomerName}</p>

              {/* Payment Method Selection */}
              <div className="mb-4">
                <label className="block mb-2 font-medium">Select Payment Method:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setCashReceived(0);
                    setMpesaPhoneNumber('');
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="credit">Credit/Account Sale</option>
                </select>
              </div>

              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <label className="block mb-1 font-medium">Cash Received (KSh):</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="Enter amount received"
                  />
                  <p className="mt-2 text-green-600 font-semibold">
                    Change Due: KSh {calculateChange().toLocaleString()}
                  </p>
                </div>
              )}

              {paymentMethod === 'mpesa' && (
                <div className="mb-4 bg-yellow-50 p-3 rounded">
                  <p className="font-medium">M-Pesa Payment</p>
                  
                  <div className="mt-3">
                    <label className="block mb-1">Phone Number:</label>
                    <input
                      type="text"
                      value={mpesaPhoneNumber}
                      onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="2547XXXXXXXX"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: 2547XXXXXXXX (e.g., 254712345678)
                    </p>
                  </div>
                  
                  <div className="mt-4 bg-blue-50 p-3 rounded">
                    <p className="font-medium text-blue-800">Payment Instructions:</p>
                    <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
                      <li>Open M-Pesa menu on your phone</li>
                      <li>Select "Lipa na M-Pesa"</li>
                      <li>Select "Pay Bill" or "Buy Goods and Services"</li>
                      <li>Enter our business number</li>
                      <li>Enter Amount: <span className="font-bold">KSh {calculateGrandTotal().toLocaleString()}</span></li>
                      <li>Enter your M-Pesa PIN and confirm</li>
                    </ol>
                    <p className="text-sm mt-2 text-red-600">
                      Once payment is confirmed, click "Confirm Payment" below
                    </p>
                  </div>
                </div>
              )}

              {paymentMethod === 'credit' && (
                <div className="mb-4 bg-orange-50 p-3 rounded">
                  <p className="font-medium">Credit / Account Sale:</p>
                  <p className="text-sm">This transaction will be recorded as an outstanding balance for the selected customer.</p>
                  <p className="text-sm text-gray-700 mt-2">
                    Due Date: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </p>
                  {!selectedCustomerId && (
                    <p className="text-red-500 text-sm mt-1">
                      Warning: Please select a specific customer for a credit sale.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setMpesaPhoneNumber('');
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleProcessPayment}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  disabled={
                    (paymentMethod === 'cash' && cashReceived < calculateGrandTotal()) ||
                    (paymentMethod === 'credit' && !selectedCustomerId) ||
                    (paymentMethod === 'mpesa' && !mpesaPhoneNumber)
                  }
                >
                  {paymentMethod === 'credit' ? 'Record Credit Sale' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credit Payment Modal */}
        {showCreditPaymentModal && selectedCreditSale && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Record Credit Payment</h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">Customer: {selectedCreditSale.customers?.name}</p>
                <p className="text-sm text-gray-600">Total Amount: KSh {selectedCreditSale.amount.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Amount Paid: KSh {(selectedCreditSale.paid_amount || 0).toLocaleString()}</p>
                <p className="text-sm font-medium">Outstanding Balance: KSh {(selectedCreditSale.amount - (selectedCreditSale.paid_amount || 0)).toLocaleString()}</p>
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 font-medium">Payment Amount (KSh):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedCreditSale.amount - (selectedCreditSale.paid_amount || 0)}
                  value={creditPaymentAmount}
                  onChange={(e) => setCreditPaymentAmount(parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Enter payment amount"
                />
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    setShowCreditPaymentModal(false);
                    setSelectedCreditSale(null);
                    setCreditPaymentAmount(0);
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleCreditPayment}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  disabled={!creditPaymentAmount || creditPaymentAmount <= 0}
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}