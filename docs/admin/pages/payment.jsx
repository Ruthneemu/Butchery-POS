import React, { useState, useEffect, useRef } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function Payment() {
  // Data states
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // ADD THIS LINE
  const [financialSummary, setFinancialSummary] = useState({
    todaySales: 0,
    monthlySales: 0,
    inventoryValue: 0,
    profit: 0
  });
  
  // Transaction-related states
  const [transactionItems, setTransactionItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Filter states
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  //fetch suppliers state
  const [supplierSearchTerm, setSupplierSearchTerm] = useState(''); // ADD THIS LINE
  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*');
    if (data) setSuppliers(data);
};

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      await fetchCustomers();
      await fetchProducts();
      // Ensure fetchSales and fetchFinancialSummary are called here for initial load
      await fetchSales(); // Needs to be fetched before financial summary
      await fetchFinancialSummary();
    };
    fetchData();
  }, [startDate, endDate]); // Dependencies for sales and summary filtering

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('inventory').select('*');
    if (data) setProducts(data);
  };

  // Reintroduced fetchSales function
  const fetchSales = async () => {
    let query = supabase.from('sales').select(`
      *,
      customers(name),
      inventory(name, selling_price, cost_price)
    `);
    if (startDate) query = query.gte('created_at', startDate.toISOString());
    if (endDate) query = query.lte('created_at', endDate.toISOString());
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setSales(data);
  };


  const fetchFinancialSummary = async () => {
    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', today.toISOString());

    // Monthly sales
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const { data: monthlySalesData } = await supabase
      .from('sales')
      .select('total, quantity, price, cost_price') // Also fetch for profit calculation
      .gte('created_at', firstDayOfMonth.toISOString());

    // Inventory value
    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity, selling_price');

    // Calculate values
    const todayTotal = todaySalesData?.reduce((sum, s) => sum + s.total, 0) || 0;
    const monthTotal = monthlySalesData?.reduce((sum, s) => sum + s.total, 0) || 0;

    // Profit calculation: (selling_price - cost_price) * quantity for each sale
    const profit = monthlySalesData?.reduce((sum, s) => {
        // Ensure cost_price is available, fallback if not
        const itemCostPrice = s.inventory?.cost_price || 0; // Assuming inventory relation is fetched, or sales table has cost_price
        return sum + (s.price - itemCostPrice) * s.quantity;
    }, 0) || 0;

    const inventoryValue = inventory?.reduce((sum, i) => sum + (i.quantity * i.selling_price), 0) || 0;

    setFinancialSummary({
      todaySales: todayTotal,
      monthlySales: monthTotal,
      inventoryValue,
      profit
    });
  };

  // --- Product Selection & Quantity Handlers ---
  const handleAddItemToTransaction = async () => {
    const product = products.find(p => p.id === selectedProductId);
    if (product && itemQuantity > 0) {
      const existingItemIndex = transactionItems.findIndex(item => item.product_id === selectedProductId);

      if (existingItemIndex > -1) {
        // Update existing item quantity
        const updatedItems = [...transactionItems];
        updatedItems[existingItemIndex].quantity += parseFloat(itemQuantity);
        updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].price;
        setTransactionItems(updatedItems);
      } else {
        // Add new item
        setTransactionItems([
          ...transactionItems,
          {
            product_id: product.id,
            name: product.name,
            quantity: parseFloat(itemQuantity),
            price: product.selling_price,
            total: parseFloat(itemQuantity) * product.selling_price,
            cost_price: product.cost_price // For profit calculation
          }
        ]);
      }
      setSelectedProductId('');
      setItemQuantity(1);
    } else {
      alert('Please select a product and enter a valid quantity.');
    }
  };

  const handleRemoveItem = (index) => {
    const updatedItems = transactionItems.filter((_, i) => i !== index);
    setTransactionItems(updatedItems);
  };

  const calculateGrandTotal = () => {
    return transactionItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateChange = () => {
    const total = calculateGrandTotal();
    return cashReceived > total ? cashReceived - total : 0;
  };

  // --- Transaction Finalization & Receipt ---
  const handleProcessPayment = async () => {
    const grandTotal = calculateGrandTotal();
    if (transactionItems.length === 0) {
      alert('Please add items to the transaction.');
      return;
    }
    if (paymentMethod === 'cash' && cashReceived < grandTotal) {
      alert('Cash received is less than the total amount.');
      return;
    }
    if (paymentMethod === 'credit' && !selectedCustomerId) {
        alert('Please select a customer for a credit/account sale.');
        return;
    }

    // Prepare sales data for Supabase
    const salesData = transactionItems.map(item => ({
      customer_id: selectedCustomerId || null, // Link to customer if selected
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      payment_method: paymentMethod,
      // Pass cost_price for accurate profit calculation in future financial reports
      cost_price: item.cost_price 
    }));

    const { error } = await supabase
      .from('sales')
      .insert(salesData);

    if (error) {
      alert('Error processing payment: ' + error.message);
      console.error('Payment processing error:', error);
    } else {
      alert('Payment successful!');
      // After successful payment, re-fetch sales and financial summary
      await fetchSales();
      await fetchFinancialSummary();
      // TODO: Implement receipt generation logic (print/email/SMS)
      console.log('Transaction processed. Receipt details:', {
        items: transactionItems,
        total: grandTotal,
        paymentMethod,
        customer: selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : 'Guest',
        change: paymentMethod === 'cash' ? calculateChange() : 0
      });
      // Reset transaction states
      setTransactionItems([]);
      setSelectedCustomerId('');
      setCustomerSearchTerm(''); // Clear customer search too
      setPaymentMethod('cash');
      setCashReceived(0);
      setShowPaymentModal(false);
    }
  };

  // Reusable card component for financial summary
  const SummaryCard = ({ title, value, color }) => (
    <div className={`bg-white p-4 rounded shadow border-l-4 ${color}`}>
      <h3 className="font-medium text-gray-500">{title}</h3>
      <p className="text-2xl font-bold">KSh {value.toLocaleString()}</p>
    </div>
  );

  const filteredCustomers = customerSearchTerm
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()))
    : [];

  const selectedCustomerName = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)?.name
    : 'Guest Customer';


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

        {/* --- Transaction Section --- */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">New Transaction</h2>

          {/* Customer Linking */}
          <div className="mb-4 relative"> {/* Added relative for absolute positioning of search results */}
            <label className="block text-sm font-medium mb-1">Link Customer:</label>
            <input
              type="text"
              placeholder="Search or select customer..."
              value={customerSearchTerm}
              onChange={(e) => {
                setCustomerSearchTerm(e.target.value);
                setSelectedCustomerId(''); // Deselect if typing
              }}
              className="border p-2 rounded w-full mb-2"
            />
            {customerSearchTerm && filteredCustomers.length > 0 && (
              <div className="border border-gray-300 rounded max-h-40 overflow-y-auto bg-white absolute z-10 w-full"> {/* Made width full */}
                {filteredCustomers.map(customer => (
                  <div
                    key={customer.id}
                    className="p-2 cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerSearchTerm(customer.name); // Display full name in input
                    }}
                  >
                    {customer.name} ({customer.phone})
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setSelectedCustomerId('');
                setCustomerSearchTerm('Guest Customer');
              }}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm mt-2"
            >
              Set as Guest
            </button>
            <p className="mt-2 text-sm text-gray-600">Selected: <span className="font-medium">{selectedCustomerName}</span></p>
          </div>

          {/* Product Selection */}
          <div className="flex gap-2 mb-4">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="border p-2 rounded flex-grow"
            >
              <option value="">Select Product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} (KSh {product.selling_price?.toLocaleString()})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={itemQuantity}
              onChange={(e) => setItemQuantity(parseFloat(e.target.value))}
              placeholder="Quantity"
              className="border p-2 rounded w-24"
            />
            <button
              onClick={handleAddItemToTransaction}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Add Item
            </button>
          </div>

          {/* Transaction Items Display */}
          <div className="border rounded p-3 mb-4 max-h-60 overflow-y-auto">
            <h3 className="font-semibold mb-2">Items in Cart:</h3>
            {transactionItems.length === 0 ? (
              <p className="text-gray-500">No items added yet.</p>
            ) : (
              <ul>
                {transactionItems.map((item, index) => (
                  <li key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.quantity} x KSh {item.price?.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center">
                      <p className="font-bold mr-3">KSh {item.total?.toLocaleString()}</p>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 text-lg"
                      >
                        &times;
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Transaction Summary */}
          <div className="text-right text-2xl font-bold mb-4">
            Grand Total: KSh {calculateGrandTotal().toLocaleString()}
          </div>

          {/* Payment Button */}
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-blue-600 text-white w-full py-3 rounded text-lg font-semibold"
            disabled={transactionItems.length === 0}
          >
            Proceed to Payment
          </button>
        </div>

        {/* Suppliers Section (kept as per previous instruction) */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Suppliers</h2>
          </div>
          // In the Suppliers section
<input
    type="text"
    placeholder="Search suppliers..."
    value={supplierSearchTerm} // Now linked to the declared state
    onChange={(e) => setSupplierSearchTerm(e.target.value)} // Now linked to the declared state setter
    className="border p-2 rounded w-full mb-3"
/>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Removed suppliers state and rendering as it was removed in a previous step, and the current request focuses on payment.
                If you need suppliers list, please explicitly ask to re-add its fetch and display.
                For now, keeping the section title, but content will be empty as `suppliers` state is no longer populated.
            */}
            {/* Re-introducing the supplier display based on the `suppliers` state */}
            {suppliers
              .filter(s => s.name.toLowerCase().includes(customerSearchTerm.toLowerCase())) // Use customerSearchTerm for simplicity, or reintroduce separate supplierSearchTerm
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

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Complete Payment</h2>
              <p className="text-lg font-bold mb-4">Amount Due: KSh {calculateGrandTotal().toLocaleString()}</p>
              <p className="text-md text-gray-700 mb-4">Paying for: {selectedCustomerName}</p>

              {/* Payment Method Selection */}
              <div className="mb-4">
                <label className="block mb-2 font-medium">Select Payment Method:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setCashReceived(0); // Reset cash received if method changes
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="card">Card Payment</option>
                  <option value="bank">Bank Transfer/Mobile Banking</option>
                  <option value="credit">Credit/Account Sale</option>
                </select>
              </div>

              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <label className="block mb-1 font-medium">Cash Received (KSh):</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="Enter amount received"
                  />
                  <p className="mt-2 text-green-600 font-semibold">
                    Change Due: KSh {calculateChange().toLocaleString()}
                  </p>
                </div>
              )}

              {paymentMethod === 'mpesa' && (
                <div className="mb-4 bg-yellow-50 p-3 rounded">
                  <p className="font-medium">M-Pesa Payment Instructions:</p>
                  <p className="text-sm">Please provide your M-Pesa Till/Paybill number.</p>
                  <p className="text-sm text-gray-700 mt-2">
                    **Note**: Real integration would involve
                    <a href="https://developer.safaricom.co.ke/docs" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Safaricom Daraja API
                    </a>
                    to generate STK push or confirm transactions.
                  </p>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="mb-4 bg-blue-50 p-3 rounded">
                  <p className="font-medium">Card Payment:</p>
                  <p className="text-sm">Prompt customer to swipe/tap card on reader.</p>
                  <p className="text-sm text-gray-700 mt-2">
                    **Note**: Requires integration with a physical card reader and payment gateway.
                  </p>
                </div>
              )}

              {paymentMethod === 'bank' && (
                <div className="mb-4 bg-purple-50 p-3 rounded">
                  <p className="font-medium">Bank Transfer / Mobile Banking:</p>
                  <p className="text-sm">Provide bank details or business mobile number for transfer.</p>
                  <p className="text-sm text-gray-700 mt-2">
                    **Note**: This is typically for larger or pre-arranged payments and may require manual confirmation.
                  </p>
                </div>
              )}

              {paymentMethod === 'credit' && (
                <div className="mb-4 bg-orange-50 p-3 rounded">
                  <p className="font-medium">Credit / Account Sale:</p>
                  <p className="text-sm">This transaction will be recorded as an outstanding balance for the selected customer.</p>
                  {!selectedCustomerId && (
                    <p className="text-red-500 text-sm mt-1">
                      **Warning**: Please select a specific customer for a credit sale.
                    </p>
                  )}
                </div>
              )}

              {/* Receipt Options (Placeholder) */}
              <div className="mb-4">
                <label className="block mb-2 font-medium">Receipt Options:</label>
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" name="receiptOption" value="print" className="form-radio" defaultChecked />
                    <span className="ml-2">Print Receipt</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" name="receiptOption" value="email" className="form-radio" />
                    <span className="ml-2">Email/SMS</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" name="receiptOption" value="none" className="form-radio" />
                    <span className="ml-2">No Receipt</span>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  **Note**: Actual print/email/SMS functionality requires further integration.
                </p>
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessPayment}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  disabled={paymentMethod === 'cash' && cashReceived < calculateGrandTotal() || (paymentMethod === 'credit' && !selectedCustomerId)}
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}