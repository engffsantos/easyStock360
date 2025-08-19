// frontend/src/pages/SalesPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/api';
import SaleForm from './SaleForm';
import { Card, Spinner, ModalWrapper, Input } from '../components/common';
import { PlusIcon, SearchIcon } from '../components/icons';

/** ============================
 *  Utilitários de formatação
 *  ============================ */
const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(value || 0));

const formatDateTime = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(dateString || Date.now()));

/** Divide um total em N parcelas (fechando centavos na última) */
function splitAmountsBRL(totalNumber, n) {
  const total = Math.round(Number(totalNumber || 0) * 100);
  const base = Math.floor(total / n);
  const remainder = total % n;
  const arr = Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
  return arr.map(v => v / 100);
}

/** Soma meses preservando o dia quando possível */
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/** yyyy-mm-dd (para <input type="date" />) */
function toInputDate(d) {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SalesPage = ({ onNavigateToReceipt }) => {
  /** ============================
   *  Estado principal da página
   *  ============================ */
  const [activeTab, setActiveTab] = useState('sales');

  const [sales, setSales] = useState([]);
  const [quotes, setQuotes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Conversão (pagamento) */
  const [paymentDetails, setPaymentDetails] = useState({ paymentMethod: 'PIX', installments: 1 });
  const [boletoDates, setBoletoDates] = useState(['']);
  const [quoteToConvert, setQuoteToConvert] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  /** ============================
   *  Crédito do cliente (novo)
   *  ============================
   *  - NÃO enviamos "CREDITO" no payload do /convert/ (para não quebrar)
   *  - Liquidamos o crédito antes e mandamos só o restante por método suportado
   */
  const [useCredit, setUseCredit] = useState(false);
  const [creditToUse, setCreditToUse] = useState(''); // input controlado
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [customerCredit, setCustomerCredit] = useState({ balance: 0, entries: [] });

  /** Modal de criação/edição */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  /** ============================
   *  Modal de ERRO de ESTOQUE (409)
   *  ============================
   *  Inspirado no modelo enviado: overlay + caixinha com ícone, mensagem e TABELA
   */
  const [stockError, setStockError] = useState({
    open: false,
    message: '',
    items: [], // [{ productId, productName, available, requested }]
  });
  const openStockErrorModal = (message, items = []) =>
    setStockError({ open: true, message: message || 'Estoque insuficiente.', items: items || [] });
  const closeStockErrorModal = () => setStockError({ open: false, message: '', items: [] });

  /** Filtros */
  // Vendas
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  // Orçamentos
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteDateFrom, setQuoteDateFrom] = useState('');
  const [quoteDateTo, setQuoteDateTo] = useState('');

  /** ============================
   *  Carregamento inicial
   *  ============================ */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, quotesData] = await Promise.all([
        api.getSales(),
        api.getQuotes(),
      ]);
      setSales(salesData || []);
      setQuotes(quotesData || []);
    } catch (e) {
      setError('Erro ao carregar vendas e orçamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** Modal nova transação */
  const handleOpenModal = () => { setEditingTransaction(null); setIsModalOpen(true); };
  const handleCloseModal = () => setIsModalOpen(false);
  const handleSaveSuccess = () => { setIsModalOpen(false); fetchData(); };

  /** ============================
   *  Crédito: carregar saldo
   *  ============================ */
  const fetchCustomerCredit = useCallback(async (customerId) => {
    if (!customerId) { setCustomerCredit({ balance: 0, entries: [] }); return; }
    try {
      setCreditLoading(true);
      setCreditError('');
      const data = await api.getCustomerCredits(customerId);
      setCustomerCredit({ balance: Number(data?.balance || 0), entries: data?.entries || [] });
    } catch (e) {
      setCreditError('Não foi possível carregar o saldo de crédito do cliente.');
      setCustomerCredit({ balance: 0, entries: [] });
    } finally {
      setCreditLoading(false);
    }
  }, []);

  /** Ao abrir conversão, reseta campos e busca crédito */
  useEffect(() => {
    setUseCredit(false);
    setCreditToUse('');
    setCustomerCredit({ balance: 0, entries: [] });
    setCreditError('');
    if (quoteToConvert?.customerId) fetchCustomerCredit(quoteToConvert.customerId);
  }, [quoteToConvert, fetchCustomerCredit]);

  /** ============================
   *  Ordenações/Filtros
   *  ============================ */
  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [sales]
  );
  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [quotes]
  );

  const filteredSales = useMemo(() => {
    const term = salesSearch.trim().toLowerCase();
    return sortedSales.filter((s) => {
      const d = new Date(s.createdAt);
      const okFrom = !salesDateFrom || d >= new Date(`${salesDateFrom}T00:00:00`);
      const okTo = !salesDateTo || d <= new Date(`${salesDateTo}T23:59:59`);
      const okText = !term ||
        (s.customerName || '').toLowerCase().includes(term) ||
        (s.id || '').toLowerCase().includes(term);
      return okText && okFrom && okTo;
    });
  }, [sortedSales, salesSearch, salesDateFrom, salesDateTo]);

  const filteredQuotes = useMemo(() => {
    const term = quoteSearch.trim().toLowerCase();
    return sortedQuotes.filter((q) => {
      const okText = !term ||
        (q.customerName || '').toLowerCase().includes(term) ||
        (q.id || '').toLowerCase().includes(term);
      const d = new Date(q.createdAt);
      const okFrom = !quoteDateFrom || d >= new Date(`${quoteDateFrom}T00:00:00`);
      const okTo = !quoteDateTo || d <= new Date(`${quoteDateTo}T23:59:59`);
      return okText && okFrom && okTo;
    });
  }, [sortedQuotes, quoteSearch, quoteDateFrom, quoteDateTo]);

  /** ============================
   *  UI helpers
   *  ============================ */
  const TabButton = ({ label, isActive, onClick, count }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-lg font-semibold border-b-4 transition-colors duration-200 ${
        isActive ? 'border-primary-700' : 'border-transparent  hover:border-primary-200'
      }`}
    >
      {label}
      <span className={`ml-2 px-2 py-0.5 rounded-full text-sm ${isActive ? 'bg-primary-700 text-white' : 'bg-base-200 text-base-400'}`}>
        {count}
      </span>
    </button>
  );
  const PrimaryButton = ({ children, onClick, disabled, className = '', ...props }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded text-white ${className}`}
      style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
      {...props}
    >
      {children}
    </button>
  );
  const DangerButton = ({ children, onClick, className = '' }) => (
    <button onClick={onClick} className={`px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 ${className}`}>
      {children}
    </button>
  );

  /** ============================
   *  Tabelas
   *  ============================ */
  const renderSalesTable = () => (
    <>
      <Card className="!p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="relative md:col-span-3">
            <Input
              id="ssearch"
              label="Buscar por Cliente ou Nº da Venda"
              placeholder="Ex.: Maria Silva ou 7b0c-..."
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              className="pl-10"
            />
            <div className="absolute inset-y-0 left-0 top-6 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="text-base-200" />
            </div>
          </div>
          <div>
            <label className="text-sm block mb-1">Data inicial</label>
            <input type="date" value={salesDateFrom} onChange={(e) => setSalesDateFrom(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full" />
          </div>
          <div>
            <label className="text-sm block mb-1">Data final</label>
            <input type="date" value={salesDateTo} onChange={(e) => setSalesDateTo(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full" />
          </div>
          <div className="md:col-span-5 text-sm text-base-400">
            Dica: deixe em branco para ver todas as vendas. O período afeta apenas a aba “Vendas”.
          </div>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Itens</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-base-200">
            {filteredSales.length > 0 ? filteredSales.map((sale) => (
              <tr key={sale.id} className={sale.status === 'CANCELLED' ? 'opacity-50 line-through' : ''}>
                <td className="px-6 py-4 text-sm ">{formatDateTime(sale.createdAt)}</td>
                <td className="px-6 py-4 text-sm text-base-400">{sale.customerName || 'Consumidor Final'}</td>
                <td className="px-6 py-4 text-sm ">{(sale.items || []).length}</td>
                <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(sale.total)}</td>
                <td className="px-6 py-4 flex flex-wrap gap-2">
                  <PrimaryButton className="!py-1 !px-2" onClick={() => onNavigateToReceipt(sale.id)}>
                    Ver Recibo
                  </PrimaryButton>
                  {sale.status !== 'CANCELLED' && (
                    <DangerButton className="!py-1 !px-2" onClick={() => handleCancelSale(sale.id)}>
                      Cancelar
                    </DangerButton>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="text-center py-12">Nenhuma venda encontrada para o filtro aplicado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderQuotesTable = () => (
    <>
      <Card className="!p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="relative md:col-span-3">
            <Input
              id="qsearch"
              label="Buscar por Cliente ou Nº do Orçamento"
              placeholder="Ex.: Maria Silva ou 7b0c-..."
              value={quoteSearch}
              onChange={(e) => setQuoteSearch(e.target.value)}
              className="pl-10"
            />
            <div className="absolute inset-y-0 left-0 top-6 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="text-base-200" />
            </div>
          </div>
          <div>
            <label className="text-sm block mb-1">Data inicial</label>
            <input type="date" value={quoteDateFrom} onChange={(e) => setQuoteDateFrom(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full" />
          </div>
          <div>
            <label className="text-sm block mb-1">Data final</label>
            <input type="date" value={quoteDateTo} onChange={(e) => setQuoteDateTo(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full" />
          </div>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Ações</th>
            </tr>
          </thead>
            <tbody className="bg-white divide-y divide-base-200">
              {filteredQuotes.length > 0 ? filteredQuotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="px-6 py-4 text-sm ">{formatDateTime(quote.createdAt)}</td>
                  <td className="px-6 py-4 text-sm text-base-400">{quote.customerName || 'Consumidor Final'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(quote.total)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <PrimaryButton className="!py-1 !px-2" onClick={() => {
                        setQuoteToConvert(quote);
                        setPaymentDetails({ paymentMethod: 'PIX', installments: 1 });
                        setBoletoDates(['']);
                      }}>
                        Converter
                      </PrimaryButton>
                      <PrimaryButton className="!py-1 !px-2" onClick={() => onNavigateToReceipt(quote.id)}>
                        Ver Orçamento
                      </PrimaryButton>
                      <button onClick={() => handleEditQuote(quote)} className="hover:text-primary-800 p-1 rounded" title="Editar Orçamento">
                        Editar
                      </button>
                      <button onClick={() => handleDeleteQuote(quote.id)} className="bg-red-600 hover:brightness-90 p-1 rounded" title="Excluir Orçamento">
                        Apagar
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="text-center py-12">Nenhum orçamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
    </>
  );

  const renderContent = () => {
    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
    if (error) return <div className="text-center text-danger p-12">{error}</div>;
    return activeTab === 'sales' ? renderSalesTable() : renderQuotesTable();
  };

  /** Mantém comportamento antigo: a quantidade de campos de boleto segue o número de parcelas */
  useEffect(() => {
    if (!quoteToConvert) return;
    if (paymentDetails.paymentMethod !== 'BOLETO') return;
    setBoletoDates(prev => {
      const next = [...prev];
      const n = Math.max(1, Number(paymentDetails.installments) || 1);
      if (n > next.length) {
        while (next.length < n) next.push('');
      } else if (n < next.length) {
        next.length = n;
      }
      return next;
    });
  }, [paymentDetails.installments, paymentDetails.paymentMethod, quoteToConvert]);

  const autofillMonthlyBoletoConv = () => {
    const today = new Date();
    const first = addMonths(today, 1);
    const n = Math.max(1, Number(paymentDetails.installments) || 1);
    const arr = Array.from({ length: n }, (_, i) => toInputDate(addMonths(first, i)));
    setBoletoDates(arr);
  };

  /** ============================
   *  Resumo com crédito
   *  ============================ */
  const totalQuote = Number(quoteToConvert?.total || 0);
  const parsedCreditInput = Math.max(0, Number(creditToUse || 0));
  const creditAllowed = Math.max(0, Math.min(parsedCreditInput, customerCredit.balance || 0, totalQuote || 0));
  const remainderAfterCredit = Math.max(0, totalQuote - creditAllowed);

  /** ============================
   *  Conversão (compat + crédito)
   *  ============================
   *
   *  - Se NÃO houver crédito:
   *      • BOLETO -> envia payments (datas + 'PENDENTE') [modo antigo ajustado]
   *      • Demais -> envia somente { paymentMethod, installments } [modo antigo]
   *
   *  - Se HOUVER crédito:
   *      • Liquida o crédito ANTES (endpoint novo)
   *      • NO /convert/ NÃO enviamos 'CREDITO'. Mandamos pagamentos apenas do RESTANTE:
   *          - BOLETO          -> payments do restante, status 'PENDENTE'
   *          - CARTAO_CREDITO  -> parcela(s) do restante, status 'PENDENTE'
   *          - CARTAO_DEBITO   -> parcela única do restante, status 'PAGO'
   *          - PIX/DINHEIRO    -> parcela única do restante, status 'PAGO'
   *          - TRANSFERENCIA   -> parcela única do restante, status 'PENDENTE'
   *      • Se 100% crédito -> { payments: [] }
   *
   *  >>> CAPTURA de 409 (OUT_OF_STOCK): abre modal com itens insuficientes
   */
  const handleConvertToSale = async () => {
    if (!quoteToConvert) return;

    try {
      setIsConverting(true);

      const method = paymentDetails.paymentMethod;
      const installments = Math.max(1, Number(paymentDetails.installments) || 1);

      // 1) Valida datas do BOLETO quando necessário
      if (method === 'BOLETO') {
        const n = installments;
        if (boletoDates.length !== n || boletoDates.some(d => !d)) {
          alert('Preencha todas as datas de vencimento das parcelas de boleto.');
          setIsConverting(false);
          return;
        }
      }

      // 2) Se houver crédito, liquida primeiro
      if (creditAllowed > 0) {
        if (!quoteToConvert.customerId) {
          alert('Não é possível usar crédito: orçamento sem cliente vinculado.');
          setIsConverting(false);
          return;
        }
        try {
          await api.liquidateCustomerCredit(quoteToConvert.customerId, creditAllowed);
        } catch (e) {
          const msg = e?.response?.data?.error || 'Falha ao liquidar crédito do cliente.';
          alert(msg);
          setIsConverting(false);
          return;
        }
      }

      // 3) Monta o payload de conversão
      let body = null;

      if (creditAllowed <= 0) {
        // ======= MODO ANTIGO (sem crédito) =======
        if (method === 'BOLETO') {
          const n = installments;
          const amounts = splitAmountsBRL(totalQuote, n); // distribui o TOTAL (compat antigo)
          body = {
            payments: boletoDates.map((d, i) => ({
              dueDate: new Date(`${d}T00:00:00Z`).toISOString(),
              amount: amounts[i],
              paymentMethod: 'BOLETO',
              status: 'PENDENTE',
            })),
          };
        } else {
          // Demais métodos: envia objeto simples (compat antigo)
          body = { paymentMethod: method, installments };
        }
      } else {
        // ======= COM CRÉDITO (não enviar "CREDITO" no convert) =======
        const payments = [];

        if (remainderAfterCredit > 0) {
          if (method === 'BOLETO') {
            const n = installments;
            const amounts = splitAmountsBRL(remainderAfterCredit, n);
            boletoDates.forEach((d, i) => {
              payments.push({
                dueDate: new Date(`${d}T00:00:00Z`).toISOString(),
                amount: amounts[i],
                paymentMethod: 'BOLETO',
                status: 'PENDENTE',
              });
            });
          } else if (method === 'CARTAO_CREDITO') {
            if (installments > 1) {
              const parts = splitAmountsBRL(remainderAfterCredit, installments);
              parts.forEach((part, idx) => {
                payments.push({
                  amount: part,
                  paymentMethod: 'CARTAO_CREDITO',
                  dueDate: addMonths(new Date(), idx).toISOString(),
                  status: 'PENDENTE',
                });
              });
            } else {
              payments.push({
                amount: remainderAfterCredit,
                paymentMethod: 'CARTAO_CREDITO',
                dueDate: new Date().toISOString(),
                status: 'PENDENTE',
              });
            }
          } else if (method === 'CARTAO_DEBITO') {
            payments.push({
              amount: remainderAfterCredit,
              paymentMethod: 'CARTAO_DEBITO',
              dueDate: new Date().toISOString(),
              status: 'PAGO', // débito é imediato
            });
          } else if (method === 'PIX' || method === 'DINHEIRO') {
            payments.push({
              amount: remainderAfterCredit,
              paymentMethod: method,
              dueDate: new Date().toISOString(),
              status: 'PAGO', // imediato
            });
          } else if (method === 'TRANSFERENCIA') {
            payments.push({
              amount: remainderAfterCredit,
              paymentMethod: 'TRANSFERENCIA',
              dueDate: new Date().toISOString(),
              status: 'PENDENTE',
            });
          }
        }

        // 100% com crédito (nenhum restante): envia payments vazio
        body = { payments };
      }

      // 4) Converte
      await api.convertToSale(quoteToConvert.id, body);

      alert('Orçamento convertido com sucesso!');
      setQuoteToConvert(null);
      setBoletoDates(['']);
      setPaymentDetails({ paymentMethod: 'PIX', installments: 1 });
      setUseCredit(false);
      setCreditToUse('');
      fetchData();
    } catch (err) {
      // >>> TRATAMENTO DO 409 (OUT_OF_STOCK) <<<
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.error === 'OUT_OF_STOCK') {
        // Abre modal bonito com tabela dos itens insuficientes
        openStockErrorModal(
          data?.message || 'Estoque insuficiente para um ou mais itens.',
          Array.isArray(data?.items) ? data.items : []
        );
      } else {
        // Outros erros continuam com alert genérico (ou customizar mais tarde)
        alert(data?.error || err?.message || 'Erro ao converter orçamento');
      }
    } finally {
      setIsConverting(false);
    }
  };

  /** ============================
   *  Ações diversas
   *  ============================ */
  const handleEditQuote = (quote) => { setEditingTransaction(quote); setIsModalOpen(true); };
  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm('Tem certeza que deseja excluir este orçamento?')) return;
    try { await api.deleteTransaction(quoteId); alert('Orçamento excluído com sucesso!'); fetchData(); }
    catch { alert('Erro ao excluir orçamento'); }
  };
  const handleCancelSale = async (saleId) => {
    if (!window.confirm('Deseja realmente cancelar esta venda?')) return;
    try { await api.cancelSale(saleId); alert('Venda cancelada com sucesso.'); fetchData(); }
    catch { alert('Erro ao cancelar a venda.'); }
  };

  /** ============================
   *  Render
   *  ============================ */
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Vendas e Orçamentos</h1>
        <PrimaryButton onClick={handleOpenModal}>
          <PlusIcon /> Nova Venda / Orçamento
        </PrimaryButton>
      </div>

      <div className="mb-6 border-b border-base-200">
        <nav className="flex gap-4">
          <TabButton label="Vendas" isActive={activeTab === 'sales'} onClick={() => setActiveTab('sales')} count={sales.length} />
          <TabButton label="Orçamentos" isActive={activeTab === 'quotes'} onClick={() => setActiveTab('quotes')} count={quotes.length} />
        </nav>
      </div>

      <Card>{renderContent()}</Card>

      {/* Modal de criação/edição */}
      <ModalWrapper
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTransaction ? 'Editar Orçamento' : 'Registrar Nova Transação'}
      >
        <div className="modal-panel bg-white rounded-xl w-full p-6 relative">
          <SaleForm
            transactionToEdit={editingTransaction}
            onSave={handleSaveSuccess}
            onClose={handleCloseModal}
            isSaving={false}
          />
        </div>
      </ModalWrapper>

      {/* Modal de conversão (compat + crédito sem "CREDITO" no convert) */}
      {quoteToConvert && (
        <ModalWrapper
          isOpen={true}
          onClose={() => setQuoteToConvert(null)}
          title="Converter Orçamento"
        >
          <div className="w-full max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto">
            <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
              <p>Confirme os detalhes de pagamento para converter este orçamento em uma venda.</p>

              {/* Resumo + Crédito */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded border">
                  <div className="text-sm text-base-400">Total do orçamento</div>
                  <div className="text-xl font-bold">{formatCurrency(totalQuote)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-sm text-base-400">Crédito aplicado</div>
                  <div className="text-xl font-bold">{formatCurrency(creditAllowed)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-sm text-base-400">Restante após crédito</div>
                  <div className="text-xl font-bold text-primary-800">{formatCurrency(remainderAfterCredit)}</div>
                </div>
              </div>

              {/* Forma / Parcelas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm">Forma de pagamento</label>
                  <select
                    value={paymentDetails.paymentMethod}
                    onChange={(e) =>
                      setPaymentDetails((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                        installments: 1,
                      }))
                    }
                    className="w-full p-2 border rounded"
                    disabled={remainderAfterCredit === 0} // se cobre 100% com crédito, desabilita
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TRANSFERENCIA">Transferência</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-sm">Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={paymentDetails.installments}
                    onChange={(e) =>
                      setPaymentDetails((prev) => ({
                        ...prev,
                        installments: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    disabled={
                      remainderAfterCredit === 0 ||
                      (paymentDetails.paymentMethod !== 'CARTAO_CREDITO' &&
                        paymentDetails.paymentMethod !== 'BOLETO')
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              {/* BLOCO: CRÉDITO DO CLIENTE */}
              <div className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useCredit"
                      className="w-4 h-4"
                      checked={useCredit}
                      onChange={(e) => setUseCredit(e.target.checked)}
                      disabled={!quoteToConvert?.customerId}
                    />
                    <label htmlFor="useCredit" className="font-semibold">Usar crédito do cliente</label>
                  </div>
                  <div className="text-sm">
                    {quoteToConvert?.customerId ? (
                      creditLoading ? 'Carregando saldo...' :
                      creditError ? <span className="text-red-600">{creditError}</span> :
                      <>Saldo disponível: <strong>{formatCurrency(customerCredit.balance || 0)}</strong></>
                    ) : (
                      <span className="text-base-400">Sem cliente vinculado ao orçamento</span>
                    )}
                  </div>
                </div>

                {useCredit && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1">Valor do crédito a utilizar</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={creditToUse}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (Number.isNaN(Number(val))) return;
                          setCreditToUse(val);
                        }}
                        onBlur={() => {
                          const n = Math.max(0, Number(creditToUse || 0));
                          const clamped = Math.min(n, customerCredit.balance || 0, totalQuote || 0);
                          setCreditToUse(String(clamped.toFixed(2)));
                        }}
                        className="w-full p-2 border rounded"
                        placeholder="Ex.: 50,00"
                      />
                      <p className="text-xs text-base-400 mt-1">
                        Máximo permitido: {formatCurrency(Math.min(customerCredit.balance || 0, totalQuote || 0))}
                      </p>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm mb-1">Saldo após uso</label>
                      <div className="p-2 border rounded bg-base-50">
                        {formatCurrency(Math.max(0, (customerCredit.balance || 0) - creditAllowed))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BOLETO: vencimentos (status PENDENTE) */}
              {paymentDetails.paymentMethod === 'BOLETO' && remainderAfterCredit > 0 && (
                <div className="border rounded p-3 bg-white">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-semibold">Vencimentos do Boleto</h4>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-2 rounded text-white"
                        style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
                        onClick={autofillMonthlyBoletoConv}
                        type="button"
                      >
                        Preencher mensalmente
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-base-400 mb-2">
                    Informe o <strong>vencimento</strong> de cada parcela. Os valores serão distribuídos automaticamente sobre o restante.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: Math.max(1, Number(paymentDetails.installments) || 1) }).map((_, i) => (
                      <div key={i}>
                        <label className="block text-sm mb-1">Parcela #{i + 1} - Vencimento</label>
                        <input
                          type="date"
                          className="w-full p-2 border rounded"
                          value={boletoDates[i] || ''}
                          onChange={(e) => {
                            setBoletoDates(prev => {
                              const next = [...prev];
                              next[i] = e.target.value;
                              return next;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-sm">
                    <p className="font-medium">Distribuição do restante por parcela (estimativa):</p>
                    <ul className="list-disc pl-5">
                      {splitAmountsBRL(remainderAfterCredit || 0, Math.max(1, Number(paymentDetails.installments) || 1)).map((v, i) => (
                        <li key={i}>Parcela #{i + 1}: {formatCurrency(v)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <PrimaryButton onClick={handleConvertToSale} disabled={isConverting}>
                {isConverting ? 'Convertendo...' : 'Confirmar Conversão'}
              </PrimaryButton>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ============================
          MODAL DE ERRO DE ESTOQUE (409)
          ============================ */}
      {stockError.open && (
        <div
          id="modal-erro-estoque"
          className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 transition-opacity duration-300 opacity-100"
          onClick={(e) => { if (e.target.id === 'modal-erro-estoque') closeStockErrorModal(); }}
        >
          <div className="bg-white p-6 md:p-8 rounded-lg shadow-2xl max-w-md w-full mx-4 transition-transform duration-300 transform scale-100">
            {/* Ícone vermelho (mesmo do exemplo) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>

            <h2 className="text-xl font-bold text-center mt-4 text-gray-800">
              Oops! Estoque Insuficiente
            </h2>

            {/* Mensagem (respeita quebras de linha) */}
            <p className="text-gray-600 text-center mt-2 whitespace-pre-line">
              {stockError.message || 'Estoque insuficiente para um ou mais itens.'}
            </p>

            {/* Tabela de itens faltantes */}
            {Array.isArray(stockError.items) && stockError.items.length > 0 && (
              <div className="mt-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-700">
                      <th className="py-1 pr-2">Produto</th>
                      <th className="py-1 pr-2 text-right">Disponível</th>
                      <th className="py-1 text-right">Solicitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockError.items.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-1 pr-2 text-gray-800">{it.productName || it.productId}</td>
                        <td className="py-1 pr-2 text-right">{Number(it.available ?? 0)}</td>
                        <td className="py-1 text-right font-semibold text-red-600">{Number(it.requested ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              id="btn-fechar-modal"
              className="mt-6 w-full bg-red-600 text-white py-2 rounded-md font-medium hover:bg-red-700 transition duration-200"
              onClick={closeStockErrorModal}
              type="button"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SalesPage;
