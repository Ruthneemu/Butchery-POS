import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
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
      .reduce((acc, s) => acc + s.total, 0);

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
        trendMap[d] += s.total;
      }
    });

    const trendData = Object.entries(trendMap).map(([day, amount]) => ({
      day: day.split(" ").slice(0, 3).join(" "),
      amount,
    }));

    const recent = sales.slice(0, 5).map((s) => ({
      id: s.id,
      product: s.item_name,
      qty: s.quantity,
      amount: s.total,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Products" value={summary.totalProducts} color="bg-blue-100" />
        <SummaryCard label="Sales Today" value={`KES ${summary.totalSalesToday}`} color="bg-green-100" />
        <SummaryCard label="Low Stock" value={summary.lowStock} color="bg-yellow-100" />
        <SummaryCard label="Expiring Soon" value={summary.expiringSoon} color="bg-red-100" />
      </div>

      {/* Alert Banner */}
      {summary.lowStock > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded mb-6">
          ⚠️ {summary.lowStock} product(s) are running low in stock!
          <Link to="/inventory" className="underline font-medium ml-2">Review now</Link>
        </div>
      )}

      {/* Sales Trend Chart */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">📈 Sales Trend (Last 7 Days)</h2>
        <div className="w-full h-[250px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded shadow p-4 mb-6 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">🧾 Recent Sales</h2>
        <table className="min-w-[500px] w-full text-left text-sm sm:text-base">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-700">
              <th className="py-2 px-2">Product</th>
              <th className="py-2 px-2">Qty</th>
              <th className="py-2 px-2">Amount</th>
              <th className="py-2 px-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.map((sale) => (
              <tr key={sale.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-2">{sale.product}</td>
                <td className="py-2 px-2">{sale.qty}</td>
                <td className="py-2 px-2">KES {sale.amount}</td>
                <td className="py-2 px-2">{sale.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Help Section */}
      <div className="bg-gray-100 text-gray-700 p-4 rounded shadow text-sm sm:text-base">
        <h3 className="font-bold mb-1">💡 Need Help?</h3>
        <p>
          📞 Call: <a href="tel:+254712345678" className="underline">+254 712 345 678</a><br />
          📄 Guide: <Link to="/help" className="underline">How to add a new product</Link>
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
