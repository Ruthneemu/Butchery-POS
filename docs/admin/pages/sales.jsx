import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import Layout from "../components/layout";

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // For editing sales
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');

  useEffect(() => {
    fetchSales();
    fetchInventory();

    const salesSubscription = supabase
      .channel('public:sales')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSales((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSales((prev) =>
              prev.map((sale) => (sale.id === payload.new.id ? payload.new : sale))
            );
          } else if (payload.eventType === 'DELETE') {
            setSales((prev) => prev.filter((sale) => sale.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(salesSubscription);
    };
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setSales(data);
    setLoading(false);
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase.from('inventory').select('id, name, price, quantity');
    if (!error) setInventory(data);
  };

  const handleAddSale = async () => {
    if (!selectedItem || !quantity) return alert('Select item and quantity.');

    const item = inventory.find((inv) => inv.id === Number(selectedItem));
    if (!item) return alert('Item not found.');

    const qty = parseInt(quantity, 10);
    if (qty <= 0) return alert('Quantity must be greater than zero.');

    if (item.quantity < qty) return alert('Not enough stock!');

    const total = item.price * qty;

    // Update inventory quantity
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity - qty })
      .eq('id', item.id);
    if (updateError) return alert('Failed to update stock.');

    // Insert new sale
    const { error: insertError } = await supabase.from('sales').insert([
      {
        item_id: item.id,
        item_name: item.name,
        quantity: qty,
        price: item.price,
        total,
      },
    ]);

    if (insertError) {
      alert('Failed to add sale.');
      // Revert stock update
      await supabase
        .from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
    } else {
      setSelectedItem('');
      setQuantity('');
    }
  };

  // --- Edit sale ---
  const startEditSale = (sale) => {
    setEditingSaleId(sale.id);
    setEditQuantity(sale.quantity);
  };

  const cancelEdit = () => {
    setEditingSaleId(null);
    setEditQuantity('');
  };

  const saveEdit = async (sale) => {
    const newQty = parseInt(editQuantity, 10);
    if (newQty <= 0) return alert('Quantity must be greater than zero.');

    const item = inventory.find((inv) => inv.id === sale.item_id);
    if (!item) return alert('Item not found.');

    const qtyDiff = newQty - sale.quantity; // positive if increase, negative if decrease

    // Check if enough stock if increasing quantity sold
    if (qtyDiff > 0 && item.quantity < qtyDiff) {
      return alert('Not enough stock to increase quantity.');
    }

    // Update inventory quantity accordingly
    const { error: updateInvError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity - qtyDiff })
      .eq('id', item.id);
    if (updateInvError) return alert('Failed to update stock.');

    // Update sale
    const newTotal = sale.price * newQty;
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({ quantity: newQty, total: newTotal })
      .eq('id', sale.id);
    if (updateSaleError) {
      // revert stock change if sale update failed
      await supabase
        .from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      return alert('Failed to update sale.');
    }

    cancelEdit();
  };

  // --- Delete sale ---
  const deleteSale = async (sale) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) return;

    const item = inventory.find((inv) => inv.id === sale.item_id);
    if (!item) return alert('Item not found.');

    // Restore stock quantity
    const { error: updateInvError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity + sale.quantity })
      .eq('id', item.id);
    if (updateInvError) return alert('Failed to restore stock.');

    // Delete sale
    const { error: deleteError } = await supabase.from('sales').delete().eq('id', sale.id);
    if (deleteError) {
      // revert stock restore if delete failed
      await supabase
        .from('inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);
      return alert('Failed to delete sale.');
    }
  };

  // --- Filter sales by date range ---
  const filteredSales = sales.filter((sale) => {
    if (!startDate || !endDate) return true;
    const createdAt = new Date(sale.created_at);
    return createdAt >= new Date(startDate) && createdAt <= new Date(endDate);
  });

  // --- Summary statistics ---
  const totalUnitsSold = filteredSales.reduce((sum, s) => sum + s.quantity, 0);
  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + s.total, 0);

  // --- Export functions ---
  const exportToCSV = () => {
    const csv = Papa.unparse(
      filteredSales.map(({ id, item_name, quantity, price, total, created_at }) => ({
        ID: id,
        Item: item_name,
        Quantity: quantity,
        Price: price,
        Total: total,
        Date: new Date(created_at).toLocaleString(),
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sales.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Sales Report', 14, 16);
    doc.autoTable({
      head: [['ID', 'Item', 'Quantity', 'Price', 'Total', 'Date']],
      body: filteredSales.map(({ id, item_name, quantity, price, total, created_at }) => [
        id,
        item_name,
        quantity,
        price,
        total,
        new Date(created_at).toLocaleString(),
      ]),
      startY: 20,
    });
    doc.save('sales.pdf');
  };

  return (
    <Layout>
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-red-700 mb-4">Real-Time Sales Tracker</h1>

      {/* Add Sale Form */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          className="px-4 py-2 border rounded"
          value={selectedItem}
          onChange={(e) => setSelectedItem(e.target.value)}
        >
          <option value="">Select Item</option>
          {inventory.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - KSh {item.price} ({item.quantity} in stock)
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Quantity"
          className="px-4 py-2 border rounded"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
        />
        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded"
          onClick={handleAddSale}
        >
          Add Sale
        </button>
      </div>

      {/* Filter and Export */}
      <div className="flex flex-wrap gap-4 mb-6">
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
        <button
          onClick={() => {
            setStartDate('');
            setEndDate('');
          }}
          className="bg-gray-500 text-white px-3 py-2 rounded"
        >
          Reset Filter
        </button>
        <button onClick={exportToCSV} className="bg-green-600 text-white px-3 py-2 rounded">
          Export CSV
        </button>
        <button onClick={exportToPDF} className="bg-blue-600 text-white px-3 py-2 rounded">
          Export PDF
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="mb-6 bg-white p-4 rounded shadow text-gray-800">
        <p>
          <strong>Total Units Sold:</strong> {totalUnitsSold}
        </p>
        <p>
          <strong>Total Sales Amount:</strong> KSh {totalSalesAmount.toFixed(2)}
        </p>
      </div>

      {/* Sales Table */}
      {loading ? (
        <p>Loading...</p>
      ) : filteredSales.length === 0 ? (
        <p>No sales found.</p>
      ) : (
        <table className="w-full bg-white shadow rounded table-auto">
          <thead className="bg-red-700 text-white">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-left">Qty</th>
              <th className="px-4 py-2 text-left">Price</th>
              <th className="px-4 py-2 text-left">Total</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale, index) => (
              <tr key={sale.id} className="border-b hover:bg-gray-100">
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2">{sale.item_name}</td>
                <td className="px-4 py-2">
                  {editingSaleId === sale.id ? (
                    <input
                      type="number"
                      min="1"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className="w-16 px-1 py-0.5 border rounded"
                    />
                  ) : (
                    sale.quantity
                  )}
                </td>
                <td className="px-4 py-2">KSh {sale.price}</td>
                <td className="px-4 py-2 font-semibold text-green-700">KSh {sale.total}</td>
                <td className="px-4 py-2">{new Date(sale.created_at).toLocaleString()}</td>
                <td className="px-4 py-2 space-x-2">
                  {editingSaleId === sale.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(sale)}
                        className="bg-green-600 text-white px-3 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="bg-gray-400 text-white px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditSale(sale)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSale(sale)}
                        className="bg-red-600 text-white px-3 py-1 rounded"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </Layout>
  );
};

export default Sales;
