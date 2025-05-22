import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../components/layout";
import supabase from "../supabaseClient";

const Dashboard = () => {
  const [summary, setSummary] = useState({});
  const [recentSales, setRecentSales] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);

  const fetchDashboardData = async () => {
    const { data: products, error: productError } = await supabase.from("inventory").select("*");
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (productError || salesError) {
      console.error("Fetch error:", productError || salesError);
      return;
    }

    const now = new Date();
    const lowStockCount = products.filter((p) => p.quantity < 5).length;
    const expiringSoonCount = products.filter((p) => {
      const expiry = new Date(p.expiry_date);
      const in3Days = new Date(now);
      in3Days.setDate(now.getDate() + 3);
      return expiry <= in3Days;
    }).length;

    const totalSalesToday = sales
      .filter((s) => new Date(s.created_at).toDateString() === now.toDateString())
      .reduce((acc, s) => acc + s.total_amount, 0);

    const trendMap = {};
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const key = day.toDateString();
      trendMap[key] = 0;
    }

    sales.forEach((s) => {
      const d = new Date(s.created_at).toDateString();
      if (trendMap[d] !== undefined) {
        trendMap[d] += s.total_amount;
      }
    });

    const trendData = Object.entries(trendMap).map(([day, amount]) => ({
      day: day.split(" ").slice(0, 3).join(" "),
      amount,
    }));

    const recent = sales.slice(0, 5).map((s) => ({
      id: s.id,
      product: s.product_name,
      qty: s.quantity,
      amount: s.total_amount,
      time: new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));

    const healthScore = {
      stock: (products.length ? (lowStockCount / products.length) * 100 : 0).toFixed(0),
      expiry: (products.length ? (expiringSoonCount / products.length) * 100 : 0).toFixed(0),
    };

    const summaryData = {
      totalProducts: products.length,
      totalSalesToday,
      lowStock: lowStockCount,
      expiringSoon: expiringSoonCount,
      healthScore,
    };

    localStorage.setItem("dashboardCache", JSON.stringify({ summaryData, recent, trendData }));
    setSummary(summaryData);
    setRecentSales(recent);
    setSalesTrend(trendData);
  };

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel("realtime-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => fetchDashboardData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Offline fallback
  useEffect(() => {
    const cached = localStorage.getItem("dashboardCache");
    if (cached && (!summary.totalProducts || !recentSales.length)) {
      const { summaryData, recent, trendData } = JSON.parse(cached);
      setSummary(summaryData);
      setRecentSales(recent);
      setSalesTrend(trendData);
    }
  }, []);

  return (
    <Layout title="Dashboard">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Products" value={summary.totalProducts} color="bg-blue-100" />
        <SummaryCard label="Sales Today" value={`KES ${summary.totalSalesToday}`} color="bg-green-100" />
        <SummaryCard label="Low Stock" value={summary.lowStock} color="bg-yellow-100" />
        <SummaryCard label="Expiring Soon" value={summary.expiringSoon} color="bg-red-100" />
      </div>

      {/* Smart Alert */}
      {summary.lowStock > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
          ⚠️ {summary.lowStock} products are running low!
          <Link to="/inventory" className="underline font-semibold ml-2">Review now</Link>
        </div>
      )}

      {/* Sales Trend Chart */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Sales Trend (Last 7 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={salesTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded shadow p-4 mb-6 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4">Recent Sales</h2>
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Product</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.map((sale) => (
              <tr key={sale.id} className="border-b hover:bg-gray-100">
                <td className="py-2">{sale.product}</td>
                <td>{sale.qty}</td>
                <td>KES {sale.amount}</td>
                <td>{sale.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feedback Section */}
      <div className="bg-gray-100 text-gray-700 p-4 rounded shadow">
        <h3 className="font-bold mb-1">Need Help?</h3>
        <p className="text-sm">
          📞 Call: +254 712 345 678 <br />
          📄 Quick Guide: <Link className="underline" to="/help">How to add a new product</Link>
        </p>
      </div>
    </Layout>
  );
};

const SummaryCard = ({ label, value, color }) => (
  <div className={`p-4 rounded shadow ${color}`}>
    <p className="text-gray-600">{label}</p>
    <h3 className="text-2xl font-bold">{value}</h3>
  </div>
);

export default Dashboard;
