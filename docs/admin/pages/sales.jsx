import React, { useEffect, useState, useCallback } from 'react';
import supabase from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import Layout from "../components/layout";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Sales = () => {
    // State Variables
    const [sales, setSales] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // New state for general errors

    // Sales form state
    const [selectedItem, setSelectedItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // Default payment method

    // Order form state
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [orderItems, setOrderItems] = useState([]);
    const [currentOrderItem, setCurrentOrderItem] = useState('');
    const [currentOrderQty, setCurrentOrderQty] = useState(1);
    const [orderNotes, setOrderNotes] = useState('');
    const [orderType, setOrderType] = useState('pickup');

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orderStatusFilter, setOrderStatusFilter] = useState('all');

    // For editing sales
    const [editingSaleId, setEditingSaleId] = useState(null);
    const [editQuantity, setEditQuantity] = useState('');

    // Active tab state
    const [activeTab, setActiveTab] = useState('sales');

    // Fetch all necessary data
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null); // Clear previous errors
        try {
            const [{ data: salesData, error: salesError }, { data: inventoryData, error: inventoryError }, { data: ordersData, error: ordersError }] = await Promise.all([
                supabase.from('sales').select('*').order('created_at', { ascending: false }),
                supabase.from('inventory').select('id, name, selling_price, quantity'),
                supabase.from('orders').select('*').order('created_at', { ascending: false })
            ]);

            if (salesError) throw salesError;
            if (inventoryError) throw inventoryError;
            if (ordersError) throw ordersError;

            setSales(salesData || []);
            setInventory(inventoryData || []);
            setOrders(ordersData || []);
        } catch (err) {
            console.error('Error fetching data:', err.message);
            setError('Failed to fetch data: ' + err.message);
            toast.error('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Supabase Realtime Subscriptions
    useEffect(() => {
        fetchAllData();

        const salesSubscription = supabase
            .channel('public:sales')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setSales(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setSales(prev => prev.map(sale => sale.id === payload.new.id ? payload.new : sale));
                } else if (payload.eventType === 'DELETE') {
                    setSales(prev => prev.filter(sale => sale.id !== payload.old.id));
                }
            })
            .subscribe();

        const ordersSubscription = supabase
            .channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setOrders(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setOrders(prev => prev.map(order => order.id === payload.new.id ? payload.new : order));
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(order => order.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(salesSubscription);
            supabase.removeChannel(ordersSubscription);
        };
    }, [fetchAllData]); // Depend on fetchAllData to re-run if it changes (though useCallback prevents this in most cases)

    // ========== SALES FUNCTIONS ==========
    const handleAddSale = async () => {
        if (!selectedItem) {
            toast.warn('Please select an item.');
            return;
        }
        if (!quantity && !amountPaid) {
            toast.warn('Please enter either quantity or amount paid.');
            return;
        }

        const item = inventory.find(inv => inv.id === Number(selectedItem));
        if (!item) {
            toast.error('Selected item not found in inventory.');
            return;
        }

        let qtyToSell = 0;
        let saleTotal = 0;

        // Determine quantity based on input type
        if (amountPaid) {
            const amount = parseFloat(amountPaid);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Please enter a valid amount paid.');
                return;
            }
            qtyToSell = amount / item.selling_price;
            saleTotal = amount; // Total is the amount paid
        } else if (quantity) {
            qtyToSell = parseFloat(quantity);
            if (isNaN(qtyToSell) || qtyToSell <= 0) {
                toast.error('Please enter a valid quantity.');
                return;
            }
            saleTotal = item.selling_price * qtyToSell;
        }

        // Round quantity to a reasonable number of decimal places if necessary
        qtyToSell = parseFloat(qtyToSell.toFixed(3)); // Example: 3 decimal places for precision

        if (item.quantity < qtyToSell) {
            toast.error(`Not enough stock. Only ${item.quantity} units of ${item.name} available.`);
            return;
        }

        try {
            // Deduct quantity from inventory
            const { error: updateError } = await supabase
                .from('inventory')
                .update({ quantity: item.quantity - qtyToSell })
                .eq('id', item.id);

            if (updateError) throw updateError;

            // Insert sale record
            const { error: insertError } = await supabase.from('sales').insert([{
                item_id: item.id,
                item_name: item.name,
                quantity: qtyToSell,
                price: item.selling_price,
                total: saleTotal,
                payment_method: paymentMethod
            }]);

            if (insertError) {
                // If sale insertion fails, attempt to revert inventory
                await supabase
                    .from('inventory')
                    .update({ quantity: item.quantity })
                    .eq('id', item.id);
                throw insertError;
            }

            toast.success('Sale recorded successfully! Inventory updated.');
            // Reset form
            setSelectedItem('');
            setQuantity('');
            setAmountPaid('');
            setPaymentMethod('cash'); // Reset to default
        } catch (err) {
            console.error("Sale transaction error:", err.message);
            toast.error('Failed to record sale: ' + err.message);
        }
    };

    const startEditSale = (sale) => {
        setEditingSaleId(sale.id);
        setEditQuantity(sale.quantity);
    };

    const cancelEditSale = () => {
        setEditingSaleId(null);
        setEditQuantity('');
    };

    const saveEditSale = async (originalSale) => {
        const newQuantity = parseFloat(editQuantity);
        if (isNaN(newQuantity) || newQuantity <= 0) {
            toast.error('Please enter a valid quantity for editing.');
            return;
        }

        // Find the item to check current stock
        const item = inventory.find(inv => inv.id === originalSale.item_id);
        if (!item) {
            toast.error('Item associated with this sale not found.');
            return;
        }

        const quantityDifference = newQuantity - originalSale.quantity;
        const newTotal = originalSale.price * newQuantity;

        // Check if there's enough stock for the *increase* in quantity
        if (quantityDifference > 0 && item.quantity < quantityDifference) {
            toast.error(`Not enough stock to increase. Only ${item.quantity} units of ${item.name} available.`);
            return;
        }

        try {
            // Update inventory
            const { error: inventoryUpdateError } = await supabase
                .from('inventory')
                .update({ quantity: item.quantity - quantityDifference })
                .eq('id', item.id);

            if (inventoryUpdateError) throw inventoryUpdateError;

            // Update sale record
            const { error: saleUpdateError } = await supabase
                .from('sales')
                .update({ quantity: newQuantity, total: newTotal })
                .eq('id', originalSale.id);

            if (saleUpdateError) {
                // Revert inventory if sale update fails
                await supabase
                    .from('inventory')
                    .update({ quantity: item.quantity }) // Revert to original stock
                    .eq('id', item.id);
                throw saleUpdateError;
            }

            toast.success('Sale updated successfully!');
            cancelEditSale();
            fetchAllData(); // Re-fetch to ensure consistency across states
        } catch (err) {
            console.error('Error saving sale edit:', err.message);
            toast.error('Failed to update sale: ' + err.message);
        }
    };

    const deleteSale = async (saleToDelete) => {
        if (!window.confirm(`Are you sure you want to delete this sale of ${saleToDelete.quantity} of ${saleToDelete.item_name}? This will revert stock.`)) {
            return;
        }

        try {
            // Revert inventory quantity
            const item = inventory.find(inv => inv.id === saleToDelete.item_id);
            if (item) {
                const { error: inventoryError } = await supabase
                    .from('inventory')
                    .update({ quantity: item.quantity + saleToDelete.quantity })
                    .eq('id', item.id);
                if (inventoryError) throw inventoryError;
            } else {
                console.warn("Item not found for sale deletion, inventory might not be reverted correctly.");
                toast.warn("Item not found for stock reversion, please check inventory manually.");
            }

            // Delete the sale record
            const { error: deleteError } = await supabase
                .from('sales')
                .delete()
                .eq('id', saleToDelete.id);

            if (deleteError) throw deleteError;

            toast.success('Sale deleted and stock reverted successfully!');
        } catch (err) {
            console.error("Error deleting sale:", err.message);
            toast.error('Failed to delete sale: ' + err.message);
        }
    };

    // ========== ORDER FUNCTIONS ==========
    const addItemToOrder = () => {
        if (!currentOrderItem) {
            toast.warn('Please select an item to add to the order.');
            return;
        }
        if (currentOrderQty <= 0) {
            toast.warn('Quantity must be greater than zero.');
            return;
        }

        const item = inventory.find(inv => inv.id === Number(currentOrderItem));
        if (!item) {
            toast.error('Selected item not found.');
            return;
        }

        // Check if item already exists in orderItems, then update quantity
        const existingItemIndex = orderItems.findIndex(orderItem => orderItem.id === item.id);
        if (existingItemIndex > -1) {
            const updatedOrderItems = [...orderItems];
            updatedOrderItems[existingItemIndex].quantity += currentOrderQty;
            setOrderItems(updatedOrderItems);
            toast.info(`Updated quantity for ${item.name}.`);
        } else {
            setOrderItems([...orderItems, {
                id: item.id,
                name: item.name,
                price: item.selling_price,
                quantity: currentOrderQty
            }]);
            toast.success(`${item.name} added to order.`);
        }

        setCurrentOrderItem('');
        setCurrentOrderQty(1);
    };

    const removeItemFromOrder = (index) => {
        const newItems = orderItems.filter((_, i) => i !== index);
        setOrderItems(newItems);
        toast.info('Item removed from order.');
    };

    const placeOrder = async () => {
        if (!customerName.trim()) {
            toast.warn('Customer name is required.');
            return;
        }
        if (orderItems.length === 0) {
            toast.warn('Please add at least one item to the order.');
            return;
        }

        const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        try {
            const { error } = await supabase.from('orders').insert([{
                customer_name: customerName,
                customer_phone: customerPhone,
                items: orderItems,
                total_amount: totalAmount,
                status: 'pending',
                order_type: orderType,
                payment_method: paymentMethod,
                notes: orderNotes
            }]);

            if (error) throw error;

            toast.success('Order placed successfully! 🎉');
            // Reset form
            setCustomerName('');
            setCustomerPhone('');
            setOrderItems([]);
            setOrderNotes('');
            setOrderType('pickup');
            setPaymentMethod('cash');
            setActiveTab('orders'); // Navigate to orders tab after placing
        } catch (err) {
            console.error('Failed to place order:', err.message);
            toast.error('Failed to place order: ' + err.message);
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            toast.success(`Order status updated to "${newStatus}"!`);
        } catch (err) {
            console.error('Failed to update order status:', err.message);
            toast.error('Failed to update order status: ' + err.message);
        }
    };

    const completeOrder = async (order) => {
        if (!window.confirm(`Are you sure you want to complete order #${order.id}? This will deduct items from inventory and record sales.`)) {
            return;
        }

        try {
            // Transaction-like logic: Deduct inventory and record sales, then update order status.
            // If any step fails, consider rolling back or alerting for manual intervention.

            for (const item of order.items) {
                const { data: inventoryItem, error: invFetchError } = await supabase
                    .from('inventory')
                    .select('quantity')
                    .eq('id', item.id)
                    .single();

                if (invFetchError) throw invFetchError;
                if (!inventoryItem || inventoryItem.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.name}. Available: ${inventoryItem ? inventoryItem.quantity : 0}, Required: ${item.quantity}.`);
                }

                // Deduct from inventory
                const { error: invUpdateError } = await supabase
                    .from('inventory')
                    .update({ quantity: inventoryItem.quantity - item.quantity })
                    .eq('id', item.id);
                if (invUpdateError) throw invUpdateError;

                // Record the sale
                const { error: saleInsertError } = await supabase.from('sales').insert([{
                    item_id: item.id,
                    item_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity,
                    payment_method: order.payment_method,
                    order_id: order.id
                }]);
                if (saleInsertError) throw saleInsertError;
            }

            // Finally update order status to completed
            await updateOrderStatus(order.id, 'completed');
            toast.success(`Order #${order.id} completed and sales recorded successfully!`);
            fetchAllData(); // Re-fetch to ensure inventory and sales are updated
        } catch (err) {
            console.error('Error completing order:', err.message);
            toast.error('Failed to complete order: ' + err.message);
            // In a real application, you might want more sophisticated rollback logic here
        }
    };

    // ========== FILTERS & EXPORTS ==========
    const filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        return (!start || saleDate >= start) && (!end || saleDate <= end);
    });

    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        const statusMatch = orderStatusFilter === 'all' || order.status === orderStatusFilter;
        const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);

        return statusMatch && dateMatch;
    });

    const exportToCSV = (data, fileName) => {
        if (data.length === 0) {
            toast.info("No data to export.");
            return;
        }
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up the URL object
        toast.success(`Exported ${fileName}`);
    };

    const exportToPDF = (data, title, fileName) => {
        if (data.length === 0) {
            toast.info("No data to export.");
            return;
        }
        const doc = new jsPDF();
        doc.text(title, 14, 16);
        const tableColumn = Object.keys(data[0]);
        const tableRows = data.map(item => Object.values(item));

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            didParseCell: function (data) {
                // Ensure number formatting for prices and totals
                if (data.column.dataKey === 'Price' || data.column.dataKey === 'Total') {
                    if (typeof data.cell.text[0] === 'number') {
                        data.cell.text[0] = `KSh ${data.cell.text[0].toFixed(2)}`;
                    }
                } else if (data.column.dataKey === 'Quantity') {
                    if (typeof data.cell.text[0] === 'number') {
                        data.cell.text[0] = data.cell.text[0].toFixed(2); // Two decimal places for quantity
                    }
                }
            }
        });
        doc.save(fileName);
        toast.success(`Exported ${fileName}`);
    };

    // Calculate total sales amount for the filtered period
    const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

    // Conditional rendering for the "Quantity" or "Amount Paid" input
    const renderQuantityOrAmountInput = () => {
        const selectedInventoryItem = inventory.find(item => item.id === Number(selectedItem));
        const sellingPrice = selectedInventoryItem ? selectedInventoryItem.selling_price : 0;

        return (
            <>
                <input
                    type="number"
                    placeholder="Quantity"
                    className="w-32 px-4 py-2 border rounded"
                    value={quantity}
                    onChange={(e) => { setQuantity(e.target.value); setAmountPaid(''); }} // Clear amountPaid if quantity is entered
                    min="0.01" // Allow fractional quantities
                    step="0.01" // Allow two decimal places for quantity
                />
                <span className="text-gray-500">OR</span>
                <input
                    type="number"
                    placeholder="Amount Paid (KSh)"
                    className="w-36 px-4 py-2 border rounded"
                    value={amountPaid}
                    onChange={(e) => { setAmountPaid(e.target.value); setQuantity(''); }} // Clear quantity if amountPaid is entered
                    min="0.01"
                    step="0.01"
                />
                {selectedInventoryItem && (quantity || amountPaid) && (
                    <span className="text-sm text-gray-600">
                        {quantity && `(Total: KSh ${(selectedInventoryItem.selling_price * parseFloat(quantity || 0)).toFixed(2)})`}
                        {amountPaid && `(Qty: ${(parseFloat(amountPaid || 0) / selectedInventoryItem.selling_price).toFixed(2)})`}
                    </span>
                )}
            </>
        );
    };


    // ========== RENDER ==========
    return (
        <Layout>
            <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
                <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Sales & Orders 🥩</h1>

                <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

                {/* Navigation Tabs */}
                <div className="flex mb-6 border-b border-gray-300">
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`px-4 py-2 rounded-t-lg transition-colors duration-200 ${activeTab === 'sales' ? 'bg-white border-t border-l border-r border-gray-300 text-red-700 font-semibold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        Sales Transactions 💰
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-4 py-2 rounded-t-lg transition-colors duration-200 ${activeTab === 'orders' ? 'bg-white border-t border-l border-r border-gray-300 text-red-700 font-semibold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        Orders Management 📦
                    </button>
                    <button
                        onClick={() => setActiveTab('newOrder')}
                        className={`px-4 py-2 rounded-t-lg transition-colors duration-200 ${activeTab === 'newOrder' ? 'bg-white border-t border-l border-r border-gray-300 text-red-700 font-semibold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        New Order ✨
                    </button>
                </div>

                {/* Date Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-white rounded shadow-md">
                    <label htmlFor="startDate" className="sr-only">Start Date</label>
                    <input
                        id="startDate"
                        type="date"
                        className="border border-gray-300 px-3 py-2 rounded-md focus:ring-red-500 focus:border-red-500"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                    <label htmlFor="endDate" className="sr-only">End Date</label>
                    <input
                        id="endDate"
                        type="date"
                        className="border border-gray-300 px-3 py-2 rounded-md focus:ring-red-500 focus:border-red-500"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                    {activeTab === 'orders' && (
                        <>
                            <label htmlFor="orderStatusFilter" className="sr-only">Order Status</label>
                            <select
                                id="orderStatusFilter"
                                className="border border-gray-300 px-3 py-2 rounded-md focus:ring-red-500 focus:border-red-500"
                                value={orderStatusFilter}
                                onChange={(e) => setOrderStatusFilter(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="preparing">Preparing</option>
                                <option value="ready">Ready</option>
                                <option value="completed">Completed</option>
                            </select>
                        </>
                    )}
                    <button
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setOrderStatusFilter('all');
                            toast.info("Filters reset!");
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-200"
                    >
                        Reset Filters 🔄
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}

                {/* Sales Tab */}
                {activeTab === 'sales' && (
                    <div className="bg-white rounded-lg shadow-xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold text-gray-800">Sales Transactions</h2>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => exportToCSV(
                                        filteredSales.map(s => ({
                                            ID: s.id,
                                            Item: s.item_name,
                                            Quantity: s.quantity,
                                            Price: s.price,
                                            Total: s.total,
                                            Payment: s.payment_method,
                                            Date: new Date(s.created_at).toLocaleString()
                                        })),
                                        'sales_report.csv'
                                    )}
                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 flex items-center gap-1"
                                >
                                    Export CSV <span className="fa fa-file-csv"></span>
                                </button>
                                <button
                                    onClick={() => exportToPDF(
                                        filteredSales.map(s => ({
                                            ID: s.id,
                                            Item: s.item_name,
                                            Quantity: s.quantity,
                                            Price: s.price,
                                            Total: s.total,
                                            Payment: s.payment_method,
                                            Date: new Date(s.created_at).toLocaleString()
                                        })),
                                        'Sales Report',
                                        'sales_report.pdf'
                                    )}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center gap-1"
                                >
                                    Export PDF <span className="fa fa-file-pdf"></span>
                                </button>
                            </div>
                        </div>

                        {/* Quick Sale Form */}
                        <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-8 p-6 bg-blue-50 rounded-lg shadow-inner items-center">
                            {/* Item Selector */}
                            <select
                                className="flex-grow min-w-[180px] px-4 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={selectedItem}
                                onChange={(e) => setSelectedItem(e.target.value)}
                                aria-label="Select Item for Sale"
                            >
                                <option value="">Select Item</option>
                                {inventory.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} - {item.quantity.toFixed(2)} in stock @ KSh {item.selling_price.toFixed(2)}/unit
                                    </option>
                                ))}
                            </select>

                            {/* Conditional Quantity/Amount Input */}
                            {renderQuantityOrAmountInput()}

                            {/* Payment Method Selector */}
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-40 px-4 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                required
                                aria-label="Payment Method"
                            >
                                <option value="cash">Cash 💵</option>
                                <option value="mpesa">M-Pesa 📱</option>
                                <option value="bank">Bank 🏦</option>
                                <option value="card">Card 💳</option>
                            </select>

                            {/* Record Sale Button */}
                            <button
                                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2"
                                onClick={handleAddSale}
                            >
                                Record Sale <span className="fa fa-plus-circle"></span>
                            </button>
                        </div>

                        {/* Sales Summary */}
                        <div className="mb-4 text-lg font-semibold text-gray-800">
                            Total Sales for Filtered Period: <span className="text-green-700">KSh {totalSalesAmount.toFixed(2)}</span>
                        </div>

                        {/* Sales Table */}
                        {loading ? (
                            <p className="text-center text-gray-500">Loading sales data...</p>
                        ) : filteredSales.length === 0 ? (
                            <p className="text-center text-gray-600 p-4 bg-gray-50 rounded-md">No sales found for the selected period.</p>
                        ) : (
                            <div className="overflow-x-auto bg-gray-50 rounded-lg shadow">
                                <table className="min-w-full leading-normal">
                                    <thead className="bg-red-700 text-white">
                                        <tr>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Item</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Qty</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Price</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Total</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Payment</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSales.map((sale, index) => (
                                            <tr key={sale.id} className="hover:bg-gray-100">
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">{index + 1}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">{sale.item_name}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">
                                                    {editingSaleId === sale.id ? (
                                                        <input
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            value={editQuantity}
                                                            onChange={(e) => setEditQuantity(e.target.value)}
                                                            className="w-24 px-2 py-1 border rounded-md"
                                                            aria-label="Edit Quantity"
                                                        />
                                                    ) : (
                                                        sale.quantity.toFixed(2)
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">KSh {sale.price.toFixed(2)}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm font-semibold">KSh {sale.total.toFixed(2)}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm capitalize">{sale.payment_method}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">{new Date(sale.created_at).toLocaleString()}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm space-x-2">
                                                    {editingSaleId === sale.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => saveEditSale(sale)}
                                                                className="bg-green-600 text-white px-3 py-1 rounded-md text-xs hover:bg-green-700 transition-colors duration-200"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={cancelEditSale}
                                                                className="bg-gray-500 text-white px-3 py-1 rounded-md text-xs hover:bg-gray-600 transition-colors duration-200"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => startEditSale(sale)}
                                                                className="bg-yellow-500 text-white px-3 py-1 rounded-md text-xs hover:bg-yellow-600 transition-colors duration-200"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => deleteSale(sale)}
                                                                className="bg-red-600 text-white px-3 py-1 rounded-md text-xs hover:bg-red-700 transition-colors duration-200"
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="bg-white rounded-lg shadow-xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold text-gray-800">Orders Management</h2>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => exportToCSV(
                                        filteredOrders.map(o => ({
                                            ID: o.id,
                                            Customer: o.customer_name,
                                            Phone: o.customer_phone,
                                            Items: o.items.map(i => `${i.name} (${i.quantity.toFixed(2)})`).join(', '),
                                            Total: o.total_amount,
                                            Status: o.status,
                                            Type: o.order_type,
                                            Payment: o.payment_method,
                                            Date: new Date(o.created_at).toLocaleString()
                                        })),
                                        'orders_report.csv'
                                    )}
                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 flex items-center gap-1"
                                >
                                    Export CSV <span className="fa fa-file-csv"></span>
                                </button>
                                <button
                                    onClick={() => exportToPDF(
                                        filteredOrders.map(o => ({
                                            ID: o.id,
                                            Customer: o.customer_name,
                                            Phone: o.customer_phone,
                                            Items: o.items.map(i => `${i.name} (${i.quantity.toFixed(2)})`).join(', '),
                                            Total: o.total_amount,
                                            Status: o.status,
                                            Type: o.order_type,
                                            Payment: o.payment_method,
                                            Date: new Date(o.created_at).toLocaleString()
                                        })),
                                        'Orders Report',
                                        'orders_report.pdf'
                                    )}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center gap-1"
                                >
                                    Export PDF <span className="fa fa-file-pdf"></span>
                                </button>
                            </div>
                        </div>

                        {/* Orders Table */}
                        {loading ? (
                            <p className="text-center text-gray-500">Loading orders data...</p>
                        ) : filteredOrders.length === 0 ? (
                            <p className="text-center text-gray-600 p-4 bg-gray-50 rounded-md">No orders found for the selected filters.</p>
                        ) : (
                            <div className="overflow-x-auto bg-gray-50 rounded-lg shadow">
                                <table className="min-w-full leading-normal">
                                    <thead className="bg-red-700 text-white">
                                        <tr>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Customer</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Items</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Total</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOrders.map((order, index) => (
                                            <tr key={order.id} className="hover:bg-gray-100">
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">{index + 1}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">
                                                    <div className="font-medium text-gray-900">{order.customer_name}</div>
                                                    {order.customer_phone && <div className="text-xs text-gray-600">{order.customer_phone}</div>}
                                                </td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">
                                                    <div className="flex flex-wrap gap-1">
                                                        {order.items.map((item, i) => (
                                                            <span key={i} className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                                                                {item.name} ({item.quantity.toFixed(2)})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm font-semibold">KSh {order.total_amount.toFixed(2)}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                                                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                            order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                                                                order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm capitalize">{order.order_type}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm">{new Date(order.created_at).toLocaleString()}</td>
                                                <td className="px-5 py-3 border-b border-gray-200 text-sm space-x-1">
                                                    {order.status === 'pending' && (
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                            className="bg-yellow-500 text-white px-3 py-1 rounded-md text-xs hover:bg-yellow-600 transition-colors duration-200"
                                                        >
                                                            Start Prep
                                                        </button>
                                                    )}
                                                    {order.status === 'preparing' && (
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, 'ready')}
                                                            className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600 transition-colors duration-200"
                                                        >
                                                            Mark Ready
                                                        </button>
                                                    )}
                                                    {order.status === 'ready' && (
                                                        <button
                                                            onClick={() => completeOrder(order)}
                                                            className="bg-green-600 text-white px-3 py-1 rounded-md text-xs hover:bg-green-700 transition-colors duration-200"
                                                        >
                                                            Complete Order
                                                        </button>
                                                    )}
                                                    {order.status !== 'completed' && (
                                                        <button
                                                            onClick={() => toast.info("Order editing/cancellation not yet implemented.")} // Placeholder
                                                            className="bg-gray-400 text-white px-3 py-1 rounded-md text-xs opacity-75 cursor-not-allowed"
                                                            disabled
                                                        >
                                                            Edit/Cancel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* New Order Tab */}
                {activeTab === 'newOrder' && (
                    <div className="bg-white rounded-lg shadow-xl p-6">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create New Order 📝</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Customer Info */}
                            <div className="space-y-5 p-4 bg-gray-50 rounded-lg shadow-inner">
                                <h3 className="text-xl font-medium text-gray-700 border-b pb-2 mb-4">Customer Details</h3>
                                <div>
                                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                                    <input
                                        id="customerName"
                                        type="text"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="E.g., John Doe"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                                    <input
                                        id="customerPhone"
                                        type="text"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder="E.g., +254712345678"
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
                                                    {item.name} - KSh {item.selling_price.toFixed(2)}/unit (Stock: {item.quantity.toFixed(2)})
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
                                            onChange={(e) => setCurrentOrderQty(parseFloat(e.target.value))}
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
                                                        {item.quantity.toFixed(2)} × KSh {item.price.toFixed(2)} = <span className="font-semibold">KSh {(item.quantity * item.price).toFixed(2)}</span>
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
                                            KSh {orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={placeOrder}
                                        disabled={orderItems.length === 0 || !customerName.trim()}
                                        className={`w-full py-3 rounded-md text-white font-semibold text-lg transition-colors duration-200 ${
                                            orderItems.length === 0 || !customerName.trim()
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                    >
                                        Place Order 🚀
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Sales;
