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

  // Sales form
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');

  // Order form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [currentOrderItem, setCurrentOrderItem] = useState('');
  const [currentOrderQty, setCurrentOrderQty] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderType, setOrderType] = useState('pickup');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  const [editingSaleId, setEditingSaleId] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
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
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
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
    const { new: newSale, old } = payload;
    if (payload.eventType === 'INSERT') {
      setSales(prev => [newSale, ...prev]);
    } else if (payload.eventType === 'UPDATE') {
      setSales(prev => prev.map(sale => sale.id === newSale.id ? newSale : sale));
    } else if (payload.eventType === 'DELETE') {
      setSales(prev => prev.filter(sale => sale.id !== old.id));
    }
  };

  const handleOrdersChange = (payload) => {
    const { new: newOrder, old } = payload;
    if (payload.eventType === 'INSERT') {
      setOrders(prev => [newOrder, ...prev]);
    } else if (payload.eventType === 'UPDATE') {
      setOrders(prev => prev.map(order => order.id === newOrder.id ? newOrder : order));
    } else if (payload.eventType === 'DELETE') {
      setOrders(prev => prev.filter(order => order.id !== old.id));
    }
  };

  const formatDate = (str) => new Date(str).toLocaleString('en-KE');

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setOrderStatusFilter('all');
    setPaymentFilter('all');
    setItemSearch('');
  };
  // ================= SALES FUNCTIONS =================
  const handleAddSale = async () => {
    if (!selectedItem || !quantity) return alert('Select item and quantity.');
    const item = inventory.find(inv => inv.id === Number(selectedItem));
    if (!item) return alert('Item not found.');

    const qty = parseInt(quantity, 10);
    if (qty <= 0) return alert('Quantity must be greater than zero.');
    if (item.quantity < qty) return alert('Not enough stock!');

    const total = item.selling_price * qty;

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity - qty })
      .eq('id', item.id);

    if (updateError) return alert('Failed to update stock.');

    const { error: insertError } = await supabase.from('sales').insert([{
      item_id: item.id,
      item_name: item.name,
      quantity: qty,
      price: item.selling_price,
      total,
      payment_method: paymentMethod,
    }]);

    if (insertError) {
      await supabase.from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      alert('Failed to add sale.');
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

    const { error: updateInvError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity - qtyDiff })
      .eq('id', item.id);

    if (updateInvError) return alert('Failed to update stock.');

    const newTotal = sale.price * newQty;
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({ quantity: newQty, total: newTotal })
      .eq('id', sale.id);

    if (updateSaleError) {
      await supabase.from('inventory')
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

    const { error: updateInvError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity + sale.quantity })
      .eq('id', item.id);

    if (updateInvError) return alert('Failed to restore stock.');

    const { error: deleteError } = await supabase
      .from('sales')
      .delete()
      .eq('id', sale.id);

    if (deleteError) {
      await supabase.from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      return alert('Failed to delete sale.');
    }
  };

  // ================= ORDER FUNCTIONS =================
  const addItemToOrder = () => {
    if (!currentOrderItem) return alert('Select an item.');
    const item = inventory.find(inv => inv.id === Number(currentOrderItem));
    if (!item) return alert('Item not found.');

    setOrderItems([...orderItems, {
      id: item.id,
      name: item.name,
      price: item.selling_price,
      quantity: parseInt(currentOrderQty),
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
    if (!customerName) return alert('Customer name is required.');
    if (orderItems.length === 0) return alert('Add at least one item.');

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const { error } = await supabase.from('orders').insert([{
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      items: orderItems,
      total_amount: totalAmount,
      status: 'pending',
      order_type: orderType,
      payment_method: paymentMethod,
      notes: orderNotes,
    }]);

    if (error) {
      alert('Failed to place order: ' + error.message);
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
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

    for (const item of order.items) {
      await supabase.from('sales').insert([{
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        payment_method: order.payment_method,
        order_id: order.id,
      }]);
    }

    await updateOrderStatus(order.id, 'completed');
  };

  // ================= FILTERING =================
  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.created_at);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && saleDate < start) return false;
    if (end && saleDate > end) return false;
    if (paymentFilter !== 'all' && sale.payment_method !== paymentFilter) return false;
    if (itemSearch && !sale.item_name.toLowerCase().includes(itemSearch.toLowerCase())) return false;

    return true;
  });

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && orderDate < start) return false;
    if (end && orderDate > end) return false;
    if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) return false;
    return true;
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

  const calculateSalesTotal = () =>
    filteredSales.reduce((sum, s) => sum + s.total, 0);

  const calculateOrdersTotal = () =>
    filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Sales & Orders</h1>

        {/* === Tab Navigation === */}
        <div className="flex mb-6 border-b">
          {['sales', 'orders', 'newOrder'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t ${
                activeTab === tab
                  ? 'bg-white border-t border-l border-r border-gray-300'
                  : 'bg-gray-200'
              }`}
            >
              {tab === 'sales'
                ? 'Sales Transactions'
                : tab === 'orders'
                ? 'Orders Management'
                : 'New Order'}
            </button>
          ))}
        </div>

        {/* === Filters === */}
        <div className="flex flex-wrap gap-3 mb-6">
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
          {activeTab === 'sales' && (
            <>
              <select
                className="border px-3 py-2 rounded"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="all">All Payment Types</option>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
              </select>
              <input
                type="text"
                placeholder="Search by item name"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="border px-3 py-2 rounded"
              />
            </>
          )}
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
              setPaymentFilter('all');
              setOrderStatusFilter('all');
              setItemSearch('');
            }}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Reset Filters
          </button>
        </div>

        {/* === Summary Banner === */}
        {(activeTab === 'sales' || activeTab === 'orders') && (
          <div className="bg-white mb-4 p-4 rounded shadow-md flex items-center justify-between flex-wrap gap-4">
            {activeTab === 'sales' ? (
              <h2 className="text-lg font-semibold text-green-700">
                Total Sales: KSh {calculateSalesTotal().toLocaleString()}
              </h2>
            ) : (
              <h2 className="text-lg font-semibold text-indigo-700">
                Total Order Revenue: KSh {calculateOrdersTotal().toLocaleString()}
              </h2>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => exportToCSV(
                  (activeTab === 'sales' ? filteredSales : filteredOrders).map(item => ({
                    ...item,
                    Date: new Date(item.created_at).toLocaleString()
                  })),
                  activeTab === 'sales' ? 'sales.csv' : 'orders.csv'
                )}
                className="bg-green-600 text-white px-3 py-2 rounded"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportToPDF(
                  (activeTab === 'sales' ? filteredSales : filteredOrders).map(item => ({
                    ...item,
                    Date: new Date(item.created_at).toLocaleString()
                  })),
                  activeTab === 'sales' ? 'Sales Report' : 'Orders Report',
                  activeTab === 'sales' ? 'sales.pdf' : 'orders.pdf'
                )}
                className="bg-blue-600 text-white px-3 py-2 rounded"
              >
                Export PDF
              </button>
            </div>
          </div>
        )}

        {/* === Tab Content === */}
        {activeTab === 'sales' && (
          <SalesTable
            sales={filteredSales}
            loading={loading}
            inventory={inventory}
            selectedItem={selectedItem}
            quantity={quantity}
            onAddSale={handleAddSale}
            onChangeItem={setSelectedItem}
            onChangeQty={setQuantity}
            editingSaleId={editingSaleId}
            editQuantity={editQuantity}
            onStartEdit={startEditSale}
            onSaveEdit={saveEditSale}
            onCancelEdit={cancelEditSale}
            onDelete={deleteSale}
            onChangeEditQty={setEditQuantity}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTable
            orders={filteredOrders}
            loading={loading}
            onUpdateStatus={updateOrderStatus}
            onComplete={completeOrder}
          />
        )}

        {activeTab === 'newOrder' && (
          <NewOrderForm
            inventory={inventory}
            customerName={customerName}
            customerPhone={customerPhone}
            customerEmail={customerEmail}
            orderType={orderType}
            paymentMethod={paymentMethod}
            orderNotes={orderNotes}
            currentOrderItem={currentOrderItem}
            currentOrderQty={currentOrderQty}
            orderItems={orderItems}
            setCustomerName={setCustomerName}
            setCustomerPhone={setCustomerPhone}
            setCustomerEmail={setCustomerEmail}
            setOrderType={setOrderType}
            setPaymentMethod={setPaymentMethod}
            setOrderNotes={setOrderNotes}
            setCurrentOrderItem={setCurrentOrderItem}
            setCurrentOrderQty={setCurrentOrderQty}
            addItemToOrder={addItemToOrder}
            removeItemFromOrder={removeItemFromOrder}
            placeOrder={placeOrder}
          />
        )}
      </div>
    </Layout>
  );
};

export default Sales;
