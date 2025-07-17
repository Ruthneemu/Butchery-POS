import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast, ToastContainer } from 'react-toastify'; // Ensure ToastContainer and toast are imported
import 'react-toastify/dist/ReactToastify.css'; // Don't forget to import the CSS!

import Layout from "../components/layout"; // Assuming 'layout' is correct
import supabase from "../supabaseClient";

// --- Constants ---
const LOW_STOCK_THRESHOLD = 5; // Products below this quantity are considered low stock
const EXPIRY_DAYS_THRESHOLD = 7; // Products expiring within this many days are 'expiring soon'

// --- Helper Functions ---
const formatCurrency = (amount) => {
  // Use 'en-US' or specific locale if 'en-KE' is not universally supported in build environments
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
};

const getStartEndDate = (range) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of today for consistent range calculations
  const startDate = new Date(now);
  let endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999); // End of today

  switch (range) {
    case '7_days':
      startDate.setDate(now.getDate() - 6);
      break;
    case '30_days':
      startDate.setDate(now.getDate() - 29);
      break;
    case 'this_month':
      startDate.setDate(1);
      break;
    case 'last_month':
      startDate.setMonth(now.getMonth() - 1);
      startDate.setDate(1);
      // Set to the last day of the previous month
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default: // 'today' or any other default
      break;
  }
  return { startDate, endDate };
};

// --- Summary Card Component ---
const SummaryCard = ({ label, value, color, isLoading = false, tooltip = '' }) => (
  <div className={`p-4 rounded shadow ${color}`} title={tooltip}>
    <p className="text-gray-600 text-sm">{label}</p>
    <h3 className="text-2xl font-bold">
      {isLoading ? (
        <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4"></div>
      ) : (
        value
      )}
    </h3>
  </div>
);

// --- Main Dashboard Component ---
const Dashboard = () => {
  const [summary, setSummary] = useState({
    totalProducts: '---',
    totalSalesToday: '---',
    lowStock: '---',
    expiringSoon: '---',
  });
  const [recentSales, setRecentSales] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [salesTrendRange, setSalesTrendRange] = useState('7_days'); // Default to last 7 days

  const [loading, setLoading] = useState({
    summary: true,
    trend: true,
    recentSales: true,
  });
  const [error, setError] = useState({
    summary: null,
    trend: null,
    recentSales: null,
  });

  // Using `toast` directly, as it's imported from 'react-toastify'
  const notify = (msg, type = 'error') => toast[type](msg);

  // --- Data Fetching Functions ---

  const fetchSummaryData = useCallback(async () => {
    setLoading(prev => ({ ...prev, summary: true }));
    setError(prev => ({ ...prev, summary: null }));
    try {
      const { data: products, error: productError } = await supabase
        .from("inventory")
        .select("id, quantity, expiry_date");
      // Note: `setHours(0,0,0,0)` on a new Date object correctly sets it to the start of today
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("total, created_at")
        .gte('created_at', new Date().setHours(0,0,0,0).toISOString());

      if (productError || salesError) {
        throw productError || salesError;
      }

      const now = new Date();
      now.setHours(0,0,0,0); // Start of today for consistent expiry calculation

      const lowStockCount = products.filter((p) => p.quantity < LOW_STOCK_THRESHOLD).length;
      const expiringSoonCount = products.filter((p) => {
        if (!p.expiry_date) return false;
        const expiry = new Date(p.expiry_date);
        const thresholdDate = new Date(now);
        thresholdDate.setDate(now.getDate() + EXPIRY_DAYS_THRESHOLD);
        return expiry <= thresholdDate;
      }).length;

      const totalSalesToday = sales.reduce((acc, s) => acc + s.total, 0);

      setSummary({
        totalProducts: products.length,
        totalSalesToday: formatCurrency(totalSalesToday),
        lowStock: lowStockCount,
        expiringSoon: expiringSoonCount,
      });

      // Cache raw value for totalSalesToday for proper re-formatting on load
      localStorage.setItem("dashboardSummaryCache", JSON.stringify({
        totalProducts: products.length,
        totalSalesToday: totalSalesToday, // Store raw value
        lowStock: lowStockCount,
        expiringSoon: expiringSoonCount,
      }));

    } catch (err) {
      console.error("Error fetching summary data:", err.message);
      setError(prev => ({ ...prev, summary: 'Failed to load summary data.' }));
      notify('Failed to load summary data.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, summary: false }));
    }
  }, [notify]); // Add notify to useCallback dependencies

  const fetchSalesTrend = useCallback(async (range) => {
    setLoading(prev => ({ ...prev, trend: true }));
    setError(prev => ({ ...prev, trend: null }));
    try {
      const { startDate, endDate } = getStartEndDate(range);

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("total, created_at")
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order("created_at", { ascending: true });

      if (salesError) throw salesError;

      const trendMap = {};
      let currentDate = new Date(startDate);
      // Populate trendMap with all days in the range, initialized to 0
      while (currentDate <= endDate) {
        trendMap[currentDate.toDateString()] = 0;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Aggregate sales data into the trend map
      sales.forEach((s) => {
        const d = new Date(s.created_at).toDateString();
        if (trendMap[d] !== undefined) {
          trendMap[d] += s.total;
        }
      });

      const trendData = Object.entries(trendMap).map(([day, amount]) => ({
        day: new Date(day).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }), // Format for chart
        amount,
      }));
      setSalesTrend(trendData);
      localStorage.setItem("dashboardTrendCache", JSON.stringify({ range, trendData }));

    } catch (err) {
      console.error("Error fetching sales trend:", err.message);
      setError(prev => ({ ...prev, trend: 'Failed to load sales trend.' }));
      notify('Failed to load sales trend.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, trend: false }));
    }
  }, [notify]); // Add notify to useCallback dependencies

  const fetchRecentSales = useCallback(async () => {
    setLoading(prev => ({ ...prev, recentSales: true }));
    setError(prev => ({ ...prev, recentSales: null }));
    try {
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, item_name, quantity, total, created_at, payment_method")
        .order("created_at", { ascending: false })
        .limit(5); // Only fetch top 5 recent sales

      if (salesError) throw salesError;

      const recent = sales.map((s) => ({
        id: s.id,
        product: s.item_name || 'N/A', // Fallback if item_name is missing
        qty: s.quantity,
        amount: formatCurrency(s.total),
        time: new Date(s.created_at).toLocaleTimeString('en-KE', { hour: "2-digit", minute: "2-digit" }), // Using 'en-KE' locale
        paymentMethod: s.payment_method || '-', // Display payment method
      }));
      setRecentSales(recent);
      localStorage.setItem("dashboardRecentSalesCache", JSON.stringify(recent));

    } catch (err) {
      console.error("Error fetching recent sales:", err.message);
      setError(prev => ({ ...prev, recentSales: 'Failed to load recent sales.' }));
      notify('Failed to load recent sales.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, recentSales: false }));
    }
  }, [notify]); // Add notify to useCallback dependencies


  // --- Effects ---

  // Initial data fetch and caching logic
  useEffect(() => {
    // Attempt to load from cache first
    const cachedSummary = localStorage.getItem("dashboardSummaryCache");
    const cachedTrend = localStorage.getItem("dashboardTrendCache");
    const cachedRecent = localStorage.getItem("dashboardRecentSalesCache");

    if (cachedSummary) {
      const parsed = JSON.parse(cachedSummary);
      setSummary({ ...parsed, totalSalesToday: formatCurrency(parsed.totalSalesToday) });
      setLoading(prev => ({ ...prev, summary: false }));
    }
    if (cachedTrend) {
      const parsed = JSON.parse(cachedTrend);
      setSalesTrend(parsed.trendData);
      setSalesTrendRange(parsed.range); // Set range from cache
      setLoading(prev => ({ ...prev, trend: false }));
    }
    if (cachedRecent) {
      const parsed = JSON.parse(cachedRecent);
      // Ensure amount is formatted correctly if it was stored without currency symbol
      setRecentSales(parsed.map(s => ({
        ...s,
        // Check if amount is already formatted or needs re-formatting
        amount: s.amount.startsWith('KES') ? s.amount : formatCurrency(parseFloat(s.amount.toString().replace('KES ', '')) || 0)
      })));
      setLoading(prev => ({ ...prev, recentSales: false }));
    }

    // Always fetch fresh data on mount (even if cached, for real-time updates)
    fetchSummaryData();
    fetchRecentSales();
    fetchSalesTrend(cachedTrend ? JSON.parse(cachedTrend).range : '7_days');

  }, [fetchSummaryData, fetchRecentSales, fetchSalesTrend]); // Dependencies for initial fetch

  // Refetch sales trend when range changes (this is separate from initial load)
  useEffect(() => {
    fetchSalesTrend(salesTrendRange);
  }, [salesTrendRange, fetchSalesTrend]); // Dependencies for trend range change

  // Realtime Subscriptions
  useEffect(() => {
    // Subscribe to sales changes
    const salesChannel = supabase
      .channel("realtime-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        // When sales change, refresh relevant data
        fetchSummaryData();
        fetchRecentSales();
        fetchSalesTrend(salesTrendRange); // Refresh trend with current range
      })
      .subscribe();

    // Subscribe to inventory changes
    const inventoryChannel = supabase
      .channel("realtime-inventory")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
        // Inventory changes primarily affect low stock/expiring soon in summary
        fetchSummaryData();
      })
      .subscribe();

    // Cleanup function: Unsubscribe from channels when component unmounts
    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, [fetchSummaryData, fetchRecentSales, fetchSalesTrend, salesTrendRange]); // Dependencies for realtime subscriptions


  return (
    <Layout title="Dashboard">
      {/* ToastContainer must be rendered once at a high level in your app */}
      {/* This line is correct for React Toastify, ensure react-toastify is installed and its CSS imported */}
      <ToastContainer position="top-right" autoClose={3000} />

      <h1 className="text-3xl font-bold mb-6 text-gray-800">📊 Dashboard Overview</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          label="Total Products"
          value={summary.totalProducts}
          color="bg-blue-50 text-blue-800"
          isLoading={loading.summary}
          tooltip="Total number of unique products in your inventory."
        />
        <SummaryCard
          label="Sales Today"
          value={summary.totalSalesToday}
          color="bg-green-50 text-green-800"
          isLoading={loading.summary}
          tooltip="Total revenue generated from sales today."
        />
        <SummaryCard
          label="Low Stock Items"
          value={summary.lowStock}
          color="bg-yellow-50 text-yellow-800"
          isLoading={loading.summary}
          tooltip={`Products with less than ${LOW_STOCK_THRESHOLD} units remaining.`}
        />
        <SummaryCard
          label="Expiring Soon"
          value={summary.expiringSoon}
          color="bg-red-50 text-red-800"
          isLoading={loading.summary}
          tooltip={`Products expiring within ${EXPIRY_DAYS_THRESHOLD} days.`}
        />
      </div>

      {/* Alert Banner for Low Stock */}
      {(summary.lowStock > 0 && !loading.summary) && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-lg mb-8 shadow-sm animate-pulse">
          <p className="font-semibold text-lg">⚠️ Action Needed: Low Stock Alert!</p>
          <p className="mt-1">
            You have **{summary.lowStock} product(s)** currently running low on stock.
            <Link to="/inventory" className="underline font-medium ml-2 text-yellow-900 hover:text-yellow-700">
              Review Inventory
            </Link>
          </p>
        </div>
      )}

      {/* Sales Trend Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700">📈 Sales Trend</h2>
          <select
            value={salesTrendRange}
            onChange={(e) => setSalesTrendRange(e.target.value)}
            className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7_days">Last 7 Days</option>
            <option value="30_days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
        </div>
        {loading.trend ? (
          <div className="w-full h-[250px] sm:h-[300px] flex items-center justify-center bg-gray-50 rounded-md">
            <div className="text-gray-500">Loading sales trend... 📊</div>
          </div>
        ) : error.trend ? (
          <div className="w-full h-[250px] sm:h-[300px] flex items-center justify-center bg-red-50 text-red-700 rounded-md border border-red-200">
            {error.trend}
          </div>
        ) : (
          <div className="w-full h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label) => `Date: ${label}`} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">🧾 Recent Sales</h2>
        {loading.recentSales ? (
          <div className="min-w-[500px] w-full text-left text-sm sm:text-base">
            <div className="py-2 px-2 bg-gray-50 h-10 w-full animate-pulse rounded"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="py-2 px-2 h-12 w-full border-b animate-pulse bg-gray-100 rounded mt-2"></div>
            ))}
          </div>
        ) : error.recentSales ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
            {error.recentSales}
          </div>
        ) : recentSales.length === 0 ? (
          <div className="p-4 text-gray-500 text-center border rounded-md">
            No recent sales yet. Get selling! 🚀
          </div>
        ) : (
          <table className="min-w-[500px] w-full text-left text-sm sm:text-base">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-700">
                <th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">Qty</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Paid By</th> {/* New column */}
                <th className="py-2 px-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr key={sale.id} className="border-b hover:bg-gray-50 transition-colors duration-150">
                  <td className="py-2 px-3 text-gray-800">{sale.product}</td>
                  <td className="py-2 px-3">{sale.qty}</td>
                  <td className="py-2 px-3 font-medium">{sale.amount}</td>
                  <td className="py-2 px-3 text-gray-600">{sale.paymentMethod}</td> {/* New data */}
                  <td className="py-2 px-3 text-gray-500">{sale.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;