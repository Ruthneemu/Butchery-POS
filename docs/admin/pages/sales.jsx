import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";

const Sales = () => {
    // Tab state - reordered as requested
    const [activeTab, setActiveTab] = useState('salesTransactions'); // 'salesTransactions', 'orderManagement', 'newOrder'
    
    // State for sales transactions
    const [sellingMethod, setSellingMethod] = useState('weight'); // 'weight' or 'amount'
    const [selectedProduct, setSelectedProduct] = useState('');
    const [weight, setWeight] = useState(0.01);
    const [amount, setAmount] = useState('');
    const [salesData, setSalesData] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [totalSales, setTotalSales] = useState(0);
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
    const [loadingSales, setLoadingSales] = useState(false);
    
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
    
    // Selling method state (by weight or by amount)
    const [orderSellingMethod, setOrderSellingMethod] = useState('weight'); // 'weight' or 'amount'
    const [targetAmount, setTargetAmount] = useState('');
    const [calculatedWeight, setCalculatedWeight] = useState(0);
    
    // Weighing scale integration
    const [scaleConnected, setScaleConnected] = useState(false);
    const [scaleReading, setScaleReading] = useState(0);
    const [useScale, setUseScale] = useState(false);
    const [scalePort, setScalePort] = useState(null);
    const [scaleError, setScaleError] = useState(null);

    // States for different tabs
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [user, setUser] = useState(null);

    // Helper function to get product name by ID
    const getProductName = (itemId) => {
        const product = inventory.find(item => item.id === itemId);
        return product ? product.name : `Unknown Product (${itemId})`;
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Get current user
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;
                setUser(user);
                
                // Fetch inventory items with actual names from database
                const { data: inventoryData, error: inventoryError } = await supabase
                    .from('inventory')
                    .select('*');

                if (inventoryError) {
                    throw inventoryError;
                }

                // Process inventory data with real values
                const parsedInventory = (inventoryData || []).map(item => ({
                    ...item,
                    name: item.name || `Product ${item.id}`, // Use actual name from database
                    quantity: item.quantity || 0, // Use actual quantity from database
                    selling_price: parseFloat(item.selling_price || 0),
                    price_per_kg: parseFloat(item.selling_price || 0),
                }));
                setInventory(parsedInventory);

            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load data: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // Calculate weight when target amount changes
    useEffect(() => {
        if (orderSellingMethod === 'amount' && targetAmount && currentOrderItem) {
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
    }, [targetAmount, currentOrderItem, orderSellingMethod, inventory]);

    // Update target amount when scale reading changes (for amount-based selling)
    useEffect(() => {
        if (orderSellingMethod === 'amount' && useScale && currentOrderItem && scaleReading > 0) {
            const selectedItem = inventory.find(item => item.id === parseInt(currentOrderItem));
            if (selectedItem) {
                const pricePerKg = parseFloat(selectedItem.price_per_kg || selectedItem.selling_price || 0);
                const currentValue = scaleReading * pricePerKg;
                setTargetAmount(currentValue.toFixed(2));
                setCurrentOrderWeight(scaleReading);
            }
        }
    }, [scaleReading, orderSellingMethod, useScale, currentOrderItem, inventory]);

    const checkScaleConnection = async () => {
        setScaleError(null);
        if ('serial' in navigator) {
            try {
                const ports = await navigator.serial.getPorts();
                if (ports.length > 0 && ports[0].readable) {
                    setScaleConnected(true);
                    setScalePort(ports[0]);
                    startScaleReading(ports[0]);
                    return;
                }
            } catch (error) {
                console.log("No previously connected scale found:", error);
                setScaleError("No previously connected scale found");
            }
        } else {
            setScaleError("Web Serial API is not supported in your browser");
        }
        setScaleConnected(false);
        setScalePort(null);
    };

    const startScaleReading = async (port) => {
        if (!port || !port.readable) return;
        
        try {
            const reader = port.readable.getReader();
            
            const readLoop = async () => {
                try {
                    const { value, done } = await reader.read();
                    if (done) {
                        reader.releaseLock();
                        return;
                    }
                    
                    const textDecoder = new TextDecoder();
                    const scaleData = textDecoder.decode(value).trim();
                    
                    // Parse common scale data formats
                    const weightMatch = scaleData.match(/(\d+\.?\d*)\s*kg|(\d+\.?\d*)\s*g/i);
                    if (weightMatch) {
                        let weight = parseFloat(weightMatch[1] || weightMatch[2]);
                        // Convert grams to kg if needed
                        if (scaleData.toLowerCase().includes('g') && !scaleData.toLowerCase().includes('kg')) {
                            weight = weight / 1000;
                        }
                        setScaleReading(Math.max(0, weight)); // Ensure non-negative
                        
                        if (useScale && orderSellingMethod === 'weight') {
                            setCurrentOrderWeight(weight);
                        }
                    }
                    
                    // Continue reading
                    setTimeout(readLoop, 100);
                } catch (error) {
                    console.error("Error reading from scale:", error);
                    setScaleError("Error reading from scale: " + error.message);
                    setScaleConnected(false);
                    setScalePort(null);
                }
            };
            
            readLoop();
        } catch (error) {
            console.error("Error starting scale reading:", error);
            setScaleError("Error starting scale reading: " + error.message);
            setScaleConnected(false);
            setScalePort(null);
        }
    };

    const connectToScale = async () => {
        setScaleError(null);
        if (!('serial' in navigator)) {
            setScaleError('Web Serial API is not supported in your browser. Please use Chrome, Edge, or Opera with HTTPS.');
            return;
        }

        try {
            const port = await navigator.serial.requestPort();
            await port.open({ 
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            });
            
            setScalePort(port);
            setScaleConnected(true);
            startScaleReading(port);
            alert('Scale connected successfully!');
        } catch (error) {
            console.error("Error connecting to scale:", error);
            if (error.name === 'NotAllowedError') {
                setScaleError('Permission denied. Please allow access to the serial port.');
            } else {
                setScaleError('Failed to connect to scale. Please check the connection and try again.');
            }
            setScaleConnected(false);
            setScalePort(null);
        }
    };

    const disconnectScale = async () => {
        if (scalePort) {
            try {
                if (scalePort.readable) {
                    const reader = scalePort.readable.getReader();
                    await reader.cancel();
                    reader.releaseLock();
                }
                await scalePort.close();
            } catch (error) {
                console.error("Error disconnecting scale:", error);
            }
        }
        setScaleConnected(false);
        setScalePort(null);
        setScaleReading(0);
        setUseScale(false);
    };

    useEffect(() => {
        checkScaleConnection();
        
        return () => {
            disconnectScale();
        };
    }, []);

    // Fetch sales data for transactions tab
    const fetchSalesData = async () => {
        setLoadingSales(true);
        try {
            // Fetch sales data with inventory details joined
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    inventory:item_id (name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            setSalesData(data || []);
            setFilteredSales(data || []);
            
            // Calculate total sales
            const total = (data || []).reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            setTotalSales(total);
        } catch (err) {
            console.error('Error fetching sales data:', err);
            setError('Error fetching sales data: ' + err.message);
        } finally {
            setLoadingSales(false);
        }
    };

    // Apply date filter to sales data
    useEffect(() => {
        if (dateFilter.start && dateFilter.end) {
            const filtered = salesData.filter(sale => {
                const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
                return saleDate >= dateFilter.start && saleDate <= dateFilter.end;
            });
            setFilteredSales(filtered);
            
            // Recalculate total sales for filtered period
            const total = filtered.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            setTotalSales(total);
        } else {
            setFilteredSales(salesData);
            const total = salesData.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            setTotalSales(total);
        }
    }, [dateFilter, salesData]);

    // Record a sale
    const recordSale = async () => {
        if (!selectedProduct) {
            alert('Please select a product');
            return;
        }
        
        if (sellingMethod === 'weight' && weight <= 0) {
            alert('Please enter a valid weight');
            return;
        }
        
        if (sellingMethod === 'amount' && !amount) {
            alert('Please enter a valid amount');
            return;
        }
        
        setLoadingSales(true);
        try {
            const selectedItem = inventory.find(item => item.id === parseInt(selectedProduct));
            if (!selectedItem) {
                throw new Error('Selected product not found');
            }
            
            const pricePerKg = parseFloat(selectedItem.price_per_kg || selectedItem.selling_price || 0);
            let saleWeight, saleTotal;
            
            if (sellingMethod === 'weight') {
                saleWeight = parseFloat(weight);
                saleTotal = saleWeight * pricePerKg;
            } else {
                saleTotal = parseFloat(amount);
                saleWeight = saleTotal / pricePerKg;
            }
            
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                throw new Error("User not authenticated. Please log in to record sales.");
            }
            
            const { error: salesError } = await supabase
                .from('sales')
                .insert([{
                    item_id: selectedItem.id,
                    price: pricePerKg,
                    total: saleTotal,
                    quantity: saleWeight,
                    payment_method: 'cash' // Default payment method for quick sales
                }]);

            if (salesError) throw salesError;
            
            alert('Sale recorded successfully!');
            
            // Reset form
            setSelectedProduct('');
            setWeight(0.01);
            setAmount('');
            
            // Refresh sales data
            fetchSalesData();
        } catch (err) {
            console.error("Error recording sale:", err);
            setError("Failed to record sale: " + err.message);
            alert("Failed to record sale. Please try again.");
        } finally {
            setLoadingSales(false);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        if (filteredSales.length === 0) {
            alert('No data to export');
            return;
        }
        
        const headers = ['ID', 'Product', 'Weight (kg)', 'Price (KSh)', 'Total (KSh)', 'Date'];
        const csvContent = [
            headers.join(','),
            ...filteredSales.map(sale => [
                sale.id,
                sale.inventory?.name || getProductName(sale.item_id),
                (sale.quantity || 1).toFixed(2),
                sale.price.toFixed(2),
                sale.total.toFixed(2),
                new Date(sale.created_at).toLocaleDateString()
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'sales_data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export to PDF (placeholder)
    const exportToPDF = () => {
        alert('PDF export functionality would be implemented here using a library like jsPDF');
    };

    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            // Fetch sales data with inventory details joined
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    inventory:item_id (name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Group sales by employee_id and date
            const groupedTransactions = {};
            (data || []).forEach(sale => {
                const dateKey = new Date(sale.created_at).toISOString().split('T')[0];
                const customerKey = `${dateKey}_${sale.id}_${Math.floor(new Date(sale.created_at).getTime() / 60000)}`;
                
                if (!groupedTransactions[customerKey]) {
                    groupedTransactions[customerKey] = {
                        id: customerKey,
                        customer_name: `Sale #${sale.id}`,
                        created_at: sale.created_at,
                        order_items: [],
                        total_amount: 0,
                        payment_method: sale.payment_method || 'cash'
                    };
                }
                
                // Get item name from joined data
                const itemName = sale.inventory?.name || getProductName(sale.item_id);
                
                groupedTransactions[customerKey].order_items.push({
                    name: itemName,
                    quantity: sale.quantity || 1,
                    price: sale.price,
                    total: sale.total
                });
                groupedTransactions[customerKey].total_amount += parseFloat(sale.total || 0);
            });

            setTransactions(Object.values(groupedTransactions));
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError('Error fetching transactions: ' + err.message);
        } finally {
            setLoadingTransactions(false);
        }
    };

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            // Fetch sales data with inventory details joined
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    inventory:item_id (name)
                `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            
            const mockOrders = (data || []).map(sale => ({
                id: sale.id,
                customer_name: `Sale #${sale.id}`,
                created_at: sale.created_at,
                total_amount: parseFloat(sale.total || 0),
                status: 'delivered',
                payment_method: sale.payment_method || 'cash',
                order_items: [{
                    name: sale.inventory?.name || getProductName(sale.item_id),
                    quantity: sale.quantity || 1,
                    total: sale.total
                }]
            }));

            setOrders(mockOrders);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setError('Error fetching orders: ' + err.message);
        } finally {
            setLoadingOrders(false);
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        alert(`Order #${orderId} status would be updated to ${newStatus}. This requires an orders table to implement properly.`);
    };

    useEffect(() => {
        if (activeTab === 'salesTransactions') {
            fetchSalesData();
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
            unit: 'kg',
            selling_method: orderSellingMethod
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

        // Reset form
        setCurrentOrderItem('');
        setCurrentOrderWeight(0.01);
        setTargetAmount('');
        setCalculatedWeight(0);
        setOrderSellingMethod('weight');
        setUseScale(false);
    };

    const removeItemFromOrder = (indexToRemove) => {
        setOrderItems(prevItems => prevItems.filter((_, index) => index !== indexToRemove));
    };

    const orderTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

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

    const isPaymentSufficient = amountPaid && parseFloat(amountPaid) >= orderTotal;

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
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                throw new Error("User not authenticated. Please log in to place orders.");
            }

            // Insert each item as a separate sale record
            const salesRecords = orderItems.map(item => ({
                price: item.price_per_kg,
                total: item.total_price,
                item_id: item.id,
                quantity: item.weight,
                payment_method: paymentMethod
            }));

            const { error: salesError } = await supabase
                .from('sales')
                .insert(salesRecords);

            if (salesError) {
                throw salesError;
            }

            // Update inventory quantities
            for (const item of orderItems) {
                const inventoryItem = inventory.find(i => i.id === item.id);
                if (inventoryItem) {
                    const newQuantity = inventoryItem.quantity - item.weight;
                    await supabase
                        .from('inventory')
                        .update({ quantity: newQuantity })
                        .eq('id', item.id);
                }
            }

            const successMessage = `Order placed successfully!\nCustomer: ${customerName}\nTotal: KSh ${orderTotal.toFixed(2)}\nPaid: KSh ${parseFloat(amountPaid).toFixed(2)}\nChange: KSh ${change.toFixed(2)}`;
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
            setTargetAmount('');
            setCalculatedWeight(0);
            setOrderSellingMethod('weight');
            setUseScale(false);

            // Re-fetch inventory
            const { data: updatedInventoryData, error: updatedInventoryError } = await supabase
                .from('inventory')
                .select('*');

            if (updatedInventoryError) {
                console.error("Failed to re-fetch inventory:", updatedInventoryError);
            } else {
                const parsedUpdatedInventory = (updatedInventoryData || []).map(item => ({
                    ...item,
                    name: item.name || `Product ${item.id}`,
                    quantity: item.quantity || 0,
                    selling_price: parseFloat(item.selling_price || 0),
                    price_per_kg: parseFloat(item.selling_price || 0),
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

    const captureWeightFromScale = () => {
        if (scaleConnected && scaleReading > 0) {
            setUseScale(true);
            if (orderSellingMethod === 'weight') {
                setCurrentOrderWeight(scaleReading);
            }
            alert(`Weight captured: ${scaleReading.toFixed(3)} kg`);
        } else {
            alert('Weighing scale is not connected or no weight detected. Please check the scale and try again.');
        }
    };

    return (
        <Layout>
            <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Sales Management</h1>

                {/* Tab Navigation - Reordered as requested */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'salesTransactions' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('salesTransactions')}
                    >
                        Sales Transactions
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'orderManagement' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('orderManagement')}
                    >
                        Order Management
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'newOrder' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('newOrder')}
                    >
                        New Order
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'salesTransactions' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-6">Sales Transactions</h2>
                        
                        {/* Sale Recording Form */}
                        <div className="bg-gray-50 p-4 rounded-lg mb-6">
                            <h3 className="text-lg font-medium text-gray-700 mb-4">Record Sale</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
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
                                            <span>By Weight (kg)</span>
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
                                            <span>By Amount (KSh)</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <div>
                                    <label htmlFor="selectedProduct" className="block text-sm font-medium text-gray-700 mb-2">Select Meat Product</label>
                                    <select
                                        id="selectedProduct"
                                        className="w-full p-2 border border-gray-300 rounded-md"
                                        value={selectedProduct}
                                        onChange={(e) => setSelectedProduct(e.target.value)}
                                    >
                                        <option value="">Choose a Meat Product</option>
                                        {inventory.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} - KSh {parseFloat(item.price_per_kg || item.selling_price || 0).toFixed(2)}/kg
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                {sellingMethod === 'weight' ? (
                                    <div>
                                        <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
                                        <input
                                            id="weight"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            className="w-full p-2 border border-gray-300 rounded-md"
                                            value={weight}
                                            onChange={(e) => setWeight(parseFloat(e.target.value) || 0.01)}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">Amount (KSh)</label>
                                        <input
                                            id="amount"
                                            type="number"
                                            min="1"
                                            step="1"
                                            className="w-full p-2 border border-gray-300 rounded-md"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                        />
                                    </div>
                                )}
                                
                                <div className="flex items-end">
                                    <button
                                        onClick={recordSale}
                                        disabled={loadingSales}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md w-full"
                                    >
                                        {loadingSales ? 'Recording...' : 'Record Sale'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Export and Filter Controls */}
                        <div className="flex flex-wrap justify-between items-center mb-6 bg-blue-50 p-4 rounded-lg">
                            <div className="flex space-x-2 mb-2 sm:mb-0">
                                <button
                                    onClick={exportToCSV}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
                                >
                                    Export CSV
                                </button>
                                <button
                                    onClick={exportToPDF}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                                >
                                    Export PDF
                                </button>
                            </div>
                            
                            <div className="flex space-x-2">
                                <div>
                                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        id="startDate"
                                        className="p-2 border border-gray-300 rounded-md"
                                        value={dateFilter.start}
                                        onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        id="endDate"
                                        className="p-2 border border-gray-300 rounded-md"
                                        value={dateFilter.end}
                                        onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Total Sales Display */}
                        <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                            <h3 className="text-lg font-medium text-gray-700 mb-2">Sales Summary</h3>
                            <div className="text-2xl font-bold text-green-700">
                                Total Sales: KSh {totalSales.toFixed(2)}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                {dateFilter.start && dateFilter.end 
                                    ? `From ${dateFilter.start} to ${dateFilter.end}`
                                    : 'All time sales'}
                            </p>
                        </div>
                        
                        {/* Sales Records Table */}
                        <div className="overflow-x-auto">
                            {loadingSales ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                                    <p className="mt-2 text-gray-600">Loading sales data...</p>
                                </div>
                            ) : filteredSales.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No sales records found
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (kg)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (KSh)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (KSh)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredSales.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    #{sale.id}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {sale.inventory?.name || getProductName(sale.item_id)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {(sale.quantity || 1).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {sale.price.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {sale.total.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(sale.created_at).toLocaleDateString()}
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
                            <p className="text-sm text-gray-600">Track and manage order statuses (Note: This is simulated using sales data)</p>
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
                                            Current Reading: {scaleReading.toFixed(3)} kg
                                        </span>
                                    )}
                                </div>
                                <div className="flex space-x-2 mt-2 sm:mt-0">
                                    {!scaleConnected ? (
                                        <button
                                            onClick={connectToScale}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                                        >
                                            Connect Scale
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={captureWeightFromScale}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                                            >
                                                Capture Weight
                                            </button>
                                            <button
                                                onClick={disconnectScale}
                                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                                            >
                                                Disconnect
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {scaleError && (
                                <div className="mt-2 text-red-600 text-sm">
                                    {scaleError}
                                </div>
                            )}
                        </div>

                        {loading && (
                            <div className="text-center text-indigo-600 text-lg">Loading inventory...</div>
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
                                <span className="block sm:inline"> Order placed successfully!</span>
                            </div>
                        )}

                        {!loading && (
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
                                            <option value="pickup">Pickup</option>
                                            <option value="delivery">Delivery</option>
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
                                            <option value="cash">Cash</option>
                                            <option value="mpesa">M-Pesa</option>
                                            <option value="card">Card</option>
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
                                            placeholder="Any special instructions..."
                                        />
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="space-y-5 p-4 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-xl font-medium text-gray-700 border-b pb-2 mb-4">Order Items</h3>

                                    {/* Selling Method Selection */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Selling Method</label>
                                        <div className="flex space-x-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="orderSellingMethod"
                                                    value="weight"
                                                    checked={orderSellingMethod === 'weight'}
                                                    onChange={(e) => setOrderSellingMethod(e.target.value)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">By Weight (kg)</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="orderSellingMethod"
                                                    value="amount"
                                                    checked={orderSellingMethod === 'amount'}
                                                    onChange={(e) => setOrderSellingMethod(e.target.value)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">By Amount (KSh)</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
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

                                        {/* Dynamic input based on selling method */}
                                        {orderSellingMethod === 'weight' ? (
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
                                        {orderSellingMethod === 'amount' && currentOrderItem && targetAmount && (
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
                                    </div>

                                    {/* Items List */}
                                    <div className="border border-gray-300 rounded-lg divide-y divide-gray-200 min-h-[150px] max-h-[300px] overflow-y-auto">
                                        {orderItems.length === 0 ? (
                                            <div className="p-6 text-center text-gray-500">No items added to this order yet.</div>
                                        ) : (
                                            orderItems.map((item, index) => (
                                                <div key={index} className="p-4 flex justify-between items-center bg-white hover:bg-gray-50">
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {item.name}
                                                            {item.selling_method === 'amount' && (
                                                                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                                    By Amount
                                                                </span>
                                                            )}
                                                        </div>
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
                                            {loading ? 'Processing Order...' : 'Place Order'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Sales;