// frontend/src/api/api.js
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Helper: normaliza erro de conversão de orçamento expirado (422)
function normalizeConvertError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (status === 422) {
    const e = new Error(data?.error || 'Orçamento expirado');
    e.code = data?.code || 'QUOTE_EXPIRED';
    throw e;
  }
  throw err;
}

export const api = {
  // -------------------------
  // Customers
  // -------------------------
  getCustomers: () => axios.get(`${BASE_URL}/customers/`).then(res => res.data),
  addCustomer: (data) => axios.post(`${BASE_URL}/customers/`, data),
  updateCustomer: (id, data) => axios.put(`${BASE_URL}/customers/${id}`, data),
  deleteCustomer: (id) => axios.delete(`${BASE_URL}/customers/${id}`),
  addInteraction: (data) => axios.post(`${BASE_URL}/customers/${data.customerId}/interactions/`, data),
  getInteractionsByCustomerId: (id) => axios.get(`${BASE_URL}/customers/${id}/interactions/`).then(res => res.data),
  getCustomerPurchases: (id) => axios.get(`${BASE_URL}/customers/${id}/purchases/`).then(res => res.data),

  // -------------------------
  // Products
  // -------------------------
  getProducts: () => axios.get(`${BASE_URL}/products/`).then(res => res.data),
  addProduct: (data) => axios.post(`${BASE_URL}/products/`, data),
  updateProduct: (id, data) => axios.put(`${BASE_URL}/products/${id}/`, data),
  deleteProduct: (id) => axios.delete(`${BASE_URL}/products/${id}/`),

  // -------------------------
  // Sales
  // -------------------------
  // Observação: o backend já retorna os novos campos:
  // subtotal, discountType, discountValue, freight, total, validUntil
  getSales: () => axios.get(`${BASE_URL}/sales/`).then(res => res.data),
  getQuotes: () => axios.get(`${BASE_URL}/sales/quotes/`).then(res => res.data),
  getTransactionById: (id) => axios.get(`${BASE_URL}/sales/${id}/`).then(res => res.data),

  // add/update aceitam os novos campos; o servidor recalcula os totais
  addTransaction: (data) => axios.post(`${BASE_URL}/sales/`, data),
  updateTransaction: (id, data) => axios.put(`${BASE_URL}/sales/${id}/`, data),
  deleteTransaction: (id) => axios.delete(`${BASE_URL}/sales/${id}/`),

  // Conversão trata 422 (QUOTE_EXPIRED) e lança erro com .code
  convertToSale: async (id, paymentDetails) => {
    try {
      const res = await axios.post(`${BASE_URL}/sales/${id}/convert/`, paymentDetails);
      return res.data;
    } catch (err) {
      normalizeConvertError(err);
    }
  },

  cancelSale: (id) => axios.put(`${BASE_URL}/sales/${id}/cancel`),

  // -------------------------
  // Financial
  // -------------------------
  getFinancialEntries: () => axios.get(`${BASE_URL}/financial`).then(res => res.data),
  addFinancialEntry: (data) => axios.post(`${BASE_URL}/financial`, data),
  markFinancialEntryAsPaid: (id) => axios.post(`${BASE_URL}/financial/${id}/pay`),
  deleteFinancialEntry: (id) => axios.delete(`${BASE_URL}/financial/${id}`),

  // -------------------------
  // Reports
  // -------------------------
  getReportsData: (start, end) =>
    axios.get(`${BASE_URL}/reports/?start=${start}&end=${end}`).then(res => res.data),
  setGoals: (data) => axios.post(`${BASE_URL}/reports/goals/`, data),
  getGoals: () => axios.get(`${BASE_URL}/reports/goals/`).then(res => res.data),

  // -------------------------
  // Dashboard
  // -------------------------
  // Ajustado: usa getQuotes() para contar orçamentos abertos corretamente
  getDashboardStats: () =>
    Promise.all([
      api.getSales(),      // vendas COMPLETED
      api.getQuotes(),     // orçamentos QUOTE
      api.getFinancialEntries(),
      api.getProducts()
    ]).then(([sales, quotes, entries, products]) => {
      const today = new Date().toISOString().slice(0, 10);

      const salesToday = sales.filter(s => (s.createdAt || '').startsWith(today));
      const openQuotes = quotes; // já são QUOTE

      const receivable = entries.filter(e => e.type === 'RECEITA' && e.status !== 'PAGO');
      const payable = entries.filter(e => e.type === 'DESPESA' && e.status !== 'PAGO');
      const overduePayable = payable.filter(e => e.status === 'VENCIDO');

      const lowStock = products.filter(p => p.quantity <= p.minStock);

      return {
        salesTodayCount: salesToday.length,
        salesTodayValue: salesToday.reduce((sum, s) => sum + (s.total || 0), 0),
        openQuotesCount: openQuotes.length,
        totalReceivable: receivable.reduce((sum, e) => sum + (e.amount || 0), 0),
        totalPayable: payable.reduce((sum, e) => sum + (e.amount || 0), 0),
        overduePayableCount: overduePayable.length,
        lowStockProductsCount: lowStock.length,
        recentSales: sales.slice(0, 5)
      };
    }),

  // -------------------------
  // Settings
  // -------------------------
  getCompanyInfo: () => axios.get(`${BASE_URL}/settings/company`).then(res => res.data),
  saveCompanyInfo: (data) => axios.post(`${BASE_URL}/settings/company`, data),
};

// Importar CSV
export async function importProductsFromCSV(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${BASE_URL}/products/import_csv`, {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao importar CSV');
      } else {
        const text = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${text}`);
      }
    }

    return await response.json();
  } catch (err) {
    console.error('[IMPORT ERROR]', err);
    throw new Error(`Falha na requisição: ${err.message}`);
  }
}
