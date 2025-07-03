import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function CustomersAndSuppliers() {
  // State for customers
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customers, setCustomers] = useState([]);

  // State for suppliers
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
  }, []);

  // Fetch customers
  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select().order('created_at', { ascending: false });
    if (data) setCustomers(data);
  };

  // Fetch suppliers
  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select().order('created_at', { ascending: false });
    if (data) setSuppliers(data);
  };

  // Add Customer
  const handleAddCustomer = async () => {
    if (!customerName || !customerPhone) return alert("Name and phone are required.");
    const { error } = await supabase.from('customers').insert([
      { name: customerName, phone: customerPhone, email: customerEmail }
    ]);
    if (error) return alert("Error: " + error.message);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    fetchCustomers();
    alert("Customer added!");
  };

  // Add Supplier
  const handleAddSupplier = async () => {
    if (!supplierName || !supplierPhone) return alert("Name and phone are required.");
    const { error } = await supabase.from('suppliers').insert([
      { name: supplierName, phone: supplierPhone, email: supplierEmail }
    ]);
    if (error) return alert("Error: " + error.message);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    fetchSuppliers();
    alert("Supplier added!");
  };

  // Delete Customer
  const handleDeleteCustomer = async (id) => {
    if (window.confirm('Delete this customer?')) {
      await supabase.from('customers').delete().eq('id', id);
      fetchCustomers();
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async (id) => {
    if (window.confirm('Delete this supplier?')) {
      await supabase.from('suppliers').delete().eq('id', id);
      fetchSuppliers();
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Customers & Suppliers</h1>

      {/* Add Customer */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">➕ Add Customer</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="p-2 border w-full" placeholder="Name" />
          <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="p-2 border w-full" placeholder="Phone" />
          <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="p-2 border w-full" placeholder="Email (optional)" />
          <button onClick={handleAddCustomer} className="bg-green-600 text-white px-4 py-2">Add</button>
        </div>
      </div>

      {/* Manage Customers */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">📋 Manage Customers</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Name</th>
              <th className="border p-2">Phone</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="border p-2">{c.name}</td>
                <td className="border p-2">{c.phone}</td>
                <td className="border p-2">{c.email || '-'}</td>
                <td className="border p-2">
                  <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Supplier */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">➕ Add Supplier</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="p-2 border w-full" placeholder="Name" />
          <input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} className="p-2 border w-full" placeholder="Phone" />
          <input value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} className="p-2 border w-full" placeholder="Email (optional)" />
          <button onClick={handleAddSupplier} className="bg-blue-600 text-white px-4 py-2">Add</button>
        </div>
      </div>

      {/* Manage Suppliers */}
      <div>
        <h2 className="text-xl font-semibold mb-2">📋 Manage Suppliers</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Name</th>
              <th className="border p-2">Phone</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">{s.phone}</td>
                <td className="border p-2">{s.email || '-'}</td>
                <td className="border p-2">
                  <button onClick={() => handleDeleteSupplier(s.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
