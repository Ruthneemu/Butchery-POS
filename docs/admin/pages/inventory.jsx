import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";
import { CSVLink } from 'react-csv';
import { Chart } from 'chart.js/auto';
import html2canvas from 'html2canvas';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('kg');
  const [sellingPrice, setSellingPrice] = useState('');
  const [newImage, setNewImage] = useState(null);
  const [newVariant, setNewVariant] = useState('');
 

  // Bulk import states
  const [bulkData, setBulkData] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  
  // Editing states
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('kg');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editImage, setEditImage] = useState(null);
  

  // Stock Adjustment states
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [adjustmentProductId, setAdjustmentProductId] = useState(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('increase');

  // Purchase Order states
  const [showPurchaseOrder, setShowPurchaseOrder] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [newPurchaseOrder, setNewPurchaseOrder] = useState({
    supplier: '',
    items: [],
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    status: 'pending'
  });
  const [poItemProduct, setPoItemProduct] = useState('');
  const [poItemQuantity, setPoItemQuantity] = useState('');

  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [nearExpiryFilter, setNearExpiryFilter] = useState(false);
  const [stockTakeMode, setStockTakeMode] = useState(false);
  const [stockTakeCounts, setStockTakeCounts] = useState({});
  const [showInventoryChart, setShowInventoryChart] = useState(false);
  
  const chartRef = useRef();
  const chartInstance = useRef(null);

  // Fetch products from Supabase
  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (lowStockFilter) {
      query = query.lt('quantity', 5);
    }

    if (nearExpiryFilter) {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      query = query.lte('expiry_date', nextWeek.toISOString())
                  .gte('expiry_date', today.toISOString());
    }

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error.message);
    } else {
      setProducts(data);
      // Initialize stock take counts
      if (stockTakeMode) {
        const counts = {};
        data.forEach(product => {
          counts[product.id] = product.quantity;
        });
        setStockTakeCounts(counts);
      }
    }
    setLoading(false);
  };

  // Fetch purchase orders from Supabase
  const fetchPurchaseOrders = async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (error) {
      console.error('Error fetching purchase orders:', error.message);
    } else {
      setPurchaseOrders(data);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchPurchaseOrders();
    
    // Clean up chart on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [searchTerm, lowStockFilter, nearExpiryFilter]);

  // Initialize chart when showInventoryChart changes
  useEffect(() => {
    if (showInventoryChart && products.length > 0) {
      renderInventoryChart();
    } else if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
  }, [showInventoryChart, products]);

  // Upload image to Supabase storage
  const uploadImage = async (file, productId) => {
    if (!file) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${productId || 'temp'}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    
    const { data, error } = await supabase
      .storage
      .from('product-images')
      .upload(fileName, file);
    
    if (error) {
      console.error('Error uploading image:', error.message);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('product-images')
      .getPublicUrl(data.path);
    
    return publicUrl;
  };

  // Add new product
  const addProduct = async (e) => {
    e.preventDefault();
    setError('');

    if (!newName || !newQuantity || !newPrice) {
      setError('Please fill in required fields (Name, Quantity, Price)');
      return;
    }

    try {
      // First create the product to get an ID
      const { data: productData, error: productError } = await supabase
        .from('inventory')
        .insert([
          {
            name: newName,
            quantity: Number(newQuantity),
            expiry_date: newExpiry || null,
            price: Number(newPrice),
            unit: newUnit,
            selling_price: Number(sellingPrice) || Number(newPrice) * 1.2,
            
          },
        ])
        .select()
        .single();

      if (productError) throw productError;

      // Upload image if provided
      let imageUrl = null;
      if (newImage) {
        imageUrl = await uploadImage(newImage, productData.id);
        if (imageUrl) {
          // Update product with image URL
          await supabase
            .from('inventory')
            .update({ image_url: imageUrl })
            .eq('id', productData.id);
        }
      }

      // Reset form
      setNewName('');
      setNewQuantity('');
      setNewExpiry('');
      setNewPrice('');
      setNewUnit('kg');
      setSellingPrice('');
      setNewImage(null);
     
      setNewVariant('');

      fetchProducts();
    } catch (error) {
      setError(error.message);
    }
  };



  // Delete product
  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) {
      alert('Failed to delete: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  // Start editing product
  const startEditing = (product) => {
    setEditingProduct(product.id);
    setEditName(product.name);
    setEditQuantity(product.quantity);
    setEditExpiry(product.expiry_date?.slice(0, 10) || '');
    setEditPrice(product.price ?? '');
    setEditUnit(product.unit ?? 'kg');
    setEditSellingPrice(product.selling_price ?? '');
    
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingProduct(null);
    setEditName('');
    setEditQuantity('');
    setEditExpiry('');
    setEditUnit('kg');
    setEditSellingPrice('');
    setEditVariant('');
    setEditImage(null);
  };

  // Save edited product
  const saveEdit = async (id) => {
    if (!editName || !editQuantity || !editPrice) {
      alert('Please fill in required fields (Name, Quantity, Price)');
      return;
    }

    try {
      const updateData = {
        name: editName,
        quantity: Number(editQuantity),
        expiry_date: editExpiry || null,
        price: Number(editPrice),
        unit: editUnit,
        selling_price: Number(editSellingPrice) || Number(editPrice) * 1.2,
      };

      // Upload new image if provided
      if (editImage) {
        const imageUrl = await uploadImage(editImage, id);
        if (imageUrl) {
          updateData.image_url = imageUrl;
        }
      }

      const { error } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      cancelEditing();
      fetchProducts();
    } catch (error) {
      alert('Update failed: ' + error.message);
    }
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    try {
      const lines = bulkData.split('\n');
      const productsToImport = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const [name, quantity, price, unit = 'kg', expiry = null, sellingPrice = null] = line.split(',');
        
        productsToImport.push({
          name: name.trim(),
          quantity: Number(quantity.trim()),
          price: Number(price.trim()),
          unit: unit.trim(),
          expiry_date: expiry?.trim() || null,
          selling_price: sellingPrice ? Number(sellingPrice.trim()) : null
        });
      }
      
      const { error } = await supabase
        .from('inventory')
        .insert(productsToImport);
        
      if (error) throw error;
      
      setBulkData('');
      setShowBulkImport(false);
      fetchProducts();
      alert('Products imported successfully!');
    } catch (error) {
      setError('Bulk import failed: ' + error.message);
    }
  };

  // Stock take functions
  const startStockTake = () => {
    const counts = {};
    products.forEach(product => {
      counts[product.id] = product.quantity;
    });
    setStockTakeCounts(counts);
    setStockTakeMode(true);
  };

  const updateStockTakeCount = (id, value) => {
    setStockTakeCounts(prev => ({
      ...prev,
      [id]: Number(value)
    }));
  };

  const saveStockTake = async () => {
    try {
      // Prepare updates
      const updates = Object.keys(stockTakeCounts).map(id => ({
        id,
        quantity: stockTakeCounts[id]
      }));

      // Batch update
      const { error } = await supabase
        .from('inventory')
        .upsert(updates);

      if (error) throw error;

      setStockTakeMode(false);
      fetchProducts();
      alert('Stock count updated successfully!');
    } catch (error) {
      alert('Failed to update stock: ' + error.message);
    }
  };

  // Generate inventory report
  const generateReport = async () => {
    try {
      const canvas = await html2canvas(document.querySelector('#inventory-dashboard'));
      const link = document.createElement('a');
      link.download = 'inventory-report.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  // Render inventory chart
  const renderInventoryChart = () => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const ctx = chartRef.current.getContext('2d');
    
    // Low stock products
    const lowStockCount = products.filter(p => isLowStock(p.quantity)).length;
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Low Stock'],
        datasets: [{
          label: 'Inventory Overview',
          data: [lowStockCount],
          backgroundColor: ['rgba(255, 99, 132, 0.7)'],
          borderColor: ['rgba(255, 99, 132, 1)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Inventory Overview'
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Products'
            }
          }
        }
      }
    });
  };

  // Stock Adjustment functions
  const createStockAdjustment = async () => {
    if (!adjustmentProductId || !adjustmentQuantity || !adjustmentReason) {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Get current product
      const { data: product } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', adjustmentProductId)
        .single();

      if (!product) throw new Error('Product not found');

      // Calculate new quantity
      const quantityChange = adjustmentType === 'increase' 
        ? Number(adjustmentQuantity) 
        : -Number(adjustmentQuantity);
      
      const newQuantity = product.quantity + quantityChange;

      if (newQuantity < 0) {
        alert('Resulting quantity cannot be negative');
        return;
      }

      // Update product quantity
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', adjustmentProductId);

      if (updateError) throw updateError;

      // Record adjustment in stock_adjustments table
      const { error: adjustmentError } = await supabase
        .from('stock_adjustments')
        .insert([{
          product_id: adjustmentProductId,
          product_name: product.name,
          adjustment_type: adjustmentType,
          quantity: adjustmentQuantity,
          previous_quantity: product.quantity,
          new_quantity: newQuantity,
          reason: adjustmentReason,
          adjusted_by: 'admin' // In a real app, you'd use the logged-in user
        }]);

      if (adjustmentError) throw adjustmentError;

      // Reset and refresh
      setShowStockAdjustment(false);
      setAdjustmentProductId(null);
      setAdjustmentQuantity('');
      setAdjustmentReason('');
      fetchProducts();
      alert('Stock adjustment recorded successfully!');
    } catch (error) {
      alert('Error recording adjustment: ' + error.message);
    }
  };

  // Purchase Order functions
  const createPurchaseOrder = async () => {
    if (!newPurchaseOrder.supplier || newPurchaseOrder.items.length === 0) {
      alert('Please select a supplier and add at least one item');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([{
          ...newPurchaseOrder,
          total_amount: newPurchaseOrder.items.reduce(
            (sum, item) => sum + (item.price * item.quantity), 0
          )
        }])
        .select();

      if (error) throw error;

      // Reset form
      setNewPurchaseOrder({
        supplier: '',
        items: [],
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: '',
        status: 'pending'
      });
      setShowPurchaseOrder(false);
      fetchPurchaseOrders();
      alert('Purchase order created successfully!');
    } catch (error) {
      alert('Error creating purchase order: ' + error.message);
    }
  };

  const addPoItem = () => {
    if (!poItemProduct || !poItemQuantity) {
      alert('Please select a product and enter quantity');
      return;
    }

    const product = products.find(p => p.id === poItemProduct);
    if (!product) return;

    setNewPurchaseOrder(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: Number(poItemQuantity),
          price: product.price,
          unit: product.unit
        }
      ]
    }));

    setPoItemProduct('');
    setPoItemQuantity('');
  };

  const removePoItem = (index) => {
    setNewPurchaseOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const receivePurchaseOrder = async (id) => {
    if (!window.confirm('Mark this order as received? This will update inventory.')) return;

    try {
      // Get the purchase order
      const { data: order } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (!order) throw new Error('Order not found');

      // Update inventory for each item
      for (const item of order.items) {
        const { data: product } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (!product) continue;

        const newQuantity = product.quantity + item.quantity;

        await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', item.product_id);
      }

      // Update order status
      await supabase
        .from('purchase_orders')
        .update({ status: 'received', received_date: new Date().toISOString() })
        .eq('id', id);

      fetchPurchaseOrders();
      fetchProducts();
      alert('Order marked as received and inventory updated!');
    } catch (error) {
      alert('Error receiving order: ' + error.message);
    }
  };

  // Helper: check if product is low stock (<5 units)
  const isLowStock = (qty) => qty < 5;

  // Helper: check if product expiry is within 7 days
  const isNearExpiry = (expiry) => {
    if (!expiry) return false;
    const expiryDate = new Date(expiry);
    const today = new Date();
    const diffDays = (expiryDate - today) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 7;
  };

  // Prepare CSV data for export
  const csvData = [
    ['Name', 'Quantity', 'Price', 'Unit', 'Expiry Date', 'Selling Price'],
    ...products.map(product => [
      product.name,
      product.quantity,
      product.price,
      product.unit,
      product.expiry_date || '',
      product.selling_price || ''
    ])
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen w-full">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Inventory Management</h1>

        {/* Inventory Dashboard Summary */}
        <div id="inventory-dashboard" className="bg-white p-4 rounded shadow mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Inventory Dashboard</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowInventoryChart(!showInventoryChart)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                {showInventoryChart ? 'Hide Chart' : 'Show Chart'}
              </button>
              <button 
                onClick={generateReport}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              >
                Generate Report
              </button>
            </div>
          </div>

          {showInventoryChart && (
            <div className="mb-6">
              <canvas ref={chartRef} height="300"></canvas>
            </div>
          )}
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search products..."
              className="border border-gray-300 rounded px-3 py-2 w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              onClick={() => setLowStockFilter(!lowStockFilter)}
              className={`px-4 py-2 rounded ${lowStockFilter ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setNearExpiryFilter(!nearExpiryFilter)}
              className={`px-4 py-2 rounded ${nearExpiryFilter ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
            >
              Near Expiry
            </button>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {!stockTakeMode ? (
              <>
                <button
                  onClick={() => setShowBulkImport(!showBulkImport)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  {showBulkImport ? 'Cancel Bulk Import' : 'Bulk Import'}
                </button>
                <CSVLink 
                  data={csvData} 
                  filename="inventory_export.csv"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-center"
                >
                  Export to CSV
                </CSVLink>
                <button
                  onClick={() => setShowStockAdjustment(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                >
                  Stock Adjustment
                </button>
                <button
                  onClick={startStockTake}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  Stock Count
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={saveStockTake}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Save Stock Count
                </button>
                <button
                  onClick={() => setStockTakeMode(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stock Adjustment Modal */}
        {showStockAdjustment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Stock Adjustment</h2>
              
              <div className="mb-4">
                <label className="block mb-1 font-medium">Product</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={adjustmentProductId || ''}
                  onChange={(e) => setAdjustmentProductId(e.target.value)}
                >
                  <option value="">Select Product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.quantity} {product.unit})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 font-medium">Adjustment Type</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                >
                  <option value="increase">Increase Stock</option>
                  <option value="decrease">Decrease Stock</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 font-medium">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(e.target.value)}
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 font-medium">Reason</label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g., Damaged goods, stock take discrepancy"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowStockAdjustment(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={createStockAdjustment}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Order Modal */}
        {showPurchaseOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">Create Purchase Order</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-1 font-medium">Supplier</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newPurchaseOrder.supplier}
                    onChange={(e) => setNewPurchaseOrder(prev => ({
                      ...prev,
                      supplier: e.target.value
                    }))}
                    placeholder="Supplier name"
                  />
                </div>
                
                <div>
                  <label className="block mb-1 font-medium">Order Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newPurchaseOrder.order_date}
                    onChange={(e) => setNewPurchaseOrder(prev => ({
                      ...prev,
                      order_date: e.target.value
                    }))}
                  />
                </div>
                
                <div>
                  <label className="block mb-1 font-medium">Expected Delivery</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newPurchaseOrder.expected_delivery}
                    onChange={(e) => setNewPurchaseOrder(prev => ({
                      ...prev,
                      expected_delivery: e.target.value
                    }))}
                  />
                </div>
              </div>
              
              <div className="mb-4 border-t pt-4">
                <h3 className="font-semibold mb-2">Order Items</h3>
                
                <div className="flex space-x-2 mb-4">
                  <select
                    className="flex-1 border border-gray-300 rounded px-3 py-2"
                    value={poItemProduct}
                    onChange={(e) => setPoItemProduct(e.target.value)}
                  >
                    <option value="">Select Product</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.price} KSh/{product.unit})
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24 border border-gray-300 rounded px-3 py-2"
                    value={poItemQuantity}
                    onChange={(e) => setPoItemQuantity(e.target.value)}
                    placeholder="Qty"
                  />
                  
                  <button
                    onClick={addPoItem}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    Add
                  </button>
                </div>
                
                {newPurchaseOrder.items.length > 0 ? (
                  <div className="border rounded">
                    <table className="min-w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-left">Quantity</th>
                          <th className="px-4 py-2 text-left">Price</th>
                          <th className="px-4 py-2 text-left">Total</th>
                          <th className="px-4 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newPurchaseOrder.items.map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="px-4 py-2">{item.product_name}</td>
                            <td className="px-4 py-2">{item.quantity} {item.unit}</td>
                            <td className="px-4 py-2">{item.price} KSh</td>
                            <td className="px-4 py-2">{(item.quantity * item.price).toFixed(2)} KSh</td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => removePoItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="3" className="px-4 py-2 font-semibold text-right">Total:</td>
                          <td className="px-4 py-2 font-semibold">
                            {newPurchaseOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)} KSh
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No items added yet</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowPurchaseOrder(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={createPurchaseOrder}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Create Order
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Form */}
        {showBulkImport && (
          <div className="mb-8 bg-white p-4 sm:p-6 rounded shadow-md">
            <h2 className="text-xl font-semibold mb-4">Bulk Import Products</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter product data in CSV format (Name, Quantity, Price, Unit, Expiry Date, Selling Price). One product per line.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 h-40 mb-4 font-mono text-sm"
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder="Example:&#10;Beef Ribeye,10,500,kg,2023-12-31,600&#10;Chicken Breast,20,300,kg,,350"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleBulkImport}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Import Products
              </button>
              <button
                onClick={() => setShowBulkImport(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Purchase Orders Section */}
        <div className="mb-8 bg-white rounded shadow-md overflow-hidden">
          <div className="flex justify-between items-center bg-red-700 text-white p-4">
            <h2 className="text-xl font-semibold">Purchase Orders</h2>
            <button
              onClick={() => setShowPurchaseOrder(true)}
              className="bg-white text-red-700 hover:bg-gray-100 px-4 py-2 rounded font-semibold"
            >
              + New Order
            </button>
          </div>
          
          {purchaseOrders.length === 0 ? (
            <p className="p-4 text-gray-600">No purchase orders found.</p>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">PO #</th>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-4 py-2 text-left">Order Date</th>
                  <th className="px-4 py-2 text-left">Expected Delivery</th>
                  <th className="px-4 py-2 text-left">Total Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map(order => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{order.id}</td>
                    <td className="px-4 py-2">{order.supplier}</td>
                    <td className="px-4 py-2">{new Date(order.order_date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-2">{order.total_amount?.toFixed(2)} KSh</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'received' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 space-x-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => receivePurchaseOrder(order.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Receive
                        </button>
                      )}
                      <button
                        onClick={() => alert('View order details')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Product Form */}
        <form onSubmit={addProduct} className="mb-8 bg-white p-4 sm:p-6 rounded shadow-md w-full max-w-4xl mx-auto space-y-4">
          <h2 className="text-xl font-semibold">Add New Product</h2>
          {error && <p className="text-red-500">{error}</p>}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Product Name*</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Beef Ribeye"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Quantity*</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="e.g., 10"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Price (KSh)*</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="e.g., 500"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Selling Price (KSh)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., 600"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Unit*</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                required
              >
                <option value="kg">kg</option>
                <option value="piece">piece</option>
                <option value="g">g</option>
                <option value="pack">pack</option>
                <option value="box">box</option>
                <option value="liter">liter</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 font-medium">Expiry Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Product Image</label>
              <input
                type="file"
                accept="image/*"
                className="w-full border border-gray-300 rounded px-3 py-2"
                onChange={(e) => setNewImage(e.target.files[0])}
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
          >
            Add Product
          </button>
        </form>

        {/* Inventory Table */}
        <div className="overflow-x-auto bg-white rounded shadow-md w-full">
          {loading ? (
            <p className="p-4 text-gray-600">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="p-4 text-gray-600">No products found.</p>
          ) : (
            <table className="min-w-full table-auto">
              <thead className="bg-red-700 text-white">
                <tr>
                  <th className="px-4 py-2 text-left text-sm">#</th>
                  <th className="px-4 py-2 text-left text-sm">Image</th>
                  <th className="px-4 py-2 text-left text-sm">Name</th>
                  <th className="px-4 py-2 text-left text-sm">Quantity</th>
                  <th className="px-4 py-2 text-left text-sm">Expiry Date</th>
                  <th className="px-4 py-2 text-left text-sm">Price</th>
                  <th className="px-4 py-2 text-left text-sm">Selling Price</th>
                  <th className="px-4 py-2 text-left text-sm">Unit</th>
                  <th className="px-4 py-2 text-left text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, idx) => {
                  const lowStock = isLowStock(product.quantity);
                  const nearExpiry = isNearExpiry(product.expiry_date);

                  if (editingProduct === product.id) {
                    // Editing row
                    return (
                      <tr key={product.id} className="border-b bg-yellow-50">
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            {product.image_url && (
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-10 h-10 object-cover rounded"
                              />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setEditImage(e.target.files[0])}
                              className="text-sm"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                            required
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                            required
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editExpiry}
                            onChange={(e) => setEditExpiry(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                            required
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editSellingPrice}
                            onChange={(e) => setEditSellingPrice(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                            required
                          >
                            <option value="kg">kg</option>
                            <option value="piece">piece</option>
                            <option value="g">g</option>
                            <option value="pack">pack</option>
                            <option value="box">box</option>
                            <option value="liter">liter</option>
                          </select>
                        </td>
                      
                        <td className="px-4 py-2 space-x-2">
                          <button
                            onClick={() => saveEdit(product.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Normal row or stock take row
                  return (
                    <tr
                      key={product.id}
                      className={`border-b hover:bg-gray-100 ${
                        lowStock ? 'bg-red-50' : nearExpiry ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-semibold">
                        {product.name}
                        {lowStock && (
                          <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                            Low Stock
                          </span>
                        )}
                        {nearExpiry && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Near Expiry
                          </span>
                        )}
                      </td>
                      {stockTakeMode ? (
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={stockTakeCounts[product.id] || ''}
                            onChange={(e) => updateStockTakeCount(product.id, e.target.value)}
                            className={`border rounded px-2 py-1 w-24 ${lowStock ? 'border-red-500' : ''}`}
                          />
                        </td>
                      ) : (
                        <td className={`px-4 py-2 ${lowStock ? 'text-red-600 font-bold' : ''}`}>
                          {product.quantity} {product.unit}
                        </td>
                      )}
                      <td className={`px-4 py-2 ${nearExpiry ? 'text-yellow-600 font-bold' : ''}`}>
                        {product.expiry_date
                          ? new Date(product.expiry_date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-2">KSh {product.price?.toLocaleString()}</td>
                      <td className="px-4 py-2">KSh {product.selling_price?.toLocaleString()}</td>
                      <td className="px-4 py-2">{product.unit}</td>
                      <td className="px-4 py-2 space-x-2">
                        {!stockTakeMode && (
                          <>
                            <button
                              onClick={() => startEditing(product)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Low Stock Alert Section */}
        {products.some(p => isLowStock(p.quantity)) && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded p-4">
            <h2 className="text-xl font-semibold text-red-700 mb-4">Low Stock Alert</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products
                .filter(p => isLowStock(p.quantity))
                .map(product => (
                  <div key={product.id} className="bg-white p-3 rounded shadow-sm border-l-4 border-red-500">
                    <div className="flex items-start">
                      {product.image_url && (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-12 h-12 object-cover rounded mr-3"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-red-600">
                          Only {product.quantity} {product.unit} remaining
                        </p>
                        <p className="text-sm text-gray-600">
                          Last updated: {new Date(product.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Near Expiry Alert Section */}
        {products.some(p => isNearExpiry(p.expiry_date)) && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded p-4">
            <h2 className="text-xl font-semibold text-yellow-700 mb-4">Near Expiry Alert</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products
                .filter(p => isNearExpiry(p.expiry_date))
                .map(product => (
                  <div key={product.id} className="bg-white p-3 rounded shadow-sm border-l-4 border-yellow-500">
                    <div className="flex items-start">
                      {product.image_url && (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-12 h-12 object-cover rounded mr-3"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-yellow-600">
                          Expires on: {new Date(product.expiry_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          Quantity: {product.quantity} {product.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Inventory;