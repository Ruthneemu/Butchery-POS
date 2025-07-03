import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Layout from "../components/layout";

const InventoryManagement = () => {
  // State for navigation between features
  const [activeTab, setActiveTab] = useState('stockAdjustment');
  
  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Inventory Management</h1>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('stockAdjustment')}
            className={`px-4 py-2 rounded-t ${activeTab === 'stockAdjustment' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            Stock Adjustment
          </button>
          <button
            onClick={() => setActiveTab('allAdjustments')}
            className={`px-4 py-2 rounded-t ${activeTab === 'allAdjustments' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            All Adjustments
          </button>
          <button
            onClick={() => setActiveTab('purchaseOrder')}
            className={`px-4 py-2 rounded-t ${activeTab === 'purchaseOrder' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            Purchase Order
          </button>
          <button
            onClick={() => setActiveTab('allOrders')}
            className={`px-4 py-2 rounded-t ${activeTab === 'allOrders' ? 'bg-white border-t border-l border-r border-gray-300' : 'bg-gray-200'}`}
          >
            All Orders
          </button>
        </div>

        {/* Render active component */}
        <div className="bg-white p-4 sm:p-6 rounded shadow">
          {activeTab === 'stockAdjustment' && <StockAdjustment />}
          {activeTab === 'allAdjustments' && <AllStockAdjustments />}
          {activeTab === 'purchaseOrder' && <PurchaseOrder />}
          {activeTab === 'allOrders' && <AllPurchaseOrders />}
        </div>
      </div>
    </Layout>
  );
};

// 1. Stock Adjustment Component
const StockAdjustment = () => {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('decrease');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) console.error('Error fetching products:', error);
      else setProducts(data || []);
    };
    fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!productId || !quantity || !reason) {
      setError('Please fill all fields');
      setLoading(false);
      return;
    }

    try {
      // 1. Record the adjustment
      const { error: adjustmentError } = await supabase
        .from('stock_adjustments')
        .insert([{
          product_id: productId,
          adjustment_type: adjustmentType,
          quantity: parseFloat(quantity),
          reason,
          adjusted_by: 'admin' // Replace with actual user from auth
        }]);

      if (adjustmentError) throw adjustmentError;

      // 2. Update the product quantity
      const { data: product } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', productId)
        .single();

      const newQuantity = adjustmentType === 'increase' 
        ? product.quantity + parseFloat(quantity)
        : product.quantity - parseFloat(quantity);

      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Reset form
      setProductId('');
      setQuantity('');
      setReason('');
      alert('Stock adjusted successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Stock Adjustment</h2>
      {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Product</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} (Current: {product.quantity} {product.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Adjustment Type</label>
          <select
            value={adjustmentType}
            onChange={(e) => setAdjustmentType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="increase">Increase Stock</option>
            <option value="decrease">Decrease Stock</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Quantity</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Reason</option>
            <option value="spoilage">Spoilage</option>
            <option value="theft">Theft</option>
            <option value="counting_error">Counting Error</option>
            <option value="other">Other</option>
          </select>
          {reason === 'other' && (
            <input
              type="text"
              placeholder="Specify reason"
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded mt-2"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          {loading ? 'Processing...' : 'Submit Adjustment'}
        </button>
      </form>
    </div>
  );
};

// 2. All Stock Adjustments Component
const AllStockAdjustments = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdjustments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('stock_adjustments')
          .select(`
            *,
            products(name, unit)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAdjustments(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAdjustments();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">All Stock Adjustments</h2>
      
      {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
      
      {loading ? (
        <p>Loading adjustments...</p>
      ) : adjustments.length === 0 ? (
        <p>No adjustments found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left border">Date</th>
                <th className="p-2 text-left border">Product</th>
                <th className="p-2 text-left border">Type</th>
                <th className="p-2 text-left border">Quantity</th>
                <th className="p-2 text-left border">Reason</th>
                <th className="p-2 text-left border">Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{new Date(adj.created_at).toLocaleString()}</td>
                  <td className="p-2 border">{adj.products?.name}</td>
                  <td className="p-2 border capitalize">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      adj.adjustment_type === 'increase' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {adj.adjustment_type}
                    </span>
                  </td>
                  <td className="p-2 border">
                    {adj.quantity} {adj.products?.unit}
                  </td>
                  <td className="p-2 border capitalize">{adj.reason}</td>
                  <td className="p-2 border">{adj.adjusted_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// 3. Purchase Order Component
const PurchaseOrder = () => {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: products }, { data: suppliers }] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('suppliers').select('*')
      ]);
      setProducts(products || []);
      setSuppliers(suppliers || []);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!productId || !supplierId || !quantity || !unitPrice) {
      setError('Please fill all required fields');
      setLoading(false);
      return;
    }

    try {
      const totalCost = parseFloat(quantity) * parseFloat(unitPrice);
      
      const { error } = await supabase
        .from('purchase_orders')
        .insert([{
          product_id: productId,
          supplier_id: supplierId,
          quantity: parseFloat(quantity),
          unit_price: parseFloat(unitPrice),
          total_cost: totalCost,
          expected_delivery: expectedDelivery,
          notes,
          status: 'pending',
          ordered_by: 'admin' // Replace with actual user from auth
        }]);

      if (error) throw error;

      // Reset form
      setProductId('');
      setSupplierId('');
      setQuantity('');
      setUnitPrice('');
      setExpectedDelivery('');
      setNotes('');
      alert('Purchase order created successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Create Purchase Order</h2>
      {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Supplier*</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select Supplier</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.contact_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">Product*</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select Product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-1 font-medium">Quantity*</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Unit Price (KSh)*</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Total Cost (KSh)</label>
            <input
              type="text"
              value={quantity && unitPrice ? (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2) : '0.00'}
              className="w-full p-2 border rounded bg-gray-100"
              readOnly
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Expected Delivery</label>
            <input
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border rounded"
              rows="1"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          {loading ? 'Processing...' : 'Create Purchase Order'}
        </button>
      </form>
    </div>
  );
};

// 4. All Purchase Orders Component
const AllPurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select(`
            *,
            products(name, unit),
            suppliers(name)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Refresh orders
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">All Purchase Orders</h2>
      
      {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
      
      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No purchase orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left border">Date</th>
                <th className="p-2 text-left border">Supplier</th>
                <th className="p-2 text-left border">Product</th>
                <th className="p-2 text-left border">Quantity</th>
                <th className="p-2 text-left border">Unit Price</th>
                <th className="p-2 text-left border">Total Cost</th>
                <th className="p-2 text-left border">Status</th>
                <th className="p-2 text-left border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-2 border">{order.suppliers?.name}</td>
                  <td className="p-2 border">{order.products?.name}</td>
                  <td className="p-2 border">
                    {order.quantity} {order.products?.unit}
                  </td>
                  <td className="p-2 border">KSh {order.unit_price?.toFixed(2)}</td>
                  <td className="p-2 border">KSh {order.total_cost?.toFixed(2)}</td>
                  <td className="p-2 border">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      order.status === 'received' 
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-2 border space-x-1">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'received')}
                          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Received
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Cancel
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
  );
};

export default InventoryManagement;