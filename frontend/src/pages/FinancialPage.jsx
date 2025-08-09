// frontend/src/pages/FinancialPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/api';
import { Card, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, TrashIcon, DollarSignIcon } from '../components/icons';

// Botões dinâmicos
const PrimaryButton = ({ children, onClick, type = 'button', className = '', ...props }) => (
  <button
    type={type}
    onClick={onClick}
    className={`px-4 py-2 rounded text-white flex items-center gap-2 ${className}`}
    style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
    {...props}
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, type = 'button', className = '', ...props }) => (
  <button
    type={type}
    onClick={onClick}
    className={`px-4 py-2 rounded text-white bg-base-400 hover:brightness-110 flex items-center gap-2 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (dateString) =>
  dateString
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(dateString))
    : '-';

const todayISO = () => new Date().toISOString().slice(0, 10);

const StatCard = ({ title, value, className }) => (
  <Card className={`text-center p-4 ${className}`}>
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="text-3xl font-bold text-base-400 mt-2">{value}</p>
  </Card>
);

const TinyStat = ({ label, value }) => (
  <div className="px-3 py-2 rounded-lg bg-base-100 border border-base-200 text-sm">
    <div className="text-base-300">{label}</div>
    <div className="font-semibold">{value}</div>
  </div>
);

const ExpenseForm = ({ onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    dueDate: '',
    paymentMethod: 'BOLETO',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.description.trim()) newErrors.description = 'Descrição é obrigatória.';
    if (formData.amount <= 0) newErrors.amount = 'Valor deve ser positivo.';
    if (!formData.dueDate) newErrors.dueDate = 'Data de vencimento é obrigatória.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave({ ...formData, type: 'DESPESA' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="description" label="Descrição da Despesa" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} required />
      {errors.description && <p className="text-danger text-sm">{errors.description}</p>}

      <Input id="amount" label="Valor (R$)" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required />
      {errors.amount && <p className="text-danger text-sm">{errors.amount}</p>}

      <Input id="dueDate" label="Data de Vencimento" type="date" value={formData.dueDate} onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))} required />
      {errors.dueDate && <p className="text-danger text-sm">{errors.dueDate}</p>}

      <div>
        <label htmlFor="paymentMethod" className="block text-sm font-medium mb-1">Forma de Pagamento</label>
        <select
          id="paymentMethod"
          value={formData.paymentMethod}
          onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value }))}
          className="w-full bg-white border border-base-200 rounded-md shadow-sm p-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-base-400"
        >
          {['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'].map((method) => (
            <option key={method} value={method}>
              {method.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <SecondaryButton onClick={onClose} disabled={isSaving}>Cancelar</SecondaryButton>
        <PrimaryButton type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Despesa'}</PrimaryButton>
      </div>
    </form>
  );
};

const METHOD_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  BOLETO: 'Boleto',
};

// Normaliza status com base em dueDate quando não vier do backend
function inferStatus(rawStatus, dueDate) {
  if (rawStatus === 'PAGO') return 'PAGO';
  if (!dueDate) return rawStatus || 'PENDENTE';
  const d = new Date(dueDate);
  const now = new Date(`${todayISO()}T23:59:59`);
  if (rawStatus && rawStatus !== 'PENDENTE') return rawStatus;
  return d < now ? 'VENCIDO' : 'PENDENTE';
}

// Gera lançamentos de RECEITA a partir de vendas e suas parcelas (se existirem)
function mapSalesToReceivables(sales) {
  const receivables = [];
  sales.forEach((s) => {
    const baseDesc = `Venda ${String(s.id).slice(0, 8)} — ${s.customerName || 'Consumidor Final'}`;
    const fallbackMethod = s.paymentMethod || 'PIX';

    if (Array.isArray(s.payments) && s.payments.length > 0) {
      s.payments.forEach((p, idx) => {
        receivables.push({
          id: p.id || `sale-${s.id}-p${idx + 1}`,
          description: `${baseDesc} (Parcela ${idx + 1})`,
          amount: Number(p.amount || 0),
          dueDate: p.dueDate || s.createdAt,
          createdAt: s.createdAt,
          paymentMethod: p.paymentMethod || fallbackMethod,
          type: 'RECEITA',
          status: inferStatus(p.status, p.dueDate),
          __source: 'sale_payment',
          __saleId: s.id,
          __installment: idx + 1,
        });
      });
    } else {
      // Fallback: uma linha única, considerada paga (mantém comportamento anterior)
      receivables.push({
        id: `venda-${s.id}`,
        description: `Venda para ${s.customerName || 'Consumidor Final'}`,
        amount: Number(s.total || 0),
        dueDate: s.createdAt,
        createdAt: s.createdAt,
        paymentMethod: fallbackMethod,
        type: 'RECEITA',
        status: 'PAGO',
        __source: 'sale_total',
        __saleId: s.id,
      });
    }
  });
  return receivables;
}

// Exporta CSV simples (UTF-8, separador vírgula)
function exportCSV(rows, filename = 'lancamentos.csv') {
  const headers = ['Tipo', 'Descrição', 'Vencimento', 'Valor', 'Status', 'Forma', 'Origem', 'Referência'];
  const lines = [
    headers.join(','),
    ...rows.map((r) => {
      const origem = r.__source === 'sale_payment' ? 'Venda (parcela)' : r.__source === 'sale_total' ? 'Venda' : 'Manual';
      const ref = r.__saleId ? `Venda ${String(r.__saleId).slice(0, 8)}${r.__installment ? ` - Parc.${r.__installment}` : ''}` : '';
      const cells = [
        r.type,
        (r.description || '').replace(/,/g, ' '),
        formatDate(r.dueDate),
        String(Number(r.amount || 0).toFixed(2)).replace('.', ','), // pt-BR friendly
        r.status || '',
        METHOD_LABEL[r.paymentMethod] || r.paymentMethod || '',
        origem,
        ref.replace(/,/g, ' ')
      ];
      return cells.join(',');
    }),
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FinancialPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros (aplicados por aba de lista)
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [manualEntries, sales] = await Promise.all([
        api.getFinancialEntries(),
        api.getSales(),
      ]);

      // Manual já vem com id, type, status etc.
      const normalizedManual = (manualEntries || []).map((e) => ({
        ...e,
        amount: Number(e.amount || 0),
        __source: 'manual',
      }));

      // Receitas de vendas (parcelas separadas quando existirem)
      const salesReceivables = mapSalesToReceivables(sales || []);

      // Junta e ordena por vencimento desc
      const all = [...normalizedManual, ...salesReceivables].sort((a, b) => {
        const da = new Date(a.dueDate || a.createdAt || 0);
        const db = new Date(b.dueDate || b.createdAt || 0);
        return db - da;
      });

      setEntries(all);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar os lançamentos financeiros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAsPaid = async (id) => {
    try {
      await api.markFinancialEntryAsPaid(id);
      fetchData();
    } catch (e) {
      alert(`Falha ao marcar como pago: ${e}`);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      try {
        await api.deleteFinancialEntry(id);
        fetchData();
      } catch (e) {
        alert(`Falha ao excluir despesa: ${e}`);
      }
    }
  };

  const handleSaveExpense = async (data) => {
    setIsSaving(true);
    try {
      await api.addFinancialEntry(data);
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      alert(`Falha ao salvar despesa: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helpers UI
  const statusBadgeClass = (st) => {
    const status = st || 'PENDENTE';
    const map = {
      PAGO: 'bg-primary-100 text-primary-800',
      PENDENTE: 'bg-yellow-100 text-yellow-800',
      VENCIDO: 'bg-red-100 text-red-800',
    };
    return `px-2 py-1 rounded ${map[status] || map.PENDENTE}`;
  };

  // Filtro comum para tabelas
  const filterData = useCallback(
    (type) => {
      const term = search.trim().toLowerCase();
      return entries.filter((e) => {
        if (e.type !== type) return false;

        // Texto
        const okText = !term || (e.description || '').toLowerCase().includes(term);

        // Período (baseado em dueDate)
        const d = new Date(e.dueDate || e.createdAt);
        const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
        const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);

        // Status (com inferência p/ vencidos quando não pago)
        const st = inferStatus(e.status, e.dueDate);
        const okStatus = statusFilter === 'ALL' || st === statusFilter;

        // Método
        const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;

        return okText && okFrom && okTo && okStatus && okMethod;
      });
    },
    [entries, search, dateFrom, dateTo, statusFilter, methodFilter]
  );

  // --------- OVERVIEW ----------
  const renderOverview = () => {
    const totalReceber = entries
      .filter((e) => e.type === 'RECEITA' && inferStatus(e.status, e.dueDate) !== 'PAGO')
      .reduce((acc, e) => acc + e.amount, 0);

    const totalPagar = entries
      .filter((e) => e.type === 'DESPESA' && inferStatus(e.status, e.dueDate) !== 'PAGO')
      .reduce((acc, e) => acc + e.amount, 0);

    const realizadoReceita = entries
      .filter((e) => e.type === 'RECEITA' && inferStatus(e.status, e.dueDate) === 'PAGO')
      .reduce((acc, e) => acc + e.amount, 0);

    const realizadoDespesa = entries
      .filter((e) => e.type === 'DESPESA' && inferStatus(e.status, e.dueDate) === 'PAGO')
      .reduce((acc, e) => acc + e.amount, 0);

    const saldo = realizadoReceita - realizadoDespesa;

    const vencidasReceber = entries
      .filter((e) => e.type === 'RECEITA' && inferStatus(e.status, e.dueDate) === 'VENCIDO').length;

    const vencidasPagar = entries
      .filter((e) => e.type === 'DESPESA' && inferStatus(e.status, e.dueDate) === 'VENCIDO').length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo Atual (Realizado)" value={formatCurrency(saldo)} className={saldo >= 0 ? 'bg-primary-50' : 'bg-red-50'} />
        <StatCard title="Total a Receber" value={formatCurrency(totalReceber)} />
        <StatCard title="Total a Pagar" value={formatCurrency(totalPagar)} />
        <Card className="text-center p-4 bg-danger/10">
          <h3 className="text-base font-semibold text-danger">Contas Vencidas</h3>
          <p className="text-2xl font-bold text-danger mt-2">{vencidasReceber + vencidasPagar}</p>
          <p className="text-sm text-red-700">{vencidasPagar} a pagar, {vencidasReceber} a receber</p>
        </Card>
      </div>
    );
  };

  // --------- TABELA ----------
  const Table = ({ data, type }) => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead className="bg-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase">Descrição</th>
              <th className="px-4 py-3 text-left text-xs uppercase">Vencimento</th>
              <th className="px-4 py-3 text-left text-xs uppercase">Valor</th>
              <th className="px-4 py-3 text-left text-xs uppercase">Forma</th>
              <th className="px-4 py-3 text-left text-xs uppercase">Origem</th>
              <th className="px-4 py-3 text-left text-xs uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((entry) => {
                const origem = entry.__source === 'sale_payment'
                  ? 'Venda (parcela)'
                  : entry.__source === 'sale_total'
                    ? 'Venda'
                    : 'Manual';
                const status = inferStatus(entry.status, entry.dueDate);
                const canPay = entry.type === 'DESPESA' && status !== 'PAGO' && entry.__source === 'manual';
                const canDelete = entry.type === 'DESPESA' && status !== 'PAGO' && entry.__source === 'manual';
                return (
                  <tr key={entry.id} className="border-b">
                    <td className="px-4 py-2">{entry.description}</td>
                    <td className="px-4 py-2">{formatDate(entry.dueDate)}</td>
                    <td className="px-4 py-2 font-medium">{formatCurrency(entry.amount)}</td>
                    <td className="px-4 py-2">{METHOD_LABEL[entry.paymentMethod] || entry.paymentMethod || '-'}</td>
                    <td className="px-4 py-2">{origem}</td>
                    <td className="px-4 py-2"><span className={statusBadgeClass(status)}>{status}</span></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 items-center">
                        {canPay && (
                          <PrimaryButton onClick={() => handleMarkAsPaid(entry.id)}>
                            <DollarSignIcon className="w-4 h-4" /> Pagar
                          </PrimaryButton>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDeleteExpense(entry.id)} className="text-danger">
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="7" className="text-center py-12">Nenhum lançamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // --------- LISTAS COM FILTROS ----------
  const FiltersBar = ({ onExport }) => (
    <Card className="!p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <Input
            id="search"
            label="Buscar (descrição)"
            placeholder="Ex.: água, aluguel, parcela 2..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm block mb-1">Data inicial</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full" />
        </div>
        <div>
          <label className="text-sm block mb-1">Data final</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full" />
        </div>
        <div>
          <label className="text-sm block mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full">
            <option value="ALL">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="VENCIDO">Vencido</option>
            <option value="PAGO">Pago</option>
          </select>
        </div>
        <div>
          <label className="text-sm block mb-1">Forma</label>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full">
            <option value="ALL">Todas</option>
            <option value="PIX">PIX</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO_CREDITO">Cartão de Crédito</option>
            <option value="CARTAO_DEBITO">Cartão de Débito</option>
            <option value="BOLETO">Boleto</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <TinyStat label="Qtd. filtrada" value={
            entries.filter((e) => {
              // só para exibir contagem rápida sem separar por tipo
              const term = search.trim().toLowerCase();
              const okText = !term || (e.description || '').toLowerCase().includes(term);
              const d = new Date(e.dueDate || e.createdAt);
              const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
              const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);
              const st = inferStatus(e.status, e.dueDate);
              const okStatus = statusFilter === 'ALL' || st === statusFilter;
              const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;
              return okText && okFrom && okTo && okStatus && okMethod;
            }).length
          } />
          <TinyStat label="Soma filtrada" value={
            formatCurrency(entries.reduce((sum, e) => {
              const term = search.trim().toLowerCase();
              const okText = !term || (e.description || '').toLowerCase().includes(term);
              const d = new Date(e.dueDate || e.createdAt);
              const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
              const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);
              const st = inferStatus(e.status, e.dueDate);
              const okStatus = statusFilter === 'ALL' || st === statusFilter;
              const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;
              return okText && okFrom && okTo && okStatus && okMethod ? sum + Number(e.amount || 0) : sum;
            }, 0))
          } />
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('ALL'); setMethodFilter('ALL'); }}>
            Limpar Filtros
          </SecondaryButton>
          <PrimaryButton onClick={onExport}>
            Exportar CSV
          </PrimaryButton>
        </div>
      </div>
    </Card>
  );

  // --------- CONTEÚDO POR ABA ----------
  const renderReceivable = () => {
    const data = filterData('RECEITA');
    return (
      <div className="space-y-4">
        <FiltersBar onExport={() => exportCSV(data, 'receitas.csv')} />
        <Card><Table data={data} type="RECEITA" /></Card>
      </div>
    );
  };

  const renderPayable = () => {
    const data = filterData('DESPESA');
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <FiltersBar onExport={() => exportCSV(data, 'despesas.csv')} />
          <div className="hidden" /> {/* espaçador */}
        </div>
        <div className="text-right -mt-2">
          <PrimaryButton onClick={() => setIsModalOpen(true)}><PlusIcon /> Nova Despesa</PrimaryButton>
        </div>
        <Card><Table data={data} type="DESPESA" /></Card>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
    if (error) return <div className="text-center text-danger p-12">{error}</div>;

    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'receivable':
        return renderReceivable();
      case 'payable':
        return renderPayable();
      default:
        return null;
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold text-base-400 mb-6">Controle Financeiro</h1>
      <div className="mb-6 border-b border-base-200">
        <nav className="flex gap-4">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-lg font-semibold border-b-4 ${activeTab === 'overview' ? 'border-primary-600 ' : 'border-transparent'}`}>Visão Geral</button>
          <button onClick={() => setActiveTab('receivable')} className={`px-4 py-2 text-lg font-semibold border-b-4 ${activeTab === 'receivable' ? 'border-primary-600 ' : 'border-transparent'}`}>Contas a Receber</button>
          <button onClick={() => setActiveTab('payable')} className={`px-4 py-2 text-lg font-semibold border-b-4 ${activeTab === 'payable' ? 'border-primary-600 ' : 'border-transparent'}`}>Contas a Pagar</button>
        </nav>
      </div>

      {renderContent()}

      <ModalWrapper isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Nova Despesa">
        <ExpenseForm onSave={handleSaveExpense} onClose={() => setIsModalOpen(false)} isSaving={isSaving} />
      </ModalWrapper>
    </>
  );
};

export default FinancialPage;
