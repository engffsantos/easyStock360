// frontend/src/pages/SalesPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/api';
import SaleForm from './SaleForm';
import { Card, Spinner, ModalWrapper, Input } from '../components/common';
import { PlusIcon, TrashIcon, CheckCircleIcon, EditIcon, SearchIcon } from '../components/icons';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateString));

function splitAmountsBRL(totalNumber, n) {
  const total = Math.round(Number(totalNumber || 0) * 100);
  const base = Math.floor(total / n);
  const remainder = total % n;
  const arr = Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
  return arr.map(v => v / 100);
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function toInputDate(d) {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SalesPage = ({ onNavigateToReceipt }) => {
  const [activeTab, setActiveTab] = useState('sales');

  const [sales, setSales] = useState([]);
  const [quotes, setQuotes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Conversão
  const [paymentDetails, setPaymentDetails] = useState({ paymentMethod: 'PIX', installments: 1 });
  const [boletoDates, setBoletoDates] = useState(['']);
  const [quoteToConvert, setQuoteToConvert] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  // Modal de criação/edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Filtro de VENDAS por data
  const [salesDateFrom, setSalesDateFrom] = useState(''); // yyyy-mm-dd
  const [salesDateTo, setSalesDateTo] = useState('');     // yyyy-mm-dd

  // Filtros de ORÇAMENTOS (texto e período)
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteDateFrom, setQuoteDateFrom] = useState('');
  const [quoteDateTo, setQuoteDateTo] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, quotesData] = await Promise.all([
        api.getSales(),
        api.getQuotes(),
      ]);
      setSales(salesData);
      setQuotes(quotesData);
    } catch (e) {
      setError('Erro ao carregar vendas e orçamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    fetchData();
  };

  const handleConvertToSale = async (quoteId, paymentDetailsIn) => {
    try {
      setIsConverting(true);

      // Monta payments se for boleto
      let body = { ...paymentDetailsIn };
      if (paymentDetailsIn.paymentMethod === 'BOLETO') {
        const n = Math.max(1, Number(paymentDetailsIn.installments) || 1);
        if (boletoDates.length !== n || boletoDates.some(d => !d)) {
          alert('Preencha todas as datas de vencimento das parcelas de boleto.');
          setIsConverting(false);
          return;
        }
        const totalRef = quotes.find(q => q.id === quoteId)?.total || 0;
        const amounts = splitAmountsBRL(totalRef, n);
        body = {
          ...body,
          payments: boletoDates.map((d, i) => ({
            dueDate: new Date(`${d}T00:00:00Z`).toISOString(),
            amount: amounts[i],
            paymentMethod: 'BOLETO',
            status: 'ABERTO',
          })),
        };
      }

      await api.convertToSale(quoteId, body);
      alert('Orçamento convertido com sucesso!');
      setQuoteToConvert(null);
      setBoletoDates(['']);
      setPaymentDetails({ paymentMethod: 'PIX', installments: 1 });
      fetchData();
    } catch (err) {
      alert('Erro ao converter orçamento');
    } finally {
      setIsConverting(false);
    }
  };

  const handleEditQuote = (quote) => {
    setEditingTransaction(quote);
    setIsModalOpen(true);
  };

  const handleDeleteQuote = async (quoteId) => {
    if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
      try {
        await api.deleteTransaction(quoteId);
        alert('Orçamento excluído com sucesso!');
        fetchData();
      } catch (err) {
        alert('Erro ao excluir orçamento');
      }
    }
  };

  const handleCancelSale = async (saleId) => {
    if (window.confirm('Deseja realmente cancelar esta venda?')) {
      try {
        await api.cancelSale(saleId);
        alert('Venda cancelada com sucesso.');
        fetchData();
      } catch (err) {
        alert('Erro ao cancelar a venda.');
      }
    }
  };

  const TabButton = ({ label, isActive, onClick, count }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-lg font-semibold border-b-4 transition-colors duration-200 ${
        isActive
          ? 'border-primary-700'
          : 'border-transparent  hover:border-primary-200'
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
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 ${className}`}
    >
      {children}
    </button>
  );

  // --------- listas com ordenação ---------
  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [sales]
  );

  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [quotes]
  );

  // --------- filtros de vendas (por período) ----------
  const filteredSales = useMemo(() => {
    return sortedSales.filter((s) => {
      const d = new Date(s.createdAt);
      const okFrom = !salesDateFrom || d >= new Date(`${salesDateFrom}T00:00:00`);
      const okTo = !salesDateTo || d <= new Date(`${salesDateTo}T23:59:59`);
      return okFrom && okTo;
    });
  }, [sortedSales, salesDateFrom, salesDateTo]);

  // --------- filtros de orçamentos ----------
  const filteredQuotes = useMemo(() => {
    const term = quoteSearch.trim().toLowerCase();
    return sortedQuotes.filter((q) => {
      const okText =
        !term ||
        (q.customerName || '').toLowerCase().includes(term) ||
        (q.id || '').toLowerCase().includes(term);

      const d = new Date(q.createdAt);
      const okFrom = !quoteDateFrom || d >= new Date(`${quoteDateFrom}T00:00:00`);
      const okTo = !quoteDateTo || d <= new Date(`${quoteDateTo}T23:59:59`);

      return okText && okFrom && okTo;
    });
  }, [sortedQuotes, quoteSearch, quoteDateFrom, quoteDateTo]);

  // --------- tabelas ----------
  const renderSalesTable = () => (
    <>
      {/* Filtro por data - VENDAS */}
      <Card className="!p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-sm block mb-1">Data inicial</label>
            <input
              type="date"
              value={salesDateFrom}
              onChange={(e) => setSalesDateFrom(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Data final</label>
            <input
              type="date"
              value={salesDateTo}
              onChange={(e) => setSalesDateTo(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>
          <div className="md:col-span-2 text-sm text-base-400">
            Dica: deixe em branco para ver todas as vendas. O período afeta apenas a aba “Vendas”.
          </div>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs  uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs  uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs  uppercase">Itens</th>
              <th className="px-6 py-3 text-left text-xs  uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs  uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-base-200">
            {filteredSales.length > 0 ? (
              filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className={sale.status === 'CANCELLED' ? 'opacity-50 line-through' : ''}
                >
                  <td className="px-6 py-4 text-sm ">{formatDate(sale.createdAt)}</td>
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
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-12">
                  Nenhuma venda encontrada para o período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderQuotesTable = () => (
    <>
      {/* Filtros rápidos - ORÇAMENTOS */}
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
            <input
              type="date"
              value={quoteDateFrom}
              onChange={(e) => setQuoteDateFrom(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Data final</label>
            <input
              type="date"
              value={quoteDateTo}
              onChange={(e) => setQuoteDateTo(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xsuppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-base-200">
            {filteredQuotes.length > 0 ? (
              filteredQuotes.map(quote => (
                <tr key={quote.id}>
                  <td className="px-6 py-4 text-sm ">{formatDate(quote.createdAt)}</td>
                  <td className="px-6 py-4 text-sm text-base-400">{quote.customerName || 'Consumidor Final'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(quote.total)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <PrimaryButton className="!py-1 !px-2 text-sm" onClick={() => {
                        setQuoteToConvert(quote);
                        setPaymentDetails({ paymentMethod: 'PIX', installments: 1 });
                        setBoletoDates(['']);
                      }}>
                        <CheckCircleIcon className="w-4 h-4" /> Converter
                      </PrimaryButton>
                      <PrimaryButton className="!py-1 !px-2" onClick={() => onNavigateToReceipt(quote.id)}>
                        Ver Orçamento
                      </PrimaryButton>
                      <button onClick={() => handleEditQuote(quote)} className=" hover:text-primary-800 p-1 rounded" title="Editar Orçamento">
                        <EditIcon />
                      </button>
                      <button onClick={() => handleDeleteQuote(quote.id)} className="text-danger hover:brightness-90 p-1 rounded" title="Excluir Orçamento">
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" className="text-center py-12 ">Nenhum orçamento encontrado.</td></tr>
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

  // Atualiza a quantidade de campos de boleto ao mudar installments
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Vendas e Orçamentos</h1>
        <PrimaryButton onClick={handleOpenModal}>
          <PlusIcon />
          Nova Venda / Orçamento
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
        {/* ÁREA IMPRIMÍVEL DO FORMULÁRIO */}
        <div className="modal-panel bg-white rounded-xl w-full max-w-lg p-6 relative">
          <SaleForm
              transactionToEdit={editingTransaction}
              onSave={handleSaveSuccess}
              onClose={handleCloseModal}
              isSaving={false}
          />
        </div>

        {/* Ações auxiliares que NÃO devem ir para a impressão */}
        <div className="mt-4 flex justify-end gap-2 print:hidden">
          <PrimaryButton className="!py-1 !px-2" onClick={() => window.print()}>
            Imprimir
          </PrimaryButton>
        </div>
      </ModalWrapper>

      {/* Modal de conversão */}
      {quoteToConvert && (
        <ModalWrapper
          isOpen={true}
          onClose={() => setQuoteToConvert(null)}
          title="Converter Orçamento"
        >
          {/* Se futuramente quiser imprimir esse conteúdo, basta mover o wrapper report-content
              para dentro. Por ora mantemos a conversão como formulário (sem impressão). */}
          <div className="w-full max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto">
            <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
              <p>Confirme os detalhes de pagamento para converter este orçamento em uma venda.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm">Forma de pagamento</label>
                  <select
                    value={paymentDetails.paymentMethod}
                    onChange={(e) =>
                      setPaymentDetails((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                        installments: 1
                      }))
                    }
                    className="w-full p-2 border rounded"
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="BOLETO">Boleto</option>
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
                        installments: parseInt(e.target.value) || 1
                      }))
                    }
                    disabled={
                      paymentDetails.paymentMethod !== 'CARTAO_CREDITO' &&
                      paymentDetails.paymentMethod !== 'BOLETO'
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              {paymentDetails.paymentMethod === 'BOLETO' && (
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
                    Informe o <strong>vencimento</strong> de cada parcela. Os valores serão distribuídos automaticamente.
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
                    <p className="font-medium">Distribuição do total por parcela (estimativa):</p>
                    <ul className="list-disc pl-5">
                      {splitAmountsBRL(quoteToConvert?.total || 0, Math.max(1, Number(paymentDetails.installments) || 1)).map((v, i) => (
                        <li key={i}>Parcela #{i + 1}: {formatCurrency(v)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <PrimaryButton
                onClick={() => handleConvertToSale(quoteToConvert.id, paymentDetails)}
                disabled={isConverting}
              >
                {isConverting ? 'Convertendo...' : 'Confirmar Conversão'}
              </PrimaryButton>
            </div>
          </div>
        </ModalWrapper>
      )}
    </>
  );
};

export default SalesPage;
