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

const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  if (!/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (dateString) =>
  dateString
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parseISOWithTZ(dateString))
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

const METHOD_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  BOLETO: 'Boleto',
};

const STATUS_OPTIONS = ['PENDENTE', 'VENCIDO', 'PAGO'];

// Normaliza status com base em dueDate quando não vier do backend
function inferStatus(rawStatus, dueDate) {
  if (rawStatus === 'PAGO') return 'PAGO';
  if (!dueDate) return rawStatus || 'PENDENTE';
  const d = parseISOWithTZ(dueDate);
  const now = new Date(`${todayISO()}T23:59:59`);
  if (rawStatus && rawStatus !== 'PENDENTE') return rawStatus;
  return d < now ? 'VENCIDO' : 'PENDENTE';
}

/** -------------------- FORMS DE CRIAÇÃO -------------------- */
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

const ReceivableForm = ({ onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    dueDate: '',
    paymentMethod: 'PIX',
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
      onSave({ ...formData, type: 'RECEITA' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="description_r" label="Descrição da Receita" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} required />
      {errors.description && <p className="text-danger text-sm">{errors.description}</p>}

      <Input id="amount_r" label="Valor (R$)" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required />
      {errors.amount && <p className="text-danger text-sm">{errors.amount}</p>}

      <Input id="dueDate_r" label="Data de Vencimento" type="date" value={formData.dueDate} onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))} required />
      {errors.dueDate && <p className="text-danger text-sm">{errors.dueDate}</p>}

      <div>
        <label htmlFor="paymentMethod_r" className="block text-sm font-medium mb-1">Forma de Pagamento</label>
        <select
          id="paymentMethod_r"
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
        <PrimaryButton type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Receita'}</PrimaryButton>
      </div>
    </form>
  );
};

/** -------------------- MAPEA SALES → RECEITAS -------------------- */
function mapSalesToReceivables(sales) {
  const receivables = [];
  sales.forEach((s) => {
    const baseDesc = `Venda ${String(s.id).slice(0, 8)} — ${s.customerName || 'Consumidor Final'}`;
    const fallbackMethod = s.paymentMethod || 'PIX';

    if (Array.isArray(s.payments) && s.payments.length > 0) {
      const ordered = [...s.payments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      ordered.forEach((p, idx) => {
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
          __paymentId: p.id || null, // id real da parcela, se existir
        });
      });
    } else {
      // Fallback: uma linha única
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

// Exporta CSV simples (agora respeita o tipo da aba)
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
        String(Number(r.amount || 0).toFixed(2)).replace('.', ','),
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

/** -------------------- MODAL DE EDIÇÃO -------------------- */
const EditEntryModal = ({ isOpen, onClose, entry, onSubmit, isSaving }) => {
  if (!isOpen || !entry) return null;

  const isReceita = entry.type === 'RECEITA';
  const isDespesa = entry.type === 'DESPESA';
  const isManual = entry.__source === 'manual';
  const isSalePayment = entry.__source === 'sale_payment';

  // Estados locais do formulário
  const [description, setDescription] = useState(entry.description || '');
  const [amount, setAmount] = useState(Number(entry.amount || 0));
  const [dueDate, setDueDate] = useState((entry.dueDate || '').slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(entry.paymentMethod || 'PIX');
  const [status, setStatus] = useState(inferStatus(entry.status, entry.dueDate));

  // Regras:
  // - DESPESA manual: pode editar tudo + status
  // - RECEITA manual: pode editar campos + status
  // - RECEITA sale_payment: permitir somente status (UI deixa claro)
  const canEditFields =
    (isDespesa && isManual) ||
    (isReceita && isManual);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      description,
      amount,
      dueDate,
      paymentMethod,
      status,
      type: entry.type,
    };
    onSubmit(payload);
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={`Editar ${isReceita ? 'Receita' : 'Despesa'}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {canEditFields ? (
          <>
            <Input id="edit_desc" label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input id="edit_amount" label="Valor (R$)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            <Input id="edit_due" label="Data de Vencimento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <div>
              <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-white border border-base-200 rounded-md shadow-sm p-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-base-400"
              >
                {['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'].map(m => (
                  <option key={m} value={m}>{METHOD_LABEL[m] || m}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="p-3 rounded bg-base-100 text-sm">
            {isSalePayment ? (
              <p>
                Esta é uma <strong>parcela de venda</strong>. Aqui você pode alterar o <strong>status</strong>. Para marcar como pago, use a ação de <em>Receber</em> ou selecione <strong>PAGO</strong> abaixo.
              </p>
            ) : (
              <p>Altere o <strong>status</strong> desta receita.</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-white border border-base-200 rounded-md shadow-sm p-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-base-400"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <SecondaryButton onClick={onClose} disabled={isSaving}>Cancelar</SecondaryButton>
          <PrimaryButton type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</PrimaryButton>
        </div>
      </form>
    </ModalWrapper>
  );
};

/** -------------------- PÁGINA -------------------- */
const FinancialPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modais
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal de edição
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  // Filtros
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

      const normalizedManual = (manualEntries || []).map((e) => ({
        ...e,
        amount: Number(e.amount || 0),
        __source: 'manual',
      }));

      const salesReceivables = mapSalesToReceivables(sales || []);

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

  const handleReceiveSalePayment = async (paymentId) => {
    try {
      await api.paySalePayment(paymentId);
      fetchData();
    } catch (e) {
      alert(`Falha ao receber parcela da venda: ${e?.response?.data?.error || e.message}`);
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
      setIsExpenseModalOpen(false);
      fetchData();
    } catch (e) {
      alert(`Falha ao salvar despesa: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReceivable = async (data) => {
    setIsSaving(true);
    try {
      await api.addFinancialEntry(data);
      setIsReceivableModalOpen(false);
      fetchData();
    } catch (e) {
      alert(`Falha ao salvar receita: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  /** --------- EDIÇÃO --------- */
  const openEdit = (entry) => {
    setEditEntry(entry);
    setIsEditOpen(true);
  };

  const saveEdit = async (payload) => {
    if (!editEntry) return;
    setIsSaving(true);
    try {
      // DESPESAS/RECEITAS manuais → updateFinancialEntry
      if (editEntry.__source === 'manual') {
        await api.updateFinancialEntry(editEntry.id, {
          description: payload.description,
          amount: payload.amount,
          dueDate: payload.dueDate,
          paymentMethod: payload.paymentMethod,
          status: payload.status,
          type: editEntry.type,
        });
      } else if (editEntry.__source === 'sale_payment' && editEntry.__paymentId) {
        // RECEITAS de venda (parcela)
        if (payload.status === 'PAGO') {
          // Reutiliza a rota existente de recebimento
          await api.paySalePayment(editEntry.__paymentId);
        } else {
          // Atualiza status da parcela (novo endpoint)
          await api.updateSalePaymentStatus(editEntry.__paymentId, { status: payload.status });
        }
      } else {
        // Outros casos (ex.: sale_total) – nada a editar
        alert('Este lançamento não suporta edição.');
      }

      setIsEditOpen(false);
      setEditEntry(null);
      fetchData();
    } catch (e) {
      alert(`Falha ao salvar edição: ${e?.response?.data?.error || e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const statusBadgeClass = (st) => {
    const status = st || 'PENDENTE';
    const map = {
      PAGO: 'bg-primary-100 text-primary-800',
      PENDENTE: 'bg-yellow-100 text-yellow-800',
      VENCIDO: 'bg-red-100 text-red-800',
    };
    return `px-2 py-1 rounded ${map[status] || map.PENDENTE}`;
  };

  const filterData = useCallback(
    (type) => {
      const term = search.trim().toLowerCase();
      return entries.filter((e) => {
        if (e.type !== type) return false;

        const okText = !term || (e.description || '').toLowerCase().includes(term);

        const d = new Date(e.dueDate || e.createdAt);
        const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
        const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);

        const st = inferStatus(e.status, e.dueDate);
        const okStatus = statusFilter === 'ALL' || st === statusFilter;

        const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;

        return okText && okFrom && okTo && okStatus && okMethod;
      });
    },
    [entries, search, dateFrom, dateTo, statusFilter, methodFilter]
  );

  // OVERVIEW
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

    const exportAllFiltered = () => {
      // Exporta tudo que passar nos filtros atuais (receita + despesa)
      const term = search.trim().toLowerCase();
      const allVisible = entries.filter((e) => {
        const okText = !term || (e.description || '').toLowerCase().includes(term);
        const d = new Date(e.dueDate || e.createdAt);
        const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
        const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);
        const st = inferStatus(e.status, e.dueDate);
        const okStatus = statusFilter === 'ALL' || st === statusFilter;
        const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;
        return okText && okFrom && okTo && okStatus && okMethod;
      });
      exportCSV(allVisible, 'financeiro_geral.csv');
    };

    return (
      <>
        <div className="mb-4 flex flex-wrap gap-2 justify-end">
          <SecondaryButton onClick={() => setIsReceivableModalOpen(true)}><PlusIcon /> Nova Receita</SecondaryButton>
          <SecondaryButton onClick={() => setIsExpenseModalOpen(true)}><PlusIcon /> Nova Despesa</SecondaryButton>
          <PrimaryButton onClick={exportAllFiltered}>Exportar CSV</PrimaryButton>
        </div>

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
      </>
    );
  };

  // Tabela
  const Table = ({ data, type }) => (
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

              const isManual = entry.__source === 'manual';
              const isSalePayment = entry.__source === 'sale_payment';
              const hasRealPaymentId = Boolean(entry.__paymentId); // veio do backend

              // Receber:
              // - manual (usa /financial/<id>/pay) OU
              // - parcela de venda com id real (usa /sales/payments/<paymentId>/pay)
              const canReceiveManual = entry.type === 'RECEITA' && status !== 'PAGO' && isManual;
              const canReceiveSale = entry.type === 'RECEITA' && status !== 'PAGO' && isSalePayment && hasRealPaymentId;

              const canPay = entry.type === 'DESPESA' && status !== 'PAGO' && isManual;
              const canDelete = entry.type === 'DESPESA' && status !== 'PAGO' && isManual;

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
                      {/* Receber / Pagar ações rápidas */}
                      {canReceiveManual && (
                        <PrimaryButton onClick={() => handleMarkAsPaid(entry.id)}>
                          <DollarSignIcon className="w-4 h-4" /> Receber
                        </PrimaryButton>
                      )}
                      {canReceiveSale && (
                        <PrimaryButton onClick={() => handleReceiveSalePayment(entry.__paymentId)}>
                          <DollarSignIcon className="w-4 h-4" /> Receber
                        </PrimaryButton>
                      )}
                      {canPay && (
                        <PrimaryButton onClick={() => handleMarkAsPaid(entry.id)}>
                          Pagar
                        </PrimaryButton>
                      )}

                      {/* EDITAR */}
                      {entry.type === 'DESPESA' && isManual && (
                        <SecondaryButton onClick={() => openEdit(entry)}>
                          Editar
                        </SecondaryButton>
                      )}
                      {entry.type === 'RECEITA' && (
                        <SecondaryButton onClick={() => openEdit(entry)}>
                          Editar
                        </SecondaryButton>
                      )}

                      {/* Excluir (somente despesa manual e não paga) */}
                      {canDelete && (
                        <button onClick={() => handleDeleteExpense(entry.id)} className="bg-red-600" title="Excluir">
                          Excluir
                        </button>
                      )}

                      {/* Aviso quando for parcela sem id */}
                      {entry.type === 'RECEITA' && isSalePayment && !hasRealPaymentId && status !== 'PAGO' && (
                        <span
                          className="text-xs text-base-300"
                          title="Esta parcela não possui ID no backend; gere novamente a venda ou atualize o backend para persistir IDs das parcelas."
                        >
                          (parcela sem ID no backend)
                        </span>
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

  // Filtros
  const FiltersBar = ({ currentType }) => {
    const filteredCount = useMemo(() => {
      const term = search.trim().toLowerCase();
      return entries.filter((e) => {
        if (currentType && e.type !== currentType) return false;
        const okText = !term || (e.description || '').toLowerCase().includes(term);
        const d = new Date(e.dueDate || e.createdAt);
        const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
        const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);
        const st = inferStatus(e.status, e.dueDate);
        const okStatus = statusFilter === 'ALL' || st === statusFilter;
        const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;
        return okText && okFrom && okTo && okStatus && okMethod;
      }).length;
    }, [entries, search, dateFrom, dateTo, statusFilter, methodFilter, currentType]);

    const filteredSum = useMemo(() => {
      const term = search.trim().toLowerCase();
      return entries.reduce((sum, e) => {
        if (currentType && e.type !== currentType) return sum;
        const okText = !term || (e.description || '').toLowerCase().includes(term);
        const d = new Date(e.dueDate || e.createdAt);
        const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
        const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);
        const st = inferStatus(e.status, e.dueDate);
        const okStatus = statusFilter === 'ALL' || st === statusFilter;
        const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;
        return okText && okFrom && okTo && okStatus && okMethod ? sum + Number(e.amount || 0) : sum;
      }, 0);
    }, [entries, search, dateFrom, dateTo, statusFilter, methodFilter, currentType]);

    const doExport = () => {
      const term = search.trim().toLowerCase();
      const rows = entries.filter((e) => {
        if (currentType && e.type !== currentType) return false;
        const okText = !term || (e.description || '').toLowerCase().includes(term);
        const d = new Date(e.dueDate || e.createdAt);
        const okFrom = !dateFrom || d >= new Date(`${dateFrom}T00:00:00`);
        const okTo = !dateTo || d <= new Date(`${dateTo}T23:59:59`);
        const st = inferStatus(e.status, e.dueDate);
        const okStatus = statusFilter === 'ALL' || st === statusFilter;
        const okMethod = methodFilter === 'ALL' || (e.paymentMethod || 'OUTRO') === methodFilter;
        return okText && okFrom && okTo && okStatus && okMethod;
      });
      exportCSV(rows, currentType === 'RECEITA' ? 'receitas.csv' : currentType === 'DESPESA' ? 'despesas.csv' : 'lancamentos.csv');
    };

    return (
      <Card className="!p-4 mb-4 ">
        <div className=" grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
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
            <TinyStat label="Qtd. filtrada" value={filteredCount} />
            <TinyStat label="Soma filtrada" value={formatCurrency(filteredSum)} />
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('ALL'); setMethodFilter('ALL'); }}>
              Limpar Filtros
            </SecondaryButton>
            <PrimaryButton onClick={doExport}>Exportar CSV</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  };

  const renderReceivable = () => {
    const data = filterData('RECEITA');
    return (
      <div className="space-y-4">
        <div className="block justify-between items-center">
          <FiltersBar currentType="RECEITA" />
        </div>
        <div className="text-right -mt-2">
          <PrimaryButton onClick={() => setIsReceivableModalOpen(true)}><PlusIcon /> Nova Receita</PrimaryButton>
        </div>
        <Card><Table data={data} type="RECEITA" /></Card>
      </div>
    );
  };

  const renderPayable = () => {
    const data = filterData('DESPESA');
    return (
      <div className="space-y-6">
        <div className="block justify-between">
          <FiltersBar currentType="DESPESA" />
          <div className="hidden" />
        </div>
        <div className="text-right -mt-2">
          <PrimaryButton onClick={() => setIsExpenseModalOpen(true)}><PlusIcon /> Nova Despesa</PrimaryButton>
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

      {/* Modal: Nova Despesa */}
      <ModalWrapper isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Adicionar Nova Despesa">
        <ExpenseForm onSave={handleSaveExpense} onClose={() => setIsExpenseModalOpen(false)} isSaving={isSaving} />
      </ModalWrapper>

      {/* Modal: Nova Receita */}
      <ModalWrapper isOpen={isReceivableModalOpen} onClose={() => setIsReceivableModalOpen(false)} title="Adicionar Nova Receita">
        <ReceivableForm onSave={handleSaveReceivable} onClose={() => setIsReceivableModalOpen(false)} isSaving={isSaving} />
      </ModalWrapper>

      {/* Modal: Editar Lançamento */}
      <EditEntryModal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditEntry(null); }}
        entry={editEntry}
        onSubmit={saveEdit}
        isSaving={isSaving}
      />
    </>
  );
};

export default FinancialPage;
