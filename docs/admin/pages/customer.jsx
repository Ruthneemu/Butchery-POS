import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { CSVLink } from 'react-csv';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Reusable Modal Component
const Modal = ({ show, onClose, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-h-[90vh] overflow-y-auto w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmationModal = ({ show, message, onConfirm, onCancel }) => {
  return (
    <Modal show={show} onClose={onCancel}>
      <h3 className="text-xl font-semibold mb-4">Confirm Action</h3>
      <p className="mb-6">{message}</p>
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
};

// Edit Modal Component (for Customers and Suppliers)
const EditModal = ({ show, onClose, data, type, onSave, isSaving }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (show) {
      setFormData(data);
    }
  }, [show, data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    onSave(type, formData.id, formData);
  };

  const renderFormFields = () => {
    if (type === 'customers') {
      return (
        <>
          <label className="block mb-2 text-sm font-medium">Name:</label>
          <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" required />
          <label className="block mb-2 text-sm font-medium">Phone:</label>
          <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" required />
          <label className="block mb-2 text-sm font-medium">Email:</label>
          <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" />
          <label className="block mb-2 text-sm font-medium">Address:</label>
          <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" />
          <label className="block mb-2 text-sm font-medium">Loyalty Points:</label>
          <input type="number" name="loyalty_points" value={formData.loyalty_points || 0} onChange={handleChange} className="border p-2 w-full mb-3 rounded" />
          <label className="block mb-2 text-sm font-medium">Notes:</label>
          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded"></textarea>
        </>
      );
    } else if (type === 'suppliers') {
      return (
        <>
          <label className="block mb-2 text-sm font-medium">Name:</label>
          <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" required />
          <label className="block mb-2 text-sm font-medium">Contact Person:</label>
          <input type="text" name="contact_person" value={formData.contact_person || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" />
          <label className="block mb-2 text-sm font-medium">Phone:</label>
          <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" required />
          <label className="block mb-2 text-sm font-medium">Email:</label>
          <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" />
          <label className="block mb-2 text-sm font-medium">Address:</label>
          <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" />
          <label className="block mb-2 text-sm font-medium">Supply Category:</label>
          <input type="text" name="supply_category" value={formData.supply_category || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" placeholder="e.g., Meat, Spices, Packaging" />
          <label className="block mb-2 text-sm font-medium">Payment Terms:</label>
          <input type="text" name="payment_terms" value={formData.payment_terms || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" placeholder="e.g., Net 30, COD" />
          <label className="block mb-2 text-sm font-medium">Delivery Schedule:</label>
          <input type="text" name="delivery_schedule" value={formData.delivery_schedule || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded" placeholder="e.g., Every Monday, On Call" />
          <label className="block mb-2 text-sm font-medium">Notes:</label>
          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="border p-2 w-full mb-3 rounded"></textarea>
        </>
      );
    }
    return null;
  };

  return (
    <Modal show={show} onClose={onClose}>
      <h3 className="text-xl font-semibold mb-4">Edit {type === 'customers' ? 'Customer' : 'Supplier'}</h3>
      {renderFormFields()}
      <div className="flex justify-end space-x-3 mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
};


export default function CustomersAndSuppliers() {
  // Data
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Forms - Expanded for new fields
  const [customerForm, setCustomerForm] = useState({
    name: '', phone: '', email: '', address: '', loyalty_points: 0, notes: ''
  });
  const [supplierForm, setSupplierForm] = useState({
    name: '', phone: '', email: '', contact_person: '', address: '',
    supply_category: '', payment_terms: '', delivery_schedule: '', notes: ''
  });

  // Editing - Combined with modal control
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [currentEditData, setCurrentEditData] = useState({});

  // Controls
  const [activeTab, setActiveTab] = useState('customers');
  const [customerSearchTerm, setCustomerSearchTerm] = useState(''); // Dedicated search
  const [supplierSearchTerm, setSupplierSearchTerm] = useState(''); // Dedicated search
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deletion Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItemDetails, setDeleteItemDetails] = useState({ id: null, type: '', name: '' });

  // Sorting
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchCustomers(), fetchSuppliers()]);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select(`
      id, name, phone, email, address, loyalty_points, total_spend, last_purchase_date, notes, created_at, updated_at
    `).order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching customers:', error.message);
      notify('Failed to fetch customers.', 'error');
    } else if (data) {
      setCustomers(data);
    }
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select(`
      id, name, phone, email, contact_person, address, supply_category, payment_terms, delivery_schedule, notes, created_at, updated_at
    `).order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching suppliers:', error.message);
      notify('Failed to fetch suppliers.', 'error');
    } else if (data) {
      setSuppliers(data);
    }
  };

  const notify = (msg, type = 'success') => toast[type](msg);

  // --- Validation Functions ---
  const isValidEmail = (email) => {
    return email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Kenyan phone number validation (starts with 07 or +2547)
  const isValidPhone = (phone) => {
    return /^(\+254|0)[7]\d{8}$/.test(phone);
  };

  const handleAdd = async (type) => {
    setIsAdding(true);
    const form = type === 'customer' ? customerForm : supplierForm;

    if (!form.name || !form.phone) {
      setIsAdding(false);
      return notify('Name and phone are required.', 'error');
    }
    if (form.email && !isValidEmail(form.email)) {
      setIsAdding(false);
      return notify('Please enter a valid email address.', 'error');
    }
    if (!isValidPhone(form.phone)) {
      setIsAdding(false);
      return notify('Please enter a valid Kenyan phone number (e.g., 07XXXXXXXX or +2547XXXXXXXX).', 'error');
    }

    const { error } = await supabase.from(type === 'customer' ? 'customers' : 'suppliers').insert([form]);
    if (error) {
      notify(`Error adding ${type}: ${error.message}`, 'error');
    } else {
      type === 'customer' ? setCustomerForm({ name: '', phone: '', email: '', address: '', loyalty_points: 0, notes: '' }) : setSupplierForm({ name: '', phone: '', email: '', contact_person: '', address: '', supply_category: '', payment_terms: '', delivery_schedule: '', notes: '' });
      type === 'customer' ? fetchCustomers() : fetchSuppliers();
      notify(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`);
    }
    setIsAdding(false);
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    const { id, type } = deleteItemDetails;
    await supabase.from(type).delete().eq('id', id);
    type === 'customers' ? fetchCustomers() : fetchSuppliers();
    notify(`${type === 'customers' ? 'Customer' : 'Supplier'} deleted successfully.`);
    setShowDeleteConfirm(false);
    setIsDeleting(false);
  };

  const handleDeleteClick = (id, type, name) => {
    setDeleteItemDetails({ id, type, name });
    setShowDeleteConfirm(true);
  };

  const handleEditSave = async (type, id, updatedData) => {
    setIsSaving(true);
    // Basic validation for name and phone during edit
    if (!updatedData.name || !updatedData.phone) {
        setIsSaving(false);
        return notify('Name and phone are required.', 'error');
    }
    if (updatedData.email && !isValidEmail(updatedData.email)) {
        setIsSaving(false);
        return notify('Please enter a valid email address.', 'error');
    }
    if (!isValidPhone(updatedData.phone)) {
      setIsSaving(false);
      return notify('Please enter a valid Kenyan phone number (e.g., 07XXXXXXXX or +2547XXXXXXXX).', 'error');
    }

    const { error } = await supabase.from(type).update(updatedData).eq('id', id);
    if (error) {
      notify(`Update error: ${error.message}`, 'error');
    } else {
      type === 'customers' ? fetchCustomers() : fetchSuppliers();
      notify(`${type === 'customers' ? 'Customer' : 'Supplier'} updated successfully!`);
      if (type === 'customers') setShowEditCustomerModal(false);
      if (type === 'suppliers') setShowEditSupplierModal(false);
    }
    setIsSaving(false);
  };

  const handleOpenEditModal = (entry, type) => {
    setCurrentEditData(entry);
    if (type === 'customers') setShowEditCustomerModal(true);
    if (type === 'suppliers') setShowEditSupplierModal(true);
  };

  // --- Sorting Logic ---
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedEntries = [...(activeTab === 'customers' ? customers : suppliers)].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue === null) return sortDirection === 'asc' ? -1 : 1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const currentSearchTerm = activeTab === 'customers' ? customerSearchTerm : supplierSearchTerm;
  const filtered = sortedEntries.filter(e =>
    e.name.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
    e.phone.includes(currentSearchTerm) ||
    (e.email && e.email.toLowerCase().includes(currentSearchTerm.toLowerCase()))
  );
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const renderTableHeaders = () => {
    if (activeTab === 'customers') {
      return (
        <>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('name')}>Name {sortColumn === 'name' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('phone')}>Phone {sortColumn === 'phone' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('email')}>Email {sortColumn === 'email' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2">Address</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('loyalty_points')}>Loyalty Points {sortColumn === 'loyalty_points' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2">Notes</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('created_at')}>Created At {sortColumn === 'created_at' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('updated_at')}>Updated At {sortColumn === 'updated_at' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2">Action</th>
        </>
      );
    } else {
      return (
        <>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('name')}>Name {sortColumn === 'name' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2">Contact Person</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('phone')}>Phone {sortColumn === 'phone' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('email')}>Email {sortColumn === 'email' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2">Address</th>
          <th className="border p-2">Category</th>
          <th className="border p-2">Payment Terms</th>
          <th className="border p-2">Delivery Schedule</th>
          <th className="border p-2">Notes</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('created_at')}>Created At {sortColumn === 'created_at' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2 cursor-pointer" onClick={() => handleSort('updated_at')}>Updated At {sortColumn === 'updated_at' && (sortDirection === 'asc' ? '⬆️' : '⬇️')}</th>
          <th className="border p-2">Action</th>
        </>
      );
    }
  };

  const renderTableRow = (entry) => {
    const commonFields = (
      <>
        <td className="border p-2">{entry.name}</td>
        <td className="border p-2">{entry.contact_person || '-'}</td>
        <td className="border p-2">{entry.phone}</td>
        <td className="border p-2">{entry.email || '-'}</td>
        <td className="border p-2">{entry.address || '-'}</td>
        <td className="border p-2">{entry.supply_category || '-'}</td>
        <td className="border p-2">{entry.payment_terms || '-'}</td>
        <td className="border p-2">{entry.delivery_schedule || '-'}</td>
        <td className="border p-2">{entry.notes || '-'}</td>
        <td className="border p-2">{new Date(entry.created_at).toLocaleDateString()}</td>
        <td className="border p-2">{new Date(entry.updated_at).toLocaleDateString()}</td>
      </>
    );

    const customerSpecificFields = (
      <>
        <td className="border p-2">{entry.name}</td>
        <td className="border p-2">{entry.phone}</td>
        <td className="border p-2">{entry.email || '-'}</td>
        <td className="border p-2">{entry.address || '-'}</td>
        <td className="border p-2">{entry.loyalty_points}</td>
        <td className="border p-2">{entry.notes || '-'}</td>
        <td className="border p-2">{new Date(entry.created_at).toLocaleDateString()}</td>
        <td className="border p-2">{new Date(entry.updated_at).toLocaleDateString()}</td>
      </>
    );

    return (
      <>
        {activeTab === 'customers' ? customerSpecificFields : commonFields}
        <td className="border p-2 whitespace-nowrap">
          <button
            onClick={() => handleOpenEditModal(entry, activeTab)}
            className="text-blue-600 hover:text-blue-800 mr-2"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteClick(entry.id, activeTab, entry.name)}
            className="text-red-600 hover:text-red-800"
            disabled={isDeleting}
          >
            {isDeleting && deleteItemDetails.id === entry.id ? 'Deleting...' : 'Delete'}
          </button>
        </td>
      </>
    );
  };


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      <h1 className="text-2xl font-bold mb-2">👥 Customers & Suppliers</h1>

      {/* Breadcrumb */}
      <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded mb-6" aria-label="Breadcrumb">
        <nav>
          <ol className="list-reset flex items-center space-x-2">
            <li>
              <a href="/" className="text-blue-600 hover:underline">Dashboard</a>
            </li>
            <li>/</li>
            <li className="font-semibold">Customers & Suppliers</li>
          </ol>
        </nav>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        {['customers', 'suppliers'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
              setSortColumn('name'); // Reset sort when changing tabs
              setSortDirection('asc');
            }}
            className={`px-4 py-2 border-b-2 ${activeTab === tab ? 'border-blue-600 font-semibold' : 'border-transparent'} text-lg`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Add Form */}
      <section className="mb-6 bg-white p-4 rounded shadow-md">
        <h2 className="text-xl font-semibold mb-3">➕ Add {activeTab === 'customers' ? 'Customer' : 'Supplier'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Name */}
          <div>
            <label htmlFor={`${activeTab}-name`} className="block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
            <input
              id={`${activeTab}-name`}
              value={activeTab === 'customers' ? customerForm.name : supplierForm.name}
              onChange={e => activeTab === 'customers'
                ? setCustomerForm({ ...customerForm, name: e.target.value })
                : setSupplierForm({ ...supplierForm, name: e.target.value })}
              className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
              placeholder="Name"
              required
            />
          </div>
          {/* Phone */}
          <div>
            <label htmlFor={`${activeTab}-phone`} className="block text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
            <input
              id={`${activeTab}-phone`}
              value={activeTab === 'customers' ? customerForm.phone : supplierForm.phone}
              onChange={e => activeTab === 'customers'
                ? setCustomerForm({ ...customerForm, phone: e.target.value })
                : setSupplierForm({ ...supplierForm, phone: e.target.value })}
              className={`p-2 border rounded w-full ${!isValidPhone(activeTab === 'customers' ? customerForm.phone : supplierForm.phone) && (activeTab === 'customers' ? customerForm.phone : supplierForm.phone) ? 'border-red-500' : ''} focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., 07XXXXXXXX or +2547XXXXXXXX"
              required
            />
            {!isValidPhone(activeTab === 'customers' ? customerForm.phone : supplierForm.phone) && (activeTab === 'customers' ? customerForm.phone : supplierForm.phone) && (
              <p className="text-red-500 text-xs mt-1">Invalid Kenyan phone number format.</p>
            )}
          </div>
          {/* Email */}
          <div>
            <label htmlFor={`${activeTab}-email`} className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id={`${activeTab}-email`}
              value={activeTab === 'customers' ? customerForm.email : supplierForm.email}
              onChange={e => activeTab === 'customers'
                ? setCustomerForm({ ...customerForm, email: e.target.value })
                : setSupplierForm({ ...supplierForm, email: e.target.value })}
              className={`p-2 border rounded w-full ${!isValidEmail(activeTab === 'customers' ? customerForm.email : supplierForm.email) && (activeTab === 'customers' ? customerForm.email : supplierForm.email) ? 'border-red-500' : ''} focus:ring-blue-500 focus:border-blue-500`}
              placeholder="Email"
            />
            {!isValidEmail(activeTab === 'customers' ? customerForm.email : supplierForm.email) && (activeTab === 'customers' ? customerForm.email : supplierForm.email) && (
              <p className="text-red-500 text-xs mt-1">Invalid email format.</p>
            )}
          </div>

          {activeTab === 'customers' && (
            <>
              {/* Customer Specific Fields */}
              <div>
                <label htmlFor="customer-address" className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  id="customer-address"
                  value={customerForm.address}
                  onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address"
                />
              </div>
              <div>
                <label htmlFor="customer-loyalty" className="block text-sm font-medium text-gray-700">Loyalty Points</label>
                <input
                  id="customer-loyalty"
                  type="number"
                  value={customerForm.loyalty_points}
                  onChange={e => setCustomerForm({ ...customerForm, loyalty_points: parseInt(e.target.value) || 0 })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label htmlFor="customer-notes" className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  id="customer-notes"
                  value={customerForm.notes}
                  onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any special notes about this customer..."
                  rows="1"
                ></textarea>
              </div>
            </>
          )}

          {activeTab === 'suppliers' && (
            <>
              {/* Supplier Specific Fields */}
              <div>
                <label htmlFor="supplier-contact" className="block text-sm font-medium text-gray-700">Contact Person</label>
                <input
                  id="supplier-contact"
                  value={supplierForm.contact_person}
                  onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contact Person"
                />
              </div>
              <div>
                <label htmlFor="supplier-address" className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  id="supplier-address"
                  value={supplierForm.address}
                  onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address"
                />
              </div>
              <div>
                <label htmlFor="supplier-category" className="block text-sm font-medium text-gray-700">Supply Category</label>
                <input
                  id="supplier-category"
                  value={supplierForm.supply_category}
                  onChange={e => setSupplierForm({ ...supplierForm, supply_category: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Meat, Spices, Packaging"
                />
              </div>
              <div>
                <label htmlFor="supplier-payment" className="block text-sm font-medium text-gray-700">Payment Terms</label>
                <input
                  id="supplier-payment"
                  value={supplierForm.payment_terms}
                  onChange={e => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Net 30, COD"
                />
              </div>
              <div>
                <label htmlFor="supplier-delivery" className="block text-sm font-medium text-gray-700">Delivery Schedule</label>
                <input
                  id="supplier-delivery"
                  value={supplierForm.delivery_schedule}
                  onChange={e => setSupplierForm({ ...supplierForm, delivery_schedule: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Every Monday, On Call"
                />
              </div>
              <div>
                <label htmlFor="supplier-notes" className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  id="supplier-notes"
                  value={supplierForm.notes}
                  onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  className="p-2 border rounded w-full focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any special notes about this supplier..."
                  rows="1"
                ></textarea>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={() => handleAdd(activeTab === 'customers' ? 'customer' : 'supplier')}
            className={`px-6 py-2 text-white rounded-md transition-colors duration-200 ${activeTab === 'customers' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={isAdding}
          >
            {isAdding ? `Adding ${activeTab === 'customers' ? 'Customer' : 'Supplier'}...` : `Add ${activeTab === 'customers' ? 'Customer' : 'Supplier'}`}
          </button>
        </div>
      </section>

      {/* Search & Export */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <input
          value={activeTab === 'customers' ? customerSearchTerm : supplierSearchTerm}
          onChange={e => {
            if (activeTab === 'customers') {
              setCustomerSearchTerm(e.target.value);
            } else {
              setSupplierSearchTerm(e.target.value);
            }
            setCurrentPage(1);
          }}
          className="border p-2 rounded sm:w-1/2 w-full mb-3 sm:mb-0 focus:ring-blue-500 focus:border-blue-500"
          placeholder={`Search ${activeTab === 'customers' ? 'customer' : 'supplier'} by name, phone, or email...`}
        />
        <CSVLink
          data={activeTab === 'customers' ? customers : suppliers}
          filename={`${activeTab}.csv`}
          className="text-blue-600 underline hover:text-blue-800 transition-colors duration-200"
        >
          📤 Export {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </CSVLink>
      </div>

      {/* Table */}
      <div className="bg-white p-4 rounded shadow-md overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            <p>Loading {activeTab} data... ⏳</p>
          </div>
        ) : (
          <table className="w-full text-sm border border-collapse">
            <thead className="bg-gray-100">
              <tr>{renderTableHeaders()}</tr>
            </thead>
            <tbody>
              {paged.length > 0 ? (
                paged.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 border-b">
                    {renderTableRow(entry)}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={activeTab === 'customers' ? 9 : 12} className="p-4 text-gray-400 text-center border">
                    No {activeTab} found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>


      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 mb-10 text-sm">
        <div className="text-gray-600 mb-2 sm:mb-0">
          Showing {filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 border rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-200'}`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <EditModal
        show={showEditCustomerModal}
        onClose={() => setShowEditCustomerModal(false)}
        data={currentEditData}
        type="customers"
        onSave={handleEditSave}
        isSaving={isSaving}
      />

      {/* Edit Supplier Modal */}
      <EditModal
        show={showEditSupplierModal}
        onClose={() => setShowEditSupplierModal(false)}
        data={currentEditData}
        type="suppliers"
        onSave={handleEditSave}
        isSaving={isSaving}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        show={showDeleteConfirm}
        message={`Are you sure you want to delete ${deleteItemDetails.name || 'this item'}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
