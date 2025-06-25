import React, { useState, useEffect } from 'react';
import supabase  from '../supabaseClient';
import { FiDollarSign, FiDownload, FiPrinter, FiCalendar, FiUser } from 'react-icons/fi';
import Layout from "../components/layout";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Payroll = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [timeCards, setTimeCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payPeriodStart, setPayPeriodStart] = useState(new Date(new Date().setDate(new Date().getDate() - 14)));
  const [payPeriodEnd, setPayPeriodEnd] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [newPayroll, setNewPayroll] = useState({
    employee_id: '',
    pay_period_start: '',
    pay_period_end: '',
    hours_worked: 0,
    gross_pay: 0,
    taxes: 0,
    deductions: 0,
    net_pay: 0,
    status: 'pending'
  });

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
    fetchTimeCards();
  }, []);

  const fetchPayrolls = async () => {
    const { data, error } = await supabase
      .from('payrolls')
      .select('*, employees(name)')
      .order('pay_period_end', { ascending: false });

    if (!error) {
      setPayrolls(data);
    }
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });

    if (!error) {
      setEmployees(data);
    }
  };

  const fetchTimeCards = async () => {
    const { data, error } = await supabase
      .from('time_cards')
      .select('*')
      .order('clock_in', { ascending: false });

    if (!error) {
      setTimeCards(data);
    }
  };

  const calculatePayroll = () => {
    const payrollData = [];
    const filteredEmployees = selectedEmployee === 'all' 
      ? employees 
      : employees.filter(emp => emp.id === selectedEmployee);

    filteredEmployees.forEach(employee => {
      // Filter time cards for this employee in the selected pay period
      const employeeTimeCards = timeCards.filter(card => 
        card.employee_id === employee.id &&
        new Date(card.clock_in) >= payPeriodStart &&
        new Date(card.clock_in) <= payPeriodEnd &&
        card.clock_out
      );

      // Calculate total hours worked
      let totalHours = 0;
      employeeTimeCards.forEach(card => {
        const clockIn = new Date(card.clock_in);
        const clockOut = new Date(card.clock_out);
        totalHours += (clockOut - clockIn) / (1000 * 60 * 60);
      });

      // Calculate pay (simplified - in a real app you'd handle overtime, etc.)
      const grossPay = totalHours * employee.hourly_rate;
      const taxes = grossPay * 0.15; // Simplified tax calculation
      const deductions = 0; // Could include benefits, etc.
      const netPay = grossPay - taxes - deductions;

      payrollData.push({
        employee_id: employee.id,
        employee_name: employee.name,
        hours_worked: totalHours.toFixed(2),
        hourly_rate: employee.hourly_rate,
        gross_pay: grossPay.toFixed(2),
        taxes: taxes.toFixed(2),
        deductions: deductions.toFixed(2),
        net_pay: netPay.toFixed(2)
      });
    });

    return payrollData;
  };

  const generatePayroll = async () => {
    const payrollData = calculatePayroll();
    
    // In a real app, you would save this to your database
    // For this demo, we'll just show it in the UI
    setShowPayrollForm(true);
    setNewPayroll({
      ...newPayroll,
      pay_period_start: payPeriodStart.toISOString(),
      pay_period_end: payPeriodEnd.toISOString()
    });
  };

  const exportToPDF = (payroll) => {
    const doc = new jsPDF();
    const fileName = `payroll_${payroll.employee_id}_${new Date().toISOString().slice(0, 10)}.pdf`;

    doc.setFontSize(18);
    doc.text('Payroll Statement', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Pay Period: ${new Date(payroll.pay_period_start).toLocaleDateString()} - ${new Date(payroll.pay_period_end).toLocaleDateString()}`, 105, 30, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Employee: ${payroll.employees?.name || 'Unknown'}`, 14, 45);

    // Payroll details
    autoTable(doc, {
      startY: 55,
      head: [['Description', 'Amount']],
      body: [
        ['Hours Worked', payroll.hours_worked],
        ['Hourly Rate', `$${payroll.hourly_rate}`],
        ['Gross Pay', `$${payroll.gross_pay}`],
        ['Taxes', `$${payroll.taxes}`],
        ['Deductions', `$${payroll.deductions}`],
        ['Net Pay', `$${payroll.net_pay}`]
      ],
      styles: { fontSize: 11 },
      headStyles: { fillColor: [59, 130, 246] }, // blue-500
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' }
      }
    });

    doc.save(fileName);
  };

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Payroll Management</h1>
        
        {/* Payroll Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Generate Payroll</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pay Period Start</label>
              <DatePicker
                selected={payPeriodStart}
                onChange={date => setPayPeriodStart(date)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pay Period End</label>
              <DatePicker
                selected={payPeriodEnd}
                onChange={date => setPayPeriodEnd(date)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                minDate={payPeriodStart}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employee</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={generatePayroll}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Calculate Payroll
          </button>
        </div>

        {showPayrollForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Payroll Preview</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Hours</th>
                    <th className="px-4 py-2 text-left">Rate</th>
                    <th className="px-4 py-2 text-left">Gross Pay</th>
                    <th className="px-4 py-2 text-left">Taxes</th>
                    <th className="px-4 py-2 text-left">Deductions</th>
                    <th className="px-4 py-2 text-left">Net Pay</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatePayroll().map((payroll, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{payroll.employee_name}</td>
                      <td className="px-4 py-2">{payroll.hours_worked}</td>
                      <td className="px-4 py-2">${payroll.hourly_rate}</td>
                      <td className="px-4 py-2">${payroll.gross_pay}</td>
                      <td className="px-4 py-2">${payroll.taxes}</td>
                      <td className="px-4 py-2">${payroll.deductions}</td>
                      <td className="px-4 py-2 font-semibold">${payroll.net_pay}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => exportToPDF({
                            ...payroll,
                            employees: { name: payroll.employee_name },
                            pay_period_start: payPeriodStart.toISOString(),
                            pay_period_end: payPeriodEnd.toISOString()
                          })}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <FiDownload /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  // In a real app, you would save all payroll records to the database
                  alert('Payroll processed successfully!');
                  setShowPayrollForm(false);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                Process Payroll
              </button>
              <button
                onClick={() => setShowPayrollForm(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Payroll History */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Payroll History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Pay Period</th>
                  <th className="px-4 py-2 text-left">Employee</th>
                  <th className="px-4 py-2 text-left">Net Pay</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map(payroll => (
                  <tr key={payroll.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {new Date(payroll.pay_period_start).toLocaleDateString()} - {new Date(payroll.pay_period_end).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">{payroll.employees?.name || 'Unknown'}</td>
                    <td className="px-4 py-2">${parseFloat(payroll.net_pay).toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        payroll.status === 'paid' ? 'bg-green-100 text-green-800' :
                        payroll.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payroll.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => exportToPDF(payroll)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <FiDownload /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Payroll;