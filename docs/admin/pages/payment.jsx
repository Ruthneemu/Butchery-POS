import React, { useState, useEffect, useRef } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FiUser, FiLock, FiBell, FiLogOut, FiEye, FiEyeOff, FiCreditCard, FiDollarSign, FiSmartphone, FiPrinter, FiDownload, FiSearch, FiFilter } from 'react-icons/fi';

export default function Payment() {
  // Data states
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [creditSales, setCreditSales] = useState([]); // New state for credit sales
  const [financialSummary, setFinancialSummary] = useState({
    todaySales: 0,
    monthlySales: 0,
    inventoryValue: 0,
    profit: 0,
    outstandingCredit: 0 // New field for outstanding credit
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

  //fetch suppliers state
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*');
    if (data) setSuppliers(data);
  };

  // States for M-Pesa and Odoo integration
  const [odooSaleOrderId, setOdooSaleOrderId] = useState(null);
  const [mpesaTransactionId, setMpesaTransactionId] = useState(null);
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [mpesaProcessing, setMpesaProcessing] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState('');
  const [pollingInterval, setPollingInterval] = useState(null);
  
  // States for M-Pesa Till Number
  const [mpesaTillNumber, setMpesaTillNumber] = useState('123456'); // Your actual till number
  const [tillProcessing, setTillProcessing] = useState(false);
  
  // States for M-Pesa Pochi La Biashara
  const [mpesaPochiNumber, setMpesaPochiNumber] = useState('0722123456'); // Your Pochi number
  const [pochiProcessing, setPochiProcessing] = useState(false);
  
  // States for Equity Bank
  const [equityAccountNumber, setEquityAccountNumber] = useState('');
  const [equityTransactionRef, setEquityTransactionRef] = useState('');
  const [equityProcessing, setEquityProcessing] = useState(false);
  
  // States for payment records
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [filteredPaymentRecords, setFilteredPaymentRecords] = useState([]);
  const [paymentRecordsLoading, setPaymentRecordsLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentRecords, setShowPaymentRecords] = useState(true);
  
  // States for sales tracking
  const [currentSale, setCurrentSale] = useState(null);
  const [saleStatus, setSaleStatus] = useState('draft');
  const [receiptData, setReceiptData] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  
  // States for payment tracking and reporting
  const [paymentStats, setPaymentStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    cashPayments: 0,
    mpesaPayments: 0,
    equityPayments: 0,
    creditPayments: 0,
    averageTransaction: 0
  });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  
  // States for access control - ENHANCED FOR PROPER AUTH
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('cashier'); // cashier, manager, admin
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({
    email: '', // Changed from username to email for Supabase
    password: ''
  });
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // States for notifications
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
    // Check for existing session
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
        await fetchCreditSales(); // New function to fetch credit sales
        await fetchFinancialSummary();
        await fetchPaymentRecords();
        await fetchPaymentStats();
        await fetchNotifications();
      };
      fetchData();
    }
  }, [user, startDate, endDate]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Filter payment records based on selected filter and search term
  useEffect(() => {
    let filtered = paymentRecords;
    
    // Apply payment method filter
    if (paymentFilter === 'till') {
      filtered = filtered.filter(record => record.payment_method === 'mpesa_till');
    } else if (paymentFilter === 'pochi') {
      filtered = filtered.filter(record => record.payment_method === 'mpesa_pochi');
    } else if (paymentFilter === 'cash') {
      filtered = filtered.filter(record => record.payment_method === 'cash');
    } else if (paymentFilter === 'equity') {
      filtered = filtered.filter(record => record.payment_method === 'equity');
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
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('inventory').select('*');
    if (data) setProducts(data);
  };

  const fetchSales = async () => {
    let query = supabase.from('sales').select(`
      *,
      customers(name),
      inventory(name, selling_price, cost_price)
    `);
    if (startDate) query = query.gte('created_at', startDate.toISOString());
    if (endDate) query = query.lte('created_at', endDate.toISOString());
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setSales(data);
  };

  // New function to fetch credit sales
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
      
      if (error) {
        console.error('Error fetching credit sales:', error);
      } else if (data) {
        setCreditSales(data);
      }
    } catch (error) {
      console.error('Error fetching credit sales:', error);
    }
  };

  const fetchFinancialSummary = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', today.toISOString());

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const { data: monthlySalesData } = await supabase
      .from('sales')
      .select('total, quantity, price, cost_price')
      .gte('created_at', firstDayOfMonth.toISOString());

    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity, selling_price');

    // Fetch outstanding credit
    const { data: creditData } = await supabase
      .from('credit_sales')
      .select('amount, paid_amount')
      .eq('status', 'unpaid');

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
  };

  // Fetch payment records
  const fetchPaymentRecords = async () => {
    setPaymentRecordsLoading(true);
    
    try {
      // Fetch records for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from('payment_records')
        .select(`
          *,
          customers(name)
        `)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });
      
      if (data) {
        setPaymentRecords(data);
      }
    } catch (error) {
      console.error('Error fetching payment records:', error);
    } finally {
      setPaymentRecordsLoading(false);
    }
  };

  // Fetch payment statistics
  const fetchPaymentStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from('payment_records')
        .select('payment_method, amount')
        .gte('created_at', today.toISOString());
      
      if (data) {
        const stats = {
          totalPayments: data.length,
          totalAmount: data.reduce((sum, record) => sum + record.amount, 0),
          cashPayments: data.filter(r => r.payment_method === 'cash').length,
          mpesaPayments: data.filter(r => r.payment_method.includes('mpesa')).length,
          equityPayments: data.filter(r => r.payment_method === 'equity').length,
          creditPayments: data.filter(r => r.payment_method === 'credit').length,
          averageTransaction: data.length > 0 ? data.reduce((sum, record) => sum + record.amount, 0) / data.length : 0
        };
        
        setPaymentStats(stats);
      }
    } catch (error) {
      console.error('Error fetching payment stats:', error);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        // Use mock notifications as fallback
        const mockNotifications = [
          { id: 1, message: 'New payment received via M-Pesa Till', read: false, created_at: new Date() },
          { id: 2, message: 'Low stock alert: Beef', read: false, created_at: new Date(Date.now() - 3600000) },
          { id: 3, message: 'Daily sales target achieved', read: true, created_at: new Date(Date.now() - 7200000) }
        ];
        
        setNotifications(mockNotifications);
        setUnreadNotifications(mockNotifications.filter(n => !n.read).length);
      } else if (data) {
        setNotifications(data);
        setUnreadNotifications(data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Add a new payment record
  const addPaymentRecord = async (record) => {
    try {
      const { data, error } = await supabase
        .from('payment_records')
        .insert([record])
        .select();
      
      if (error) {
        console.error('Error adding payment record:', error);
      } else if (data) {
        // Update the payment records list
        setPaymentRecords(prev => [data[0], ...prev]);
        
        // Add notification
        const newNotification = {
          user_id: user.id,
          message: `New payment received: KSh ${record.amount.toLocaleString()} via ${record.payment_method}`,
          read: false,
          created_at: new Date()
        };
        
        const { data: notificationData } = await supabase
          .from('notifications')
          .insert([newNotification])
          .select();
        
        if (notificationData) {
          setNotifications(prev => [notificationData[0], ...prev]);
          setUnreadNotifications(prev => prev + 1);
        }
        
        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Payment Received', {
            body: `KSh ${record.amount} received via ${record.payment_method === 'mpesa_till' ? 'Till Number' : 'Pochi La Biashara'}`,
            icon: '/favicon.ico'
          });
        }
        
        // Update stats
        await fetchPaymentStats();
      }
    } catch (error) {
      console.error('Error adding payment record:', error);
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      
      if (!error) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === id ? { ...notification, read: true } : notification
          )
        );
        setUnreadNotifications(prev => prev - 1);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id);
      
      if (!error) {
        setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
        setUnreadNotifications(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Handle login with Supabase
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
        
        // Add notification
        const newNotification = {
          user_id: data.user.id,
          message: `Logged in as ${profileData?.role || 'user'}`,
          read: false,
          created_at: new Date()
        };
        
        const { data: notificationData } = await supabase
          .from('notifications')
          .insert([newNotification])
          .select();
        
        if (notificationData) {
          setNotifications(prev => [notificationData[0], ...prev]);
          setUnreadNotifications(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle logout with Supabase
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole('cashier');
      setLoginCredentials({ email: '', password: '' });
      
      // Add notification (for next login)
      const mockNotification = {
        id: notifications.length + 1,
        message: 'Logged out',
        read: false,
        created_at: new Date()
      };
      
      setNotifications(prev => [mockNotification, ...prev]);
      setUnreadNotifications(prev => prev + 1);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle credit sale payment
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
          payment_method: 'cash', // Default to cash, could be extended
          recorded_by: user.id
        }])
        .select();
      
      if (error) {
        console.error('Error processing credit payment:', error);
        alert('Error processing payment: ' + error.message);
        return;
      }
      
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
      
      if (updateError) {
        console.error('Error updating credit sale:', updateError);
        alert('Error updating credit sale record');
        return;
      }
      
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

  // Export payment records to PDF
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
    doc.setFontSize(14);
    doc.text('Payment Summary:', 14, 40);
    doc.setFontSize(10);
    doc.text(`Total Payments: ${paymentStats.totalPayments}`, 14, 50);
    doc.text(`Total Amount: KSh ${paymentStats.totalAmount.toLocaleString()}`, 14, 55);
    doc.text(`Cash Payments: ${paymentStats.cashPayments}`, 14, 60);
    doc.text(`M-Pesa Payments: ${paymentStats.mpesaPayments}`, 14, 65);
    doc.text(`Equity Payments: ${paymentStats.equityPayments}`, 14, 70);
    doc.text(`Credit Payments: ${paymentStats.creditPayments}`, 14, 75);
    doc.text(`Average Transaction: KSh ${paymentStats.averageTransaction.toFixed(2)}`, 14, 80);
    
    // Add payment records table
    const tableColumn = ["Date", "Time", "Customer", "Amount", "Payment Method", "Receipt #"];
    const tableRows = filteredPaymentRecords.map(record => [
      new Date(record.created_at).toLocaleDateString(),
      new Date(record.created_at).toLocaleTimeString(),
      record.customer_name || 'Guest',
      `KSh ${record.amount.toLocaleString()}`,
      record.payment_method === 'mpesa_till' ? 'Till Number' :
      record.payment_method === 'mpesa_pochi' ? 'Pochi La Biashara' :
      record.payment_method === 'mpesa' ? 'M-Pesa STK' :
      record.payment_method === 'equity' ? 'Equity Bank' :
      record.payment_method === 'credit' ? 'Credit' : 'Cash',
      record.receipt_number || ''
    ]);
    
    doc.autoTable(tableColumn, tableRows, { startY: 90 });
    
    // Save the PDF
    doc.save(`payment_records_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export single payment to PDF
  const exportPaymentToPDF = (payment) => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Payment Receipt', 105, 15, { align: 'center' });
    
    // Add payment details
    doc.setFontSize(12);
    doc.text(`Receipt #: ${payment.receipt_number}`, 14, 30);
    doc.text(`Date: ${new Date(payment.created_at).toLocaleDateString()}`, 14, 40);
    doc.text(`Time: ${new Date(payment.created_at).toLocaleTimeString()}`, 14, 50);
    doc.text(`Customer: ${payment.customer_name || 'Guest Customer'}`, 14, 60);
    doc.text(`Payment Method: ${payment.payment_method === 'mpesa_till' ? 'Till Number' :
                                   payment.payment_method === 'mpesa_pochi' ? 'Pochi La Biashara' :
                                   payment.payment_method === 'mpesa' ? 'M-Pesa STK' :
                                   payment.payment_method === 'equity' ? 'Equity Bank' :
                                   payment.payment_method === 'credit' ? 'Credit' : 'Cash'}`, 14, 70);
    doc.text(`Amount: KSh ${payment.amount.toLocaleString()}`, 14, 80);
    
    if (payment.phone_number) {
      doc.text(`Phone: ${payment.phone_number}`, 14, 90);
    }
    
    // Add items if available
    if (payment.items && payment.items.length > 0) {
      doc.setFontSize(14);
      doc.text('Items Purchased:', 14, 110);
      
      const tableColumn = ["Item", "Quantity", "Price", "Total"];
      const tableRows = payment.items.map(item => [
        item.name,
        item.quantity,
        `KSh ${item.price.toLocaleString()}`,
        `KSh ${item.total.toLocaleString()}`
      ]);
      
      doc.autoTable(tableColumn, tableRows, { startY: 120 });
    }
    
    // Save the PDF
    doc.save(`receipt_${payment.receipt_number}.pdf`);
  };

  // Create a new sale record
  const createSaleRecord = async () => {
    if (transactionItems.length === 0) {
      alert('Please add items to the transaction.');
      return null;
    }

    try {
      const customer = selectedCustomerId 
        ? customers.find(c => c.id === selectedCustomerId) 
        : { name: 'Guest Customer' };
      
      const saleData = {
        customer_id: selectedCustomerId || null,
        items: transactionItems,
        total: calculateGrandTotal(),
        payment_method: paymentMethod,
        status: 'draft',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sales')
        .insert([saleData])
        .select();
      
      if (error) {
        console.error('Error creating sale record:', error);
        return null;
      }
      
      setCurrentSale(data[0]);
      setSaleStatus('draft');
      return data[0];
    } catch (error) {
      console.error('Error creating sale record:', error);
      return null;
    }
  };

  // Create a credit sale record
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
      
      if (error) {
        console.error('Error creating credit sale record:', error);
        return null;
      }
      
      // Add notification for credit sale
      const newNotification = {
        user_id: user.id,
        message: `New credit sale: KSh ${calculateGrandTotal().toLocaleString()} for ${customer.name}`,
        read: false,
        created_at: new Date()
      };
      
      await supabase
        .from('notifications')
        .insert([newNotification]);
      
      // Update notifications
      await fetchNotifications();
      
      return data[0];
    } catch (error) {
      console.error('Error creating credit sale record:', error);
      return null;
    }
  };

  // Update sale record status
  const updateSaleStatus = async (saleId, status, paymentDetails = {}) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({
          status,
          ...paymentDetails,
          updated_at: new Date().toISOString()
        })
        .eq('id', saleId);
      
      if (error) {
        console.error('Error updating sale status:', error);
        return false;
      }
      
      // Update local state
      setCurrentSale(prev => prev && prev.id === saleId ? { ...prev, status, ...paymentDetails } : prev);
      setSaleStatus(status);
      
      // Refresh sales data
      await fetchSales();
      return true;
    } catch (error) {
      console.error('Error updating sale status:', error);
      return false;
    }
  };

  // Generate receipt data
  const generateReceipt = (saleId, paymentDetails = {}) => {
    const sale = sales.find(s => s.id === saleId) || currentSale;
    
    if (!sale) return null;
    
    const receipt = {
      receipt_number: paymentDetails.receipt_number || `R${Date.now()}`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      customer: selectedCustomerId 
        ? customers.find(c => c.id === selectedCustomerId)?.name 
        : 'Guest Customer',
      items: transactionItems,
      subtotal: transactionItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      tax: 0,
      total: calculateGrandTotal(),
      payment_method: paymentMethod,
      payment_details: paymentDetails,
      cashier: user?.email || 'Cashier',
      store_info: {
        name: 'Your Butchery Name',
        address: 'Your Address',
        phone: 'Your Phone',
        email: 'your@email.com'
      }
    };
    
    setReceiptData(receipt);
    return receipt;
  };

  // Confirm payment and update sale status
  const confirmPayment = async (saleId, paymentDetails = {}) => {
    try {
      // Update sale status to paid
      const updated = await updateSaleStatus(saleId, 'paid', paymentDetails);
      
      if (updated) {
        // Generate receipt
        const receipt = generateReceipt(saleId, paymentDetails);
        
        // Add payment record
        await addPaymentRecord({
          payment_method: paymentMethod,
          amount: calculateGrandTotal(),
          receipt_number: paymentDetails.receipt_number || receipt.receipt_number,
          phone_number: mpesaPhoneNumber,
          customer_name: selectedCustomerId 
            ? customers.find(c => c.id === selectedCustomerId)?.name 
            : 'Guest Customer',
          status: 'completed',
          sale_id: saleId,
          items: transactionItems
        });
        
        // Show receipt
        setShowReceipt(true);
        
        // Refresh financial data
        await fetchFinancialSummary();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error confirming payment:', error);
      return false;
    }
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

  // Enhanced M-Pesa STK Push function with better error handling
  const initiateMpesaStkPush = async () => {
    if (!mpesaPhoneNumber) {
      alert('Please enter a phone number');
      return;
    }
    
    // Validate phone number format (should start with 2547xxxxxxxx)
    if (!mpesaPhoneNumber.match(/^2547\d{8}$/)) {
      alert('Please enter a valid phone number in the format 2547xxxxxxxx');
      return;
    }
    
    setMpesaProcessing(true);
    
    try {
      // Create sale record first
      const sale = await createSaleRecord();
      if (!sale) {
        throw new Error('Failed to create sale record');
      }
      
      // Update sale status to pending payment
      await updateSaleStatus(sale.id, 'pending_payment');
      
      // Simulate API call to M-Pesa STK Push
      // In a real implementation, this would be an actual API call
      const response = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: mpesaPhoneNumber,
          amount: calculateGrandTotal(),
          reference: `BUTCHERY-${Date.now()}`,
          description: 'Payment for butchery products'
        }),
      });
      
      // For demo purposes, simulate a successful response
      const result = {
        success: true,
        checkoutRequestID: `ws_CO_${Date.now()}${Math.floor(Math.random() * 1000)}`
      };
      
      if (result.success) {
        setMpesaTransactionId(result.checkoutRequestID);
        setMpesaStatus('pending');
        
        // Start polling for payment status
        startPollingMpesaStatus(result.checkoutRequestID, sale.id);
        
        // Add notification
        const newNotification = {
          user_id: user.id,
          message: `M-Pesa STK Push sent to ${mpesaPhoneNumber} for KSh ${calculateGrandTotal().toLocaleString()}`,
          read: false,
          created_at: new Date()
        };
        
        await supabase
          .from('notifications')
          .insert([newNotification]);
        
        // Update notifications
        await fetchNotifications();
      } else {
        throw new Error(result.error || 'Failed to initiate STK push');
      }
    } catch (error) {
      console.error('STK push error:', error);
      setMpesaStatus('failed');
      alert('Error initiating M-Pesa payment: ' + error.message);
    } finally {
      setMpesaProcessing(false);
    }
  };

  // M-Pesa Till Number function
  const processMpesaTillPayment = async () => {
    if (!mpesaTillNumber || !mpesaPhoneNumber) {
      alert('Please enter Till Number and phone number');
      return;
    }
    
    setTillProcessing(true);
    
    try {
      // Create sale record first
      const sale = await createSaleRecord();
      if (!sale) {
        throw new Error('Failed to create sale record');
      }
      
      // Update sale status to pending payment
      await updateSaleStatus(sale.id, 'pending_payment');
      
      // Simulate API call to M-Pesa Till
      // In a real implementation, this would be an actual API call
      const response = await fetch('/api/mpesa/till', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tillNumber: mpesaTillNumber,
          phoneNumber: mpesaPhoneNumber,
          amount: calculateGrandTotal(),
          reference: `BUTCHERY-${Date.now()}`
        }),
      });
      
      // For demo purposes, simulate a successful response
      const result = {
        success: true,
        transactionId: `TILL_${Date.now()}${Math.floor(Math.random() * 1000)}`
      };
      
      if (result.success) {
        setMpesaTransactionId(result.transactionId);
        setMpesaStatus('pending');
        
        // Add notification
        const newNotification = {
          user_id: user.id,
          message: `M-Pesa Till payment initiated for KSh ${calculateGrandTotal().toLocaleString()}`,
          read: false,
          created_at: new Date()
        };
        
        await supabase
          .from('notifications')
          .insert([newNotification]);
        
        // Update notifications
        await fetchNotifications();
        
        alert('Till Number payment initiated. Please confirm when payment is received.');
      } else {
        throw new Error(result.error || 'Failed to process Till Number payment');
      }
    } catch (error) {
      console.error('Till Number payment error:', error);
      setMpesaStatus('failed');
      alert('Error processing Till Number payment: ' + error.message);
    } finally {
      setTillProcessing(false);
    }
  };

  // M-Pesa Pochi La Biashara function
  const processMpesaPochiPayment = async () => {
    if (!mpesaPochiNumber || !mpesaPhoneNumber) {
      alert('Please enter Pochi number and phone number');
      return;
    }
    
    setPochiProcessing(true);
    
    try {
      // Create sale record first
      const sale = await createSaleRecord();
      if (!sale) {
        throw new Error('Failed to create sale record');
      }
      
      // Update sale status to pending payment
      await updateSaleStatus(sale.id, 'pending_payment');
      
      // Simulate API call to M-Pesa Pochi
      // In a real implementation, this would be an actual API call
      const response = await fetch('/api/mpesa/pochi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pochiNumber: mpesaPochiNumber,
          phoneNumber: mpesaPhoneNumber,
          amount: calculateGrandTotal(),
          reference: `BUTCHERY-${Date.now()}`
        }),
      });
      
      // For demo purposes, simulate a successful response
      const result = {
        success: true,
        transactionId: `POCHI_${Date.now()}${Math.floor(Math.random() * 1000)}`
      };
      
      if (result.success) {
        setMpesaTransactionId(result.transactionId);
        setMpesaStatus('pending');
        
        // Add notification
        const newNotification = {
          user_id: user.id,
          message: `M-Pesa Pochi payment initiated for KSh ${calculateGrandTotal().toLocaleString()}`,
          read: false,
          created_at: new Date()
        };
        
        await supabase
          .from('notifications')
          .insert([newNotification]);
        
        // Update notifications
        await fetchNotifications();
        
        alert('Pochi La Biashara payment initiated. Please confirm when payment is received.');
      } else {
        throw new Error(result.error || 'Failed to process Pochi payment');
      }
    } catch (error) {
      console.error('Pochi payment error:', error);
      setMpesaStatus('failed');
      alert('Error processing Pochi La Biashara payment: ' + error.message);
    } finally {
      setPochiProcessing(false);
    }
  };

  // Equity Bank payment function
  const processEquityPayment = async () => {
    if (!equityAccountNumber) {
      alert('Please enter account number');
      return;
    }
    
    setEquityProcessing(true);
    
    try {
      // Create sale record first
      const sale = await createSaleRecord();
      if (!sale) {
        throw new Error('Failed to create sale record');
      }
      
      // Update sale status to pending payment
      await updateSaleStatus(sale.id, 'pending_payment');
      
      // Simulate API call to Equity Bank
      // In a real implementation, this would be an actual API call
      const response = await fetch('/api/equity/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountNumber: equityAccountNumber,
          transactionRef: equityTransactionRef || `BUTCHERY-${Date.now()}`,
          amount: calculateGrandTotal()
        }),
      });
      
      // For demo purposes, simulate a successful response
      const result = {
        success: true,
        transactionId: `EQUITY_${Date.now()}${Math.floor(Math.random() * 1000)}`
      };
      
      if (result.success) {
        setMpesaTransactionId(result.transactionId);
        setMpesaStatus('pending');
        
        // Add notification
        const newNotification = {
          user_id: user.id,
          message: `Equity Bank payment initiated for KSh ${calculateGrandTotal().toLocaleString()}`,
          read: false,
          created_at: new Date()
        };
        
        await supabase
          .from('notifications')
          .insert([newNotification]);
        
        // Update notifications
        await fetchNotifications();
        
        alert('Equity Bank payment initiated. Please confirm when payment is received.');
      } else {
        throw new Error(result.error || 'Failed to process Equity Bank payment');
      }
    } catch (error) {
      console.error('Equity payment error:', error);
      setMpesaStatus('failed');
      alert('Error processing Equity Bank payment: ' + error.message);
    } finally {
      setEquityProcessing(false);
    }
  };

  // Polling function for M-Pesa status
  const startPollingMpesaStatus = (checkoutRequestID, saleId) => {
    const maxAttempts = 10;
    let attempts = 0;
    
    const poll = async () => {
      try {
        // Simulate API call to check M-Pesa status
        // In a real implementation, this would be an actual API call
        const response = await fetch(`/api/mpesa/status/${checkoutRequestID}`);
        
        // For demo purposes, simulate a successful payment after a few attempts
        let result;
        if (attempts < 3) {
          result = {
            success: true,
            data: {
              ResultCode: '1032', // Still pending
              ResultDesc: 'Transaction is being processed'
            }
          };
        } else {
          result = {
            success: true,
            data: {
              ResultCode: '0', // Success
              ResultDesc: 'The service request has been accepted successfully',
              CallbackMetadata: {
                Item: [
                  { Name: 'MpesaReceiptNumber', Value: `ODJ${Date.now()}${Math.floor(Math.random() * 1000)}` }
                ]
              }
            }
          };
        }
        
        if (result.success && result.data.ResultCode === '0') {
          // Payment successful
          const receiptNumber = result.data.CallbackMetadata.Item.find(
            item => item.Name === 'MpesaReceiptNumber'
          ).Value;
          
          setMpesaReceiptNumber(receiptNumber);
          handleMpesaConfirmation(saleId, receiptNumber);
        } else if (result.data.ResultCode && result.data.ResultCode !== '0') {
          // Payment failed
          setMpesaStatus('failed');
          clearInterval(pollingInterval);
        } else if (attempts < maxAttempts) {
          // Still pending, continue polling
          attempts++;
        } else {
          // Timeout
          setMpesaStatus('failed');
          clearInterval(pollingInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (attempts < maxAttempts) {
          attempts++;
        } else {
          setMpesaStatus('failed');
          clearInterval(pollingInterval);
        }
      }
    };
    
    // Start polling
    const intervalId = setInterval(poll, 5000); // Poll every 5 seconds
    setPollingInterval(intervalId);
  };

  // Handle M-Pesa confirmation
  const handleMpesaConfirmation = async (saleId, receiptNumber) => {
    try {
      // Now save the sale to Supabase
      const salesData = transactionItems.map(item => ({
        customer_id: selectedCustomerId || null,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        payment_method: paymentMethod,
        cost_price: item.cost_price,
        odoo_sale_order_id: odooSaleOrderId,
        mpesa_receipt_number: receiptNumber,
      }));

      const { error } = await supabase
        .from('sales')
        .insert(salesData);

      if (error) {
        throw new Error('Error saving sale: ' + error.message);
      }
      
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
      
      // Confirm payment in Odoo
      await fetch('/api/odoo/mpesa-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: mpesaTransactionId,
          receiptNumber
        }),
      });
      
      // Confirm payment and add to records
      await confirmPayment(saleId, {
        receipt_number: receiptNumber,
        transaction_id: mpesaTransactionId
      });
      
      setMpesaStatus('completed');
      alert('M-Pesa payment confirmed!');
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
      setMpesaTransactionId(null);
      setOdooSaleOrderId(null);
      setShowPaymentModal(false);
      
      // Clear polling interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    } catch (error) {
      console.error('M-Pesa confirmation error:', error);
      setMpesaStatus('failed');
      alert('Error confirming M-Pesa payment: ' + error.message);
    }
  };

  // Handle manual payment confirmation (for Till, Pochi, and Equity)
  const handleManualConfirmation = async () => {
    try {
      // Now save the sale to Supabase
      const salesData = transactionItems.map(item => ({
        customer_id: selectedCustomerId || null,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        payment_method: paymentMethod,
        cost_price: item.cost_price,
        odoo_sale_order_id: odooSaleOrderId,
        transaction_id: mpesaTransactionId,
      }));

      const { error } = await supabase
        .from('sales')
        .insert(salesData);

      if (error) {
        throw new Error('Error saving sale: ' + error.message);
      }
      
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
      
      // Confirm payment in Odoo
      await fetch('/api/odoo/payment-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: mpesaTransactionId,
          paymentMethod: paymentMethod
        }),
      });
      
      // Confirm payment and add to records
      await confirmPayment(currentSale.id, {
        receipt_number: `T${Date.now()}`,
        transaction_id: mpesaTransactionId
      });
      
      setMpesaStatus('completed');
      alert(`${paymentMethod === 'mpesa_till' ? 'Till Number' : paymentMethod === 'mpesa_pochi' ? 'Pochi La Biashara' : 'Equity Bank'} payment confirmed!`);
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
      setMpesaTillNumber('');
      setMpesaPochiNumber('');
      setEquityAccountNumber('');
      setEquityTransactionRef('');
      setMpesaTransactionId(null);
      setOdooSaleOrderId(null);
      setShowPaymentModal(false);
      
    } catch (error) {
      console.error('Payment confirmation error:', error);
      setMpesaStatus('failed');
      alert('Error confirming payment: ' + error.message);
    }
  };

  // Updated handleProcessPayment function
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
      
      // Create sale order in Odoo first
      const customer = selectedCustomerId 
        ? customers.find(c => c.id === selectedCustomerId) 
        : { name: 'Guest Customer' };
      
      const saleData = {
        customer,
        items: transactionItems,
        paymentMethod,
      };
      
      const odooResponse = await fetch('/api/odoo/sale-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ saleData }),
      });
      
      const odooResult = await odooResponse.json();
      
      if (!odooResult.success) {
        throw new Error(odooResult.error || 'Failed to create sale order in Odoo');
      }
      
      setOdooSaleOrderId(odooResult.saleOrderId);
      
      // Handle M-Pesa STK Push separately
      if (paymentMethod === 'mpesa') {
        // M-Pesa STK Push is handled by initiateMpesaStkPush
        return;
      }
      
      // Handle Till Number, Pochi, and Equity separately
      if (paymentMethod === 'mpesa_till') {
        await processMpesaTillPayment();
        return;
      }
      
      if (paymentMethod === 'mpesa_pochi') {
        await processMpesaPochiPayment();
        return;
      }
      
      if (paymentMethod === 'equity') {
        await processEquityPayment();
        return;
      }
      
      // For other payment methods, proceed with saving to Supabase
      const salesData = transactionItems.map(item => ({
        customer_id: selectedCustomerId || null,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        payment_method: paymentMethod,
        cost_price: item.cost_price,
        odoo_sale_order_id: odooResult.saleOrderId,
      }));

      const { error } = await supabase
        .from('sales')
        .insert(salesData);

      if (error) {
        throw new Error('Error processing payment: ' + error.message);
      }
      
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
      
      // Confirm payment and add to records
      await confirmPayment(odooResult.saleOrderId, {
        receipt_number: `R${Date.now()}`
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
      setShowPaymentModal(false);
      setOdooSaleOrderId(null);
      
    } catch (error) {
      console.error('Payment processing error:', error);
      alert('Error processing payment: ' + error.message);
      setMpesaStatus('failed');
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
              <p>Or create an account if you don't have one</p>
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
              <div className="relative">
                <button 
                  onClick={() => setShowLoginModal(!showLoginModal)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {showLoginModal && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
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
            icon={<FiCreditCard className="h-6 w-6" />}
          />
        </div>

        {/* Payment Statistics */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Payment Statistics</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreditManagement(!showCreditManagement)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                <FiCreditCard className="mr-1" />
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
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-blue-50 p-3 rounded text-center">
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-xl font-bold">{paymentStats.totalPayments}</p>
            </div>
            <div className="bg-green-50 p-3 rounded text-center">
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-xl font-bold">KSh {paymentStats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded text-center">
              <p className="text-sm text-gray-600">Cash</p>
              <p className="text-xl font-bold">{paymentStats.cashPayments}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded text-center">
              <p className="text-sm text-gray-600">M-Pesa</p>
              <p className="text-xl font-bold">{paymentStats.mpesaPayments}</p>
            </div>
            <div className="bg-indigo-50 p-3 rounded text-center">
              <p className="text-sm text-gray-600">Equity</p>
              <p className="text-xl font-bold">{paymentStats.equityPayments}</p>
            </div>
            <div className="bg-red-50 p-3 rounded text-center">
              <p className="text-sm text-gray-600">Credit</p>
              <p className="text-xl font-bold">{paymentStats.creditPayments}</p>
            </div>
          </div>
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
                          <button
                            onClick={() => exportPaymentToPDF({
                              ...creditSale,
                              receipt_number: `CR${creditSale.id}`,
                              payment_method: 'credit',
                              created_at: creditSale.created_at,
                              customer_name: creditSale.customers?.name,
                              items: creditSale.items
                            })}
                            className="text-green-600 hover:text-green-900"
                          >
                            PDF
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

        {/* Payment Records Section */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Payment Records</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowPaymentRecords(!showPaymentRecords)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
              >
                {showPaymentRecords ? 'Hide' : 'Show'} Records
              </button>
              <button
                onClick={fetchPaymentRecords}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
          
          {showPaymentRecords && (
            <>
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
                    <option value="till">Till Number Only</option>
                    <option value="pochi">Pochi La Biashara Only</option>
                    <option value="equity">Equity Bank Only</option>
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
                          Items
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
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
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {record.items && record.items.length > 0 ? (
                              <div className="max-h-20 overflow-y-auto">
                                {record.items.map((item, idx) => (
                                  <div key={idx}>{item.quantity}x {item.name}</div>
                                ))}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            KSh {record.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              record.payment_method === 'cash' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : record.payment_method === 'mpesa_till' 
                                  ? 'bg-green-100 text-green-800' 
                                  : record.payment_method === 'mpesa_pochi' 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : record.payment_method === 'equity' 
                                      ? 'bg-indigo-100 text-indigo-800' 
                                      : 'bg-red-100 text-red-800'
                            }`}>
                              {record.payment_method === 'cash' ? 'Cash' : 
                               record.payment_method === 'mpesa_till' ? 'Till Number' : 
                               record.payment_method === 'mpesa_pochi' ? 'Pochi La Biashara' : 
                               record.payment_method === 'equity' ? 'Equity Bank' : 'Credit'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.receipt_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedPayment(record);
                                setShowPaymentDetails(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-2"
                            >
                              View
                            </button>
                            <button
                              onClick={() => exportPaymentToPDF(record)}
                              className="text-green-600 hover:text-green-900"
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

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

        {/* Suppliers Section */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Suppliers</h2>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search suppliers..."
              value={supplierSearchTerm}
              onChange={(e) => setSupplierSearchTerm(e.target.value)}
              className="border p-2 rounded w-full mb-3 pl-10"
            />
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers
              .filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()))
              .map(supplier => (
                <div key={supplier.id} className="border p-3 rounded hover:bg-gray-50">
                  <h3 className="font-bold">{supplier.name}</h3>
                  <p className="text-gray-600">{supplier.phone}</p>
                  {supplier.contact_person && (
                    <p className="text-gray-600">Contact: {supplier.contact_person}</p>
                  )}
                </div>
              ))}
          </div>
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
                    setMpesaStatus(null);
                    setMpesaPhoneNumber('');
                    setMpesaTillNumber('');
                    setMpesaPochiNumber('');
                    setEquityAccountNumber('');
                    setEquityTransactionRef('');
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa (STK Push)</option>
                  <option value="mpesa_till">M-Pesa Till Number</option>
                  <option value="mpesa_pochi">M-Pesa Pochi La Biashara</option>
                  <option value="equity">Equity Bank</option>
                  <option value="card">Card Payment</option>
                  <option value="bank">Bank Transfer/Mobile Banking</option>
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
                  <p className="font-medium">M-Pesa STK Push</p>
                  
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
                  
                  {mpesaProcessing && (
                    <div className="mt-3 p-2 bg-blue-100 rounded">
                      <p>Processing M-Pesa payment...</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'pending' && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded">
                      <p>Payment initiated. Please check your phone and enter PIN.</p>
                      <p className="text-sm mt-1">Transaction ID: {mpesaTransactionId}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'completed' && (
                    <div className="mt-3 p-2 bg-green-100 rounded">
                      <p>Payment successful! Receipt Number: {mpesaReceiptNumber}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'failed' && (
                    <div className="mt-3 p-2 bg-red-100 rounded">
                      <p>Payment failed. Please try again.</p>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-700 mt-2">
                    This system is integrated with Safaricom Daraja API for secure M-Pesa payments.
                  </p>
                </div>
              )}

              {paymentMethod === 'mpesa_till' && (
                <div className="mb-4 bg-yellow-50 p-3 rounded">
                  <p className="font-medium">M-Pesa Till Number Payment</p>
                  
                  {/* Till Number Display */}
                  <div className="mt-3 p-4 bg-white rounded border-2 border-green-500 text-center">
                    <p className="text-sm text-gray-600">Customer should send money to:</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{mpesaTillNumber}</p>
                    <p className="text-sm text-gray-600 mt-2">Amount: KSh {calculateGrandTotal().toLocaleString()}</p>
                  </div>
                  
                  {/* Step-by-step Instructions */}
                  <div className="mt-4 bg-blue-50 p-3 rounded">
                    <p className="font-medium text-blue-800">Payment Instructions:</p>
                    <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
                      <li>Open M-Pesa menu on your phone</li>
                      <li>Select "Lipa na M-Pesa"</li>
                      <li>Select "Buy Goods and Services"</li>
                      <li>Enter Till Number: <span className="font-bold">{mpesaTillNumber}</span></li>
                      <li>Enter Amount: <span className="font-bold">KSh {calculateGrandTotal().toLocaleString()}</span></li>
                      <li>Enter your M-Pesa PIN and confirm</li>
                    </ol>
                  </div>
                  
                  {/* Phone Number Input */}
                  <div className="mt-3">
                    <label className="block mb-1">Customer Phone (for SMS confirmation):</label>
                    <input
                      type="text"
                      value={mpesaPhoneNumber}
                      onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="2547XXXXXXXX"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter to receive payment confirmation and faster processing
                    </p>
                  </div>
                  
                  {/* Status Messages */}
                  {tillProcessing && (
                    <div className="mt-3 p-2 bg-blue-100 rounded">
                      <p>Processing payment...</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'pending' && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded">
                      <p>Waiting for payment confirmation...</p>
                      <p className="text-sm mt-1">Transaction ID: {mpesaTransactionId}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'completed' && (
                    <div className="mt-3 p-2 bg-green-100 rounded">
                      <p>Payment successful! Receipt Number: {mpesaReceiptNumber}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'failed' && (
                    <div className="mt-3 p-2 bg-red-100 rounded">
                      <p>Payment failed or expired. Please try again.</p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => {
                        setMpesaStatus('pending');
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                      disabled={tillProcessing}
                    >
                      Start Payment Process
                    </button>
                    
                    <button
                      onClick={handleManualConfirmation}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                      disabled={tillProcessing || mpesaStatus === 'completed'}
                    >
                      Confirm Payment
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'mpesa_pochi' && (
                <div className="mb-4 bg-yellow-50 p-3 rounded">
                  <p className="font-medium">M-Pesa Pochi La Biashara</p>
                  
                  {/* Pochi Number Display */}
                  <div className="mt-3 p-4 bg-white rounded border-2 border-purple-500 text-center">
                    <p className="text-sm text-gray-600">Customer should send money to:</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{mpesaPochiNumber}</p>
                    <p className="text-sm text-gray-600 mt-2">Amount: KSh {calculateGrandTotal().toLocaleString()}</p>
                  </div>
                  
                  {/* Step-by-step Instructions */}
                  <div className="mt-4 bg-blue-50 p-3 rounded">
                    <p className="font-medium text-blue-800">Payment Instructions:</p>
                    <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
                      <li>Open M-Pesa menu on your phone</li>
                      <li>Select "Pochi La Biashara"</li>
                      <li>Select "Send Money"</li>
                      <li>Enter Pochi Number: <span className="font-bold">{mpesaPochiNumber}</span></li>
                      <li>Enter Amount: <span className="font-bold">KSh {calculateGrandTotal().toLocaleString()}</span></li>
                      <li>Enter your M-Pesa PIN and confirm</li>
                    </ol>
                  </div>
                  
                  {/* Phone Number Input */}
                  <div className="mt-3">
                    <label className="block mb-1">Customer Phone (for SMS confirmation):</label>
                    <input
                      type="text"
                      value={mpesaPhoneNumber}
                      onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="2547XXXXXXXX"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter to receive payment confirmation and faster processing
                    </p>
                  </div>
                  
                  {/* Status Messages */}
                  {pochiProcessing && (
                    <div className="mt-3 p-2 bg-blue-100 rounded">
                      <p>Processing payment...</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'pending' && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded">
                      <p>Waiting for payment confirmation...</p>
                      <p className="text-sm mt-1">Transaction ID: {mpesaTransactionId}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'completed' && (
                    <div className="mt-3 p-2 bg-green-100 rounded">
                      <p>Payment successful! Receipt Number: {mpesaReceiptNumber}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'failed' && (
                    <div className="mt-3 p-2 bg-red-100 rounded">
                      <p>Payment failed or expired. Please try again.</p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => {
                        setMpesaStatus('pending');
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                      disabled={pochiProcessing}
                    >
                      Start Payment Process
                    </button>
                    
                    <button
                      onClick={handleManualConfirmation}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                      disabled={pochiProcessing || mpesaStatus === 'completed'}
                    >
                      Confirm Payment
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'equity' && (
                <div className="mb-4 bg-purple-50 p-3 rounded">
                  <p className="font-medium">Equity Bank Payment</p>
                  
                  <div className="mt-3">
                    <label className="block mb-1">Account Number:</label>
                    <input
                      type="text"
                      value={equityAccountNumber}
                      onChange={(e) => setEquityAccountNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="Enter account number"
                    />
                  </div>
                  
                  <div className="mt-3">
                    <label className="block mb-1">Transaction Reference:</label>
                    <input
                      type="text"
                      value={equityTransactionRef}
                      onChange={(e) => setEquityTransactionRef(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="Enter transaction reference"
                    />
                  </div>
                  
                  {equityProcessing && (
                    <div className="mt-3 p-2 bg-blue-100 rounded">
                      <p>Processing Equity Bank payment...</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'pending' && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded">
                      <p>Equity Bank payment initiated. Please confirm when payment is received.</p>
                      <p className="text-sm mt-1">Transaction ID: {mpesaTransactionId}</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'completed' && (
                    <div className="mt-3 p-2 bg-green-100 rounded">
                      <p>Payment successful!</p>
                    </div>
                  )}
                  
                  {mpesaStatus === 'failed' && (
                    <div className="mt-3 p-2 bg-red-100 rounded">
                      <p>Payment failed. Please try again.</p>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-700 mt-2">
                    Enter customer's account number and transaction reference for payment verification.
                  </p>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="mb-4 bg-blue-50 p-3 rounded">
                  <p className="font-medium">Card Payment:</p>
                  <p className="text-sm">Prompt customer to swipe/tap card on reader.</p>
                  <p className="text-sm text-gray-700 mt-2">
                    Note: Requires integration with a physical card reader and payment gateway.
                  </p>
                </div>
              )}

              {paymentMethod === 'bank' && (
                <div className="mb-4 bg-purple-50 p-3 rounded">
                  <p className="font-medium">Bank Transfer / Mobile Banking:</p>
                  <p className="text-sm">Provide bank details or business mobile number for transfer.</p>
                  <p className="text-sm text-gray-700 mt-2">
                    Note: This is typically for larger or pre-arranged payments and may require manual confirmation.
                  </p>
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

              {/* Receipt Options */}
              <div className="mb-4">
                <label className="block mb-2 font-medium">Receipt Options:</label>
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" name="receiptOption" value="print" className="form-radio" defaultChecked />
                    <span className="ml-2">Print Receipt</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" name="receiptOption" value="email" className="form-radio" />
                    <span className="ml-2">Email/SMS</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" name="receiptOption" value="none" className="form-radio" />
                    <span className="ml-2">No Receipt</span>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Note: Actual print/email/SMS functionality requires further integration.
                </p>
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    // Reset M-Pesa states when closing modal
                    setMpesaStatus(null);
                    setMpesaPhoneNumber('');
                    setMpesaTillNumber('');
                    setMpesaPochiNumber('');
                    setEquityAccountNumber('');
                    setEquityTransactionRef('');
                    if (pollingInterval) {
                      clearInterval(pollingInterval);
                      setPollingInterval(null);
                    }
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                
                {/* Show confirmation button for payment methods that require manual confirmation */}
                {(paymentMethod === 'mpesa_till' || paymentMethod === 'mpesa_pochi' || paymentMethod === 'equity') && mpesaStatus === 'pending' && (
                  <button
                    onClick={handleManualConfirmation}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  >
                    Confirm Payment
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (paymentMethod === 'mpesa') {
                      initiateMpesaStkPush();
                    } else if (paymentMethod === 'mpesa_till') {
                      processMpesaTillPayment();
                    } else if (paymentMethod === 'mpesa_pochi') {
                      processMpesaPochiPayment();
                    } else if (paymentMethod === 'equity') {
                      processEquityPayment();
                    } else {
                      handleProcessPayment();
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  disabled={
                    (paymentMethod === 'cash' && cashReceived < calculateGrandTotal()) ||
                    (paymentMethod === 'credit' && !selectedCustomerId) ||
                    (paymentMethod === 'mpesa' && (!mpesaPhoneNumber || mpesaProcessing)) ||
                    (paymentMethod === 'mpesa_till' && (!mpesaPhoneNumber || tillProcessing)) ||
                    (paymentMethod === 'mpesa_pochi' && (!mpesaPhoneNumber || pochiProcessing)) ||
                    (paymentMethod === 'equity' && (!equityAccountNumber || equityProcessing)) ||
                    mpesaProcessing ||
                    tillProcessing ||
                    pochiProcessing ||
                    equityProcessing
                  }
                >
                  {paymentMethod === 'mpesa' ? 'Initiate M-Pesa STK Push' :
                   paymentMethod === 'mpesa_till' ? 'Process Till Number Payment' :
                   paymentMethod === 'mpesa_pochi' ? 'Process Pochi Payment' :
                   paymentMethod === 'equity' ? 'Process Equity Bank Payment' :
                   paymentMethod === 'credit' ? 'Record Credit Sale' :
                   'Confirm Payment'}
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

        {/* Payment Details Modal */}
        {showPaymentDetails && selectedPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Payment Details</h2>
                <button
                  onClick={() => setShowPaymentDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Receipt Number</p>
                  <p className="font-medium">{selectedPayment.receipt_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium">
                    {new Date(selectedPayment.created_at).toLocaleDateString()} {new Date(selectedPayment.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedPayment.customer_name || 'Guest Customer'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium">
                    {selectedPayment.payment_method === 'cash' ? 'Cash' : 
                     selectedPayment.payment_method === 'mpesa_till' ? 'Till Number' : 
                     selectedPayment.payment_method === 'mpesa_pochi' ? 'Pochi La Biashara' : 
                     selectedPayment.payment_method === 'equity' ? 'Equity Bank' : 'Credit'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">KSh {selectedPayment.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{selectedPayment.phone_number || '-'}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Items Purchased</p>
                <div className="border rounded p-3 max-h-40 overflow-y-auto">
                  {selectedPayment.items && selectedPayment.items.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedPayment.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm">{item.name}</td>
                            <td className="px-4 py-2 text-sm">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm">KSh {item.price.toLocaleString()}</td>
                            <td className="px-4 py-2 text-sm">KSh {item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500">No items recorded</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => exportPaymentToPDF(selectedPayment)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Export to PDF
                </button>
                <button
                  onClick={() => setShowPaymentDetails(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Modal */}
        {showReceipt && receiptData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Receipt</h2>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold">{receiptData.store_info.name}</h3>
                <p className="text-sm">{receiptData.store_info.address}</p>
                <p className="text-sm">{receiptData.store_info.phone}</p>
              </div>
              
              <div className="border-t border-b py-2 mb-4">
                <div className="flex justify-between mb-1">
                  <span>Receipt #:</span>
                  <span>{receiptData.receipt_number}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Date:</span>
                  <span>{receiptData.date}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Time:</span>
                  <span>{receiptData.time}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Cashier:</span>
                  <span>{receiptData.cashier}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="font-medium mb-2">Customer: {receiptData.customer}</p>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-sm">{item.name}</td>
                        <td className="text-sm">{item.quantity}</td>
                        <td className="text-sm">KSh {item.price.toLocaleString()}</td>
                        <td className="text-sm">KSh {item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex justify-between mb-1">
                  <span>Subtotal:</span>
                  <span>KSh {receiptData.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Tax:</span>
                  <span>KSh {receiptData.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>KSh {receiptData.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span>Payment Method:</span>
                  <span>
                    {receiptData.payment_method === 'cash' ? 'Cash' : 
                     receiptData.payment_method === 'mpesa_till' ? 'Till Number' : 
                     receiptData.payment_method === 'mpesa_pochi' ? 'Pochi La Biashara' : 
                     receiptData.payment_method === 'equity' ? 'Equity Bank' : 'Credit'}
                  </span>
                </div>
              </div>
              
              <div className="text-center mt-4 text-sm text-gray-500">
                <p>Thank you for your business!</p>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    // Print functionality would go here
                    alert('Print functionality would be implemented here');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
                >
                  <FiPrinter className="mr-1" />
                  Print
                </button>
                <button
                  onClick={() => {
                    const receipt = new jsPDF();
                    receipt.text('Receipt', 105, 15, { align: 'center' });
                    receipt.text(`Receipt #: ${receiptData.receipt_number}`, 14, 30);
                    receipt.text(`Date: ${receiptData.date}`, 14, 40);
                    receipt.text(`Time: ${receiptData.time}`, 14, 50);
                    receipt.text(`Customer: ${receiptData.customer}`, 14, 60);
                    receipt.text(`Total: KSh ${receiptData.total.toLocaleString()}`, 14, 70);
                    receipt.save(`receipt_${receiptData.receipt_number}.pdf`);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
                >
                  <FiDownload className="mr-1" />
                  Save PDF
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}