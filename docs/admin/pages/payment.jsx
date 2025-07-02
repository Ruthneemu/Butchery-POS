// payment.js

import React, { useState, useEffect } from 'react';
import Layout from "../components/layout";
import supabase from '../supabaseClient';

export default function Payment() {
  const [customerPayments, setCustomerPayments] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [profitLoss, setProfitLoss] = useState({ income: 0, expenses: 0, net: 0 });
  const [balanceSheet, setBalanceSheet] = useState({ assets: 0, liabilities: 0, equity: 0 });

  // Fetch data
  useEffect(() => {
    fetchCustomerPayments();
    fetchSupplierPayments();
    fetchTrialBalance();
    fetchProfitAndLoss();
    fetchBalanceSheet();
  }, []);

  // --- 1. Customer Payments ---
  const fetchCustomerPayments = async () => {
    const { data, error } = await supabase.from('customer_payments').select('*').order('created_at', { ascending: false });
    if (data) setCustomerPayments(data);
  };

  // --- 2. Supplier Payments ---
  const fetchSupplierPayments = async () => {
    const { data, error } = await supabase.from('supplier_payments').select('*').order('created_at', { ascending: false });
    if (data) setSupplierPayments(data);
  };

  // --- 6. Trial Balance ---
  const fetchTrialBalance = async () => {
    const { data, error } = await supabase.from('accounts').select('name, type, debit, credit');
    if (data) setTrialBalance(data);
  };

  // --- 7. Profit and Loss ---
  const fetchProfitAndLoss = async () => {
    const { data: transactions, error } = await supabase.from('transactions').select('*');
    if (!transactions) return;

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    setProfitLoss({ income, expenses, net: income - expenses });
  };

  // --- 8. Balance Sheet ---
  const fetchBalanceSheet = async () => {
    const { data: accounts, error } = await supabase.from('accounts').select('*');

    if (!accounts) return;

    const assets = accounts
      .filter(a => a.type === 'asset')
      .reduce((sum, a) => sum + (a.debit - a.credit), 0);

    const liabilities = accounts
      .filter(a => a.type === 'liability')
      .reduce((sum, a) => sum + (a.credit - a.debit), 0);

    const equity = accounts
      .filter(a => a.type === 'equity')
      .reduce((sum, a) => sum + (a.credit - a.debit), 0);

    setBalanceSheet({ assets, liabilities, equity });
  };

  return (
    <Layout>
      <div className="p-4 space-y-8">

        {/* 1. Customer Payments */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Customer Payments</h2>
          <div className="bg-white shadow rounded p-4 space-y-2">
            {customerPayments.map(payment => (
              <div key={payment.id} className="border-b py-2">
                <p><strong>{payment.customer_name}</strong> paid <strong>KSh {payment.amount}</strong> on {new Date(payment.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Supplier Payments */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Supplier Payments</h2>
          <div className="bg-white shadow rounded p-4 space-y-2">
            {supplierPayments.map(payment => (
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

        {/* 7. Profit & Loss */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Profit and Loss</h2>
          <div className="bg-white p-4 rounded shadow">
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
