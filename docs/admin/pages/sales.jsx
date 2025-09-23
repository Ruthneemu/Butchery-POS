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
    const [currentOrderQty, setCurrentOrderQty] = useState(0.01);
    const [orderItems, setOrderItems] = useState([]);

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
                    quantity: parseFloat(item.quantity || 0), // Ensure it's a number, default to 0 if null/undefined
                    selling_price: parseFloat(item.selling_price || 0),
                    price: parseFloat(item.price || 0), // Also ensure price is a number
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

            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load data: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

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

        // Ensure we're working with numbers
        const availableQuantity = parseFloat(selectedInventoryItem.quantity || 0);
        const orderQuantity = parseFloat(currentOrderQty || 0);
        
        if (availableQuantity < orderQuantity) {
            alert(`Not enough stock for ${selectedInventoryItem.name}. Available: ${availableQuantity.toFixed(2)}`);
            return;
        }

        const newItem = {
            id: selectedInventoryItem.id,
            name: selectedInventoryItem.name,
            price: parseFloat(selectedInventoryItem.selling_price || 0), // Ensure price is a number
            quantity: orderQuantity,
        };

        setOrderItems(prevItems => {
            // Check if item already exists in order to update quantity
            const existingItemIndex = prevItems.findIndex(item => item.id === newItem.id);

            if (existingItemIndex > -1) {
                const updatedItems = [...prevItems];
                const updatedQty = parseFloat(updatedItems[existingItemIndex].quantity || 0) + orderQuantity;

                if (availableQuantity < updatedQty) {
                    alert(`Adding this quantity would exceed available stock for ${selectedInventoryItem.name}.`);
                    return prevItems;
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
            const orderTotal = orderItems.reduce((sum, item) => {
                const itemPrice = parseFloat(item.price || 0);
                const itemQuantity = parseFloat(item.quantity || 0);
                return sum + (itemPrice * itemQuantity);
            }, 0);

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
                        status: 'pending',
                    }
                ])
                .select();

            if (orderError) {
                throw orderError;
            }

            const newOrderId = orderData[0].id;

            // 2. Prepare order_items for bulk insert
            const orderItemsToInsert = orderItems.map(item => ({
                order_id: newOrderId,
                item_id: item.id,
                quantity: parseFloat(item.quantity || 0),
                price_at_order: parseFloat(item.price || 0),
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
                // Ensure currentStock is a number
                const safeCurrentStock = parseFloat(currentStock || 0);
                const newStock = safeCurrentStock - parseFloat(orderItem.quantity || 0);

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
            setCurrentOrderQty(0.01);
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
                    price: parseFloat(item.price || 0),
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
                                                {item.name} - KSh {parseFloat(item.selling_price || 0).toFixed(2)}/unit (Stock: {parseFloat(item.quantity || 0).toFixed(2)})
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
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setCurrentOrderQty(isNaN(val) ? 0.01 : val);
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
                                                    {parseFloat(item.quantity || 0).toFixed(2)} × KSh {parseFloat(item.price || 0).toFixed(2)} = <span className="font-semibold">KSh {(parseFloat(item.quantity || 0) * parseFloat(item.price || 0)).toFixed(2)}</span>
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
                                        KSh {orderItems.reduce((sum, item) => {
                                            const itemPrice = parseFloat(item.price || 0);
                                            const itemQuantity = parseFloat(item.quantity || 0);
                                            return sum + (itemPrice * itemQuantity);
                                        }, 0).toFixed(2)}
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