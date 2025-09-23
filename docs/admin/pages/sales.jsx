import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";

const Sales = () => {
    // State for order details
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [orderType, setOrderType] = useState('pickup');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [orderNotes, setOrderNotes] = useState('');

    // State for managing order items
    const [inventory, setInventory] = useState([]);
    const [currentOrderItem, setCurrentOrderItem] = useState('');
    const [currentOrderWeight, setCurrentOrderWeight] = useState(0.01); // Weight in kg
    const [orderItems, setOrderItems] = useState([]);
    
    // Weighing scale integration
    const [scaleConnected, setScaleConnected] = useState(false);
    const [scaleReading, setScaleReading] = useState(0);
    const [useScale, setUseScale] = useState(false);
    const [scalePort, setScalePort] = useState(null);

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
                    price_per_kg: parseFloat(item.price_per_kg || item.selling_price || 0), // Price per kg for meat products
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
                // This is a placeholder for actual scale integration
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

    // Function to simulate connecting to a weighing scale
    const tryConnectToScale = () => {
        // In a real implementation, this would use Web Serial API or another method
        // to connect to the physical weighing scale
        if ('serial' in navigator) {
            console.log("Web Serial API supported");
            // Here you would implement actual scale connection
            // For now, we'll just simulate it
            setScaleConnected(true);
            
            // Simulate scale readings
            const interval = setInterval(() => {
                if (useScale) {
                    // Generate random weight between 0.1 and 5.0 kg for simulation
                    const randomWeight = (Math.random() * 4.9 + 0.1).toFixed(2);
                    setScaleReading(parseFloat(randomWeight));
                    setCurrentOrderWeight(parseFloat(randomWeight));
                }
            }, 2000);
            
            return () => clearInterval(interval);
        } else {
            console.log("Web Serial API not supported");
            setScaleConnected(false);
        }
    };

    // Function to connect to scale via Web Serial API (example implementation)
    const connectToScale = async () => {
        try {
            // Request a port and open a connection
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            setScalePort(port);
            setScaleConnected(true);
            
            // Set up a reader to read data from the scale
            const reader = port.readable.getReader();
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                // Parse the scale data (this depends on your specific scale protocol)
                const textDecoder = new TextDecoder();
                const scaleData = textDecoder.decode(value);
                
                // Extract weight from scale data (implementation depends on scale output format)
                const weightMatch = scaleData.match(/(\d+\.\d+)/);
                if (weightMatch) {
                    const weight = parseFloat(weightMatch[1]);
                    setScaleReading(weight);
                    if (useScale) {
                        setCurrentOrderWeight(weight);
                    }
                }
            }
        } catch (error) {
            console.error("Error connecting to scale:", error);
            setScaleConnected(false);
        }
    };

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

        // Check if we have enough stock
        if (selectedInventoryItem.quantity < currentOrderWeight) {
            alert(`Not enough stock for ${selectedInventoryItem.name}. Available: ${selectedInventoryItem.quantity.toFixed(2)} kg`);
            return;
        }

        // Calculate price based on weight
        const pricePerKg = parseFloat(selectedInventoryItem.price_per_kg || selectedInventoryItem.selling_price || 0);
        const totalPrice = pricePerKg * currentOrderWeight;

        const newItem = {
            id: selectedInventoryItem.id,
            name: selectedInventoryItem.name,
            price_per_kg: pricePerKg,
            weight: parseFloat(currentOrderWeight),
            total_price: totalPrice,
            unit: 'kg'
        };

        setOrderItems(prevItems => {
            // Check if item already exists in order to update weight
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

        // Reset item selection and weight
        setCurrentOrderItem('');
        setCurrentOrderWeight(0.01);
    };

    const removeItemFromOrder = (indexToRemove) => {
        setOrderItems(prevItems => prevItems.filter((_, index) => index !== indexToRemove));
    };

    const placeOrder = async () => {
        if (orderItems.length === 0) {
            alert('Cannot place an empty order.');
            return;
        }
        if (!customerName.trim()) {
            alert('Customer Name is required to place an order.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const orderTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

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
                    status: 'pending',
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
                quantity: item.weight, // For meat, quantity is weight
                price_at_order: item.price_per_kg,
            }));

            const { error: orderItemsError } = await supabase
                .from('order_items')
                .insert(orderItemsToInsert);

            if (orderItemsError) {
                throw orderItemsError;
            }

            // 3. Update inventory quantities (reduce weight)
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

            alert('Order placed successfully!');
            setShowSuccessMessage(true);
            // Reset form
            setCustomerName('');
            setCustomerContact('');
            setOrderType('pickup');
            setPaymentMethod('cash');
            setOrderNotes('');
            setCurrentOrderItem('');
            setCurrentOrderWeight(0.01);
            setOrderItems([]);

            // Re-fetch inventory to reflect updated stock levels
            const { data: updatedInventoryData, error: updatedInventoryError } = await supabase
                .from('inventory')
                .select('*');

            if (updatedInventoryError) {
                console.error("Failed to re-fetch inventory after order placement:", updatedInventoryError);
            } else {
                const parsedUpdatedInventory = (updatedInventoryData || []).map(item => ({
                    ...item,
                    quantity: parseFloat(item.quantity || 0),
                    selling_price: parseFloat(item.selling_price || 0),
                    price_per_kg: parseFloat(item.price_per_kg || item.selling_price || 0),
                }));
                setInventory(parsedUpdatedInventory);
            }

            // Hide success message after a few seconds
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
            setCurrentOrderWeight(scaleReading);
        } else {
            alert('Weighing scale is not connected. Please enter weight manually.');
        }
    };

    return (
        <Layout>
            <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Meat Sales by Weight</h1>

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

                            <div className="flex flex-col sm:flex-row gap-3 items-end">
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
                                            setUseScale(false); // Disable scale reading when manually entering
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

                            {/* Items List */}
                            <div className="border border-gray-300 rounded-lg divide-y divide-gray-200 min-h-[150px] max-h-[300px] overflow-y-auto">
                                {orderItems.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">No items added to this order yet.</div>
                                ) : (
                                    orderItems.map((item, index) => (
                                        <div key={index} className="p-4 flex justify-between items-center bg-white hover:bg-gray-50">
                                            <div>
                                                <div className="font-medium text-gray-900">{item.name}</div>
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

                            {/* Order Summary */}
                            <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                                <div className="flex justify-between font-bold text-xl text-gray-800 mb-4">
                                    <span>Order Total:</span>
                                    <span>
                                        KSh {orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}
                                    </span>
                                </div>
                                <button
                                    onClick={placeOrder}
                                    disabled={orderItems.length === 0 || !customerName.trim() || loading}
                                    className={`w-full py-3 rounded-md text-white font-semibold text-lg transition-colors duration-200 ${
                                        orderItems.length === 0 || !customerName.trim() || loading
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {loading ? 'Processing Order...' : 'Place Order 🚀'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Sales;
