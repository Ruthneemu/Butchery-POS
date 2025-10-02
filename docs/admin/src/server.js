// server.js
const express = require('express');
const bodyParser = require('body-parser');
const OdooService = require('./odooService');

const app = express();
app.use(bodyParser.json());

const odooService = new OdooService({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  db: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USERNAME || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
  mpesaPaymentMethodId: process.env.MPESA_PAYMENT_METHOD_ID || 1,
});

// Create sale order in Odoo
app.post('/api/odoo/sale-order', async (req, res) => {
  try {
    const { saleData } = req.body;
    const saleOrderId = await odooService.createSaleOrder(saleData);
    res.json({ success: true, saleOrderId });
  } catch (error) {
    console.error('Error creating sale order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process M-Pesa payment
app.post('/api/odoo/mpesa-payment', async (req, res) => {
  try {
    const { paymentData } = req.body;
    const transactionId = await odooService.processMpesaPayment(paymentData);
    res.json({ success: true, transactionId });
  } catch (error) {
    console.error('Error processing M-Pesa payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm M-Pesa payment (callback from M-Pesa)
app.post('/api/odoo/mpesa-confirm', async (req, res) => {
  try {
    const { transactionId, receiptNumber } = req.body;
    await odooService.confirmMpesaPayment(transactionId, receiptNumber);
    res.json({ success: true });
  } catch (error) {
    console.error('Error confirming M-Pesa payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});