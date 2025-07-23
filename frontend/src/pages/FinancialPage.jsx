import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, TrashIcon, CheckCircleIcon } from '../components/icons';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(dateString));

const FinancialForm = ({ onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    type: 'RECEITA',
    amount: '',
    dueDate: '',
    description: ''
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.dueDate || !formData.description) return;
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select
        name="type"
        value={formData.type}
        onChange={handleChange}
        className="w-full p-2 border border-base-200 rounded"
      >
        <option value="RECEITA">Receita</option>
        <option value="DESPESA">Despesa</option>
      </select>

      <Input name="amount" label="Valor (R$)" type="number" step="0.01" value={formData.amount} onChange={handleChange} required />
      <Input name="dueDate" label="Data de Vencimento" type="date" value={formData.dueDate} onChange={handleChange} required />
      <Input name="description" label="Descrição" value={formData.description} onChange={handleChange} required />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

const FinancialPage = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const data = await api.getFinancialEntries();
      setEntries(data);
    } catch (err) {
      setError('Erro ao carregar lançamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleMarkAsPaid = async (id) => {
    try {
      await api.markFinancialEntryAsPaid(id);
      await fetchEntries();
    } catch {
      alert('Erro ao marcar como pago.');
    }
  };

  const handleDeleteEntry = async (id) => {
    if (window.confirm('Deseja realmente excluir este lançamento?')) {
      try {
        await api.deleteFinancialEntry(id);
        await fetchEntries();
      } catch {
        alert('Erro ao excluir lançamento.');
      }
    }
  };

  const handleSaveEntry = async (data) => {
    setIsSaving(true);
    try {
      await api.addFinancialEntry(data);
      setIsModalOpen(false);
      await fetchEntries();
    } catch {
      alert('Erro ao salvar lançamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedEntries = useMemo(() => {
    return entries.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [entries]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Lançamentos Financeiros</h1>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <PlusIcon />
          Novo Lançamento
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : error ? (
          <div className="text-center text-danger p-12">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs text-base-300 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs text-base-300 uppercase">Valor</th>
                  <th className="px-6 py-3 text-left text-xs text-base-300 uppercase">Vencimento</th>
                  <th className="px-6 py-3 text-left text-xs text-base-300 uppercase">Descrição</th>
                  <th className="px-6 py-3 text-left text-xs text-base-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs text-base-300 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200">
                {sortedEntries.length > 0 ? sortedEntries.map(entry => (
                  <tr key={entry.id} className={entry.status === 'VENCIDO' ? 'bg-warning/10' : ''}>
                    <td className="px-6 py-4 text-sm font-medium text-base-400">
                      {entry.type === 'RECEITA' ? 'Receita' : 'Despesa'}
                    </td>
                    <td className="px-6 py-4 text-sm text-base-300">{formatCurrency(entry.amount)}</td>
                    <td className="px-6 py-4 text-sm text-base-300">{formatDate(entry.dueDate)}</td>
                    <td className="px-6 py-4 text-sm text-base-300">{entry.description}</td>
                    <td className="px-6 py-4 text-sm text-base-300">{entry.status}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2 items-center">
                        {entry.status !== 'PAGO' && (
                          <button onClick={() => handleMarkAsPaid(entry.id)} className="text-success hover:text-green-800" title="Marcar como pago">
                            <CheckCircleIcon />
                          </button>
                        )}
                        <button onClick={() => handleDeleteEntry(entry.id)} className="text-danger hover:text-red-700" title="Excluir">
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-base-300">Nenhum lançamento cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalWrapper
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Lançamento Financeiro"
      >
        <FinancialForm
          onSave={handleSaveEntry}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSaving}
        />
      </ModalWrapper>
    </>
  );
};

export default FinancialPage;
