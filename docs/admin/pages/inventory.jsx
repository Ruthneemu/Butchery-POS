import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";
import { CSVLink } from 'react-csv';

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
  const [variants, setVariants] = useState([]);
  const [barcode, setBarcode] = useState('');

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
  const [editVariant, setEditVariant] = useState('');
  const [editVariants, setEditVariants] = useState([]);
  const [editBarcode, setEditBarcode] = useState('');

  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

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

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [searchTerm, lowStockFilter]);

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
            selling_price: Number(sellingPrice) || Number(newPrice) * 1.2, // Default to 20% markup
            variants: variants.length > 0 ? variants : null,
            barcode: barcode || null
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
      setVariants([]);
      setNewVariant('');
      setBarcode('');

      fetchProducts();
    } catch (error) {
      setError(error.message);
    }
  };

  // Add variant to new product
  const addVariant = () => {
    if (newVariant && !variants.includes(newVariant)) {
      setVariants([...variants, newVariant]);
      setNewVariant('');
    }
  };

  // Remove variant from new product
  const removeVariant = (variantToRemove) => {
    setVariants(variants.filter(v => v !== variantToRemove));
  };

  // Add variant to edited product
  const addEditVariant = () => {
    if (editVariant && !editVariants.includes(editVariant)) {
      setEditVariants([...editVariants, editVariant]);
      setEditVariant('');
    }
  };

  // Remove variant from edited product
  const removeEditVariant = (variantToRemove) => {
    setEditVariants(editVariants.filter(v => v !== variantToRemove));
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
    setEditVariants(product.variants || []);
    setEditBarcode(product.barcode || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingProduct(null);
    setEditName('');
    setEditQuantity('');
    setEditExpiry('');
    setEditUnit('kg');
    setEditSellingPrice('');
    setEditVariants([]);
    setEditVariant('');
    setEditBarcode('');
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
        variants: editVariants.length > 0 ? editVariants : null,
        barcode: editBarcode || null
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
        
        const [name, quantity, price, unit = 'kg', expiry = null, sellingPrice = null, barcode = null] = line.split(',');
        
        productsToImport.push({
          name: name.trim(),
          quantity: Number(quantity.trim()),
          price: Number(price.trim()),
          unit: unit.trim(),
          expiry_date: expiry?.trim() || null,
          selling_price: sellingPrice ? Number(sellingPrice.trim()) : null,
          barcode: barcode?.trim() || null
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
    ['Name', 'Quantity', 'Price', 'Unit', 'Expiry Date', 'Selling Price', 'Barcode', 'Variants'],
    ...products.map(product => [
      product.name,
      product.quantity,
      product.price,
      product.unit,
      product.expiry_date || '',
      product.selling_price || '',
      product.barcode || '',
      product.variants ? product.variants.join(';') : ''
    ])
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen w-full">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Inventory</h1>

        {/* Inventory Dashboard Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold text-gray-600">Total Products</h3>
            <p className="text-2xl font-bold">{products.length}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold text-gray-600">Low Stock</h3>
            <p className="text-2xl font-bold text-red-600">
              {products.filter(p => isLowStock(p.quantity)).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold text-gray-600">Near Expiry</h3>
            <p className="text-2xl font-bold text-yellow-600">
              {products.filter(p => isNearExpiry(p.expiry_date)).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold text-gray-600">Total Value</h3>
            <p className="text-2xl font-bold">
              KSh {products.reduce((sum, p) => sum + (p.price * p.quantity), 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
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
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
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
          </div>
        </div>

        {/* Bulk Import Form */}
        {showBulkImport && (
          <div className="mb-8 bg-white p-4 sm:p-6 rounded shadow-md">
            <h2 className="text-xl font-semibold mb-4">Bulk Import Products</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter product data in CSV format (Name, Quantity, Price, Unit, Expiry Date, Selling Price, Barcode). One product per line.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 h-40 mb-4 font-mono text-sm"
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder="Example:&#10;Beef Ribeye,10,500,kg,2023-12-31,600,123456789&#10;Chicken Breast,20,300,kg,,350,987654321"
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
              <label className="block mb-1 font-medium">Barcode</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g., 123456789"
              />
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

          <div className="space-y-2">
            <label className="block mb-1 font-medium">Variants</label>
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded px-3 py-2"
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                placeholder="e.g., Large, Small, Frozen"
              />
              <button
                type="button"
                onClick={addVariant}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Add
              </button>
            </div>
            {variants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {variants.map((variant) => (
                  <span key={variant} className="bg-gray-200 px-3 py-1 rounded-full flex items-center">
                    {variant}
                    <button
                      type="button"
                      onClick={() => removeVariant(variant)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
                  <th className="px-4 py-2 text-left text-sm">Variants</th>
                  <th className="px-4 py-2 text-left text-sm">Barcode</th>
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
                        <td className="px-4 py-2">
                          <div className="flex space-x-2 mb-2">
                            <input
                              type="text"
                              value={editVariant}
                              onChange={(e) => setEditVariant(e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="Add variant"
                            />
                            <button
                              type="button"
                              onClick={addEditVariant}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-sm"
                            >
                              Add
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {editVariants.map((variant) => (
                              <span key={variant} className="bg-gray-200 px-2 py-0.5 rounded-full text-xs flex items-center">
                                {variant}
                                <button
                                  type="button"
                                  onClick={() => removeEditVariant(variant)}
                                  className="ml-1 text-red-600 hover:text-red-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editBarcode}
                            onChange={(e) => setEditBarcode(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
                            placeholder="Barcode"
                          />
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

                  // Normal row
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
                      <td className={`px-4 py-2 ${lowStock ? 'text-red-600 font-bold' : ''}`}>
                        {product.quantity} {product.unit}
                      </td>
                      <td className={`px-4 py-2 ${nearExpiry ? 'text-yellow-600 font-bold' : ''}`}>
                        {product.expiry_date
                          ? new Date(product.expiry_date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-2">KSh {product.price?.toLocaleString()}</td>
                      <td className="px-4 py-2">KSh {product.selling_price?.toLocaleString()}</td>
                      <td className="px-4 py-2">{product.unit}</td>
                      <td className="px-4 py-2">
                        {product.variants?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.variants.map(variant => (
                              <span key={variant} className="bg-gray-200 px-2 py-0.5 rounded-full text-xs">
                                {variant}
                              </span>
                            ))}
                          </div>
                        ) : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm">{product.barcode || 'N/A'}</td>
                      <td className="px-4 py-2 space-x-2">
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
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-red-600">
                      Only {product.quantity} {product.unit} remaining
                    </p>
                    <p className="text-sm text-gray-600">
                      Last updated: {new Date(product.updated_at).toLocaleString()}
                    </p>
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