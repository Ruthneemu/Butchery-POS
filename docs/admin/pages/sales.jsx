import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import Layout from "../components/layout";

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sales form state
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');

  // Order form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [currentOrderItem, setCurrentOrderItem] = useState('');
  const [currentOrderQty, setCurrentOrderQty] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderType, setOrderType] = useState('pickup');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // For editing
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState('sales');

  useEffect(() => {
    fetchAllData();

    const salesSubscription = supabase
      .channel('public:sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, handleSalesChange)
      .subscribe();

    const ordersSubscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleOrdersChange)
      .subscribe();

    return () => {
      supabase.removeChannel(salesSubscription);
      supabase.removeChannel(ordersSubscription);
    };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [{ data: salesData }, { data: inventoryData }, { data: ordersData }] = await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('id, name, selling_price, quantity'),
        supabase.from('orders').select('*').order('created_at', { ascending: false })
      ]);
      
      setSales(salesData || []);
      setInventory(inventoryData || []);
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleSalesChange = (payload) => {
    if (payload.eventType === 'INSERT') {
      setSales(prev => [payload.new, ...prev]);
    } else if (payload.eventType === 'UPDATE') {
      setSales(prev => prev.map(sale => sale.id === payload.new.id ? payload.new : sale));
    } else if (payload.eventType === 'DELETE') {
      setSales(prev => prev.filter(sale => sale.id !== payload.old.id));
    }
  };

  const handleOrdersChange = (payload) => {
    if (payload.eventType === 'INSERT') {
      setOrders(prev => [payload.new, ...prev]);
    } else if (payload.eventType === 'UPDATE') {
      setOrders(prev => prev.map(order => order.id === payload.new.id ? payload.new : order));
    } else if (payload.eventType === 'DELETE') {
      setOrders(prev => prev.filter(order => order.id !== payload.old.id));
    }
  };

  // ========== SALES FUNCTIONS ==========
  const handleAddSale = async () => {
  if (!selectedItem || !quantity) return alert('Select item and quantity.');

  const item = inventory.find(inv => inv.id === Number(selectedItem));
  if (!item) return alert('Item not found.');

  let qty;
  const enteredValue = quantity.trim();

  // Detect if entered is price-like e.g. "500" without units
  if (enteredValue.includes('.') || Number(enteredValue) >= item.selling_price) {
    // Calculate quantity from amount
    const amount = parseFloat(enteredValue);
    qty = Math.floor(amount / item.selling_price);

    if (qty <= 0) return alert('Amount too low for selected item.');
    if (item.quantity < qty) return alert('Not enough stock for requested amount.');
  } else {
    // Treat as normal quantity
    qty = parseInt(enteredValue, 10);
    if (qty <= 0) return alert('Quantity must be greater than zero.');
    if (item.quantity < qty) return alert('Not enough stock!');
  }

  const total = item.selling_price * qty;

  // Update inventory
  const { error: updateError } = await supabase
    .from('inventory')
    .update({ quantity: item.quantity - qty })
    .eq('id', item.id);
  if (updateError) return alert('Failed to update stock.');

  // Record sale
  const { error: insertError } = await supabase.from('sales').insert([{
    item_id: item.id,
    item_name: item.name,
    quantity: qty,
    price: item.selling_price,
    total,
    payment_method: 'cash'
  }]);

  if (insertError) {
    alert('Failed to add sale.');
    // Revert stock update
    await supabase
      .from('inventory')
      .update({ quantity: item.quantity })
      .eq('id', item.id);
  } else {
    setSelectedItem('');
    setQuantity('');
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

  const saveEditSale = async (sale) => {
    const newQty = parseInt(editQuantity, 10);
    if (newQty <= 0) return alert('Quantity must be greater than zero.');

    const item = inventory.find(inv => inv.id === sale.item_id);
    if (!item) return alert('Item not found.');

    const qtyDiff = newQty - sale.quantity;

    if (qtyDiff > 0 && item.quantity < qtyDiff) {
      return alert('Not enough stock to increase quantity.');
    }

    // Update inventory
    const { error: updateInvError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity - qtyDiff })
      .eq('id', item.id);
    if (updateInvError) return alert('Failed to update stock.');

    // Update sale
    const newTotal = sale.price * newQty;
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({ quantity: newQty, total: newTotal })
      .eq('id', sale.id);
    if (updateSaleError) {
      await supabase
        .from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      return alert('Failed to update sale.');
    }

    cancelEditSale();
  };

  const deleteSale = async (sale) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) return;

    const item = inventory.find(inv => inv.id === sale.item_id);
    if (!item) return alert('Item not found.');

    // Restore stock
    const { error: updateInvError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity + sale.quantity })
      .eq('id', item.id);
    if (updateInvError) return alert('Failed to restore stock.');

    // Delete sale
    const { error: deleteError } = await supabase.from('sales').delete().eq('id', sale.id);
    if (deleteError) {
      await supabase
        .from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      return alert('Failed to delete sale.');
    }
  };

  // ========== ORDER FUNCTIONS ==========
  const addItemToOrder = () => {
    if (!currentOrderItem) return alert('Select an item');
    const item = inventory.find(inv => inv.id === Number(currentOrderItem));
    if (!item) return alert('Item not found');

    setOrderItems([...orderItems, {
      id: item.id,
      name: item.name,
      price: item.selling_price,
      quantity: currentOrderQty
    }]);
    setCurrentOrderItem('');
    setCurrentOrderQty(1);
  };

  const removeItemFromOrder = (index) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const placeOrder = async () => {
    if (!customerName) return alert('Customer name is required');
    if (orderItems.length === 0) return alert('Add at least one item');

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

    if (error) {
      alert('Failed to place order: ' + error.message);
    } else {
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setOrderItems([]);
      setOrderNotes('');
      alert('Order placed successfully!');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Failed to update order status: ' + error.message);
    }
  };

  const completeOrder = async (order) => {
    // First update inventory for each item
    for (const item of order.items) {
      const { data: inventoryItem } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('id', item.id)
        .single();

      if (inventoryItem) {
        const newQuantity = inventoryItem.quantity - item.quantity;
        await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', item.id);
      }
    }

    // Then record the sale
    for (const item of order.items) {
      await supabase.from('sales').insert([{
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        payment_method: order.payment_method,
        order_id: order.id
      }]);
    }

    // Finally update order status
    await updateOrderStatus(order.id, 'completed');
  };

  // ========== FILTERS & EXPORTS ==========
  const filteredSales = sales.filter(sale => {
    if (!startDate || !endDate) return true;
    const saleDate = new Date(sale.created_at);
    return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
  });

  const filteredOrders = orders.filter(order => {
    if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) return false;
    if (!startDate || !endDate) return true;
    const orderDate = new Date(order.created_at);
    return orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
  });

  const exportToCSV = (data, fileName) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = (data, title, fileName) => {
    const doc = new jsPDF();
    doc.text(title, 14, 16);
    doc.autoTable({
      head: [Object.keys(data[0])],
      body: data.map(item => Object.values(item)),
      startY: 20,
    });
    doc.save(fileName);
  };

  // ========== RENDER ==========
  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Sales & Orders</h1>

        {/* Navigation Tabs */}
        <div className="flex mb-6 border-b">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-t ${activeTab === 'sales' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            Sales Transactions
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-t ${activeTab === 'orders' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            Orders Management
          </button>
          <button
            onClick={() => setActiveTab('newOrder')}
            className={`px-4 py-2 rounded-t ${activeTab === 'newOrder' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            New Order
          </button>
        </div>

        {/* Date Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="date"
            className="border px-3 py-2 rounded"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="border px-3 py-2 rounded"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {activeTab === 'orders' && (
            <select
              className="border px-3 py-2 rounded"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
            </select>
          )}
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setOrderStatusFilter('all');
            }}
            className="bg-gray-500 text-white px-3 py-2 rounded"
          >
            Reset Filters
          </button>
        </div>

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <div className="bg-white rounded shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Sales Transactions</h2>
              <div className="flex gap-2">
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
                    'sales.csv'
                  )}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Export CSV
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
                    'sales.pdf'
                  )}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Export PDF
                </button>
              </div>
            </div>

            {/* Quick Sale Form */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded">
              <select
                className="flex-grow px-4 py-2 border rounded"
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
              >
                <option value="">Select Item</option>
                {inventory.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} - KSh {item.selling_price} ({item.quantity} in stock)
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Quantity"
                className="w-24 px-4 py-2 border rounded"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
              <button
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                onClick={handleAddSale}
              >
                Record Sale
              </button>
            </div>

            {/* Sales Table */}
            {loading ? (
              <p>Loading sales...</p>
            ) : filteredSales.length === 0 ? (
              <p>No sales found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-700 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                      <th className="px-4 py-2 text-left">Price</th>
                      <th className="px-4 py-2 text-left">Total</th>
                      <th className="px-4 py-2 text-left">Payment</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale, index) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{index + 1}</td>
                        <td className="px-4 py-2">{sale.item_name}</td>
                        <td className="px-4 py-2">
                          {editingSaleId === sale.id ? (
                            <input
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 px-1 py-0.5 border rounded"
                            />
                          ) : (
                            sale.quantity
                          )}
                        </td>
                        <td className="px-4 py-2">KSh {sale.price}</td>
                        <td className="px-4 py-2 font-semibold">KSh {sale.total}</td>
                        <td className="px-4 py-2 capitalize">{sale.payment_method}</td>
                        <td className="px-4 py-2">{new Date(sale.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 space-x-2">
                          {editingSaleId === sale.id ? (
                            <>
                              <button
                                onClick={() => saveEditSale(sale)}
                                className="bg-green-600 text-white px-2 py-1 rounded text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditSale}
                                className="bg-gray-500 text-white px-2 py-1 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditSale(sale)}
                                className="bg-yellow-500 text-white px-2 py-1 rounded text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteSale(sale)}
                                className="bg-red-600 text-white px-2 py-1 rounded text-sm"
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
          <div className="bg-white rounded shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Orders Management</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportToCSV(
                    filteredOrders.map(o => ({
                      ID: o.id,
                      Customer: o.customer_name,
                      Phone: o.customer_phone,
                      Items: o.items.map(i => `${i.name} (${i.quantity})`).join(', '),
                      Total: o.total_amount,
                      Status: o.status,
                      Type: o.order_type,
                      Payment: o.payment_method,
                      Date: new Date(o.created_at).toLocaleString()
                    })),
                    'orders.csv'
                  )}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Export CSV
                </button>
                <button 
                  onClick={() => exportToPDF(
                    filteredOrders.map(o => ({
                      ID: o.id,
                      Customer: o.customer_name,
                      Phone: o.customer_phone,
                      Items: o.items.map(i => `${i.name} (${i.quantity})`).join(', '),
                      Total: o.total_amount,
                      Status: o.status,
                      Type: o.order_type,
                      Payment: o.payment_method,
                      Date: new Date(o.created_at).toLocaleString()
                    })),
                    'Orders Report',
                    'orders.pdf'
                  )}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Export PDF
                </button>
              </div>
            </div>

            {/* Orders Table */}
            {loading ? (
              <p>Loading orders...</p>
            ) : filteredOrders.length === 0 ? (
              <p>No orders found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-700 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Items</th>
                      <th className="px-4 py-2 text-left">Total</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, index) => (
                      <tr key={order.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{index + 1}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-sm text-gray-600">{order.customer_phone}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {order.items.map((item, i) => (
                              <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                                {item.name} ({item.quantity})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 font-semibold">KSh {order.total_amount}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs capitalize ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 capitalize">{order.order_type}</td>
                        <td className="px-4 py-2">{new Date(order.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 space-x-1">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'preparing')}
                              className="bg-yellow-500 text-white px-2 py-1 rounded text-sm"
                            >
                              Start Prep
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'ready')}
                              className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button
                              onClick={() => completeOrder(order)}
                              className="bg-green-600 text-white px-2 py-1 rounded text-sm"
                            >
                              Complete
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
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-xl font-semibold mb-4">New Order</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <div className="space-y-4">
                <h3 className="font-medium">Customer Information</h3>
                <div>
                  <label className="block mb-1">Name *</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">Order Type</label>
                  <select
                    className="w-full p-2 border rounded"
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Payment Method</label>
                  <select
                    className="w-full p-2 border rounded"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Notes</label>
                  <textarea
                    className="w-full p-2 border rounded"
                    rows="3"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h3 className="font-medium">Order Items</h3>
                
                <div className="flex gap-2">
                  <select
                    className="flex-grow p-2 border rounded"
                    value={currentOrderItem}
                    onChange={(e) => setCurrentOrderItem(e.target.value)}
                  >
                    <option value="">Select Item</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} - KSh {item.selling_price}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    className="w-20 p-2 border rounded"
                    value={currentOrderQty}
                    onChange={(e) => setCurrentOrderQty(e.target.value)}
                  />
                  <button
                    onClick={addItemToOrder}
                    className="bg-indigo-600 text-white px-3 py-2 rounded"
                  >
                    Add
                  </button>
                </div>

                {/* Items List */}
                <div className="border rounded divide-y">
                  {orderItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No items added</div>
                  ) : (
                    orderItems.map((item, index) => (
                      <div key={index} className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-600">
                            {item.quantity} × KSh {item.price} = KSh {item.quantity * item.price}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItemFromOrder(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 p-4 rounded">
                  <div className="flex justify-between font-medium mb-2">
                    <span>Total:</span>
                    <span>
                      KSh {orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
                    </span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={orderItems.length === 0 || !customerName}
                    className={`w-full py-2 rounded text-white ${
                      orderItems.length === 0 || !customerName
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Place Order
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