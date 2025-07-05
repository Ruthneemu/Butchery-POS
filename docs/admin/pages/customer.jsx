import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { CSVLink } from 'react-csv';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function CustomersAndSuppliers() {
  // Data
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Forms
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '' });

  // Editing
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [editSupplierId, setEditSupplierId] = useState(null);
  const [editCustomerData, setEditCustomerData] = useState({});
  const [editSupplierData, setEditSupplierData] = useState({});

  // Controls
  const [activeTab, setActiveTab] = useState('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Breadcrumb
  const [showBreadcrumb, setShowBreadcrumb] = useState(true);

  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select().order('created_at', { ascending: false });
    if (data) setCustomers(data);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select().order('created_at', { ascending: false });
    if (data) setSuppliers(data);
  };

  const notify = (msg, type = 'success') => toast[type](msg);

  const handleAdd = async (type) => {
    const form = type === 'customer' ? customerForm : supplierForm;
    if (!form.name || !form.phone) return notify('Name and phone are required.', 'error');

    const { error } = await supabase.from(type === 'customer' ? 'customers' : 'suppliers').insert([form]);
    if (error) return notify(`Error: ${error.message}`, 'error');

    type === 'customer' ? setCustomerForm({ name: '', phone: '', email: '' }) : setSupplierForm({ name: '', phone: '', email: '' });
    type === 'customer' ? fetchCustomers() : fetchSuppliers();
    notify(`${type.charAt(0).toUpperCase() + type.slice(1)} added!`);
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm('Proceed with deletion?')) return;
    await supabase.from(type).delete().eq('id', id);
    type === 'customers' ? fetchCustomers() : fetchSuppliers();
    notify(`${type === 'customers' ? 'Customer' : 'Supplier'} deleted.`);
  };

  const handleEdit = async (type, id) => {
    const updated = type === 'customers' ? editCustomerData : editSupplierData;
    const { error } = await supabase.from(type).update(updated).eq('id', id);
    if (error) return notify('Update error.', 'error');
    type === 'customers' ? setEditCustomerId(null) : setEditSupplierId(null);
    fetchCustomers();
    fetchSuppliers();
    notify(`${type === 'customers' ? 'Customer' : 'Supplier'} updated.`);
  };

  const entries = activeTab === 'customers' ? customers : suppliers;
  const filtered = entries.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.phone.includes(searchTerm)
  );
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      <h1 className="text-2xl font-bold mb-2">👥 Customers & Suppliers</h1>

      {/* Breadcrumb  */}
        <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded mb-6" aria-label="Breadcrumb">
          <nav>
            <ol className="list-reset flex items-center space-x-2">
              <li>
                <a href="/" className="text-blue-600 hover:underline">Dashboard</a>
              </li>
              <li>/</li>
              <li className="text-gray-700">Customers & Suppliers</li>
            </ol>
          </nav>
        
        </div>
      

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        {['customers', 'suppliers'].map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchTerm(''); setCurrentPage(1); }}
            className={`px-4 py-2 border-b-2 ${activeTab === tab ? 'border-blue-600 font-semibold' : 'border-transparent'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Add Form */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">➕ Add {activeTab === 'customers' ? 'Customer' : 'Supplier'}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={activeTab === 'customers' ? customerForm.name : supplierForm.name}
            onChange={e => activeTab === 'customers'
              ? setCustomerForm({ ...customerForm, name: e.target.value })
              : setSupplierForm({ ...supplierForm, name: e.target.value })}
            className="p-2 border w-full"
            placeholder="Name"
          />
          <input
            value={activeTab === 'customers' ? customerForm.phone : supplierForm.phone}
            onChange={e => activeTab === 'customers'
              ? setCustomerForm({ ...customerForm, phone: e.target.value })
              : setSupplierForm({ ...supplierForm, phone: e.target.value })}
            className="p-2 border w-full"
            placeholder="Phone"
          />
          <input
            value={activeTab === 'customers' ? customerForm.email : supplierForm.email}
            onChange={e => activeTab === 'customers'
              ? setCustomerForm({ ...customerForm, email: e.target.value })
              : setSupplierForm({ ...supplierForm, email: e.target.value })}
            className="p-2 border w-full"
            placeholder="Email"
          />
          <button
            onClick={() => handleAdd(activeTab === 'customers' ? 'customer' : 'supplier')}
            className={`px-4 py-2 text-white ${activeTab === 'customers' ? 'bg-green-600' : 'bg-blue-600'}`}
          >
            Add
          </button>
        </div>
      </section>

      {/* Search & Export */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <input
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="border p-2 sm:w-1/2"
          placeholder="Search name or phone..."
        />
        <CSVLink
          data={activeTab === 'customers' ? customers : suppliers}
          filename={`${activeTab}.csv`}
          className="text-blue-600 underline mt-2 sm:mt-0"
        >
          📤 Export {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </CSVLink>
      </div>

      {/* Table */}
      <table className="w-full text-sm border mb-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Name</th>
            <th className="border p-2">Phone</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {paged.map(entry => (
            <tr key={entry.id} className="hover:bg-gray-50">
              {activeTab === 'customers' ? (
                <>
                  <td className="border p-2">
                    {editCustomerId === entry.id
                      ? <input value={editCustomerData.name} onChange={e => setEditCustomerData({ ...editCustomerData, name: e.target.value })} />
                      : entry.name}
                  </td>
                  <td className="border p-2">
                    {editCustomerId === entry.id
                      ? <input value={editCustomerData.phone} onChange={e => setEditCustomerData({ ...editCustomerData, phone: e.target.value })} />
                      : entry.phone}
                  </td>
                  <td className="border p-2">
                    {editCustomerId === entry.id
                      ? <input value={editCustomerData.email} onChange={e => setEditCustomerData({ ...editCustomerData, email: e.target.value })} />
                      : entry.email || '-'}
                  </td>
                  <td className="border p-2">
                    {editCustomerId === entry.id
                      ? <button onClick={() => handleEdit('customers', entry.id)} className="text-green-600">Save</button>
                      : <>
                          <button onClick={() => { setEditCustomerId(entry.id); setEditCustomerData(entry); }} className="text-blue-600 mr-2">Edit</button>
                          <button onClick={() => handleDelete(entry.id, 'customers')} className="text-red-600">Delete</button>
                        </>}
                  </td>
                </>
              ) : (
                <>
                  <td className="border p-2">
                    {editSupplierId === entry.id
                      ? <input value={editSupplierData.name} onChange={e => setEditSupplierData({ ...editSupplierData, name: e.target.value })} />
                      : entry.name}
                  </td>
                  <td className="border p-2">
                    {editSupplierId === entry.id
                      ? <input value={editSupplierData.phone} onChange={e => setEditSupplierData({ ...editSupplierData, phone: e.target.value })} />
                      : entry.phone}
                  </td>
                  <td className="border p-2">
                    {editSupplierId === entry.id
                      ? <input value={editSupplierData.email} onChange={e => setEditSupplierData({ ...editSupplierData, email: e.target.value })} />
                      : entry.email || '-'}
                  </td>
                  <td className="border p-2">
                    {editSupplierId === entry.id
                      ? <button onClick={() => handleEdit('suppliers', entry.id)} className="text-green-600">Save</button>
                      : <>
                          <button onClick={() => { setEditSupplierId(entry.id); setEditSupplierData(entry); }} className="text-blue-600 mr-2">Edit</button>
                          <button onClick={() => handleDelete(entry.id, 'suppliers')} className="text-red-600">Delete</button>
                        </>}
                  </td>
                </>
              )}
            </tr>
          ))}
          {!paged.length && (
            <tr>
              <td colSpan="4" className="p-2 text-gray-400 text-center border">
                No {activeTab} found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex gap-2 justify-center mb-10">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1 border ${currentPage === i + 1 ? 'bg-gray-200 font-bold' : ''}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
