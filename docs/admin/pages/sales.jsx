import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";

const Sales = () => {
    // Tab state
    const [activeTab, setActiveTab] = useState('newOrder'); // 'newOrder', 'transactions', 'orderManagement'
    
    // State for order details
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [orderType, setOrderType] = useState('pickup');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [orderNotes, setOrderNotes] = useState('');

    // Payment processing state
    const [amountPaid, setAmountPaid] = useState('');
    const [change, setChange] = useState(0);

    // State for managing order items
    const [inventory, setInventory] = useState([]);
    const [currentOrderItem, setCurrentOrderItem] = useState('');
    const [currentOrderWeight, setCurrentOrderWeight] = useState(0.01);
    const [orderItems, setOrderItems] = useState([]);
    
<<<<<<< HEAD
    // NEW: Selling method state (by weight or by amount)
    const [sellingMethod, setSellingMethod] = useState('weight'); // 'weight' or 'amount'
    const [targetAmount, setTargetAmount] = useState('');
    const [calculatedWeight, setCalculatedWeight] = useState(0);
    
=======
>>>>>>> refs/remotes/origin/main
    // Weighing scale integration
    const [scaleConnected, setScaleConnected] = useState(false);
    const [scaleReading, setScaleReading] = useState(0);
    const [useScale, setUseScale] = useState(false);
    const [scalePort, setScalePort] = useState(null);

    // New states for tabs
    const [transactions, setTransactions] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch inventory items
                const { data: inventoryData, error: inventoryError } = await supabase
                    .from('inventory')
                    .select('*');

                if (inventoryError) {
                    throw inventoryError;
                }

                // Ensure quantity and selling_price are numbers when setting inventory state
                const parsedInventory = (inventoryData || []).map(item => ({
                    ...item,
                    quantity: parseFloat(item.quantity || 0),
                    selling_price: parseFloat(item.selling_price || 0),
                    price_per_kg: parseFloat(item.price_per_kg || item.selling_price || 0),
                }));
                setInventory(parsedInventory);

                // Fetch business settings
                const { data: settingsData, error: settingsError } = await supabase
                    .from('business_settings')
                    .select('*')
                    .limit(1);

                if (settingsError) {
                    throw settingsError;
                }
                console.log("Business Settings:", settingsData);

                // Try to connect to weighing scale if available
                tryConnectToScale();

            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load data: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

<<<<<<< HEAD
    // NEW: Calculate weight when target amount changes
    useEffect(() => {
        if (sellingMethod === 'amount' && targetAmount && currentOrderItem) {
            const selectedItem = inventory.find(item => item.id === parseInt(currentOrderItem));
            if (selectedItem) {
                const pricePerKg = parseFloat(selectedItem.price_per_kg || selectedItem.selling_price || 0);
                if (pricePerKg > 0) {
                    const weight = parseFloat(targetAmount) / pricePerKg;
                    setCalculatedWeight(weight);
                    setCurrentOrderWeight(weight);
                }
            }
        }
    }, [targetAmount, currentOrderItem, sellingMethod, inventory]);

    // NEW: Update target amount when scale reading changes (for amount-based selling)
    useEffect(() => {
        if (sellingMethod === 'amount' && useScale && currentOrderItem && scaleReading > 0) {
            const selectedItem = inventory.find(item => item.id === parseInt(currentOrderItem));
            if (selectedItem) {
                const pricePerKg = parseFloat(selectedItem.price_per_kg || selectedItem.selling_price || 0);
                const currentValue = scaleReading * pricePerKg;
                setTargetAmount(currentValue.toFixed(2));
                setCurrentOrderWeight(scaleReading);
            }
        }
    }, [scaleReading, sellingMethod, useScale, currentOrderItem, inventory]);

=======
>>>>>>> refs/remotes/origin/main
    // Function to simulate connecting to a weighing scale
    const tryConnectToScale = () => {
        if ('serial' in navigator) {
            console.log("Web Serial API supported");
            setScaleConnected(true);
            
            // Simulate scale readings
            const interval = setInterval(() => {
                if (useScale) {
                    const randomWeight = (Math.random() * 4.9 + 0.1).toFixed(2);
                    setScaleReading(parseFloat(randomWeight));
<<<<<<< HEAD
                    if (sellingMethod === 'weight') {
                        setCurrentOrderWeight(parseFloat(randomWeight));
                    }
=======
                    setCurrentOrderWeight(parseFloat(randomWeight));
>>>>>>> refs/remotes/origin/main
                }
            }, 2000);
            
            return () => clearInterval(interval);
        } else {
            console.log("Web Serial API not supported");
            setScaleConnected(false);
        }
    };

    // Function to connect to scale via Web Serial API
    const connectToScale = async () => {
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            setScalePort(port);
            setScaleConnected(true);
            
            const reader = port.readable.getReader();
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const textDecoder = new TextDecoder();
                const scaleData = textDecoder.decode(value);
                
                const weightMatch = scaleData.match(/(\d+\.\d+)/);
                if (weightMatch) {
                    const weight = parseFloat(weightMatch[1]);
                    setScaleReading(weight);
                    if (useScale) {
<<<<<<< HEAD
                        if (sellingMethod === 'weight') {
                            setCurrentOrderWeight(weight);
                        }
                        // For amount-based selling, the useEffect will handle the calculation
=======
                        setCurrentOrderWeight(weight);
>>>>>>> refs/remotes/origin/main
                    }
                }
            }
        } catch (error) {
            console.error("Error connecting to scale:", error);
            setScaleConnected(false);
        }
    };

    // Fetch transactions (completed sales)
    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        inventory (name)
                    )
                `)
                .in('status', ['confirmed', 'completed'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLoadingTransactions(false);
        }
    };

    // Fetch orders for management
    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        inventory (name)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoadingOrders(false);
        }
    };

    // Update order status
    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            
            // Refresh orders list
            fetchOrders();
            alert(`Order status updated to ${newStatus}`);
        } catch (err) {
            console.error('Error updating order status:', err);
            alert('Failed to update order status');
        }
    };

    // Load data when tabs are switched
    useEffect(() => {
        if (activeTab === 'transactions') {
            fetchTransactions();
        } else if (activeTab === 'orderManagement') {
            fetchOrders();
        }
    }, [activeTab]);

    const addItemToOrder = () => {
        if (!currentOrderItem || currentOrderWeight <= 0 || isNaN(currentOrderWeight)) {
            alert('Please select an item and enter a valid weight greater than zero.');
            return;
        }

        const selectedInventoryItem = inventory.find(item => item.id === parseInt(currentOrderItem));

        if (!selectedInventoryItem) {
            alert('Selected item not found in inventory.');
            return;
        }

        if (selectedInventoryItem.quantity < currentOrderWeight) {
            alert(`Not enough stock for ${selectedInventoryItem.name}. Available: ${selectedInventoryItem.quantity.toFixed(2)} kg`);
            return;
        }

        const pricePerKg = parseFloat(selectedInventoryItem.price_per_kg || selectedInventoryItem.selling_price || 0);
        const totalPrice = pricePerKg * currentOrderWeight;

        const newItem = {
            id: selectedInventoryItem.id,
            name: selectedInventoryItem.name,
            price_per_kg: pricePerKg,
            weight: parseFloat(currentOrderWeight),
            total_price: totalPrice,
<<<<<<< HEAD
            unit: 'kg',
            selling_method: sellingMethod // Track how this item was sold
=======
            unit: 'kg'
>>>>>>> refs/remotes/origin/main
        };

        setOrderItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(item => item.id === newItem.id);

            if (existingItemIndex > -1) {
                const updatedItems = [...prevItems];
                const updatedWeight = updatedItems[existingItemIndex].weight + newItem.weight;

                if (selectedInventoryItem.quantity < updatedWeight) {
                    alert(`Adding this weight would exceed available stock for ${selectedInventoryItem.name}.`);
                    return prevItems;
                }

                updatedItems[existingItemIndex].weight = updatedWeight;
                updatedItems[existingItemIndex].total_price = pricePerKg * updatedWeight;
                return updatedItems;
            } else {
                return [...prevItems, newItem];
            }
        });

<<<<<<< HEAD
        // Reset form
        setCurrentOrderItem('');
        setCurrentOrderWeight(0.01);
        setTargetAmount('');
        setCalculatedWeight(0);
        setSellingMethod('weight');
=======
        setCurrentOrderItem('');
        setCurrentOrderWeight(0.01);
>>>>>>> refs/remotes/origin/main
    };

    const removeItemFromOrder = (indexToRemove) => {
        setOrderItems(prevItems => prevItems.filter((_, index) => index !== indexToRemove));
    };

    // Calculate order total
    const orderTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

    // Handle amount paid input
    const handleAmountPaidChange = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setAmountPaid(value);
            if (value) {
                const paid = parseFloat(value) || 0;
                setChange(paid - orderTotal);
            } else {
                setChange(0);
            }
        }
    };

    // Check if payment is sufficient
    const isPaymentSufficient = amountPaid && parseFloat(amountPaid) >= orderTotal;
    const paymentStatus = !amountPaid ? 'pending' : 
                         isPaymentSufficient ? 'paid' : 'partial';

    const placeOrder = async () => {
        if (orderItems.length === 0) {
            alert('Cannot place an empty order.');
            return;
        }
        if (!customerName.trim()) {
            alert('Customer Name is required to place an order.');
            return;
        }
        if (!amountPaid) {
            alert('Please enter the amount paid by the customer.');
            return;
        }
        if (parseFloat(amountPaid) < orderTotal) {
            alert('Insufficient payment. Please enter the full amount or more.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // 1. Insert the new order into the 'orders' table
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    customer_name: customerName,
                    customer_contact: customerContact,
                    order_type: orderType,
                    payment_method: paymentMethod,
                    order_notes: orderNotes,
                    total_amount: orderTotal,
                    amount_paid: parseFloat(amountPaid),
                    change: parseFloat(change.toFixed(2)),
                    payment_status: paymentStatus,
                    status: 'confirmed',
                }])
                .select();

            if (orderError) {
                throw orderError;
            }

            const newOrderId = orderData[0].id;

            // 2. Prepare order_items for bulk insert
            const orderItemsToInsert = orderItems.map(item => ({
                order_id: newOrderId,
                item_id: item.id,
                quantity: item.weight,
                price_at_order: item.price_per_kg,
            }));

            const { error: orderItemsError } = await supabase
                .from('order_items')
                .insert(orderItemsToInsert);

            if (orderItemsError) {
                throw orderItemsError;
            }

            // 3. Update inventory quantities
            const updates = orderItems.map(async (orderItem) => {
                const currentStock = inventory.find(inv => inv.id === orderItem.id)?.quantity;
                const safeCurrentStock = parseFloat(currentStock || 0);
                const newStock = safeCurrentStock - orderItem.weight;

                const { error: updateError } = await supabase
                    .from('inventory')
                    .update({ quantity: newStock })
                    .eq('id', orderItem.id);

                if (updateError) {
                    console.error(`Failed to update stock for item ${orderItem.name}:`, updateError);
                }
            });

            await Promise.all(updates);

            const successMessage = `Order placed successfully!\nTotal: KSh ${orderTotal.toFixed(2)}\nPaid: KSh ${parseFloat(amountPaid).toFixed(2)}\nChange: KSh ${change.toFixed(2)}`;
            alert(successMessage);
            setShowSuccessMessage(true);
            
            // Reset form
            setCustomerName('');
            setCustomerContact('');
            setOrderType('pickup');
            setPaymentMethod('cash');
            setOrderNotes('');
            setAmountPaid('');
            setChange(0);
            setCurrentOrderItem('');
            setCurrentOrderWeight(0.01);
            setOrderItems([]);
<<<<<<< HEAD
            setTargetAmount('');
            setCalculatedWeight(0);
            setSellingMethod('weight');
=======
>>>>>>> refs/remotes/origin/main

            // Re-fetch inventory
            const { data: updatedInventoryData, error: updatedInventoryError } = await supabase
                .from('inventory')
                .select('*');

            if (updatedInventoryError) {
                console.error("Failed to re-fetch inventory:", updatedInventoryError);
            } else {
                const parsedUpdatedInventory = (updatedInventoryData || []).map(item => ({
                    ...item,
                    quantity: parseFloat(item.quantity || 0),
                    selling_price: parseFloat(item.selling_price || 0),
                    price_per_kg: parseFloat(item.price_per_kg || item.selling_price || 0),
                }));
                setInventory(parsedUpdatedInventory);
            }

            setTimeout(() => setShowSuccessMessage(false), 3000);

        } catch (err) {
            console.error("Error placing order:", err);
            setError("Failed to place order: " + err.message);
            alert("Failed to place order. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Function to capture weight from scale
    const captureWeightFromScale = () => {
        if (scaleConnected) {
            setUseScale(true);
<<<<<<< HEAD
            if (sellingMethod === 'weight') {
                setCurrentOrderWeight(scaleReading);
            }
            // For amount-based selling, the weight will be captured automatically via useEffect
=======
            setCurrentOrderWeight(scaleReading);
>>>>>>> refs/remotes/origin/main
        } else {
            alert('Weighing scale is not connected. Please enter weight manually.');
        }
    };

    return (
        <Layout>
            <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Sales Management</h1>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'newOrder' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('newOrder')}
                    >
                        New Sales Order
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'transactions' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('transactions')}
                    >
                        Sales Transactions
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'orderManagement' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('orderManagement')}
                    >
                        Order Management
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'newOrder' && (
                    <div>
                        {/* Scale Status */}
                        <div className="mb-6 bg-white p-4 rounded-lg shadow">
                            <div className="flex flex-wrap items-center justify-between">
                                <div className="flex items-center">
                                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${scaleConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="font-medium">
                                        Weighing Scale: {scaleConnected ? 'Connected' : 'Not Connected'}
                                    </span>
                                    {scaleConnected && (
                                        <span className="ml-4 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                            Current Reading: {scaleReading.toFixed(2)} kg
                                        </span>
                                    )}
                                </div>
                                <div className="flex space-x-2 mt-2 sm:mt-0">
                                    {!scaleConnected && (
                                        <button
                                            onClick={connectToScale}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                                        >
                                            Connect Scale
                                        </button>
                                    )}
                                    {scaleConnected && (
                                        <button
                                            onClick={captureWeightFromScale}
                                            className={`px-4 py-2 rounded text-sm ${useScale ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                                        >
                                            Use Scale Reading
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {loading && (
                            <div className="text-center text-indigo-600 text-lg">Loading inventory and settings...</div>
                        )}

                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                                <strong className="font-bold">Error!</strong>
                                <span className="block sm:inline"> {error}</span>
                            </div>
                        )}

                        {showSuccessMessage && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                                <strong className="font-bold">Success!</strong>
                                <span className="block sm:inline"> Order placed successfully! 🎉</span>
                            </div>
                        )}

                        {!loading && !error && (
                            <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Customer & Order Details */}
                                <div className="space-y-5 p-4 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-xl font-medium text-gray-700 border-b pb-2 mb-4">Customer & Order Details</h3>
                                    <div>
                                        <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                                        <input
                                            type="text"
                                            id="customerName"
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="e.g., Jane Doe"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="customerContact" className="block text-sm font-medium text-gray-700 mb-1">Customer Contact</label>
                                        <input
                                            type="text"
                                            id="customerContact"
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                            value={customerContact}
                                            onChange={(e) => setCustomerContact(e.target.value)}
                                            placeholder="e.g., +2547XXXXXXXX"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="orderType" className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                                        <select
                                            id="orderType"
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                            value={orderType}
                                            onChange={(e) => setOrderType(e.target.value)}
                                        >
                                            <option value="pickup">Pickup 🚶</option>
                                            <option value="delivery">Delivery 🚚</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                        <select
                                            id="paymentMethod"
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        >
                                            <option value="cash">Cash 💵</option>
                                            <option value="mpesa">M-Pesa 📱</option>
                                            <option value="card">Card 💳</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                        <textarea
                                            id="orderNotes"
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                            rows="3"
                                            value={orderNotes}
                                            onChange={(e) => setOrderNotes(e.target.value)}
                                            placeholder="Any special instructions or preferences..."
                                        />
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="space-y-5 p-4 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-xl font-medium text-gray-700 border-b pb-2 mb-4">Order Items</h3>

<<<<<<< HEAD
                                    {/* Selling Method Selection */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Selling Method</label>
                                        <div className="flex space-x-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="sellingMethod"
                                                    value="weight"
                                                    checked={sellingMethod === 'weight'}
                                                    onChange={(e) => setSellingMethod(e.target.value)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">By Weight (kg)</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="sellingMethod"
                                                    value="amount"
                                                    checked={sellingMethod === 'amount'}
                                                    onChange={(e) => setSellingMethod(e.target.value)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">By Amount (KSh)</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
=======
                                    <div className="flex flex-col sm:flex-row gap-3 items-end">
>>>>>>> refs/remotes/origin/main
                                        <div className="flex-grow">
                                            <label htmlFor="currentOrderItem" className="block text-sm font-medium text-gray-700 mb-1">Select Meat Product</label>
                                            <select
                                                id="currentOrderItem"
                                                className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                value={currentOrderItem}
                                                onChange={(e) => setCurrentOrderItem(e.target.value)}
                                            >
                                                <option value="">Choose a Meat Product</option>
                                                {inventory.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name} - KSh {parseFloat(item.price_per_kg || item.selling_price || 0).toFixed(2)}/kg (Stock: {item.quantity.toFixed(2)} kg)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
<<<<<<< HEAD

                                        {/* Dynamic input based on selling method */}
                                        {sellingMethod === 'weight' ? (
                                            <div className="flex gap-3 items-end">
                                                <div className="w-28">
                                                    <label htmlFor="currentOrderWeight" className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                                                    <input
                                                        id="currentOrderWeight"
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                        value={currentOrderWeight}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setCurrentOrderWeight(isNaN(val) ? 0.01 : val);
                                                            setUseScale(false);
                                                        }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={addItemToOrder}
                                                    className="bg-indigo-600 text-white px-5 py-3 rounded-md hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0"
                                                >
                                                    Add Item
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3 items-end">
                                                <div className="w-28">
                                                    <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount (KSh)</label>
                                                    <input
                                                        id="targetAmount"
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                        value={targetAmount}
                                                        onChange={(e) => setTargetAmount(e.target.value)}
                                                        placeholder="e.g., 300"
                                                    />
                                                </div>
                                                <div className="w-32">
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-3 border border-gray-300 rounded-md bg-gray-100"
                                                        value={calculatedWeight.toFixed(3)}
                                                        readOnly
                                                    />
                                                </div>
                                                <button
                                                    onClick={addItemToOrder}
                                                    className="bg-indigo-600 text-white px-5 py-3 rounded-md hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0"
                                                >
                                                    Add Item
                                                </button>
                                            </div>
                                        )}

                                        {/* Amount-based selling helper */}
                                        {sellingMethod === 'amount' && currentOrderItem && targetAmount && (
                                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                                <div className="text-sm text-yellow-800">
                                                    <strong>Target:</strong> KSh {targetAmount} worth of meat<br/>
                                                    <strong>Required Weight:</strong> {calculatedWeight.toFixed(3)} kg<br/>
                                                    {scaleConnected && useScale && (
                                                        <>
                                                            <strong>Current Scale Reading:</strong> {scaleReading.toFixed(3)} kg<br/>
                                                            <strong>Current Value:</strong> KSh {(scaleReading * (inventory.find(item => item.id === parseInt(currentOrderItem))?.price_per_kg || 0)).toFixed(2)}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
=======
                                        <div className="w-28">
                                            <label htmlFor="currentOrderWeight" className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                                            <input
                                                id="currentOrderWeight"
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                value={currentOrderWeight}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    setCurrentOrderWeight(isNaN(val) ? 0.01 : val);
                                                    setUseScale(false);
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={addItemToOrder}
                                            className="bg-indigo-600 text-white px-5 py-3 rounded-md hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0"
                                        >
                                            Add Item
                                        </button>
>>>>>>> refs/remotes/origin/main
                                    </div>

                                    {/* Items List */}
                                    <div className="border border-gray-300 rounded-lg divide-y divide-gray-200 min-h-[150px] max-h-[300px] overflow-y-auto">
                                        {orderItems.length === 0 ? (
                                            <div className="p-6 text-center text-gray-500">No items added to this order yet.</div>
                                        ) : (
                                            orderItems.map((item, index) => (
                                                <div key={index} className="p-4 flex justify-between items-center bg-white hover:bg-gray-50">
                                                    <div>
<<<<<<< HEAD
                                                        <div className="font-medium text-gray-900">
                                                            {item.name}
                                                            {item.selling_method === 'amount' && (
                                                                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                                    By Amount
                                                                </span>
                                                            )}
                                                        </div>
=======
                                                        <div className="font-medium text-gray-900">{item.name}</div>
>>>>>>> refs/remotes/origin/main
                                                        <div className="text-sm text-gray-600">
                                                            {item.weight.toFixed(2)} kg × KSh {item.price_per_kg.toFixed(2)}/kg = <span className="font-semibold">KSh {item.total_price.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItemFromOrder(index)}
                                                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                                                        aria-label={`Remove ${item.name}`}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Payment Section */}
                                    <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                                        <h3 className="text-lg font-medium text-gray-800 mb-4">Payment Details</h3>
                                        
                                        <div className="space-y-4">
                                            <div className="flex justify-between">
                                                <span className="font-medium">Order Total:</span>
                                                <span className="font-bold text-lg">KSh {orderTotal.toFixed(2)}</span>
                                            </div>
                                            
                                            <div>
                                                <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                                                <input
                                                    type="text"
                                                    id="amountPaid"
                                                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                    value={amountPaid}
                                                    onChange={handleAmountPaidChange}
                                                    placeholder="Enter amount paid by customer"
                                                />
                                            </div>
                                            
                                            {amountPaid && (
                                                <div className="flex justify-between">
                                                    <span className="font-medium">Change:</span>
                                                    <span className={`font-bold text-lg ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        KSh {Math.abs(change).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center">
                                                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                                                    !amountPaid ? 'bg-gray-400' : 
                                                    isPaymentSufficient ? 'bg-green-500' : 'bg-red-500'
                                                }`}></span>
                                                <span className="text-sm font-medium">
                                                    {!amountPaid ? 'Payment pending' : 
                                                     isPaymentSufficient ? 'Payment sufficient' : 'Insufficient payment'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Summary */}
                                    <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                                        <button
                                            onClick={placeOrder}
                                            disabled={orderItems.length === 0 || !customerName.trim() || !amountPaid || !isPaymentSufficient || loading}
                                            className={`w-full py-3 rounded-md text-white font-semibold text-lg transition-colors duration-200 ${
                                                orderItems.length === 0 || !customerName.trim() || !amountPaid || !isPaymentSufficient || loading
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : 'bg-red-600 hover:bg-red-700'
                                            }`}
                                        >
<<<<<<< HEAD
                                            {loading ? 'Processing Order...' : 'Place Order'}
=======
                                            {loading ? 'Processing Order...' : 'Place Order 🚀'}
>>>>>>> refs/remotes/origin/main
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800">Sales Transactions</h2>
                            <p className="text-sm text-gray-600">View all completed sales transactions</p>
                        </div>
                        
                        <div className="overflow-x-auto">
                            {loadingTransactions ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                                    <p className="mt-2 text-gray-600">Loading transactions...</p>
                                </div>
                            ) : transactions.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No transactions found
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {transactions.map((transaction) => (
                                            <tr key={transaction.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    #{transaction.id}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {transaction.customer_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(transaction.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {transaction.order_items?.length || 0} items
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    KSh {transaction.total_amount?.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        transaction.payment_method === 'cash' ? 'bg-green-100 text-green-800' :
                                                        transaction.payment_method === 'mpesa' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-purple-100 text-purple-800'
                                                    }`}>
                                                        {transaction.payment_method}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <button className="text-red-600 hover:text-red-900 mr-3">
                                                        Receipt
                                                    </button>
                                                    <button className="text-indigo-600 hover:text-indigo-900">
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'orderManagement' && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800">Order Management</h2>
                            <p className="text-sm text-gray-600">Track and manage order statuses</p>
                        </div>
                        
                        <div className="overflow-x-auto">
                            {loadingOrders ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                                    <p className="mt-2 text-gray-600">Loading orders...</p>
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No orders found
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {orders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    #{order.id}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {order.customer_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    KSh {order.total_amount?.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                        order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                                                        order.status === 'ready' ? 'bg-purple-100 text-purple-800' :
                                                        order.status === 'delivered' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex space-x-2">
                                                        {order.status === 'pending' && (
                                                            <button
                                                                onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                                                className="text-green-600 hover:text-green-900"
                                                            >
                                                                Confirm
                                                            </button>
                                                        )}
                                                        {order.status === 'confirmed' && (
                                                            <button
                                                                onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                                className="text-blue-600 hover:text-blue-900"
                                                            >
                                                                Start Preparing
                                                            </button>
                                                        )}
                                                        {order.status === 'preparing' && (
                                                            <button
                                                                onClick={() => updateOrderStatus(order.id, 'ready')}
                                                                className="text-purple-600 hover:text-purple-900"
                                                            >
                                                                Mark Ready
                                                            </button>
                                                        )}
                                                        {order.status === 'ready' && (
                                                            <button
                                                                onClick={() => updateOrderStatus(order.id, 'delivered')}
                                                                className="text-gray-600 hover:text-gray-900"
                                                            >
                                                                Mark Delivered
                                                            </button>
                                                        )}
                                                        <button className="text-indigo-600 hover:text-indigo-900">
                                                            View
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

<<<<<<< HEAD
export default Sales;
=======
export default Sales;
>>>>>>> refs/remotes/origin/main
