//frontend/src/pages/FinancialPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, TrashIcon, CheckCircleIcon, DollarSignIcon } from '../components/icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (dateString) => dateString ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(dateString)) : '-';

const PAYMENT_METHODS = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto'
};

const StatCard = ({ title, value, className }) => (
  <Card className={`text-center p-4 ${className}`}>
    <h3 className="text-base font-semibold text-base-300">{title}</h3>
    <p className="text-3xl font-bold text-base-400 mt-2">{value}</p>
  </Card>
);

const ExpenseForm = ({ onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    dueDate: '',
    paymentMethod: 'BOLETO'
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
      onSave({
        ...formData,
        type: 'DESPESA'
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="description" name="description" label="Descrição da Despesa" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} required />
      {errors.description && <p className="text-danger text-sm">{errors.description}</p>}

      <Input id="amount" name="amount" label="Valor (R$)" type="number" step="0.01" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required />
      {errors.amount && <p className="text-danger text-sm">{errors.amount}</p>}

      <Input id="dueDate" name="dueDate" label="Data de Vencimento" type="date" value={formData.dueDate} onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))} required />
      {errors.dueDate && <p className="text-danger text-sm">{errors.dueDate}</p>}

      <div>
        <label htmlFor="paymentMethod" className="block text-sm font-medium text-base-300 mb-1">Forma de Pagamento (Prevista)</label>
        <select id="paymentMethod" value={formData.paymentMethod} onChange={e => setFormData(p => ({ ...p, paymentMethod: e.target.value }))} className="w-full bg-white border border-base-200 rounded-md shadow-sm p-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-base-400">
          {Object.entries(PAYMENT_METHODS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Despesa'}</Button>
      </div>
    </form>
  );
};

const FinancialPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [manualEntries, sales] = await Promise.all([
        api.getFinancialEntries(),
        api.getSales()
      ]);

      const salesMapped = sales.map(s => ({
        id: `venda-${s.id}`,
        description: `Venda para ${s.customerName}`,
        amount: s.total,
        dueDate: s.createdAt,
        paymentMethod: 'PIX',
        createdAt: s.createdAt,
        type: 'RECEITA',
        status: 'PAGO'
      }));

      setEntries([...manualEntries, ...salesMapped]);
    } catch (e) {
      setError('Falha ao carregar os lançamentos financeiros.');
      console.error(e);
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

  const renderTable = (type) => {
    const data = entries.filter(e => e.type === type);
    const statusStyles = {
      PAGO: 'bg-primary-100 text-primary-800',
      PENDENTE: 'bg-yellow-100 text-yellow-800',
      VENCIDO: 'bg-red-100 text-red-800'
    };

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map(entry => (
              <tr key={entry.id}>
                <td>{entry.description}</td>
                <td>{formatDate(entry.dueDate)}</td>
                <td>{formatCurrency(entry.amount)}</td>
                <td><span className={`px-2 py-1 rounded ${statusStyles[entry.status]}`}>{entry.status}</span></td>
                <td>
                  <div className="flex gap-2 items-center">
                    {entry.status !== 'PAGO' && !entry.id.startsWith('venda-') && (
                      <Button onClick={() => handleMarkAsPaid(entry.id)}><DollarSignIcon className="w-4 h-4" /> Pagar</Button>
                    )}
                    {type === 'DESPESA' && entry.status !== 'PAGO' && !entry.id.startsWith('venda-') && (
                      <button onClick={() => handleDeleteExpense(entry.id)} className="text-danger"><TrashIcon /></button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="text-center py-12 text-base-300">Nenhum lançamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
    if (error) return <div className="text-center text-danger p-12">{error}</div>;

    switch (activeTab) {
      case 'overview':
        const totalReceivable = entries.filter(e => e.type === 'RECEITA' && e.status !== 'PAGO').reduce((acc, e) => acc + e.amount, 0);
        const totalPayable = entries.filter(e => e.type === 'DESPESA' && e.status !== 'PAGO').reduce((acc, e) => acc + e.amount, 0);
        const balance = entries.filter(e => e.type === 'RECEITA' && e.status === 'PAGO').reduce((acc, e) => acc + e.amount, 0)
          - entries.filter(e => e.type === 'DESPESA' && e.status === 'PAGO').reduce((acc, e) => acc + e.amount, 0);
        //const overduePayableCount = entries.filter(e => e.type === 'DESPESA' && e.status === 'VENCIDO').length;
        const now = new Date();

        const overduePayableCount = entries.filter(e =>
          e.type === 'DESPESA' &&
          e.status !== 'PAGO' &&
          new Date(e.dueDate) < now
        ).length;


        const overdueReceivableCount = entries.filter(e => e.type === 'RECEITA' && e.status === 'VENCIDO').length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Saldo Atual (Realizado)" value={formatCurrency(balance)} className={balance >= 0 ? 'bg-primary-50' : 'bg-red-50'} />
            <StatCard title="Total a Receber" value={formatCurrency(totalReceivable)} />
            <StatCard title="Total a Pagar" value={formatCurrency(totalPayable)} />
            <Card className="text-center p-4 bg-danger/10">
              <h3 className="text-base font-semibold text-danger">Contas Vencidas</h3>
              <p className="text-2xl font-bold text-danger mt-2">{overduePayableCount + overdueReceivableCount}</p>
              <p className="text-sm text-red-700">{overduePayableCount} a pagar, {overdueReceivableCount} a receber</p>
            </Card>
          </div>
        );
      case 'receivable':
        return <Card>{renderTable('RECEITA')}</Card>;
      case 'payable':
        return (
          <div className="space-y-6">
            <div className="text-right">
              <Button onClick={() => setIsModalOpen(true)}><PlusIcon /> Nova Despesa</Button>
            </div>
            <Card>{renderTable('DESPESA')}</Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold text-base-400 mb-6">Controle Financeiro</h1>
      <div className="mb-6 border-b border-base-200">
        <nav className="flex gap-4">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-lg font-semibold border-b-4 ${activeTab === 'overview' ? 'border-primary-600 text-primary-700' : 'border-transparent text-base-300'}`}>Visão Geral</button>
          <button onClick={() => setActiveTab('receivable')} className={`px-4 py-2 text-lg font-semibold border-b-4 ${activeTab === 'receivable' ? 'border-primary-600 text-primary-700' : 'border-transparent text-base-300'}`}>Contas a Receber</button>
          <button onClick={() => setActiveTab('payable')} className={`px-4 py-2 text-lg font-semibold border-b-4 ${activeTab === 'payable' ? 'border-primary-600 text-primary-700' : 'border-transparent text-base-300'}`}>Contas a Pagar</button>
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
