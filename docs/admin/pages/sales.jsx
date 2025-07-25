import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Assuming you have this file for Supabase client
import Layout from '../components/Layout'; // Your layout component

const Sales = () => {
    // State for order details
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [orderType, setOrderType] = useState('pickup'); // Default to pickup
    const [paymentMethod, setPaymentMethod] = useState('cash'); // Default to cash
    const [orderNotes, setOrderNotes] = useState('');

    // State for managing order items
    const [inventory, setInventory] = useState([]); // To store items fetched from Supabase
    const [currentOrderItem, setCurrentOrderItem] = useState(''); // Stores the ID of the selected item
    const [currentOrderQty, setCurrentOrderQty] = useState(0.01); // Default quantity, ensure it's a number
    const [orderItems, setOrderItems] = useState([]); // Array to hold items added to the current order

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false); // For order placement feedback
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
                setInventory(inventoryData || []); // Ensure it's an array

                // Fetch business settings (example of fixing the 404/406 issues)
                // You might need a user ID if your RLS policies require it,
                // but for fetching general settings, often user_id isn't needed
                // unless it's specific settings per user.
                // Assuming you want general business settings, not user-specific ones for the 404.
                // If it IS user-specific, ensure 'auth.user().id' or similar is correctly passed.
                // For demonstration, I'm removing 'user_id=eq.cf916bb0-6582-4d1f-99f7-fabde9b8b7ac'
                // as it was the part of the URL causing 404/406. Adjust if truly user-specific.
                const { data: settingsData, error: settingsError } = await supabase
                    .from('business_settings')
                    .select('*')
                    .limit(1); // Assuming you only need one row of settings

                if (settingsError) {
                    throw settingsError;
                }
                // You might use settingsData to pre-fill some fields or configure the UI
                console.log("Business Settings:", settingsData);

            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load data: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []); // Empty dependency array means this runs once on mount
    // --- Part 3 continues from previous response ---

    const addItemToOrder = () => {
        if (!currentOrderItem || currentOrderQty <= 0 || isNaN(currentOrderQty)) {
            alert('Please select an item and enter a valid quantity greater than zero.');
            return;
        }

        const selectedInventoryItem = inventory.find(item => item.id === parseInt(currentOrderItem));

        if (!selectedInventoryItem) {
            alert('Selected item not found in inventory.');
            return;
        }

        // Check stock availability
        if (selectedInventoryItem.quantity < currentOrderQty) {
            alert(`Not enough stock for ${selectedInventoryItem.name}. Available: ${selectedInventoryItem.quantity.toFixed(2)}`);
            return;
        }

        const newItem = {
            id: selectedInventoryItem.id,
            name: selectedInventoryItem.name,
            price: parseFloat(selectedInventoryItem.selling_price), // Ensure price is a number
            quantity: parseFloat(currentOrderQty), // Ensure quantity is a number
        };

        setOrderItems(prevItems => {
            // Check if item already exists in order to update quantity
            const existingItemIndex = prevItems.findIndex(item => item.id === newItem.id);

            if (existingItemIndex > -1) {
                const updatedItems = [...prevItems];
                const updatedQty = updatedItems[existingItemIndex].quantity + newItem.quantity;

                if (selectedInventoryItem.quantity < updatedQty) {
                    alert(`Adding this quantity would exceed available stock for ${selectedInventoryItem.name}.`);
                    return prevItems; // Don't update if exceeds stock
                }

                updatedItems[existingItemIndex].quantity = updatedQty;
                return updatedItems;
            } else {
                return [...prevItems, newItem];
            }
        });

        // Reset item selection and quantity
        setCurrentOrderItem('');
        setCurrentOrderQty(0.01);
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
            const orderTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // 1. Insert the new order into the 'orders' table
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([
                    {
                        customer_name: customerName,
                        customer_contact: customerContact,
                        order_type: orderType,
                        payment_method: paymentMethod,
                        order_notes: orderNotes,
                        total_amount: orderTotal,
                        status: 'pending', // Default status
                        // You might want to add a user_id if orders are linked to specific users
                        // user_id: (await supabase.auth.getSession()).data.session?.user?.id,
                    }
                ])
                .select(); // Use .select() to get the inserted data, including the new order ID

            if (orderError) {
                throw orderError;
            }

            const newOrderId = orderData[0].id; // Get the ID of the newly created order

            // 2. Prepare order_items for bulk insert
            const orderItemsToInsert = orderItems.map(item => ({
                order_id: newOrderId,
                item_id: item.id,
                quantity: item.quantity,
                price_at_order: item.price, // Store the price at the time of order
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
                const newStock = currentStock - orderItem.quantity;

                const { error: updateError } = await supabase
                    .from('inventory')
                    .update({ quantity: newStock })
                    .eq('id', orderItem.id);

                if (updateError) {
                    console.error(`Failed to update stock for item ${orderItem.name}:`, updateError);
                    // You might want to throw this error or handle it more gracefully
                }
            });

            await Promise.all(updates); // Wait for all inventory updates to complete

            alert('Order placed successfully!');
            setShowSuccessMessage(true);
            // Reset form
            setCustomerName('');
            setCustomerContact('');
            setOrderType('pickup');
            setPaymentMethod('cash');
            setOrderNotes('');
            setCurrentOrderItem('');
            setCurrentOrderQty(0.01);
            setOrderItems([]);

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
    return (
        <Layout>
            <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">New Sales Order</h1>

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

                            <div className="flex flex-col sm:flex-row gap-3 items-end">
                                <div className="flex-grow">
                                    <label htmlFor="currentOrderItem" className="block text-sm font-medium text-gray-700 mb-1">Select Item</label>
                                    <select
                                        id="currentOrderItem"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                        value={currentOrderItem}
                                        onChange={(e) => setCurrentOrderItem(e.target.value)}
                                    >
                                        <option value="">Choose an Item</option>
                                        {inventory.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} - KSh {parseFloat(item.selling_price).toFixed(2)}/unit (Stock: {parseFloat(item.quantity).toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label htmlFor="currentOrderQty" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                    <input
                                        id="currentOrderQty"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                        value={currentOrderQty}
                                        // Crucial: Ensure quantity is always a number, handle potential NaN
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setCurrentOrderQty(isNaN(val) ? 0.01 : val); // Default to 0.01 if invalid
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
                                                    {/* Ensure item.quantity and item.price are numbers here */}
                                                    {parseFloat(item.quantity).toFixed(2)} × KSh {parseFloat(item.price).toFixed(2)} = <span className="font-semibold">KSh {(parseFloat(item.quantity) * parseFloat(item.price)).toFixed(2)}</span>
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
                                        KSh {orderItems.reduce((sum, item) => sum + (parseFloat(item.price) * parseFloat(item.quantity)), 0).toFixed(2)}
                                    </span>
                                </div>
                                <button
                                    onClick={placeOrder}
                                    disabled={orderItems.length === 0 || !customerName.trim() || loading} // Disable while loading
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