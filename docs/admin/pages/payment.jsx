import React, { useState, useEffect, useRef } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';
import { CSVLink } from 'react-csv';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function Payment() {
  // Data states
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({
    todaySales: 0,
    monthlySales: 0,
    inventoryValue: 0,
    profit: 0
  });

  // Form visibility states
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);

  // Form data states
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  });

  const [newSale, setNewSale] = useState({
    customer_id: '',
    product_id: '',
    quantity: 1,
    price: 0,
    payment_method: 'cash',
    notes: ''
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      await fetchCustomers();
      await fetchSuppliers();
      await fetchProducts();
      await fetchSales();
      await fetchFinancialSummary();
    };
    fetchData();
  }, [startDate, endDate]);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*');
    if (data) setSuppliers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('inventory').select('*');
    if (data) setProducts(data);
  };

  const fetchSales = async () => {
    let query = supabase.from('sales').select(`
      *,
      customers(name),
      inventory(name)
    `);
    if (startDate) query = query.gte('created_at', startDate.toISOString());
    if (endDate) query = query.lte('created_at', endDate.toISOString());
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setSales(data);
  };

  const fetchFinancialSummary = async () => {
    // Today's sales
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySales } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', today);

    // Monthly sales
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const { data: monthlySales } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', firstDayOfMonth.toISOString());

    // Inventory value
    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity, selling_price');

    // Calculate values
    const todayTotal = todaySales?.reduce((sum, s) => sum + s.total, 0) || 0;
    const monthTotal = monthlySales?.reduce((sum, s) => sum + s.total, 0) || 0;
    const inventoryValue = inventory?.reduce((sum, i) => sum + (i.quantity * i.selling_price), 0) || 0;
    const profit = monthTotal * 0.3; // Assuming 30% profit margin

    setFinancialSummary({
      todaySales: todayTotal,
      monthlySales: monthTotal,
      inventoryValue,
      profit
    });
  };

  // Form handlers
  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      alert('Please fill in name and phone number');
      return;
    }

    const { error } = await supabase
      .from('customers')
      .insert([newCustomer]);

    if (error) {
      alert('Error adding customer: ' + error.message);
    } else {
      setShowCustomerForm(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      fetchCustomers();
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name || !newSupplier.phone) {
      alert('Please fill in business name and phone number');
      return;
    }

    const { error } = await supabase
      .from('suppliers')
      .insert([newSupplier]);

    if (error) {
      alert('Error adding supplier: ' + error.message);
    } else {
      setShowSupplierForm(false);
      setNewSupplier({ name: '', contact_person: '', phone: '', email: '', address: '' });
      fetchSuppliers();
    }
  };

  const handleAddSale = async () => {
    if (!newSale.customer_id || !newSale.product_id || !newSale.quantity) {
      alert('Please select customer, product and quantity');
      return;
    }

    const selectedProduct = products.find(p => p.id === newSale.product_id);
    const salePrice = newSale.price || selectedProduct.selling_price;

    const { error } = await supabase
      .from('sales')
      .insert([{
        customer_id: newSale.customer_id,
        product_id: newSale.product_id,
        quantity: newSale.quantity,
        price: salePrice,
        total: salePrice * newSale.quantity,
        payment_method: newSale.payment_method,
        notes: newSale.notes,
        cost_price: selectedProduct.price // For profit calculation
      }]);

    if (error) {
      alert('Error recording sale: ' + error.message);
    } else {
      setShowSaleForm(false);
      setNewSale({
        customer_id: '',
        product_id: '',
        quantity: 1,
        price: 0,
        payment_method: 'cash',
        notes: ''
      });
      fetchSales();
      fetchProducts();
      fetchFinancialSummary();
    }
  };

  // Update sale price when product changes
  useEffect(() => {
    if (newSale.product_id) {
      const selectedProduct = products.find(p => p.id === newSale.product_id);
      if (selectedProduct) {
        setNewSale(prev => ({
          ...prev,
          price: selectedProduct.selling_price
        }));
      }
    }
  }, [newSale.product_id, products]);

  // Reusable card component for financial summary
  const SummaryCard = ({ title, value, color }) => (
    <div className={`bg-white p-4 rounded shadow border-l-4 ${color}`}>
      <h3 className="font-medium text-gray-500">{title}</h3>
      <p className="text-2xl font-bold">KSh {value.toLocaleString()}</p>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 space-y-6 max-w-screen-lg mx-auto">
        {/* Date Filter */}
        <div className="flex flex-wrap gap-4 items-end bg-white shadow p-4 rounded">
          <div>
            <label className="block text-sm font-medium">Start Date</label>
            <DatePicker 
              selected={startDate} 
              onChange={setStartDate} 
              className="border p-2 rounded w-full" 
              placeholderText="Select start date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">End Date</label>
            <DatePicker 
              selected={endDate} 
              onChange={setEndDate} 
              className="border p-2 rounded w-full" 
              placeholderText="Select end date"
            />
          </div>
        </div>

        {/* Financial Summary Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard 
            title="Today's Sales" 
            value={financialSummary.todaySales} 
            color="border-green-500" 
          />
          <SummaryCard 
            title="Monthly Sales" 
            value={financialSummary.monthlySales} 
            color="border-blue-500" 
          />
          <SummaryCard 
            title="Inventory Value" 
            value={financialSummary.inventoryValue} 
            color="border-purple-500" 
          />
          <SummaryCard 
            title="Estimated Profit" 
            value={financialSummary.profit} 
            color="border-yellow-500" 
          />
        </div>

        {/* Customers Section */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Customers</h2>
            <button
              onClick={() => setShowCustomerForm(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              + New Customer
            </button>
          </div>
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border p-2 rounded w-full mb-3"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers
              .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(customer => (
                <div key={customer.id} className="border p-3 rounded hover:bg-gray-50">
                  <h3 className="font-bold">{customer.name}</h3>
                  <p className="text-gray-600">{customer.phone}</p>
                  {customer.email && <p className="text-gray-600">{customer.email}</p>}
                </div>
              ))}
          </div>
        </div>

        {/* Suppliers Section */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Suppliers</h2>
            <button
              onClick={() => setShowSupplierForm(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              + New Supplier
            </button>
          </div>
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border p-2 rounded w-full mb-3"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers
              .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(supplier => (
                <div key={supplier.id} className="border p-3 rounded hover:bg-gray-50">
                  <h3 className="font-bold">{supplier.name}</h3>
                  <p className="text-gray-600">{supplier.phone}</p>
                  {supplier.contact_person && (
                    <p className="text-gray-600">Contact: {supplier.contact_person}</p>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Sales Section */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Sales</h2>
            <button
              onClick={() => setShowSaleForm(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              + New Sale
            </button>
          </div>
          <div className="space-y-3">
            {sales.map(sale => (
              <div key={sale.id} className="border p-3 rounded hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold">{sale.inventory?.name}</h3>
                    <p className="text-gray-600">Sold to: {sale.customers?.name || 'Unknown'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">KSh {(sale.price * sale.quantity).toLocaleString()}</p>
                    <p className="text-gray-600">
                      {sale.quantity} × KSh {sale.price?.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(sale.created_at).toLocaleString()} • {sale.payment_method}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Form Modal */}
        {showCustomerForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Full Name*</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Phone Number*</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Address</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowCustomerForm(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomer}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Save Customer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Supplier Form Modal */}
        {showSupplierForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add New Supplier</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Business Name*</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Contact Person</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSupplier.contact_person}
                    onChange={(e) => setNewSupplier({...newSupplier, contact_person: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Phone Number*</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Address</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowSupplierForm(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSupplier}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Save Supplier
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sale Form Modal */}
        {showSaleForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Record New Sale</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Customer*</label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSale.customer_id}
                    onChange={(e) => setNewSale({...newSale, customer_id: e.target.value})}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Product*</label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSale.product_id}
                    onChange={(e) => setNewSale({...newSale, product_id: e.target.value})}
                    required
                  >
                    <option value="">Select Product</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} (KSh {product.selling_price?.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-medium">Quantity*</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={newSale.quantity}
                      onChange={(e) => setNewSale({...newSale, quantity: e.target.value})}
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
                      value={newSale.price}
                      onChange={(e) => setNewSale({...newSale, price: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Payment Method</label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSale.payment_method}
                    onChange={(e) => setNewSale({...newSale, payment_method: e.target.value})}
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="card">Credit Card</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Notes</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={newSale.notes}
                    onChange={(e) => setNewSale({...newSale, notes: e.target.value})}
                    placeholder="Any special instructions"
                    rows={2}
                  />
                </div>
                <div className="bg-gray-100 p-3 rounded">
                  <p className="font-medium">Total: KSh 
                    <span className="text-lg ml-1">
                      {(newSale.price * newSale.quantity).toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowSaleForm(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSale}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Record Sale
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}