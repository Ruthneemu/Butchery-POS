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
  // ... (previous state declarations remain the same)

  // Payment processing states
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
  const [cardDetails, setCardDetails] = useState({
    number: '',
    exp: '',
    cvc: '',
    name: ''
  });
  const [processingPayment, setProcessingPayment] = useState(false);

  // ... (previous useEffect and other functions remain the same until we add new ones)

  // Payment Processing Functions
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    calculateTotal([...cart, { ...product, quantity: 1 }]);
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

  const initiatePayment = async () => {
    setPaymentError('');
    setProcessingPayment(true);

    try {
      if (paymentMethod === 'card') {
        // Process card payment through Stripe
        const stripe = await stripePromise;
        
        // Create payment intent on your server
        const { data: paymentIntent, error } = await supabase
          .from('create_payment_intent')
          .insert([{
            amount: paymentAmount * 100, // in cents
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

        // Confirm card payment
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

        // Record successful transaction
        await recordTransaction(paymentIntent.id, 'card', paymentAmount);
      } else if (paymentMethod === 'cash') {
        // Process cash payment
        await recordTransaction(`cash_${Date.now()}`, 'cash', paymentAmount);
      } else if (paymentMethod === 'mobile') {
        // Process mobile money payment (simulated)
        await recordTransaction(`mobile_${Date.now()}`, 'mobile', paymentAmount);
      }

      // Update inventory quantities
      await updateInventoryAfterSale();
      
      setPaymentSuccess(true);
      setProcessingPayment(false);
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setProcessingPayment(false);
    }
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
      quantity: item.quantity - item.quantity
    }));

    const { error } = await supabase
      .from('inventory')
      .upsert(updates);

    if (error) throw error;
  };

  const fetchTransactionHistory = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error) {
      setTransactionHistory(data);
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    }
    return value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/[^0-9]/g, '');
    if (v.length >= 3) {
      return `${v.slice(0, 2)}/${v.slice(2)}`;
    }
    return value;
  };

  // ... (previous component code remains the same until we add the new UI elements)

  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen w-full">
        {/* ... (previous JSX remains the same) */}

        {/* Shopping Cart Button */}
        <div className="fixed bottom-6 right-6 z-10">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Process Payment</h2>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentSuccess(false);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {paymentSuccess ? (
                  <div className="text-center py-8">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Successful!</h3>
                    <p className="text-gray-500 mb-6">Transaction ID: {transactionHistory[0]?.transaction_id}</p>
                    <button
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentSuccess(false);
                        setCart([]);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Cart Items */}
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2">Order Summary</h3>
                      {cart.length === 0 ? (
                        <p className="text-gray-500">Your cart is empty</p>
                      ) : (
                        <div className="space-y-3">
                          {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center border-b pb-2">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">{item.quantity} × KSh {item.selling_price?.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value))}
                                  className="w-16 border rounded px-2 py-1 mr-2"
                                />
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Payment Total */}
                    <div className="bg-gray-50 p-4 rounded mb-6">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>KSh {paymentAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2">Customer Information</h3>
                      <div className="space-y-3">
                        <input
                          type="email"
                          placeholder="Email (optional)"
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                        />
                        <input
                          type="tel"
                          placeholder="Phone Number (optional)"
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2">Payment Method</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setPaymentMethod('card')}
                          className={`p-2 border rounded flex flex-col items-center ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <span className="text-xs">Card</span>
                        </button>
                        <button
                          onClick={() => setPaymentMethod('cash')}
                          className={`p-2 border rounded flex flex-col items-center ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="text-xs">Cash</span>
                        </button>
                        <button
                          onClick={() => setPaymentMethod('mobile')}
                          className={`p-2 border rounded flex flex-col items-center ${paymentMethod === 'mobile' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs">Mobile</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Payment Form (shown only when card is selected) */}
                    {paymentMethod === 'card' && (
                      <div className="mb-6">
                        <h3 className="font-semibold mb-2">Card Details</h3>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Card Number"
                            className="w-full border border-gray-300 rounded px-3 py-2"
                            value={cardDetails.number}
                            onChange={(e) => setCardDetails({...cardDetails, number: formatCardNumber(e.target.value)})}
                            maxLength="19"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="MM/YY"
                              className="w-full border border-gray-300 rounded px-3 py-2"
                              value={cardDetails.exp}
                              onChange={(e) => setCardDetails({...cardDetails, exp: formatExpiry(e.target.value)})}
                              maxLength="5"
                            />
                            <input
                              type="text"
                              placeholder="CVC"
                              className="w-full border border-gray-300 rounded px-3 py-2"
                              value={cardDetails.cvc}
                              onChange={(e) => setCardDetails({...cardDetails, cvc: e.target.value.replace(/[^0-9]/g, '')})}
                              maxLength="4"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Name on Card"
                            className="w-full border border-gray-300 rounded px-3 py-2"
                            value={cardDetails.name}
                            onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    {/* Mobile Money Payment Form (shown only when mobile is selected) */}
                    {paymentMethod === 'mobile' && (
                      <div className="mb-6">
                        <h3 className="font-semibold mb-2">Mobile Money Details</h3>
                        <div className="space-y-3">
                          <select className="w-full border border-gray-300 rounded px-3 py-2">
                            <option>Select Network</option>
                            <option>M-Pesa</option>
                            <option>Airtel Money</option>
                            <option>T-Kash</option>
                          </select>
                          <input
                            type="tel"
                            placeholder="Phone Number"
                            className="w-full border border-gray-300 rounded px-3 py-2"
                          />
                        </div>
                      </div>
                    )}

                    {/* Payment Error */}
                    {paymentError && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-red-700">{paymentError}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Button */}
                    <button
                      onClick={initiatePayment}
                      disabled={cart.length === 0 || processingPayment}
                      className={`w-full py-3 px-4 rounded font-bold ${cart.length === 0 || processingPayment ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    >
                      {processingPayment ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        `Pay KSh ${paymentAmount.toLocaleString()}`
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* View Transactions Button */}
        <div className="fixed bottom-6 left-6 z-10">
          <button
            onClick={() => {
              fetchTransactionHistory();
              setShowTransactionHistory(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        </div>

        {/* Transactions History Modal */}
        {showTransactionHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Transaction History</h2>
                  <button
                    onClick={() => setShowTransactionHistory(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {transactionHistory.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">No transactions found</p>
                ) : (
                  <div className="space-y-4">
                    {transactionHistory.map((transaction) => (
                      <div key={transaction.id} className="border-b pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">Transaction #{transaction.transaction_id}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(transaction.created_at).toLocaleString()}
                            </p>
                            <p className="text-sm">
                              Method: <span className="capitalize">{transaction.payment_method}</span>
                            </p>
                            {transaction.customer_email && (
                              <p className="text-sm">Email: {transaction.customer_email}</p>
                            )}
                            {transaction.customer_phone && (
                              <p className="text-sm">Phone: {transaction.customer_phone}</p>
                            )}
                          </div>
                          <p className="font-bold">KSh {transaction.amount.toLocaleString()}</p>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-sm font-semibold">Items:</h4>
                          <ul className="list-disc list-inside text-sm text-gray-600">
                            {transaction.items.map((item, idx) => (
                              <li key={idx}>
                                {item.quantity} × {item.name} @ KSh {item.price.toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ... (rest of your existing JSX remains the same) */}
      </div>
    </Layout>
  );
};

export default Payment;