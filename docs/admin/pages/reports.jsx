import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
import Papa from 'papaparse';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // ✅ Correct way for ES modules
import Layout from "../components/layout";

Chart.register(ArcElement, Tooltip, Legend);

const Reports = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch inventory:', error.message);
      setInventory([]);
    } else {
      setInventory(data);
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    if (!inventory || inventory.length === 0) return;

    const csv = Papa.unparse(inventory, {
      columns: true,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'inventory_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Inventory Report', 14, 22);

    const tableColumn = ['#', 'Name', 'Quantity', 'Expiry Date', 'Created At'];
    const tableRows = [];

    inventory.forEach((item, index) => {
      const row = [
        index + 1,
        item.name,
        item.quantity,
        item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A',
        item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A',
      ];
      tableRows.push(row);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });

    doc.save('inventory_report.pdf');
  };

  const filterByDateRange = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date');
      return;
    }

    const filtered = inventory.filter((item) => {
      if (!item.created_at) return false;
      const createdAt = new Date(item.created_at);
      return createdAt >= new Date(startDate) && createdAt <= new Date(endDate);
    });

    setInventory(filtered);
  };

  const pieData = {
    labels: inventory.map((item) => item.name),
    datasets: [
      {
        label: 'Quantity',
        data: inventory.map((item) => item.quantity),
        backgroundColor: [
          '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
        ],
        hoverOffset: 30,
      },
    ],
  };

  return (
    <Layout>
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-red-700 mb-6">Inventory Reports</h1>
        <div className="w-full sm:w-auto">
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="w-full sm:w-auto">
          <label className="block font-medium mb-1">Start Date</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-3 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
          <div className="w-full sm:w-auto">
          <label className="block font-medium mb-1">End Date</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-3 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          onClick={filterByDateRange}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
        >
          Filter
        </button>
        <button
          onClick={() => {
            setStartDate('');
            setEndDate('');
            fetchInventory();
          }}
          className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded ml-2"
        >
          Reset
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <button
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          Export to CSV
        </button>
        <button
          onClick={exportToPDF}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Export to PDF
        </button>
      </div>

      {loading ? (
        <p>Loading data...</p>
      ) : inventory.length === 0 ? (
        <p>No data found.</p>
      ) : (
        <>
          <div className="w-full max-w-full px-4 mb-8">
            <Pie data={pieData} />
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-[600px] table-auto bg-white shadow-md rounded">
            <thead className="bg-red-700 text-white">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Quantity</th>
                <th className="px-4 py-2 text-left">Expiry Date</th>
                <th className="px-4 py-2 text-left">Created At</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item, index) => (
                <tr key={item.id} className="border-b hover:bg-gray-100">
                  <td className="px-4 py-2">{index + 1}</td>
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2">{item.quantity}</td>
                  <td className="px-4 py-2">
                    {item.expiry_date
                      ? new Date(item.expiry_date).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-2">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
      </div>
    </div>
    </Layout>

  );
};

export default Reports;
