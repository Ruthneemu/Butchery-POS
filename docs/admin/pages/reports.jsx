import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
import Papa from 'papaparse';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Layout from "../components/layout";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Register all Chart.js components
Chart.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title
);

const Reports = () => {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reportType, setReportType] = useState('inventory');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [reportFrequency, setReportFrequency] = useState('daily');
  const [scheduledReports, setScheduledReports] = useState([]);
  const [email, setEmail] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Fetch all data on component mount
  useEffect(() => {
    fetchInventory();
    fetchSales();
    fetchScheduledReports();
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

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch sales:', error.message);
      setSales([]);
    } else {
      setSales(data);
    }
  };

  const fetchScheduledReports = async () => {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*');

    if (!error) {
      setScheduledReports(data);
    }
  };

  // Export functions
  const exportToCSV = () => {
    let dataToExport = [];
    const fileName = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;

    if (reportType === 'inventory') {
      dataToExport = getFilteredInventory();
    } else {
      dataToExport = getFilteredSales();
    }

    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    const csv = Papa.unparse(dataToExport, {
      columns: true,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const fileName = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
    let tableColumn = [];
    let tableRows = [];

    doc.setFontSize(18);
    doc.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, 14, 22);

    if (reportType === 'inventory') {
      const filteredData = getFilteredInventory();
      tableColumn = ['#', 'Name', 'Quantity', 'Unit', 'Price', 'Expiry Date'];
      tableRows = filteredData.map((item, index) => [
        index + 1,
        item.name,
        item.quantity,
        item.unit,
        `$${item.price}`,
        item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A',
      ]);
    } else {
      const filteredData = getFilteredSales();
      tableColumn = ['#', 'Product', 'Quantity', 'Unit Price', 'Total', 'Date', 'Customer'];
      tableRows = filteredData.map((item, index) => [
        index + 1,
        item.product_name,
        item.quantity,
        `$${item.unit_price}`,
        `$${item.total_price}`,
        new Date(item.created_at).toLocaleDateString(),
        item.customer_name || 'Walk-in',
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [239, 68, 68] } // Red-500
    });

    doc.save(fileName);
  };

  // Filter functions
  const getFilteredInventory = () => {
    let filtered = [...inventory];

    if (startDate && endDate) {
      filtered = filtered.filter((item) => {
        if (!item.created_at) return false;
        const createdAt = new Date(item.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }

    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (lowStockFilter) {
      filtered = filtered.filter(item => item.quantity < 5);
    }

    return filtered;
  };

  const getFilteredSales = () => {
    let filtered = [...sales];

    if (startDate && endDate) {
      filtered = filtered.filter((item) => {
        if (!item.created_at) return false;
        const saleDate = new Date(item.created_at);
        return saleDate >= startDate && saleDate <= endDate;
      });
    }

    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (reportFrequency === 'daily') {
      // Group by day
      const dailySales = {};
      filtered.forEach(sale => {
        const date = new Date(sale.created_at).toLocaleDateString();
        if (!dailySales[date]) {
          dailySales[date] = { ...sale, quantity: 0, total_price: 0 };
        }
        dailySales[date].quantity += sale.quantity;
        dailySales[date].total_price += sale.total_price;
      });
      filtered = Object.values(dailySales);
    } else if (reportFrequency === 'weekly') {
      // Group by week
      const weeklySales = {};
      filtered.forEach(sale => {
        const date = new Date(sale.created_at);
        const week = `${date.getFullYear()}-W${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;
        if (!weeklySales[week]) {
          weeklySales[week] = { ...sale, product_name: `Week ${week.split('-W')[1]}`, quantity: 0, total_price: 0 };
        }
        weeklySales[week].quantity += sale.quantity;
        weeklySales[week].total_price += sale.total_price;
      });
      filtered = Object.values(weeklySales);
    } else if (reportFrequency === 'monthly') {
      // Group by month
      const monthlySales = {};
      filtered.forEach(sale => {
        const date = new Date(sale.created_at);
        const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
        if (!monthlySales[month]) {
          monthlySales[month] = { ...sale, product_name: new Date(date.getFullYear(), date.getMonth()).toLocaleString('default', { month: 'long' }), quantity: 0, total_price: 0 };
        }
        monthlySales[month].quantity += sale.quantity;
        monthlySales[month].total_price += sale.total_price;
      });
      filtered = Object.values(monthlySales);
    }

    return filtered;
  };

  // Chart data functions
  const getInventoryPieData = () => {
    const filtered = getFilteredInventory();
    return {
      labels: filtered.map((item) => item.name),
      datasets: [
        {
          label: 'Quantity',
          data: filtered.map((item) => item.quantity),
          backgroundColor: [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
          ],
          hoverOffset: 30,
        },
      ],
    };
  };

  const getSalesBarData = () => {
    const filtered = getFilteredSales();
    return {
      labels: filtered.map((item) => item.product_name || `Sale ${filtered.indexOf(item) + 1}`),
      datasets: [
        {
          label: 'Total Sales ($)',
          data: filtered.map((item) => item.total_price),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Quantity Sold',
          data: filtered.map((item) => item.quantity),
          backgroundColor: '#10b981',
        },
      ],
    };
  };

  const getSalesTrendData = () => {
    const filtered = getFilteredSales();
    const dailySales = {};
    
    filtered.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString();
      if (!dailySales[date]) {
        dailySales[date] = 0;
      }
      dailySales[date] += sale.total_price;
    });

    return {
      labels: Object.keys(dailySales),
      datasets: [
        {
          label: 'Daily Sales ($)',
          data: Object.values(dailySales),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.1,
        },
      ],
    };
  };

  const getCategoryDistributionData = () => {
    const filtered = reportType === 'inventory' ? getFilteredInventory() : getFilteredSales();
    const categories = {};

    filtered.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category] += reportType === 'inventory' ? item.quantity : item.total_price;
    });

    return {
      labels: Object.keys(categories),
      datasets: [
        {
          label: reportType === 'inventory' ? 'Quantity by Category' : 'Sales by Category ($)',
          data: Object.values(categories),
          backgroundColor: [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
          ],
        },
      ],
    };
  };

  // Schedule report functions
  const scheduleReport = async () => {
    if (!email) {
      alert('Please enter an email address');
      return;
    }

    const { error } = await supabase
      .from('scheduled_reports')
      .insert([
        {
          email,
          report_type: reportType,
          frequency: scheduleFrequency,
          filters: {
            start_date: startDate,
            end_date: endDate,
            category: categoryFilter,
            low_stock: lowStockFilter
          }
        }
      ]);

    if (error) {
      alert('Failed to schedule report: ' + error.message);
    } else {
      setEmail('');
      setShowScheduleForm(false);
      fetchScheduledReports();
      alert('Report scheduled successfully!');
    }
  };

  const deleteScheduledReport = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scheduled report?')) return;

    const { error } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchScheduledReports();
    }
  };

  // Get unique categories for filter dropdown
  const getUniqueCategories = () => {
    const data = reportType === 'inventory' ? inventory : sales;
    const categories = new Set();
    data.forEach(item => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories);
  };

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-red-700 mb-6">POS Analytics Dashboard</h1>
        
        {/* Report Controls */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex flex-wrap gap-4 items-center mb-4">
            <div>
              <label className="block font-medium mb-1">Report Type</label>
              <select
                className="border border-gray-300 rounded px-3 py-2"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="inventory">Inventory Report</option>
                <option value="sales">Sales Report</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                className="border border-gray-300 rounded px-3 py-2"
                dateFormat="yyyy-MM-dd"
                placeholderText="Select start date"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                className="border border-gray-300 rounded px-3 py-2"
                dateFormat="yyyy-MM-dd"
                placeholderText="Select end date"
                minDate={startDate}
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Category</label>
              <select
                className="border border-gray-300 rounded px-3 py-2"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {getUniqueCategories().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {reportType === 'inventory' && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lowStock"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="lowStock" className="font-medium">Low Stock Only</label>
              </div>
            )}

            {reportType === 'sales' && (
              <div>
                <label className="block font-medium mb-1">Frequency</label>
                <select
                  className="border border-gray-300 rounded px-3 py-2"
                  value={reportFrequency}
                  onChange={(e) => setReportFrequency(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="individual">Individual Sales</option>
                </select>
              </div>
            )}

            <button
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setCategoryFilter('');
                setLowStockFilter(false);
              }}
              className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
            >
              Reset Filters
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
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
            <button
              onClick={() => setShowScheduleForm(!showScheduleForm)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
            >
              Schedule Report
            </button>
          </div>

          {showScheduleForm && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">Schedule This Report</h3>
              <div className="flex flex-wrap gap-4 items-center">
                <div>
                  <label className="block font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    className="border border-gray-300 rounded px-3 py-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email to receive reports"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Frequency</label>
                  <select
                    className="border border-gray-300 rounded px-3 py-2"
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <button
                  onClick={scheduleReport}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  Schedule
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scheduled Reports List */}
        {scheduledReports.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Scheduled Reports</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Report Type</th>
                    <th className="px-4 py-2 text-left">Frequency</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledReports.map((report) => (
                    <tr key={report.id} className="border-b">
                      <td className="px-4 py-2">{report.email}</td>
                      <td className="px-4 py-2 capitalize">{report.report_type}</td>
                      <td className="px-4 py-2 capitalize">{report.frequency}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => deleteScheduledReport(report.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Content */}
        {loading ? (
          <div className="text-center py-8">
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {reportType === 'inventory' ? (
                <>
                  <div className="bg-white p-4 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Inventory Distribution</h2>
                    <Pie data={getInventoryPieData()} />
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Inventory by Category</h2>
                    <Bar data={getCategoryDistributionData()} />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Sales Overview</h2>
                    <Bar data={getSalesBarData()} />
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Sales Trend</h2>
                    <Line data={getSalesTrendData()} />
                  </div>
                </>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Category Distribution</h2>
              <Pie data={getCategoryDistributionData()} />
            </div>

            {/* Data Table Section */}
            <div className="bg-white p-4 rounded-lg shadow-md mt-6">
              <h2 className="text-xl font-semibold mb-4">
                {reportType === 'inventory' ? 'Inventory Details' : 'Sales Details'}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {reportType === 'inventory' ? (
                        <>
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Category</th>
                          <th className="px-4 py-2 text-left">Quantity</th>
                          <th className="px-4 py-2 text-left">Unit</th>
                          <th className="px-4 py-2 text-left">Price</th>
                          <th className="px-4 py-2 text-left">Expiry Date</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-left">Category</th>
                          <th className="px-4 py-2 text-left">Quantity</th>
                          <th className="px-4 py-2 text-left">Unit Price</th>
                          <th className="px-4 py-2 text-left">Total</th>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-left">Customer</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(reportType === 'inventory' ? getFilteredInventory() : getFilteredSales()).map((item, index) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{index + 1}</td>
                        <td className="px-4 py-2">{item.name || item.product_name}</td>
                        <td className="px-4 py-2">{item.category || 'Uncategorized'}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        {reportType === 'inventory' ? (
                          <>
                            <td className="px-4 py-2">{item.unit}</td>
                            <td className="px-4 py-2">${item.price}</td>
                            <td className="px-4 py-2">
                              {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2">${item.unit_price}</td>
                            <td className="px-4 py-2">${item.total_price}</td>
                            <td className="px-4 py-2">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">{item.customer_name || 'Walk-in'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Reports;