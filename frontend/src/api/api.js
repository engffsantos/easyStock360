//frontend/src/api/api.js
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';
// Corrigido com barra final
export const api = {
  // Customers
  getCustomers: () => axios.get(`${BASE_URL}/customers/`).then(res => res.data),
  addCustomer: (data) => axios.post(`${BASE_URL}/customers/`, data),
  updateCustomer: (id, data) => axios.put(`${BASE_URL}/customers/${id}/`, data),
  deleteCustomer: (id) => axios.delete(`${BASE_URL}/customers/${id}/`),

  // Products
  getProducts: () => axios.get(`${BASE_URL}/products/`).then(res => res.data),
  addProduct: (data) => axios.post(`${BASE_URL}/products/`, data),
  updateProduct: (id, data) => axios.put(`${BASE_URL}/products/${id}/`, data),
  deleteProduct: (id) => axios.delete(`${BASE_URL}/products/${id}/`),

  // Sales
  getSales: () => axios.get(`${BASE_URL}/sales/`).then(res => res.data),
  getQuotes: () => axios.get(`${BASE_URL}/sales/quotes/`).then(res => res.data),
  getTransactionById: (id) => axios.get(`${BASE_URL}/sales/${id}/`).then(res => res.data),
  addTransaction: (data) => axios.post(`${BASE_URL}/sales/`, data),
  updateTransaction: (id, data) => axios.put(`${BASE_URL}/sales/${id}/`, data),
  deleteTransaction: (id) => axios.delete(`${BASE_URL}/sales/${id}/`),
  convertToSale: (id, paymentDetails) => axios.post(`${BASE_URL}/sales/${id}/convert/`, paymentDetails),
  cancelSale: (id) => axios.put(`${BASE_URL}/sales/${id}/cancel`),

  // Financial
  getFinancialEntries: () => axios.get(`${BASE_URL}/financial/`).then(res => res.data),
  addFinancialEntry: (data) => axios.post(`${BASE_URL}/financial/`, data),
  markFinancialEntryAsPaid: (id) => axios.post(`${BASE_URL}/financial/${id}/pay/`),
  deleteFinancialEntry: (id) => axios.delete(`${BASE_URL}/financial/${id}/`),

  // Reports
  getReportsData: (start, end) =>
    axios.get(`${BASE_URL}/reports/?start=${start}&end=${end}`).then(res => res.data),
  setGoals: (data) => axios.post(`${BASE_URL}/reports/goals/`, data),

  // Interactions (opcional)
  addInteraction: (data) => axios.post(`${BASE_URL}/customers/${data.customerId}/interactions/`, data),
  getInteractionsByCustomerId: (id) => axios.get(`${BASE_URL}/customers/${id}/interactions/`).then(res => res.data),

  // Dashboard
  getDashboardStats: () =>
    Promise.all([
      api.getSales(),
      api.getFinancialEntries(),
      api.getProducts()
    ]).then(([sales, entries, products]) => {
      const today = new Date().toISOString().slice(0, 10);
      const salesToday = sales.filter(s => s.createdAt.startsWith(today));
      const openQuotes = sales.filter(s => s.status === 'QUOTE');

      const receivable = entries.filter(e => e.type === 'RECEITA' && e.status !== 'PAGO');
      const payable = entries.filter(e => e.type === 'DESPESA' && e.status !== 'PAGO');
      const overduePayable = payable.filter(e => e.status === 'VENCIDO');

      const lowStock = products.filter(p => p.quantity <= p.minStock);

      return {
        salesTodayCount: salesToday.length,
        salesTodayValue: salesToday.reduce((sum, s) => sum + s.total, 0),
        openQuotesCount: openQuotes.length,
        totalReceivable: receivable.reduce((sum, e) => sum + e.amount, 0),
        totalPayable: payable.reduce((sum, e) => sum + e.amount, 0),
        overduePayableCount: overduePayable.length,
        lowStockProductsCount: lowStock.length,
        recentSales: sales.slice(0, 5)
      };
    })
};
