import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import Layout from "../components/layout";

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('kg');

  const [error, setError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('kg');
  const [sellingPrice, setSellingPrice] = React.useState('');


  // Fetch products from Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Add new product
  const addProduct = async (e) => {
    e.preventDefault();
    setError('');

    if (!newName || !newQuantity || !newExpiry || !newPrice) {
      setError('Please fill in all fields');
      return;
    }

    const { error } = await supabase.from('inventory').insert([
      {
        name: newName,
        quantity: Number(newQuantity),
        expiry_date: newExpiry,
        price: Number(newPrice),
        unit: newUnit, // <-- Add this
        selling_price: Number(sellingPrice), // <-- added

      },
    ]);

    if (error) {
      setError(error.message);
    } else {
      setNewName('');
      setNewQuantity('');
      setNewExpiry('');
      setNewPrice('');
      setNewUnit('kg');
      fetchProducts();
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
  };

  // Save edited product
  const saveEdit = async (id) => {
    if (!editName || !editQuantity || !editExpiry || !editPrice) {
      alert('Please fill in all fields');
      return;
    }

    const { error } = await supabase
      .from('inventory')
      .update({
        name: editName,
        quantity: Number(editQuantity),
        expiry_date: editExpiry,
        price: Number(editPrice),
        unit: editUnit,
        selling_price: Number(editSellingPrice),
      })
      .eq('id', id);

    if (error) {
      alert('Update failed: ' + error.message);
    } else {
      cancelEditing();
      fetchProducts();
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

  return (
    <Layout>
<div className="p-4 sm:p-6 bg-gray-50 min-h-screen w-full">
      <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-6">Butchery Inventory</h1>

      {/* Add Product Form */}
     <form onSubmit={addProduct} className="mb-8 bg-white p-4 sm:p-6 rounded shadow-md w-full max-w-2xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold">Add New Product</h2>
        {error && <p className="text-red-500">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Product Name</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Beef Ribeye"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Quantity (kg or units)</label>
          <input
            type="number"
            min="0"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            placeholder="e.g., 10"
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
          <label className="block mb-1 font-medium">Price (KSh)</label>
          <input
            type="number"
            min="0"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="e.g., 500"
          />
        </div>
        
        <div>
  <label className="block mb-1 font-medium">Selling Price (KSh)</label>
  <input
    type="number"
    min="0"
    className="w-full border border-gray-300 rounded px-3 py-2"
    placeholder="e.g., 600"
    value={sellingPrice}
    onChange={(e) => setSellingPrice(e.target.value)}
    required
  />
</div>

        <div>
          <label className="block mb-1 font-medium">Unit</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          >
            <option value="kg">kg</option>
            <option value="piece">piece</option>
            <option value="g">g</option>
            <option value="pack">pack</option>
            {/* Add more units as needed */}
          </select>
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
                <th className="px-4 py-2 text-left text-sm">Name</th>
                <th className="px-4 py-2 text-left text-sm">Quantity</th>
                <th className="px-4 py-2 text-left text-sm">Expiry Date</th>
                <th className="px-4 py-2 text-left text-sm">Price</th>
                <th className="px-4 py-2 text-left text-sm">Unit</th>
                <th className="px-4 py-2 text-left text-sm">Selling Price</th>
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
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
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
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
                        >
                          <option value="kg">kg</option>
                          <option value="piece">piece</option>
                          <option value="g">g</option>
                          <option value="pack">pack</option>
                        </select>
                      </td>
<td className="px-4 py-2">
  <input
    type="number"
    min="0"
    value={editSellingPrice}
    onChange={(e) => setEditSellingPrice(e.target.value)}
    className="border border-gray-300 rounded px-2 py-1 w-full"
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
                      lowStock ? 'bg-red-100' : nearExpiry ? 'bg-yellow-100' : ''
                    }`}
                  >
                    <td className="px-4 py-2">{idx + 1}</td>
                    <td className="px-4 py-2 font-semibold">{product.name}</td>
                    <td className="px-4 py-2">{product.quantity}</td>
                    <td className="px-4 py-2">
                      {product.expiry_date
                        ? new Date(product.expiry_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-2">{product.price}</td>
                    <td className="px-4 py-2">{product.unit}</td>
                    <td className="px-4 py-2 space-x-2">
                      <button
                        onClick={() => startEditing(product)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
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
    </div>
    </Layout>
  );
};

export default Inventory;
