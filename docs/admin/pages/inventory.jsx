import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";
import Papa from 'papaparse';
import { Chart } from 'chart.js/auto';
import html2canvas from 'html2canvas';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Inventory = () => {
  // Original states (from your old code)
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const tableRef = useRef();

  // Payment Feature States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    exp: '',
    cvc: '',
    name: ''
  });

  // Fetch inventory (original logic)
  useEffect(() => {
    const fetchInventory = async () => {
      const { data, error } = await supabase.from('inventory').select('*');
      if (!error) setInventory(data);
      setLoading(false);
    };
    fetchInventory();
  }, []);

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Export CSV (original logic)
  const exportToCSV = () => {
    const csv = Papa.unparse(filteredInventory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'inventory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Screenshot (original logic)
  const takeScreenshot = () => {
    html2canvas(tableRef.current).then(canvas => {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = 'inventory.png';
      link.click();
    });
  };

  // -------- Payment Feature Logic -------- //
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    let updatedCart;
    if (existingItem) {
      updatedCart = cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updatedCart = [...cart, { ...product, quantity: 1 }];
    }
    setCart(updatedCart);
    calculateTotal(updatedCart);
  };

  const removeFromCart = (productId) => {
    const newCart = cart.filter(item => item.id !== productId);
    setCart(newCart);
    calculateTotal(newCart);
  };

  const updateCartQuantity = (productId, quantity) => {
    const newCart = cart.map(item =>
      item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
    );
    setCart(newCart);
    calculateTotal(newCart);
  };

  const calculateTotal = (cartItems) => {
    const total = cartItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
    setPaymentAmount(total);
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/[^0-9]/g, '');
    if (v.length >= 3) return `${v.slice(0, 2)}/${v.slice(2)}`;
    return value;
  };

  const recordTransaction = async (transactionId, method, amount) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        transaction_id: transactionId,
        payment_method: method,
        amount: amount,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.selling_price
        }))
      }])
      .select()
      .single();

    if (error) throw error;
    setTransactionHistory([data, ...transactionHistory]);
    return data;
  };

  const updateInventoryAfterSale = async () => {
    const updates = cart.map(item => ({
      id: item.id,
      quantity: item.quantity - item.quantity // subtract sold quantity
    }));

    const { error } = await supabase.from('inventory').upsert(updates);
    if (error) throw error;
  };

  const fetchTransactionHistory = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setTransactionHistory(data);
  };

  const initiatePayment = async () => {
    setPaymentError('');
    setProcessingPayment(true);

    try {
      if (paymentMethod === 'card') {
        const stripe = await stripePromise;

        const { data: paymentIntent, error } = await supabase
          .from('create_payment_intent')
          .insert([{
            amount: paymentAmount * 100,
            currency: 'kes',
            metadata: {
              products: JSON.stringify(cart.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.selling_price
              })))
            }
          }])
          .select()
          .single();

        if (error) throw error;

        const { error: stripeError } = await stripe.confirmCardPayment(paymentIntent.client_secret, {
          payment_method: {
            card: {
              number: cardDetails.number,
              exp_month: cardDetails.exp.split('/')[0],
              exp_year: cardDetails.exp.split('/')[1],
              cvc: cardDetails.cvc
            },
            billing_details: {
              name: cardDetails.name,
              email: customerEmail,
              phone: customerPhone
            }
          }
        });

        if (stripeError) throw stripeError;
        await recordTransaction(paymentIntent.id, 'card', paymentAmount);
      } else if (paymentMethod === 'cash') {
        await recordTransaction(`cash_${Date.now()}`, 'cash', paymentAmount);
      } else if (paymentMethod === 'mobile') {
        await recordTransaction(`mobile_${Date.now()}`, 'mobile', paymentAmount);
      }

      await updateInventoryAfterSale();
      setPaymentSuccess(true);
      setProcessingPayment(false);
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setProcessingPayment(false);
    }
  };

  // Render JSX
  return (
    <Layout>
      <div className="p-6">
        {/* Original UI like table, filters, CSV export, screenshot button, etc. */}
        <div className="mb-4 flex items-center justify-between">
          <input
            type="text"
            placeholder="Search Inventory"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-4 py-2 w-64"
          />
          <div className="space-x-2">
            <button onClick={exportToCSV} className="bg-blue-600 text-white px-4 py-2 rounded">Export CSV</button>
            <button onClick={takeScreenshot} className="bg-green-600 text-white px-4 py-2 rounded">Download Screenshot</button>
          </div>
        </div>

        <div ref={tableRef} className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4">Name</th>
                <th className="py-2 px-4">Quantity</th>
                <th className="py-2 px-4">Price</th>
                <th className="py-2 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="py-2 px-4">{item.name}</td>
                  <td className="py-2 px-4">{item.quantity}</td>
                  <td className="py-2 px-4">KSh {item.selling_price.toLocaleString()}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Add to Cart
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-gray-500">No inventory matches your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payment Modal and Transaction History UI */}
        {/* You already have this code, so just ensure it's placed after the inventory table in JSX */}

        {/* You can copy the modal JSX from your latest code where showPaymentModal and showTransactionHistory are conditionally rendered */}

      </div>
    </Layout>
  );
};

export default Inventory;
