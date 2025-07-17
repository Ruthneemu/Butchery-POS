import React, { useEffect, useState, useMemo, useCallback } from 'react';
import supabase from '../supabaseClient';
import Papa from 'papaparse';
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Layout from "../components/layout";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiDownload, FiRefreshCw, FiClock, FiTrash2, FiMail, FiXCircle } from 'react-icons/fi'; // Added FiXCircle for clearing filters
import { BsGraphUp, BsBoxSeam, BsCurrencyDollar } from 'react-icons/bs';

// You would typically import a toast library here, e.g.:
// import { toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';

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

// --- Constants (consider moving to a separate file like src/constants.js) ---
const LOW_STOCK_THRESHOLD = 5; // Default low stock threshold
const DEBOUNCE_DELAY = 300; // Milliseconds for debounce

const Reports = () => {
    // --- State Variables ---
    const [inventory, setInventory] = useState([]);
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loadingData, setLoadingData] = useState(true); // Specific loading for data fetch
    const [exportingCSV, setExportingCSV] = useState(false); // Specific loading for CSV export
    const [exportingPDF, setExportingPDF] = useState(false); // Specific loading for PDF export
    const [schedulingReport, setSchedulingReport] = useState(false); // Specific loading for scheduling

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

    // --- Effects ---
    useEffect(() => {
        fetchData();
    }, []); // Empty dependency array means this runs once on mount

    // --- Data Fetching Functions ---
    const fetchData = async () => {
        setLoadingData(true);
        try {
            await Promise.all([
                fetchInventory(),
                fetchSales(),
                fetchCustomers(),
                fetchScheduledReports()
            ]);
        } catch (error) {
            console.error("Error fetching all data:", error);
            // toast.error("Failed to load all data. Please try again."); // Using toast
        } finally {
            setLoadingData(false);
        }
    };

    const fetchInventory = async () => {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) setInventory(data);
        else {
            console.error('Failed to fetch inventory:', error.message);
            // toast.error(`Failed to fetch inventory: ${error.message}`);
        }
    };

    const fetchSales = async () => {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) setSales(data);
        else {
            console.error('Failed to fetch sales:', error.message);
            // toast.error(`Failed to fetch sales: ${error.message}`);
        }
    };

    const fetchCustomers = async () => {
        const { data, error } = await supabase
            .from('customers')
            .select('*');

        if (!error) setCustomers(data);
        else {
            console.error('Failed to fetch customers:', error.message);
            // toast.error(`Failed to fetch customers: ${error.message}`);
        }
    };

    const fetchScheduledReports = async () => {
        const { data, error } = await supabase
            .from('scheduled_reports')
            .select('*');

        if (!error) setScheduledReports(data);
        else {
            console.error('Failed to fetch scheduled reports:', error.message);
            // toast.error(`Failed to fetch scheduled reports: ${error.message}`);
        }
    };

    // --- Date Range Presets Logic ---
    const handlePresetDateRange = (days) => {
        const end = new Date();
        const start = new Date();
        if (days === '30') {
            start.setDate(start.getDate() - 30);
        } else if (days === '7') {
            start.setDate(start.getDate() - 7);
        } else if (days === 'month') {
            start.setDate(1); // Start of current month
        } else if (days === 'lastMonth') {
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setDate(0); // Last day of previous month
        } else if (days === 'year') {
            start.setMonth(0);
            start.setDate(1);
        } else if (days === 'all') {
            // Set a very early date, or rely on fetching all data if your DB supports it
            setStartDate(new Date(2000, 0, 1)); // Arbitrary early date
            setEndDate(new Date());
            return;
        }
        setStartDate(start);
        setEndDate(end);
    };

    // --- Memoized Filtered Data ---
    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const itemDate = new Date(item.created_at);
            const inDateRange = itemDate >= startDate && itemDate <= endDate;
            const inCategory = !categoryFilter || item.category === categoryFilter;
            const isLowStock = !lowStockFilter || item.quantity < (item.low_stock_threshold || LOW_STOCK_THRESHOLD);
            const matchesProduct = !productFilter || item.name?.toLowerCase().includes(productFilter.toLowerCase());
            return inDateRange && inCategory && isLowStock && matchesProduct;
        });
    }, [inventory, startDate, endDate, categoryFilter, lowStockFilter, productFilter]);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            const inDateRange = saleDate >= startDate && saleDate <= endDate;
            const inCategory = !categoryFilter || sale.category === categoryFilter;
            const matchesCustomer = !customerFilter || sale.customer_name?.toLowerCase().includes(customerFilter.toLowerCase());
            const matchesProduct = !productFilter || sale.product_name?.toLowerCase().includes(productFilter.toLowerCase());
            return inDateRange && inCategory && matchesCustomer && matchesProduct;
        });
    }, [sales, startDate, endDate, categoryFilter, customerFilter, productFilter]);

    const getUniqueCategories = useMemo(() => {
        const items = reportType === 'inventory' ? inventory : sales;
        const categories = items.map(item => item.category).filter(Boolean);
        return [...new Set(categories)];
    }, [reportType, inventory, sales]);

    // --- Export Functions ---
    const exportToCSV = async () => {
        setExportingCSV(true);
        let dataToExport = [];
        const fileName = `${reportType}_report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;

        if (reportType === 'inventory') {
            dataToExport = filteredInventory;
        } else {
            dataToExport = filteredSales;
        }

        if (dataToExport.length === 0) {
            // toast.info('No data to export.');
            alert('No data to export.'); // Fallback if toast not integrated
            setExportingCSV(false);
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
        // toast.success('CSV exported successfully!');
        setExportingCSV(false);
    };

    const exportToPDF = async () => {
        setExportingPDF(true);
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
            tableColumn = ['#', 'Name', 'Category', 'Quantity', 'Unit', 'Price', 'Cost', 'Expiry Date'];
            tableRows = filteredInventory.map((item, index) => [
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
            tableColumn = ['#', 'Product', 'Category', 'Quantity', 'Unit Price', 'Total', 'Profit', 'Date', 'Customer'];
            tableRows = filteredSales.map((item, index) => [
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

        if (tableRows.length === 0) {
            // toast.info('No data to export.');
            alert('No data to export.'); // Fallback
            setExportingPDF(false);
            return;
        }

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [239, 68, 68] },
        });

        if (reportType === 'sales') {
            const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total_price, 0);
            const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);

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
        // toast.success('PDF exported successfully!');
        setExportingPDF(false);
    };

    // --- Summary Statistics ---
    const getSummaryStats = useMemo(() => {
        if (reportType === 'inventory') {
            const totalItems = filteredInventory.length;
            const lowStockCount = filteredInventory.filter(item => item.quantity < (item.low_stock_threshold || LOW_STOCK_THRESHOLD)).length;
            const expiringSoon = filteredInventory.filter(item => {
                if (!item.expiry_date) return false;
                const expiry = new Date(item.expiry_date);
                return expiry >= new Date() && expiry <= new Date(new Date().setDate(new Date().getDate() + 7));
            }).length;

            return [
                { title: 'Total Items', value: totalItems, icon: <BsBoxSeam /> },
                { title: 'Low Stock', value: lowStockCount, icon: <BsCurrencyDollar /> }, // Icon choice here might be re-evaluated
                { title: 'Expiring Soon', value: expiringSoon, icon: <FiClock /> }
            ];
        } else { // reportType === 'sales'
            const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_price, 0);
            const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
            const totalTransactions = filteredSales.length;

            return [
                { title: 'Total Revenue', value: `Ksh${totalRevenue.toFixed(2)}`, icon: <BsCurrencyDollar /> },
                { title: 'Total Profit', value: `Ksh${totalProfit.toFixed(2)}`, icon: <BsGraphUp /> },
                { title: 'Transactions', value: totalTransactions, icon: <FiRefreshCw /> } // Icon choice might be re-evaluated
            ];
        }
    }, [reportType, filteredInventory, filteredSales]);

    // --- Chart Data Preparation Functions (Memoized) ---
    const getInventoryPieData = useMemo(() => {
        const categoryCounts = {};
        filteredInventory.forEach(item => {
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
    }, [filteredInventory]);

    const getCategoryDistributionData = useMemo(() => {
        const data = reportType === 'inventory' ? filteredInventory : filteredSales;
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
    }, [reportType, filteredInventory, filteredSales]);

    const getSalesBarData = useMemo(() => {
        const freqMap = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.created_at);
            let key;
            if (reportFrequency === 'daily') key = date.toLocaleDateString();
            else if (reportFrequency === 'weekly') {
                const startOfWeek = new Date(date);
                startOfWeek.setDate(date.getDate() - date.getDay());
                key = startOfWeek.toLocaleDateString();
            } else if (reportFrequency === 'monthly') key = `${date.getMonth() + 1}/${date.getFullYear()}`;
            else key = sale.product_name; // 'individual' for product-based bar chart

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
    }, [filteredSales, reportFrequency]);

    const getSalesTrendData = useMemo(() => {
        const dailySales = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.created_at).toLocaleDateString();
            dailySales[date] = (dailySales[date] || 0) + sale.total_price;
        });

        // Ensure dates are sorted for correct line chart display
        const sortedLabels = Object.keys(dailySales).sort((a, b) => new Date(a) - new Date(b));
        const sortedData = sortedLabels.map(label => dailySales[label]);

        return {
            labels: sortedLabels,
            datasets: [
                {
                    label: 'Total Sales',
                    data: sortedData,
                    borderColor: '#34d399',
                    fill: false,
                    tension: 0.3
                }
            ]
        };
    }, [filteredSales]);

    const getProfitTrendData = useMemo(() => {
        const dailyProfit = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.created_at).toLocaleDateString();
            dailyProfit[date] = (dailyProfit[date] || 0) + (sale.profit || 0);
        });

        // Ensure dates are sorted
        const sortedLabels = Object.keys(dailyProfit).sort((a, b) => new Date(a) - new Date(b));
        const sortedData = sortedLabels.map(label => dailyProfit[label]);

        return {
            labels: sortedLabels,
            datasets: [
                {
                    label: 'Profit',
                    data: sortedData,
                    borderColor: '#f59e0b',
                    fill: false,
                    tension: 0.3
                }
            ]
        };
    }, [filteredSales]);

    const getCustomerSpendingData = useMemo(() => {
        const spendingMap = {};
        filteredSales.forEach(sale => {
            const name = sale.customer_name || 'Walk-in';
            spendingMap[name] = (spendingMap[name] || 0) + sale.total_price;
        });

        const sorted = Object.entries(spendingMap).sort((a, b) => b[1] - a[1]).slice(0, 10); // Top 10 customers
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
    }, [filteredSales]);

    // --- Debounced Filter Handlers ---
    // useCallback with debounce ensures the function reference is stable and debounce works correctly
    const debouncedSetCustomerFilter = useCallback(
        debounce((value) => setCustomerFilter(value), DEBOUNCE_DELAY),
        []
    );

    const debouncedSetProductFilter = useCallback(
        debounce((value) => setProductFilter(value), DEBOUNCE_DELAY),
        []
    );

    // Helper for debounce (simple implementation, replace with lodash.debounce for production)
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }


    // --- Scheduling Report Logic ---
    const scheduleReport = async () => {
        if (!email) {
            // toast.error('Please enter an email address.');
            alert('Please enter an email address.'); // Fallback
            return;
        }
        setSchedulingReport(true);

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
            // toast.error('Failed to schedule report. Please try again.');
            alert('Failed to schedule report.'); // Fallback
        } else {
            // toast.success('Report scheduled successfully!');
            alert('Report scheduled successfully!'); // Fallback
            setEmail('');
            setShowScheduleForm(false);
            fetchScheduledReports();
        }
        setSchedulingReport(false);
    };

    const deleteScheduledReport = async (id) => {
        if (window.confirm("Are you sure you want to delete this scheduled report?")) { // Confirmation dialog
            const { error } = await supabase.from('scheduled_reports').delete().eq('id', id);
            if (!error) {
                fetchScheduledReports();
                // toast.success('Scheduled report deleted.');
            } else {
                console.error('Failed to delete scheduled report:', error.message);
                // toast.error(`Failed to delete scheduled report: ${error.message}`);
            }
        }
    };

    // --- Reset Filters Function ---
    const resetFilters = () => {
        setStartDate(new Date(new Date().setDate(new Date().getDate() - 30)));
        setEndDate(new Date());
        setCategoryFilter('');
        setLowStockFilter(false);
        setCustomerFilter('');
        setProductFilter('');
        // toast.info('All filters reset.');
    };

    return (
        <Layout>
            <div className="p-6 bg-gray-50 min-h-screen">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-red-700">POS Analytics Dashboard</h1>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
                        disabled={loadingData}
                    >
                        {loadingData ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <FiRefreshCw /> Refresh Data
                            </>
                        )}
                    </button>
                </div>

                {/* Report Controls */}
                <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                    <div className="flex flex-wrap gap-4 items-end mb-4"> {/* Align items to bottom */}
                        {/* Report Type */}
                        <div>
                            <label htmlFor="reportType" className="block font-medium mb-1">Report Type</label>
                            <select
                                id="reportType"
                                className="border border-gray-300 rounded px-3 py-2 w-48"
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
                            <div className="flex flex-wrap gap-2 items-center">
                                <DatePicker
                                    selected={startDate}
                                    onChange={(date) => setStartDate(date)}
                                    className="border border-gray-300 rounded px-3 py-2 w-36"
                                    dateFormat="MMM d, yyyy"
                                    placeholderText="Start Date"
                                />
                                <span className="self-center">to</span>
                                <DatePicker
                                    selected={endDate}
                                    onChange={(date) => setEndDate(date)}
                                    className="border border-gray-300 rounded px-3 py-2 w-36"
                                    dateFormat="MMM d, yyyy"
                                    placeholderText="End Date"
                                    minDate={startDate}
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => handlePresetDateRange('7')} className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm">Last 7 Days</button>
                                    <button onClick={() => handlePresetDateRange('30')} className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm">Last 30 Days</button>
                                    <button onClick={() => handlePresetDateRange('month')} className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm">This Month</button>
                                    <button onClick={() => handlePresetDateRange('all')} className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm">All Time</button>
                                </div>
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div>
                            <label htmlFor="categoryFilter" className="block font-medium mb-1">Category</label>
                            <select
                                id="categoryFilter"
                                className="border border-gray-300 rounded px-3 py-2 w-48"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {getUniqueCategories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>

                        {/* Low Stock Only (Inventory Only) */}
                        {reportType === 'inventory' && (
                            <div className="flex items-center mb-1">
                                <input
                                    type="checkbox"
                                    id="lowStock"
                                    checked={lowStockFilter}
                                    onChange={(e) => setLowStockFilter(e.target.checked)}
                                    className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                />
                                <label htmlFor="lowStock" className="font-medium text-gray-700">Low Stock Only</label>
                            </div>
                        )}

                        {/* Frequency (Sales Only) */}
                        {reportType === 'sales' && (
                            <div>
                                <label htmlFor="reportFrequency" className="block font-medium mb-1">Frequency</label>
                                <select
                                    id="reportFrequency"
                                    className="border border-gray-300 rounded px-3 py-2 w-40"
                                    value={reportFrequency}
                                    onChange={(e) => setReportFrequency(e.target.value)}
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="individual">By Product</option> {/* Renamed for clarity */}
                                </select>
                            </div>
                        )}

                        {/* Customer Filter (Sales Only) */}
                        {reportType === 'sales' && (
                            <div>
                                <label htmlFor="customerFilter" className="block font-medium mb-1">Customer</label>
                                <input
                                    type="text"
                                    id="customerFilter"
                                    className="border border-gray-300 rounded px-3 py-2 w-48"
                                    defaultValue={customerFilter} // Use defaultValue for debounced input
                                    onChange={(e) => debouncedSetCustomerFilter(e.target.value)}
                                    placeholder="Filter by customer"
                                />
                            </div>
                        )}

                        {/* Product Filter */}
                        <div>
                            <label htmlFor="productFilter" className="block font-medium mb-1">Product</label>
                            <input
                                type="text"
                                id="productFilter"
                                className="border border-gray-300 rounded px-3 py-2 w-48"
                                defaultValue={productFilter} // Use defaultValue for debounced input
                                onChange={(e) => debouncedSetProductFilter(e.target.value)}
                                placeholder="Filter by product"
                            />
                        </div>

                        {/* Reset Filters */}
                        <button
                            onClick={resetFilters}
                            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
                        >
                            <FiXCircle /> Reset Filters
                        </button>
                    </div>

                    {/* Export and Schedule Buttons */}
                    <div className="flex flex-wrap gap-4 mt-4">
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                            disabled={exportingCSV}
                        >
                            {exportingCSV ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <FiDownload />
                            )}
                            {exportingCSV ? 'Exporting...' : 'Export to CSV'}
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                            disabled={exportingPDF}
                        >
                            {exportingPDF ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <FiDownload />
                            )}
                            {exportingPDF ? 'Exporting...' : 'Export to PDF'}
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
                                    <label htmlFor="scheduleEmail" className="block font-medium mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        id="scheduleEmail"
                                        className="border border-gray-300 rounded px-3 py-2 w-full"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter email to receive reports"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="scheduleFrequency" className="block font-medium mb-1">Frequency</label>
                                    <select
                                        id="scheduleFrequency"
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
                                    disabled={schedulingReport}
                                >
                                    {schedulingReport ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <FiMail />
                                    )}
                                    {schedulingReport ? 'Scheduling...' : 'Schedule'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Summary Cards */}
                {!loadingData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {getSummaryStats.map((stat, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg shadow-md">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-gray-500 text-sm">{stat.title}</p>
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                    </div>
                                    <div className="text-2xl text-red-500"> {/* Added a default color for icons */}
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
                                                {report.filters?.category && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Category: {report.filters.category}</span>}
                                                {report.filters?.low_stock && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Low Stock: Yes</span>}
                                                {report.filters?.customer && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Customer: {report.filters.customer}</span>}
                                                {report.filters?.product && <span className="bg-gray-200 px-2 py-1 rounded text-xs mr-1">Product: {report.filters.product}</span>}
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
                {loadingData ? (
                    <div className="text-center py-8">
                        <p className="text-lg text-gray-600">Loading data and analytics... Please wait.</p>
                        <svg className="animate-spin h-10 w-10 text-red-500 mx-auto mt-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
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
                                        {filteredInventory.length > 0 ? (
                                            <>
                                                <div className="bg-white p-4 rounded-lg shadow-md">
                                                    <h2 className="text-xl font-semibold mb-4">Inventory Distribution by Category</h2>
                                                    <Doughnut data={getInventoryPieData} />
                                                </div>
                                                <div className="bg-white p-4 rounded-lg shadow-md">
                                                    <h2 className="text-xl font-semibold mb-4">Inventory Quantity by Category</h2>
                                                    <Bar
                                                        data={getCategoryDistributionData}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            scales: {
                                                                y: { beginAtZero: true }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="lg:col-span-2 text-center py-8 bg-white rounded-lg shadow-md">
                                                <p className="text-gray-600">No inventory data available for the selected filters.</p>
                                            </div>
                                        )}
                                    </>
                                ) : ( // Sales Report Overview
                                    <>
                                        {filteredSales.length > 0 ? (
                                            <>
                                                <div className="bg-white p-4 rounded-lg shadow-md">
                                                    <h2 className="text-xl font-semibold mb-4">Sales Overview ({reportFrequency.charAt(0).toUpperCase() + reportFrequency.slice(1)})</h2>
                                                    <Bar
                                                        data={getSalesBarData}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            scales: {
                                                                y: { beginAtZero: true }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="bg-white p-4 rounded-lg shadow-md">
                                                    <h2 className="text-xl font-semibold mb-4">Sales Trend (Daily)</h2>
                                                    <Line data={getSalesTrendData} options={{ responsive: true, maintainAspectRatio: false }} />
                                                </div>
                                                <div className="bg-white p-4 rounded-lg shadow-md">
                                                    <h2 className="text-xl font-semibold mb-4">Profit Trend (Daily)</h2>
                                                    <Line data={getProfitTrendData} options={{ responsive: true, maintainAspectRatio: false }} />
                                                </div>
                                                <div className="bg-white p-4 rounded-lg shadow-md">
                                                    <h2 className="text-xl font-semibold mb-4">Sales by Category Distribution</h2>
                                                    <Doughnut data={getCategoryDistributionData} options={{ responsive: true, maintainAspectRatio: false }} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="lg:col-span-2 text-center py-8 bg-white rounded-lg shadow-md">
                                                <p className="text-gray-600">No sales data available for the selected filters.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Customer Insights */}
                        {activeTab === 'customers' && reportType === 'sales' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {filteredSales.length > 0 ? (
                                    <>
                                        <div className="bg-white p-4 rounded-lg shadow-md">
                                            <h2 className="text-xl font-semibold mb-4">Top 10 Customers by Spending</h2>
                                            <Bar
                                                data={getCustomerSpendingData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    indexAxis: 'y', // Horizontal bars
                                                    scales: {
                                                        x: { beginAtZero: true }
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="bg-white p-4 rounded-lg shadow-md">
                                            <h2 className="text-xl font-semibold mb-4">Customer Purchase Frequency</h2>
                                            <p className="text-gray-500">This feature will show how often customers make purchases.</p>
                                            <p className="text-gray-400 text-sm mt-2">
                                                (Implementation for this chart would involve further data processing, e.g., counting transactions per customer over time)
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="lg:col-span-2 text-center py-8 bg-white rounded-lg shadow-md">
                                        <p className="text-gray-600">No sales data to generate customer insights for the selected filters.</p>
                                    </div>
                                )}
                            </div>
                        )}
// ... (Continued from Part 2)

                        {/* Detailed Table */}
                        {(activeTab === 'details' || (activeTab === 'customers' && reportType === 'sales')) && (
                            <div className="bg-white p-4 rounded-lg shadow-md">
                                <h2 className="text-xl font-semibold mb-4">
                                    {reportType === 'inventory' ? 'Inventory Details' : 'Sales Details'}
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200"> {/* Added table styling */}
                                        <thead className="bg-gray-100">
                                            <tr>
                                                {reportType === 'inventory' ? (
                                                    <>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {(reportType === 'inventory' ? filteredInventory : filteredSales).length > 0 ? (
                                                (reportType === 'inventory' ? filteredInventory : filteredSales).map((item, index) => (
                                                    <tr key={item.id || index} className="hover:bg-gray-50"> {/* Added index as fallback key */}
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.name || item.product_name}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.category || 'Uncategorized'}</td>
                                                        <td className={`px-4 py-2 whitespace-nowrap text-sm ${reportType === 'inventory' && item.quantity < (item.low_stock_threshold || LOW_STOCK_THRESHOLD) ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                                            {item.quantity}
                                                        </td>
                                                        {reportType === 'inventory' ? (
                                                            <>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.unit}</td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">Ksh{item.price.toFixed(2)}</td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">Ksh{item.cost ? item.cost.toFixed(2) : 'N/A'}</td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                                    {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">Ksh{item.unit_price.toFixed(2)}</td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">Ksh{item.total_price.toFixed(2)}</td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">Ksh{item.profit ? item.profit.toFixed(2) : 'N/A'}</td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                                    {new Date(item.created_at).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.customer_name || 'Walk-in'}</td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={reportType === 'inventory' ? 8 : 9} className="px-4 py-4 text-center text-gray-500">
                                                        No data available for the selected filters.
                                                    </td>
                                                </tr>
                                            )}
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
