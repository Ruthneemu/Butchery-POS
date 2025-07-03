// ...imports remain unchanged
import React, { useState, useEffect, useRef } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';
import { CSVLink } from 'react-csv';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FiDownload, FiFileText } from 'react-icons/fi';

export default function Payment() {
  const [customerPayments, setCustomerPayments] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [profitLoss, setProfitLoss] = useState({ income: 0, expenses: 0, net: 0 });
  const [balanceSheet, setBalanceSheet] = useState({ assets: 0, liabilities: 0, equity: 0 });

  const [customerSearch, setCustomerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const customerRef = useRef();
  const supplierRef = useRef();

  useEffect(() => {
    fetchPayments('customer_payments', setCustomerPayments);
    fetchPayments('supplier_payments', setSupplierPayments);
    fetchTrialBalance();
    fetchProfitAndLoss();
    fetchBalanceSheet();
  }, [startDate, endDate]);

  const fetchPayments = async (table, setter) => {
    let query = supabase.from(table).select('*');
    if (startDate) query = query.gte('created_at', startDate.toISOString());
    if (endDate) query = query.lte('created_at', endDate.toISOString());
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setter(data);
  };

  const fetchTrialBalance = async () => {
    const { data } = await supabase.from('accounts').select('name, type, debit, credit');
    if (data) setTrialBalance(data);
  };

  const fetchProfitAndLoss = async () => {
    const { data } = await supabase.from('transactions').select('*');
    if (!data) return;
    const income = data.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    setProfitLoss({ income, expenses, net: income - expenses });
  };

  const fetchBalanceSheet = async () => {
    const { data } = await supabase.from('accounts').select('*');
    if (!data) return;
    const assets = data.filter(a => a.type === 'asset').reduce((sum, a) => sum + (a.debit - a.credit), 0);
    const liabilities = data.filter(a => a.type === 'liability').reduce((sum, a) => sum + (a.credit - a.debit), 0);
    const equity = data.filter(a => a.type === 'equity').reduce((sum, a) => sum + (a.credit - a.debit), 0);
    setBalanceSheet({ assets, liabilities, equity });
  };

  const exportPDF = (ref, title = 'report') => {
    html2canvas(ref.current).then(canvas => {
      const pdf = new jsPDF();
      pdf.text(title, 10, 10);
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 10, 20, 190, 0);
      pdf.save(`${title}.pdf`);
    });
  };

  const PaymentSection = ({ title, data, searchValue, onSearchChange, searchKey, refEl, csvFileName }) => {
    const [sortKey, setSortKey] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');

    const handleSort = (key) => {
      if (sortKey === key) {
        setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
    };

    const sortIcon = (key) => {
      if (sortKey !== key) return '⇅';
      return sortDirection === 'asc' ? '↑' : '↓';
    };

    const filteredData = data.filter(p =>
      p[searchKey]?.toLowerCase().includes(searchValue.toLowerCase())
    );

    const sortedData = [...filteredData].sort((a, b) => {
      const aVal = sortKey === 'created_at' ? new Date(a[sortKey]) : a[sortKey];
      const bVal = sortKey === 'created_at' ? new Date(b[sortKey]) : b[sortKey];
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return (
      <section ref={refEl} className="bg-white rounded shadow p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="flex gap-2">
            <CSVLink
              data={sortedData}
              filename={csvFileName}
              className="btn bg-green-100 px-3 py-1 flex items-center gap-1 rounded text-sm"
            >
              <FiFileText /> CSV
            </CSVLink>
            <button
              onClick={() => exportPDF(refEl, title)}
              className="btn bg-blue-100 px-3 py-1 flex items-center gap-1 rounded text-sm"
            >
              <FiDownload /> PDF
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
          <input
            type="text"
            placeholder={`Search ${searchKey.split('_')[0]}...`}
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            className="border p-2 rounded w-full md:w-1/2"
          />
          <div className="flex gap-4 text-sm mt-2 md:mt-0">
            <button onClick={() => handleSort('amount')} className="underline text-gray-700">
              Sort by Amount {sortIcon('amount')}
            </button>
            <button onClick={() => handleSort('created_at')} className="underline text-gray-700">
              Sort by Date {sortIcon('created_at')}
            </button>
          </div>
        </div>

        <div className="divide-y">
          {sortedData.map(p => (
            <div key={p.id} className="py-2">
              <p>
                <strong>{p[searchKey]}</strong>{' '}
                {title.includes('Customer') ? 'paid' : 'was paid'}{' '}
                <strong>KSh {p.amount?.toLocaleString()}</strong>{' '}
                on {new Date(p.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <Layout>
      <div className="p-4 space-y-6 max-w-screen-lg mx-auto">
        {/* Date Filter */}
        <div className="flex flex-wrap gap-4 items-end bg-white shadow p-4 rounded">
          <div>
            <label className="block text-sm font-medium">Start Date</label>
            <DatePicker selected={startDate} onChange={setStartDate} className="border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium">End Date</label>
            <DatePicker selected={endDate} onChange={setEndDate} className="border p-2 rounded" />
          </div>
        </div>

        {/* Sections */}
        <PaymentSection
          title="Customer Payments"
          data={customerPayments}
          searchValue={customerSearch}
          onSearchChange={setCustomerSearch}
          searchKey="customer_name"
          refEl={customerRef}
          csvFileName="customer_payments.csv"
        />

        <PaymentSection
          title="Supplier Payments"
          data={supplierPayments}
          searchValue={supplierSearch}
          onSearchChange={setSupplierSearch}
          searchKey="supplier_name"
          refEl={supplierRef}
          csvFileName="supplier_payments.csv"
        />

        {/* Trial Balance */}
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Trial Balance</h2>
          <table className="w-full text-left border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Account</th>
                <th className="p-2 border">Type</th>
                <th className="p-2 border">Debit (KSh)</th>
                <th className="p-2 border">Credit (KSh)</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.map(a => (
                <tr key={a.name}>
                  <td className="p-2 border">{a.name}</td>
                  <td className="p-2 border capitalize">{a.type}</td>
                  <td className="p-2 border">{a.debit?.toLocaleString()}</td>
                  <td className="p-2 border">{a.credit?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Profit & Loss */}
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Profit and Loss</h2>
          <p>💰 <strong>Total Income:</strong> KSh {profitLoss.income.toLocaleString()}</p>
          <p>💸 <strong>Total Expenses:</strong> KSh {profitLoss.expenses.toLocaleString()}</p>
          <p className="mt-2 font-bold text-lg">
            🧮 Net Profit: <span className={profitLoss.net >= 0 ? 'text-green-600' : 'text-red-600'}>
              KSh {profitLoss.net.toLocaleString()}
            </span>
          </p>
        </section>

        {/* Balance Sheet */}
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Balance Sheet</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <h3 className="font-medium">Assets</h3>
              <p className="text-lg">KSh {balanceSheet.assets.toLocaleString()}</p>
            </div>
            <div>
              <h3 className="font-medium">Liabilities</h3>
              <p className="text-lg">KSh {balanceSheet.liabilities.toLocaleString()}</p>
            </div>
            <div>
              <h3 className="font-medium">Equity</h3>
              <p className="text-lg">KSh {balanceSheet.equity.toLocaleString()}</p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
