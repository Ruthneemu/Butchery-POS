// odooService.js
const axios = require('axios');
const xmlrpc = require('xmlrpc');

class OdooService {
  constructor(config) {
    this.config = {
      url: config.url,
      db: config.db,
      username: config.username,
      password: config.password,
      ...config
    };
    this.uid = null;
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      const client = xmlrpc.createClient({
        url: `${this.config.url}/xmlrpc/2/common`
      });

      client.methodCall('authenticate', [
        this.config.db,
        this.config.username,
        this.config.password,
        {}
      ], (error, uid) => {
        if (error) {
          reject(error);
        } else {
          this.uid = uid;
          resolve(uid);
        }
      });
    });
  }

  async execute_kw(model, method, params = []) {
    if (!this.uid) {
      await this.authenticate();
    }

    return new Promise((resolve, reject) => {
      const client = xmlrpc.createClient({
        url: `${this.config.url}/xmlrpc/2/object`
      });

      client.methodCall('execute_kw', [
        this.config.db,
        this.uid,
        this.config.password,
        model,
        method,
        params
      ], (error, value) => {
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      });
    });
  }

  async createSaleOrder(saleData) {
    const customer = await this.getOrCreateCustomer(saleData.customer);
    
    const orderLines = saleData.items.map(item => {
      return [0, 0, {
        product_id: this.getProductId(item.product_id),
        product_uom_qty: item.quantity,
        price_unit: item.price,
        name: item.name
      }];
    });

    const orderData = {
      partner_id: customer.id,
      state: 'draft',
      order_line: orderLines,
      note: `Payment method: ${saleData.paymentMethod}`,
    };

    return this.execute_kw('sale.order', 'create', [orderData]);
  }

  async getOrCreateCustomer(customerData) {
    if (!customerData || customerData === 'Guest Customer') {
      // Create or get a generic guest customer
      const guestCustomer = await this.execute_kw('res.partner', 'search', [[['name', '=', 'Guest Customer']]]);
      
      if (guestCustomer.length > 0) {
        return { id: guestCustomer[0] };
      }
      
      return {
        id: await this.execute_kw('res.partner', 'create', [{
          name: 'Guest Customer',
          customer: true,
        }])
      };
    }

    // Search for existing customer
    const customers = await this.execute_kw('res.partner', 'search', [[['name', '=', customerData.name]]]);
    
    if (customers.length > 0) {
      return { id: customers[0] };
    }
    
    // Create new customer
    return {
      id: await this.execute_kw('res.partner', 'create', [{
        name: customerData.name,
        phone: customerData.phone,
        customer: true,
      }])
    };
  }

  getProductId(productId) {
    // This would map your product IDs to Odoo product IDs
    // In a real implementation, you'd have a mapping or sync products between systems
    return productId; // Placeholder
  }

  async processMpesaPayment(paymentData) {
    // Create a payment transaction in Odoo
    const paymentTransaction = {
      amount: paymentData.amount,
      payment_method_id: this.config.mpesaPaymentMethodId, // ID of M-Pesa payment method in Odoo
      partner_id: paymentData.customerId,
      sale_order_ids: paymentData.saleOrderIds,
      state: 'pending',
      mpesa_phone_number: paymentData.phoneNumber,
      mpesa_transaction_id: paymentData.transactionId,
    };

    return this.execute_kw('payment.transaction', 'create', [paymentTransaction]);
  }

  async confirmMpesaPayment(transactionId, receiptNumber) {
    // Update payment transaction as completed
    return this.execute_kw('payment.transaction', 'write', [[transactionId], {
      state: 'done',
      mpesa_receipt_number: receiptNumber,
    }]);
  }
}

module.exports = OdooService;