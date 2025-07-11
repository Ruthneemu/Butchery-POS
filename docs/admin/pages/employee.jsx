import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import { FiDownload, FiCheck } from 'react-icons/fi';
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
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRate, setNewEmployeeRate] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeePhoto, setNewEmployeePhoto] = useState(null);
  const [editingNetPayId, setEditingNetPayId] = useState(null);
  const [editedNetPay, setEditedNetPay] = useState('');
  const fileInputRef = useRef();

  const itemsPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
    fetchTimeCards();
  }, [filterStart, filterEnd, roleFilter, statusFilter]);

  const fetchPayrolls = async () => {
    let query = supabase
      .from('payrolls')
      .select('*, employee:employees(name, role)')
      .order('pay_period_end', { ascending: false });

    if (filterStart) query = query.gte('pay_period_start', filterStart.toISOString());
    if (filterEnd) query = query.lte('pay_period_end', filterEnd.toISOString());

    const { data, error } = await query;
    if (error) return;

    let filtered = data;
    if (roleFilter) {
      filtered = filtered.filter(row => row.employee?.role?.toLowerCase() === roleFilter.toLowerCase());
    }
    if (statusFilter) {
      filtered = filtered.filter(row => row.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    setPayrolls(filtered);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name', { ascending: true });
    setEmployees(data || []);
  };

  const fetchTimeCards = async () => {
    const { data } = await supabase.from('time_cards').select('*').order('clock_in', { ascending: false });
    setTimeCards(data || []);
  };

  const calculatePayroll = () => {
    const filtered = selectedEmployee === 'all'
      ? employees
      : employees.filter(emp => emp.id === selectedEmployee);

    return filtered.map(employee => {
      const cards = timeCards.filter(c =>
        c.employee_id === employee.id &&
      new Date(c.clock_in) >= payPeriodStart && // Filter for clock_in after payPeriodStart
      new Date(c.clock_in) <= payPeriodEnd // Add condition to filter by clock_in before payPeriodEnd
    );
      const total = cards.reduce((sum, c) =>
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

  const savePayrollsToDB = async () => {
    const data = calculatePayroll();
    const { error } = await supabase.from('payrolls').insert(data);
    if (!error) {
      alert('Payroll saved!');
      setShowPayrollForm(false);
      fetchPayrolls();
    }
  };

  const exportToPDF = (row, all) => {
    const doc = new jsPDF();
    doc.text(all ? 'All Payrolls' : `Payroll: ${row.employee_name}`, 14, 14);
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
      const { data: upload } = await supabase
        .storage.from('avatars')
        .upload(`avatars/${Date.now()}`, newEmployeePhoto);
      photoUrl = supabase.storage.from('avatars').getPublicUrl(upload.path).publicURL;
    }
    await supabase.from('employees').insert([{
      name: newEmployeeName,
      hourly_rate: parseFloat(newEmployeeRate),
      role: newEmployeeRole,
      photo: photoUrl
    }]);
    alert('Employee registered!');
    setNewEmployeeName(''); setNewEmployeeRate(''); setNewEmployeeRole(''); setNewEmployeePhoto(null);
    fetchEmployees();
  };

  const toggleStatus = async (id, current) => {
    const next = current === 'paid' ? 'pending' : 'paid';
    await supabase.from('payrolls').update({ status: next }).eq('id', id);
    fetchPayrolls();
  };

  const handleNetPaySave = async (id) => {
    await supabase.from('payrolls').update({ net_pay: editedNetPay }).eq('id', id);
    setEditingNetPayId(null);
    setEditedNetPay('');
    fetchPayrolls();
  };

  const currentItems = payrolls.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(payrolls.length / itemsPerPage);

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl mb-6">Payroll Management</h1>

        {/* Employee Registration */}
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-xl mb-4">Register New Employee</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <input placeholder="Name" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} className="border p-2 rounded" />
            <input placeholder="Rate" value={newEmployeeRate} onChange={e => setNewEmployeeRate(e.target.value)} className="border p-2 rounded" />
            <input placeholder="Role" value={newEmployeeRole} onChange={e => setNewEmployeeRole(e.target.value)} className="border p-2 rounded" />
            <input type="file" ref={fileInputRef} onChange={e => setNewEmployeePhoto(e.target.files[0])} className="border p-2 rounded" />
            <button onClick={registerEmployee} className="col-span-full bg-green-600 text-white py-2 rounded">Register</button>
          </div>
        </div>

        {/* Payroll Controls */}
        <div className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl mb-4">Generate Payroll</h2>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <DatePicker selected={payPeriodStart} onChange={date => setPayPeriodStart(date)} className="border p-2 rounded" />
            <DatePicker selected={payPeriodEnd} onChange={date => setPayPeriodEnd(date)} className="border p-2 rounded" />
            <select onChange={e => setRoleFilter(e.target.value)} className="border p-2 rounded">
              <option value="">Filter by Role</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
            <select onChange={e => setStatusFilter(e.target.value)} className="border p-2 rounded">
              <option value="">Filter by Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <button onClick={savePayrollsToDB} className="bg-blue-600 text-white py-2 rounded">Generate Payroll</button>
        </div>

        {/* Payroll List */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl mb-4">Payroll Records</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="border p-2">Employee</th>
                <th className="border p-2">Hours Worked</th>
                <th className="border p-2">Net Pay</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(payroll => (
                <tr key={payroll.id}>
                  <td className="border p-2">{payroll.employee_name}</td>
                  <td className="border p-2">{payroll.hours_worked}</td>
                  <td className="border p-2">
                    {editingNetPayId === payroll.id ? (
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={editedNetPay}
                          onChange={(e) => setEditedNetPay(e.target.value)}
                          className="border p-1 rounded w-24"
                        />
                        <button onClick={() => handleNetPaySave(payroll.id)} className="ml-2 bg-green-600 text-white py-1 px-2 rounded">
                          <FiCheck />
                        </button>
                      </div>
                    ) : (
                      payroll.net_pay
                    )}
                  </td>
                  <td className="border p-2">{payroll.status}</td>
                  <td className="border p-2">
                    <button onClick={() => toggleStatus(payroll.id, payroll.status)} className="text-blue-600 hover:underline">
                      Toggle Status
                    </button>
                    <button onClick={() => exportToPDF(payroll, false)} className="text-blue-600 ml-2">
                      <FiDownload />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Previous
            </button>
            <div>
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
