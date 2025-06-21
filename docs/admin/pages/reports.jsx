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

  // Fetch all data on component mount
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

    if (!error) {
      setInventory(data);
    } else {
      console.error('Failed to fetch inventory:', error.message);
    }
  };

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setSales(data);
    } else {
      console.error('Failed to fetch sales:', error.message);
    }
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*');

    if (!error) {
      setCustomers(data);
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
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Date Range: ${startDate ? startDate.toLocaleDateString() : 'All time'} - ${endDate ? endDate.toLocaleDateString() : 'All time'}`, 14, 30);

    if (reportType === 'inventory') {
      const filteredData = getFilteredInventory();
      tableColumn = ['#', 'Name', 'Category', 'Quantity', 'Unit', 'Price', 'Cost', 'Expiry Date'];
      tableRows = filteredData.map((item, index) => [
        index + 1,
        item.name,
        item.category || 'Uncategorized',
        item.quantity,
        item.unit,
        `$${item.price.toFixed(2)}`,
        `$${item.cost ? item.cost.toFixed(2) : 'N/A'}`,
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
        `$${item.unit_price.toFixed(2)}`,
        `$${item.total_price.toFixed(2)}`,
        `$${item.profit ? item.profit.toFixed(2) : 'N/A'}`,
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
      columnStyles: {
        0: { cellWidth: 10 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
      }
    });

    // Add summary statistics
    if (reportType === 'sales') {
      const salesData = getFilteredSales();
      const totalSales = salesData.reduce((sum, sale) => sum + sale.total_price, 0);
      const totalProfit = salesData.reduce((sum, sale) => sum + (sale.profit || 0), 0);
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        body: [
          ['Total Sales', `$${totalSales.toFixed(2)}`],
          ['Total Profit', `$${totalProfit.toFixed(2)}`],
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
      filtered = filtered.filter(item => item.quantity < (item.low_stock_threshold || 5));
    }

    if (productFilter) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(productFilter.toLowerCase())
      );
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

    if (customerFilter) {
      filtered = filtered.filter(item => 
        item.customer_name && item.customer_name.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    if (productFilter) {
      filtered = filtered.filter(item => 
        item.product_name.toLowerCase().includes(productFilter.toLowerCase())
      );
    }

    if (reportFrequency === 'daily') {
      const dailySales = {};
      filtered.forEach(sale => {
        const date = new Date(sale.created_at).toLocaleDateString();
        if (!dailySales[date]) {
          dailySales[date] = { 
            ...sale, 
            product_name: date,
            quantity: 0, 
            total_price: 0,
            profit: 0
          };
        }
        dailySales[date].quantity += sale.quantity;
        dailySales[date].total_price += sale.total_price;
        dailySales[date].profit += (sale.profit || 0);
      });
      filtered = Object.values(dailySales);
    } else if (reportFrequency === 'weekly') {
      const weeklySales = {};
      filtered.forEach(sale => {
        const date = new Date(sale.created_at);
        const week = `${date.getFullYear()}-W${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;
        if (!weeklySales[week]) {
          weeklySales[week] = { 
            ...sale, 
            product_name: `Week ${week.split('-W')[1]}`,
            quantity: 0, 
            total_price: 0,
            profit: 0
          };
        }
        weeklySales[week].quantity += sale.quantity;
        weeklySales[week].total_price += sale.total_price;
        weeklySales[week].profit += (sale.profit || 0);
      });
      filtered = Object.values(weeklySales);
    } else if (reportFrequency === 'monthly') {
      const monthlySales = {};
      filtered.forEach(sale => {
        const date = new Date(sale.created_at);
        const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
        if (!monthlySales[month]) {
          monthlySales[month] = { 
            ...sale, 
            product_name: new Date(date.getFullYear(), date.getMonth()).toLocaleString('default', { month: 'long' }),
            quantity: 0, 
            total_price: 0,
            profit: 0
          };
        }
        monthlySales[month].quantity += sale.quantity;
        monthlySales[month].total_price += sale.total_price;
        monthlySales[month].profit += (sale.profit || 0);
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
            '#6366f1', '#14b8a6', '#f43f5e', '#10b981', '#0ea5e9', '#64748b'
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
          yAxisID: 'y1'
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
        categories[category] = {
          quantity: 0,
          sales: 0,
          profit: 0
        };
      }
      if (reportType === 'inventory') {
        categories[category].quantity += item.quantity;
      } else {
        categories[category].sales += item.total_price;
        categories[category].profit += (item.profit || 0);
      }
    });

    return {
      labels: Object.keys(categories),
      datasets: [
        {
          label: reportType === 'inventory' ? 'Quantity by Category' : 'Sales by Category ($)',
          data: Object.values(categories).map(item => reportType === 'inventory' ? item.quantity : item.sales),
          backgroundColor: [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
            '#6366f1', '#14b8a6', '#f43f5e', '#10b981', '#0ea5e9', '#64748b'
          ],
        },
      ],
    };
  };

  const getProfitTrendData = () => {
    const filtered = getFilteredSales();
    const dailyProfit = {};
    
    filtered.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString();
      if (!dailyProfit[date]) {
        dailyProfit[date] = 0;
      }
      dailyProfit[date] += (sale.profit || 0);
    });

    return {
      labels: Object.keys(dailyProfit),
      datasets: [
        {
          label: 'Daily Profit ($)',
          data: Object.values(dailyProfit),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.1,
        },
      ],
    };
  };

  const getCustomerSpendingData = () => {
    const filtered = getFilteredSales();
    const customerSpending = {};

    filtered.forEach(sale => {
      const customer = sale.customer_name || 'Walk-in';
      if (!customerSpending[customer]) {
        customerSpending[customer] = 0;
      }
      customerSpending[customer] += sale.total_price;
    });

    // Sort customers by spending and take top 10
    const sortedCustomers = Object.entries(customerSpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      labels: sortedCustomers.map(item => item[0]),
      datasets: [
        {
          label: 'Total Spending ($)',
          data: sortedCustomers.map(item => item[1]),
          backgroundColor: '#8b5cf6',
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
            low_stock: lowStockFilter,
            customer: customerFilter,
            product: productFilter
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

  // Summary statistics
  const getSummaryStats = () => {
    if (reportType === 'inventory') {
      const filtered = getFilteredInventory();
      const totalItems = filtered.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = filtered.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const lowStockItems = filtered.filter(item => item.quantity < (item.low_stock_threshold || 5)).length;
      
      return [
        { title: 'Total Items', value: totalItems, icon: <BsBoxSeam className="text-blue-500" /> },
        { title: 'Total Value', value: `$${totalValue.toFixed(2)}`, icon: <BsCurrencyDollar className="text-green-500" /> },
        { title: 'Low Stock Items', value: lowStockItems, icon: <BsGraphUp className="text-red-500" /> }
      ];
    } else {
      const filtered = getFilteredSales();
      const totalSales = filtered.reduce((sum, sale) => sum + sale.total_price, 0);
      const totalProfit = filtered.reduce((sum, sale) => sum + (sale.profit || 0), 0);
      const profitMargin = totalSales ? (totalProfit / totalSales) * 100 : 0;
      const avgSaleValue = filtered.length ? totalSales / filtered.length : 0;
      
      return [
        { title: 'Total Sales', value: `$${totalSales.toFixed(2)}`, icon: <BsCurrencyDollar className="text-blue-500" /> },
        { title: 'Total Profit', value: `$${totalProfit.toFixed(2)}`, icon: <BsGraphUp className="text-green-500" /> },
        { title: 'Profit Margin', value: `${profitMargin.toFixed(2)}%`, icon: <BsGraphUp className="text-purple-500" /> },
        { title: 'Avg. Sale Value', value: `$${avgSaleValue.toFixed(2)}`, icon: <BsCurrencyDollar className="text-yellow-500" /> }
      ];
    }
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

        {/* Report Content */}
        {loading ? (
          <div className="text-center py-8">
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {/* Tabs for different views */}
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
                            y: {
                              beginAtZero: true
                            }
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
                            y: {
                              beginAtZero: true
                            },
                            y1: {
                              beginAtZero: true,
                              position: 'right',
                              grid: {
                                drawOnChartArea: false
                              }
                            }
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

            {activeTab === 'customers' && reportType === 'sales' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Top Customers by Spending</h2>
                  <Bar 
                    data={getCustomerSpendingData()} 
                    options={{
                      indexAxis: 'y',
                      scales: {
                        x: {
                          beginAtZero: true
                        }
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
                              <td className="px-4 py-2">${item.price.toFixed(2)}</td>
                              <td className="px-4 py-2">${item.cost ? item.cost.toFixed(2) : 'N/A'}</td>
                              <td className="px-4 py-2">
                                {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2">${item.unit_price.toFixed(2)}</td>
                              <td className="px-4 py-2">${item.total_price.toFixed(2)}</td>
                              <td className="px-4 py-2">${item.profit ? item.profit.toFixed(2) : 'N/A'}</td>
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