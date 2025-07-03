import React, { useState, useEffect, useRef } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';
import { CSVLink } from 'react-csv';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
    fetchCustomerPayments();
    fetchSupplierPayments();
    fetchTrialBalance();
    fetchProfitAndLoss();
    fetchBalanceSheet();
  }, [startDate, endDate]);

  const fetchCustomerPayments = async () => {
    let query = supabase.from('customer_payments').select('*');
    if (startDate) query = query.gte('created_at', startDate.toISOString());
    if (endDate) query = query.lte('created_at', endDate.toISOString());
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setCustomerPayments(data);
  };

  const fetchSupplierPayments = async () => {
    let query = supabase.from('supplier_payments').select('*');
    if (startDate) query = query.gte('created_at', startDate.toISOString());
    if (endDate) query = query.lte('created_at', endDate.toISOString());
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setSupplierPayments(data);
  };

  const fetchTrialBalance = async () => {
    const { data } = await supabase.from('accounts').select('name, type, debit, credit');
    if (data) setTrialBalance(data);
  };

  const fetchProfitAndLoss = async () => {
    const { data: transactions } = await supabase.from('transactions').select('*');
    if (!transactions) return;
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    setProfitLoss({ income, expenses, net: income - expenses });
  };

  const fetchBalanceSheet = async () => {
    const { data: accounts } = await supabase.from('accounts').select('*');
    if (!accounts) return;
    const assets = accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + (a.debit - a.credit), 0);
    const liabilities = accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + (a.credit - a.debit), 0);
    const equity = accounts.filter(a => a.type === 'equity').reduce((sum, a) => sum + (a.credit - a.debit), 0);
    setBalanceSheet({ assets, liabilities, equity });
  };

  const exportPDF = (ref, title = 'payments') => {
    html2canvas(ref.current).then(canvas => {
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.text(title, 10, 10);
      pdf.addImage(img, 'PNG', 10, 20, 190, 0);
      pdf.save(`${title}.pdf`);
    });
  };

  const filterCustomerPayments = customerPayments.filter(p =>
    p.customer_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filterSupplierPayments = supplierPayments.filter(p =>
    p.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-4 space-y-8">
        {/* Date Filter */}
        <div className="flex gap-4 mb-6 items-center">
          <div>
            <label className="block text-sm font-medium">Start Date</label>
            <DatePicker selected={startDate} onChange={date => setStartDate(date)} className="border p-1 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium">End Date</label>
            <DatePicker selected={endDate} onChange={date => setEndDate(date)} className="border p-1 rounded" />
          </div>
        </div>

        {/* 1. Customer Payments */}
        <section ref={customerRef}>
          <h2 className="text-2xl font-semibold mb-2">Customer Payments</h2>
          <div className="flex justify-between items-center mb-2">
            <input
              type="text"
              placeholder="Search Customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="border p-1 rounded"
            />
            <div className="flex gap-2">
              <CSVLink data={filterCustomerPayments} filename="customer_payments.csv" className="btn bg-green-100 px-2">Export CSV</CSVLink>
              <button onClick={() => exportPDF(customerRef, 'Customer Payments')} className="btn bg-blue-100 px-2">Export PDF</button>
            </div>
          </div>
          <div className="bg-white shadow rounded p-4 space-y-2">
            {filterCustomerPayments.map(payment => (
              <div key={payment.id} className="border-b py-2">
                <p><strong>{payment.customer_name}</strong> paid <strong>KSh {payment.amount}</strong> on {new Date(payment.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Supplier Payments */}
        <section ref={supplierRef}>
          <h2 className="text-2xl font-semibold mb-2">Supplier Payments</h2>
          <div className="flex justify-between items-center mb-2">
            <input
              type="text"
              placeholder="Search Supplier..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="border p-1 rounded"
            />
            <div className="flex gap-2">
              <CSVLink data={filterSupplierPayments} filename="supplier_payments.csv" className="btn bg-green-100 px-2">Export CSV</CSVLink>
              <button onClick={() => exportPDF(supplierRef, 'Supplier Payments')} className="btn bg-blue-100 px-2">Export PDF</button>
            </div>
          </div>
          <div className="bg-white shadow rounded p-4 space-y-2">
            {filterSupplierPayments.map(payment => (
              <div key={payment.id} className="border-b py-2">
                <p><strong>{payment.supplier_name}</strong> was paid <strong>KSh {payment.amount}</strong> on {new Date(payment.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Trial Balance */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Trial Balance</h2>
          <table className="w-full text-left border">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border">Account</th>
                <th className="p-2 border">Type</th>
                <th className="p-2 border">Debit (KSh)</th>
                <th className="p-2 border">Credit (KSh)</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.map(account => (
                <tr key={account.name}>
                  <td className="p-2 border">{account.name}</td>
                  <td className="p-2 border capitalize">{account.type}</td>
                  <td className="p-2 border">{account.debit?.toLocaleString()}</td>
                  <td className="p-2 border">{account.credit?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 7. Profit and Loss */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Profit and Loss</h2>
          <div className="bg-white p-4 rounded shadow space-y-2">
            <p>💰 <strong>Total Income:</strong> KSh {profitLoss.income.toLocaleString()}</p>
            <p>💸 <strong>Total Expenses:</strong> KSh {profitLoss.expenses.toLocaleString()}</p>
            <p className="mt-2 font-bold text-lg">
              🧮 Net Profit: <span className={profitLoss.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                KSh {profitLoss.net.toLocaleString()}
              </span>
            </p>
          </div>
        </section>

        {/* 8. Balance Sheet */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Balance Sheet</h2>
          <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded shadow">
            <div>
              <h3 className="font-medium">Assets</h3>
              <p>KSh {balanceSheet.assets.toLocaleString()}</p>
            </div>
            <div>
              <h3 className="font-medium">Liabilities</h3>
              <p>KSh {balanceSheet.liabilities.toLocaleString()}</p>
            </div>
            <div>
              <h3 className="font-medium">Equity</h3>
              <p>KSh {balanceSheet.equity.toLocaleString()}</p>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
