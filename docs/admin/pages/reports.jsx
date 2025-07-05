import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
import Papa from 'papaparse';
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Layout from "../components/layout";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiDownload, FiRefreshCw, FiClock, FiTrash2, FiMail } from 'react-icons/fi';
import { BsGraphUp, BsBoxSeam, BsCurrencyDollar } from 'react-icons/bs';

// Register Chart.js components
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
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState(new Date());
  const [reportType, setReportType] = useState('sales');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [reportFrequency, setReportFrequency] = useState('daily');
  const [scheduledReports, setScheduledReports] = useState([]);
  const [email, setEmail] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [customerFilter, setCustomerFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchInventory(),
      fetchSales(),
      fetchCustomers(),
      fetchScheduledReports()
    ]);
    setLoading(false);
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setInventory(data);
    else console.error('Failed to fetch inventory:', error.message);
  };

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setSales(data);
    else console.error('Failed to fetch sales:', error.message);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*');

    if (!error) setCustomers(data);
  };

  const fetchScheduledReports = async () => {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*');

    if (!error) setScheduledReports(data);
  };

  const exportToCSV = () => {
    let dataToExport = [];
    const fileName = `${reportType}_report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;

    if (reportType === 'inventory') {
      dataToExport = getFilteredInventory();
    } else {
      dataToExport = getFilteredSales();
    }

    if (dataToExport.length === 0) {
      alert('No data to export.');
      return;
    }

    const csv = Papa.unparse(dataToExport, { columns: true });
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
    const fileName = `${reportType}_report_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
    let tableColumn = [];
    let tableRows = [];

    doc.setFontSize(18);
    doc.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Date Range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 14, 30);

    if (reportType === 'inventory') {
      const filteredData = getFilteredInventory();
      tableColumn = ['#', 'Name', 'Category', 'Quantity', 'Unit', 'Price', 'Cost', 'Expiry Date'];
      tableRows = filteredData.map((item, index) => [
        index + 1,
        item.name,
        item.category || 'Uncategorized',
        item.quantity,
        item.unit,
        `Ksh${item.price.toFixed(2)}`,
        `Ksh${item.cost ? item.cost.toFixed(2) : 'N/A'}`,
        item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A',
      ]);
    } else {
      const filteredData = getFilteredSales();
      tableColumn = ['#', 'Product', 'Category', 'Quantity', 'Unit Price', 'Total', 'Profit', 'Date', 'Customer'];
      tableRows = filteredData.map((item, index) => [
        index + 1,
        item.product_name,
        item.category || 'Uncategorized',
        item.quantity,
        `Ksh${item.unit_price.toFixed(2)}`,
        `Ksh${item.total_price.toFixed(2)}`,
        `Ksh${item.profit ? item.profit.toFixed(2) : 'N/A'}`,
        new Date(item.created_at).toLocaleDateString(),
        item.customer_name || 'Walk-in',
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    if (reportType === 'sales') {
      const salesData = getFilteredSales();
      const totalSales = salesData.reduce((sum, sale) => sum + sale.total_price, 0);
      const totalProfit = salesData.reduce((sum, sale) => sum + (sale.profit || 0), 0);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        body: [
          ['Total Sales', `Ksh${totalSales.toFixed(2)}`],
          ['Total Profit', `Ksh${totalProfit.toFixed(2)}`],
          ['Profit Margin', `${totalSales ? ((totalProfit / totalSales) * 100).toFixed(2) + '%' : '0%'}`]
        ],
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 40, halign: 'right' }
        }
      });
    }

    doc.save(fileName);
  };
  const getFilteredInventory = () => {
    return inventory.filter(item => {
      const itemDate = new Date(item.created_at);
      const inDateRange = itemDate >= startDate && itemDate <= endDate;
      const inCategory = !categoryFilter || item.category === categoryFilter;
      const isLowStock = !lowStockFilter || item.quantity < (item.low_stock_threshold || 5);
      const matchesProduct = !productFilter || item.name?.toLowerCase().includes(productFilter.toLowerCase());
      return inDateRange && inCategory && isLowStock && matchesProduct;
    });
  };

  const getFilteredSales = () => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      const inDateRange = saleDate >= startDate && saleDate <= endDate;
      const inCategory = !categoryFilter || sale.category === categoryFilter;
      const matchesCustomer = !customerFilter || sale.customer_name?.toLowerCase().includes(customerFilter.toLowerCase());
      const matchesProduct = !productFilter || sale.product_name?.toLowerCase().includes(productFilter.toLowerCase());
      return inDateRange && inCategory && matchesCustomer && matchesProduct;
    });
  };

  const getUniqueCategories = () => {
    const items = reportType === 'inventory' ? inventory : sales;
    const categories = items.map(item => item.category).filter(Boolean);
    return [...new Set(categories)];
  };

  const getSummaryStats = () => {
    if (reportType === 'inventory') {
      const filtered = getFilteredInventory();
      const totalItems = filtered.length;
      const lowStockCount = filtered.filter(item => item.quantity < (item.low_stock_threshold || 5)).length;
      const expiringSoon = filtered.filter(item => {
        if (!item.expiry_date) return false;
        const expiry = new Date(item.expiry_date);
        return expiry >= new Date() && expiry <= new Date(new Date().setDate(new Date().getDate() + 7));
      }).length;

      return [
        { title: 'Total Items', value: totalItems, icon: <BsBoxSeam /> },
        { title: 'Low Stock', value: lowStockCount, icon: <BsCurrencyDollar /> },
        { title: 'Expiring Soon', value: expiringSoon, icon: <FiClock /> }
      ];
    } else {
      const filtered = getFilteredSales();
      const totalRevenue = filtered.reduce((sum, sale) => sum + sale.total_price, 0);
      const totalProfit = filtered.reduce((sum, sale) => sum + (sale.profit || 0), 0);
      const totalTransactions = filtered.length;

      return [
        { title: 'Total Revenue', value: `Ksh${totalRevenue.toFixed(2)}`, icon: <BsCurrencyDollar /> },
        { title: 'Total Profit', value: `Ksh${totalProfit.toFixed(2)}`, icon: <BsGraphUp /> },
        { title: 'Transactions', value: totalTransactions, icon: <FiRefreshCw /> }
      ];
    }
  };

  const getInventoryPieData = () => {
    const data = getFilteredInventory();
    const categoryCounts = {};

    data.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });

    return {
      labels: Object.keys(categoryCounts),
      datasets: [
        {
          label: 'Inventory Distribution',
          data: Object.values(categoryCounts),
          backgroundColor: ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']
        }
      ]
    };
  };

  const getCategoryDistributionData = () => {
    const data = reportType === 'inventory' ? getFilteredInventory() : getFilteredSales();
    const categorySums = {};

    data.forEach(item => {
      const key = item.category || 'Uncategorized';
      if (!categorySums[key]) categorySums[key] = 0;
      categorySums[key] += reportType === 'inventory' ? item.quantity : item.total_price;
    });

    return {
      labels: Object.keys(categorySums),
      datasets: [
        {
          label: reportType === 'inventory' ? 'Quantity' : 'Total Sales',
          data: Object.values(categorySums),
          backgroundColor: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa']
        }
      ]
    };
  };

  const getSalesBarData = () => {
    const data = getFilteredSales();
    const freqMap = {};

    data.forEach(sale => {
      const date = new Date(sale.created_at);
      let key;
      if (reportFrequency === 'daily') key = date.toLocaleDateString();
      else if (reportFrequency === 'weekly') {
        const startOfWeek = new Date(date.setDate(date.getDate() - date.getDay()));
        key = startOfWeek.toLocaleDateString();
      } else if (reportFrequency === 'monthly') key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      else key = sale.product_name;

      freqMap[key] = (freqMap[key] || 0) + sale.total_price;
    });

    return {
      labels: Object.keys(freqMap),
      datasets: [
        {
          label: 'Sales',
          data: Object.values(freqMap),
          backgroundColor: '#f87171'
        }
      ]
    };
  };

  const getSalesTrendData = () => {
    const data = getFilteredSales();
    const dailySales = {};

    data.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString();
      dailySales[date] = (dailySales[date] || 0) + sale.total_price;
    });

    return {
      labels: Object.keys(dailySales),
      datasets: [
        {
          label: 'Total Sales',
          data: Object.values(dailySales),
          borderColor: '#34d399',
          fill: false,
          tension: 0.3
        }
      ]
    };
  };

  const getProfitTrendData = () => {
    const data = getFilteredSales();
    const dailyProfit = {};

    data.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString();
      dailyProfit[date] = (dailyProfit[date] || 0) + (sale.profit || 0);
    });

    return {
      labels: Object.keys(dailyProfit),
      datasets: [
        {
          label: 'Profit',
          data: Object.values(dailyProfit),
          borderColor: '#f59e0b',
          fill: false,
          tension: 0.3
        }
      ]
    };
  };

  const getCustomerSpendingData = () => {
    const data = getFilteredSales();
    const spendingMap = {};

    data.forEach(sale => {
      const name = sale.customer_name || 'Walk-in';
      spendingMap[name] = (spendingMap[name] || 0) + sale.total_price;
    });

    const sorted = Object.entries(spendingMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(entry => entry[0]);
    const values = sorted.map(entry => entry[1]);

    return {
      labels,
      datasets: [
        {
          label: 'Spending (Ksh)',
          data: values,
          backgroundColor: '#a78bfa'
        }
      ]
    };
  };

  const scheduleReport = async () => {
    if (!email) return alert('Please enter an email.');

    const filters = {
      category: categoryFilter,
      low_stock: lowStockFilter,
      customer: customerFilter,
      product: productFilter
    };

    const { error } = await supabase.from('scheduled_reports').insert([
      {
        email,
        report_type: reportType,
        frequency: scheduleFrequency,
        filters
      }
    ]);

    if (error) {
      console.error('Failed to schedule:', error.message);
      alert('Failed to schedule report.');
    } else {
      alert('Report scheduled successfully!');
      setEmail('');
      setShowScheduleForm(false);
      fetchScheduledReports();
    }
  };

  const deleteScheduledReport = async (id) => {
    const { error } = await supabase.from('scheduled_reports').delete().eq('id', id);
    if (!error) fetchScheduledReports();
  };
  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-red-700">POS Analytics Dashboard</h1>
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
          >
            <FiRefreshCw /> Refresh Data
          </button>
        </div>
        
        {/* Report Controls */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex flex-wrap gap-4 items-center mb-4">
            {/* Report Type */}
            <div>
              <label className="block font-medium mb-1">Report Type</label>
              <select
                className="border border-gray-300 rounded px-3 py-2 w-full"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="sales">Sales Report</option>
                <option value="inventory">Inventory Report</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block font-medium mb-1">Date Range</label>
              <div className="flex gap-2">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  className="border border-gray-300 rounded px-3 py-2 w-32"
                  dateFormat="MMM d, yyyy"
                  placeholderText="Start"
                />
                <span className="self-center">to</span>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  className="border border-gray-300 rounded px-3 py-2 w-32"
                  dateFormat="MMM d, yyyy"
                  placeholderText="End"
                  minDate={startDate}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block font-medium mb-1">Category</label>
              <select
                className="border border-gray-300 rounded px-3 py-2 w-full"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {getUniqueCategories().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Low Stock Only (Inventory Only) */}
            {reportType === 'inventory' && (
              <div className="flex items-center mt-6">
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

            {/* Frequency and Customer (Sales Only) */}
            {reportType === 'sales' && (
              <>
                <div>
                  <label className="block font-medium mb-1">Frequency</label>
                  <select
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                    value={reportFrequency}
                    onChange={(e) => setReportFrequency(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="individual">Individual Sales</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Customer</label>
                  <input
                    type="text"
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    placeholder="Filter by customer"
                  />
                </div>
              </>
            )}

            {/* Product Filter */}
            <div>
              <label className="block font-medium mb-1">Product</label>
              <input
                type="text"
                className="border border-gray-300 rounded px-3 py-2 w-full"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Filter by product"
              />
            </div>

            {/* Reset Filters */}
            <button
              onClick={() => {
                setStartDate(new Date(new Date().setDate(new Date().getDate() - 30)));
                setEndDate(new Date());
                setCategoryFilter('');
                setLowStockFilter(false);
                setCustomerFilter('');
                setProductFilter('');
              }}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg mt-6"
            >
              Reset Filters
            </button>
          </div>

          {/* Export and Schedule Buttons */}
          <div className="flex flex-wrap gap-4 mt-4">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              <FiDownload /> Export to CSV
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              <FiDownload /> Export to PDF
            </button>
            <button
              onClick={() => setShowScheduleForm(!showScheduleForm)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
            >
              <FiClock /> Schedule Report
            </button>
          </div>

          {/* Schedule Form */}
          {showScheduleForm && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Schedule This Report</h3>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <label className="block font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    className="border border-gray-300 rounded px-3 py-2 w-full"
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
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg mt-6"
                >
                  <FiMail /> Schedule
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {getSummaryStats().map((stat, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-500 text-sm">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className="text-2xl">
                    {stat.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
                    <th className="px-4 py-2 text-left">Filters</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledReports.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{report.email}</td>
                      <td className="px-4 py-2 capitalize">{report.report_type}</td>
                      <td className="px-4 py-2 capitalize">{report.frequency}</td>
                      <td className="px-4 py-2">
                        {report.filters.category && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Category: {report.filters.category}</span>}
                        {report.filters.low_stock && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Low Stock</span>}
                        {report.filters.customer && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Customer: {report.filters.customer}</span>}
                        {report.filters.product && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Product: {report.filters.product}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => deleteScheduledReport(report.id)}
                          className="text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                          <FiTrash2 /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="text-center py-8">
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b mb-6">
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'overview' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-600'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'details' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-600'}`}
                onClick={() => setActiveTab('details')}
              >
                Detailed Data
              </button>
              {reportType === 'sales' && (
                <button
                  className={`px-4 py-2 font-medium ${activeTab === 'customers' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-600'}`}
                  onClick={() => setActiveTab('customers')}
                >
                  Customer Insights
                </button>
              )}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {reportType === 'inventory' ? (
                  <>
                    <div className="bg-white p-4 rounded-lg shadow-md">
                      <h2 className="text-xl font-semibold mb-4">Inventory Distribution</h2>
                      <Doughnut data={getInventoryPieData()} />
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-md">
                      <h2 className="text-xl font-semibold mb-4">Inventory by Category</h2>
                      <Bar 
                        data={getCategoryDistributionData()} 
                        options={{
                          scales: {
                            y: { beginAtZero: true }
                          }
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-lg shadow-md">
                      <h2 className="text-xl font-semibold mb-4">Sales Overview</h2>
                      <Bar 
                        data={getSalesBarData()} 
                        options={{
                          scales: {
                            y: { beginAtZero: true }
                          }
                        }}
                      />
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-md">
                      <h2 className="text-xl font-semibold mb-4">Sales Trend</h2>
                      <Line data={getSalesTrendData()} />
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-md">
                      <h2 className="text-xl font-semibold mb-4">Profit Trend</h2>
                      <Line data={getProfitTrendData()} />
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-md">
                      <h2 className="text-xl font-semibold mb-4">Category Distribution</h2>
                      <Doughnut data={getCategoryDistributionData()} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Customer Insights */}
            {activeTab === 'customers' && reportType === 'sales' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Top Customers by Spending</h2>
                  <Bar 
                    data={getCustomerSpendingData()} 
                    options={{
                      indexAxis: 'y',
                      scales: {
                        x: { beginAtZero: true }
                      }
                    }}
                  />
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Customer Purchase Frequency</h2>
                  <p className="text-gray-500">Coming soon - Customer purchase frequency analysis</p>
                </div>
              </div>
            )}

            {/* Detailed Table */}
            {(activeTab === 'details' || activeTab === 'customers') && (
              <div className="bg-white p-4 rounded-lg shadow-md">
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
                            <th className="px-4 py-2 text-left">Cost</th>
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
                            <th className="px-4 py-2 text-left">Profit</th>
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
                          <td className={`px-4 py-2 ${reportType === 'inventory' && item.quantity < (item.low_stock_threshold || 5) ? 'text-red-600 font-medium' : ''}`}>
                            {item.quantity}
                          </td>
                          {reportType === 'inventory' ? (
                            <>
                              <td className="px-4 py-2">{item.unit}</td>
                              <td className="px-4 py-2">Ksh{item.price.toFixed(2)}</td>
                              <td className="px-4 py-2">Ksh{item.cost ? item.cost.toFixed(2) : 'N/A'}</td>
                              <td className="px-4 py-2">
                                {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2">Ksh{item.unit_price.toFixed(2)}</td>
                              <td className="px-4 py-2">Ksh{item.total_price.toFixed(2)}</td>
                              <td className="px-4 py-2">Ksh{item.profit ? item.profit.toFixed(2) : 'N/A'}</td>
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
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Reports;
