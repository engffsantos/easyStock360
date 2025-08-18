// frontend/src/api/api.js
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Axios instance (padrão)
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

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

// ---------- Update compatível para /financial ----------
async function updateFinancialCompat(id, payload) {
  // 1) PATCH /financial/:id
  try {
    const r = await apiClient.patch(`/financial/${id}`, payload);
    return r.data;
  } catch (e1) {
    if (e1?.response?.status !== 405 && e1?.response?.status !== 404) throw e1;
  }

  // 2) PUT /financial/:id
  try {
    const r = await apiClient.put(`/financial/${id}`, payload);
    return r.data;
  } catch (e2) {
    if (e2?.response?.status !== 405 && e2?.response?.status !== 404) throw e2;
  }

  // 3) POST /financial/:id/update (compat)
  try {
    const r = await apiClient.post(`/financial/${id}/update`, payload);
    return r.data;
  } catch (e3) {
    const msg = e3?.response?.data?.error || e3.message;
    const err = new Error(msg || 'Falha ao atualizar lançamento financeiro.');
    err.cause = e3;
    throw err;
  }
}

export const api = {
  // -------------------------
  // Customers
  // -------------------------
  getCustomers: () => apiClient.get(`/customers/`).then(res => res.data),
  addCustomer: (data) => apiClient.post(`/customers/`, data),
  updateCustomer: (id, data) => apiClient.put(`/customers/${id}`, data),
  deleteCustomer: (id) => apiClient.delete(`/customers/${id}`),
  addInteraction: (data) => apiClient.post(`/customers/${data.customerId}/interactions/`, data),
  getInteractionsByCustomerId: (id) => apiClient.get(`/customers/${id}/interactions/`).then(res => res.data),
  getCustomerPurchases: (id) => apiClient.get(`/customers/${id}/purchases/`).then(res => res.data),
  // Créditos do cliente
  getCustomerCredits: (id) =>  apiClient.get(`/customers/${id}/credits/`).then(res => res.data),

  // -------------------------
  // Products (ATUALIZADO)
  // -------------------------
  // opts: { includeInactive?: boolean, onlyInactive?: boolean }
  getProducts: (opts = {}) => {
    const params = {};
    if (opts.onlyInactive) params.is_active = 0;
    else if (opts.includeInactive) params.include_inactive = 1;
    return apiClient.get(`/products/`, { params }).then(res => res.data);
  },
  addProduct: (data) => apiClient.post(`/products/`, data),
  updateProduct: (id, data) => apiClient.put(`/products/${id}/`, data),

  // Novo fluxo: desativar/reativar (mantém histórico)
  deactivateProduct: (id) => apiClient.patch(`/products/${id}/deactivate`).then(res => res.data),
  activateProduct: (id) => apiClient.patch(`/products/${id}/activate`).then(res => res.data),

  // Alias para compat (antigo delete -> agora desativar)
  deleteProduct: (id) => apiClient.patch(`/products/${id}/deactivate`).then(res => res.data),

  getProductHistory: (id) => apiClient.get(`/products/${id}/history`).then(res => res.data),

  // -------------------------
  // Sales
  // -------------------------
  getSales: () => apiClient.get(`/sales/`).then(res => res.data),
  // NOVO: somente vendas concluídas (usa ?status=COMPLETED)
  getCompletedSales: () =>
    apiClient.get(`/sales/`, { params: { status: 'COMPLETED' } }).then(res => res.data),

  getQuotes: () => apiClient.get(`/sales/quotes/`).then(res => res.data),
  getTransactionById: (id) => apiClient.get(`/sales/${id}/`).then(res => res.data),
  addTransaction: (data) => apiClient.post(`/sales/`, data),
  updateTransaction: (id, data) => apiClient.put(`/sales/${id}/`, data),
  deleteTransaction: (id) => apiClient.delete(`/sales/${id}/`),
  convertToSale: async (id, paymentDetails) => {
    try {
      const res = await apiClient.post(`/sales/${id}/convert/`, paymentDetails);
      return res.data;
    } catch (err) {
      normalizeConvertError(err);
    }
  },
  cancelSale: (id) => apiClient.put(`/sales/${id}/cancel`),

  // --- Sales Payments ---
  paySalePayment: (paymentId) =>
    apiClient.post(`/sales/payments/${paymentId}/pay`).then(res => res.data),

  // Atualizar status/infos da parcela da venda
  updateSalePaymentStatus: (paymentId, data) =>
    apiClient.put(`/sales/payments/${paymentId}`, data).then(res => res.data),

  // -------------------------
  // Returns (Devoluções)
  // -------------------------
  getReturns: () => apiClient.get(`/returns`).then(res => res.data),
  addReturn: (payload) => apiClient.post(`/returns`, payload).then(res => res.data),
  updateReturnStatus: (id, status) =>
    apiClient.patch(`/returns/${id}/status`, { status }).then(res => res.data),

  // -------------------------
  // Financial
  // -------------------------
  getFinancialEntries: () => apiClient.get(`/financial`).then(res => res.data),
  addFinancialEntry: (data) => apiClient.post(`/financial`, data),
  markFinancialEntryAsPaid: (id) => apiClient.post(`/financial/${id}/pay`),
  deleteFinancialEntry: (id) => apiClient.delete(`/financial/${id}`),

  // Atualizar lançamento financeiro manual (receita/despesa)
  updateFinancialEntry: (id, data) => updateFinancialCompat(id, data),

  // -------------------------
  // Reports
  // -------------------------
  getReportsData: (start, end) =>
    apiClient.get(`/reports/`, { params: { start, end } }).then(res => res.data),
  setGoals: (data) => apiClient.post(`/reports/goals/`, data),
  getGoals: () => apiClient.get(`/reports/goals/`).then(res => res.data),

  // -------------------------
  // Dashboard
  // -------------------------
  getDashboardStats: () =>
    Promise.all([
      api.getSales(),
      api.getQuotes(),
      api.getFinancialEntries(),
      api.getProducts()
    ]).then(([sales, quotes, entries, products]) => {
      const today = new Date().toISOString().slice(0, 10);
      const salesToday = sales.filter(s => (s.createdAt || '').startsWith(today));
      const openQuotes = quotes;
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
  getCompanyInfo: () => apiClient.get(`/settings/company`).then(res => res.data),
  saveCompanyInfo: (data) => apiClient.post(`/settings/company`, data),
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
