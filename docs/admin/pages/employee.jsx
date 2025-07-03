import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import { FiDownload } from 'react-icons/fi';
import Layout from '../components/layout';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Payroll() {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [timeCards, setTimeCards] = useState([]);
  const [payPeriodStart, setPayPeriodStart] = useState(new Date(new Date().setDate(new Date().getDate() - 14)));
  const [payPeriodEnd, setPayPeriodEnd] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [filterStart, setFilterStart] = useState(null);
  const [filterEnd, setFilterEnd] = useState(null);

  // Registration & enhanced fields
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRate, setNewEmployeeRate] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeePhoto, setNewEmployeePhoto] = useState(null);

  const fileInputRef = useRef();

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
    fetchTimeCards();
  }, []);

  const fetchPayrolls = async () => {
    let q = supabase.from('payrolls').select('*, employee:employees(name, role)');
    if (filterStart) q = q.gte('pay_period_start', filterStart.toISOString());
    if (filterEnd) q = q.lte('pay_period_end', filterEnd.toISOString());
    const { data, error } = await q.order('pay_period_end', { ascending: false });
    if (!error) setPayrolls(data);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase.from('employees').select('*').order('name', { ascending: true });
    if (!error) setEmployees(data);
  };

  const fetchTimeCards = async () => {
    const { data, error } = await supabase.from('time_cards').select('*').order('clock_in', { ascending: false });
    if (!error) setTimeCards(data);
  };

  const calculatePayroll = () => {
    const filtered = selectedEmployee === 'all'
      ? employees
      : employees.filter(emp => emp.id === selectedEmployee);
    return filtered.map(employee => {
      const cards = timeCards.filter(c =>
        c.employee_id === employee.id &&
        new Date(c.clock_in) >= payPeriodStart &&
        new Date(c.clock_in) <= payPeriodEnd &&
        c.clock_out
      );
      let total = cards.reduce((sum, c) =>
        sum + ((new Date(c.clock_out) - new Date(c.clock_in)) / 3600000), 0
      );
      const gross = total * employee.hourly_rate;
      const tax = gross * 0.15;
      const deduction = 0;
      const net = gross - tax - deduction;
      return {
        employee_id: employee.id,
        employee_name: employee.name,
        hours_worked: total.toFixed(2),
        hourly_rate: employee.hourly_rate,
        gross_pay: gross.toFixed(2),
        taxes: tax.toFixed(2),
        deductions: deduction.toFixed(2),
        net_pay: net.toFixed(2),
        pay_period_start: payPeriodStart.toISOString(),
        pay_period_end: payPeriodEnd.toISOString(),
        status: 'pending',
        notes: ''
      };
    });
  };

  const generatePayroll = () => setShowPayrollForm(true);

  const savePayrollsToDB = async () => {
    const data = calculatePayroll().map(p => ({ ...p }));
    const { error } = await supabase.from('payrolls').insert(data);
    if (error) alert('Failed to save payroll');
    else {
      alert('Payroll saved!');
      setShowPayrollForm(false);
      fetchPayrolls();
    }
  };

  const exportToPDF = (row, all) => {
    const doc = new jsPDF();
    if (all) doc.text('All Payrolls', 14, 14);
    else {
      doc.text(`Payroll: ${row.employee_name}`, 14, 14);
      doc.text(`Period: ${new Date(row.pay_period_start).toLocaleDateString()} - ${new Date(row.pay_period_end).toLocaleDateString()}`, 14, 24);
    }
    const body = all
      ? payrolls.map(r => [r.employee?.name, r.hours_worked, r.net_pay, r.status])
      : [['Hours Worked', row.hours_worked], ['Net Pay', row.net_pay], ['Status', row.status], ['Notes', row.notes || '-']];
    const head = all ? [['Employee', 'Hours', 'Net Pay', 'Status']] : [['Field', 'Value']];
    autoTable(doc, { startY: all ? 24 : 34, head, body });
    doc.save(all ? 'all_payrolls.pdf' : `payroll_${row.employee_id}.pdf`);
  };

  const registerEmployee = async () => {
    if (!newEmployeeName || !newEmployeeRate || !newEmployeeRole) return alert('Fill all fields');
    let photoUrl = null;
    if (newEmployeePhoto) {
      const { data: upload, error: upErr } = await supabase
        .storage.from('avatars').upload(`avatars/${Date.now()}`, newEmployeePhoto);
      if (upErr) return alert('Upload failed');
      photoUrl = supabase.storage.from('avatars').getPublicUrl(upload.path).publicURL;
    }
    const { error } = await supabase.from('employees').insert([{ name: newEmployeeName, hourly_rate: parseFloat(newEmployeeRate), role: newEmployeeRole, photo: photoUrl }]);
    if (error) alert('Registration failed');
    else {
      alert('Employee registered!');
      setNewEmployeeName(''); setNewEmployeeRate(''); setNewEmployeeRole(''); setNewEmployeePhoto(null);
      fetchEmployees();
    }
  };

  const toggleStatus = async (id, current) => {
    const next = current === 'paid' ? 'pending' : 'paid';
    await supabase.from('payrolls').update({ status: next }).eq('id', id);
    fetchPayrolls();
  };

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl mb-6">Payroll Management</h1>

        {/* Employee Registration */}
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-xl mb-4">Register New Employee</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <input placeholder="Name" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} className="border p-2 rounded"/>
            <input placeholder="Rate" value={newEmployeeRate} onChange={e => setNewEmployeeRate(e.target.value)} className="border p-2 rounded"/>
            <input placeholder="Role" value={newEmployeeRole} onChange={e => setNewEmployeeRole(e.target.value)} className="border p-2 rounded"/>
            <input type="file" ref={fileInputRef} onChange={e => setNewEmployeePhoto(e.target.files[0])} className="border p-2 rounded"/>
            <button onClick={registerEmployee} className="col-span-full bg-green-600 text-white py-2 rounded">Register</button>
          </div>
        </div>

        {/* Payroll Controls */}
        <div className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl mb-4">Generate Payroll</h2>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <DatePicker selected={payPeriodStart} onChange={setPayPeriodStart} className="border p-2 rounded"/>
            <DatePicker selected={payPeriodEnd} onChange={setPayPeriodEnd} className="border p-2 rounded"/>
            <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="border p-2 rounded">
              <option value="all">All Employees</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
            <button onClick={generatePayroll} className="bg-blue-600 text-white py-2 rounded">Calculate</button>
          </div>
        </div>

        {/* Payroll Preview */}
        {showPayrollForm && (
          <div className="bg-white p-6 rounded shadow mb-6">
            <h2 className="text-xl mb-4">Preview</h2>
            <table className="min-w-full mb-4">
              <thead className="bg-gray-100"><tr><th>Name</th><th>Hours</th><th>Gross</th><th>Net</th><th>Taxes</th><th>Actions</th></tr></thead>
              <tbody>
                {calculatePayroll().map((r,i) =>
                  <tr key={i} className="border-b">
                    <td>{r.employee_name}</td><td>{r.hours_worked}</td><td>${r.gross_pay}</td><td>${r.net_pay}</td><td>${r.taxes}</td>
                    <td><button onClick={() => exportToPDF(r)}><FiDownload /></button></td>
                  </tr>
                )}
                <tr className="font-bold"><td>Total</td><td>{calculatePayroll().reduce((sum,r)=>sum+parseFloat(r.hours_worked),0).toFixed(2)}</td><td></td><td>${calculatePayroll().reduce((sum,r)=>sum+parseFloat(r.net_pay),0).toFixed(2)}</td><td></td><td></td></tr>
              </tbody>
            </table>
            <button onClick={savePayrollsToDB} className="bg-green-600 text-white py-2 mr-2 rounded">Process</button>
            <button onClick={() => setShowPayrollForm(false)} className="bg-gray-500 text-white py-2 rounded">Cancel</button>
          </div>
        )}

        {/* Filters & Export */}
        <div className="bg-white p-4 rounded shadow mb-4 flex gap-4">
          <DatePicker selected={filterStart} onChange={setFilterStart} placeholderText="Filter start" className="border p-2 rounded"/>
          <DatePicker selected={filterEnd} onChange={setFilterEnd} placeholderText="Filter end" className="border p-2 rounded"/>
          <button onClick={fetchPayrolls} className="bg-blue-600 text-white py-2 rounded">Apply Filter</button>
          <button onClick={() => exportToPDF(null, true)} className="bg-blue-500 text-white py-2 rounded">Export All</button>
        </div>

        {/* Payroll History */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl mb-4">History</h2>
          <table className="min-w-full">
            <thead className="bg-gray-100"><tr><th>Period</th><th>Name</th><th>Net</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {payrolls.map(r =>
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td>{new Date(r.pay_period_start).toLocaleDateString()}–{new Date(r.pay_period_end).toLocaleDateString()}</td>
                  <td>{r.employee?.name}</td>
                  <td>${parseFloat(r.net_pay).toFixed(2)}</td>
                  <td>
                    <button onClick={() => toggleStatus(r.id, r.status)} className={`px-2 py-1 rounded ${r.status==='paid'?'bg-green-200':'bg-yellow-200'}`}>{r.status}</button>
                  </td>
                  <td><input defaultValue={r.notes} onBlur={async e=> {
                    await supabase.from('payrolls').update({ notes: e.target.value }).eq('id',r.id);
                    fetchPayrolls();
                  }} className="border p-1 rounded w-full"/></td>
                  <td><button onClick={() => exportToPDF(r)}><FiDownload /></button></td>
                </tr>
              )}
              <tr className="font-bold"><td colSpan="2">Totals</td><td>${payrolls.reduce((sum,r)=>sum+parseFloat(r.net_pay),0).toFixed(2)}</td><td></td><td></td><td></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
