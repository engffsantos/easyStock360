// frontend/src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, Spinner, ModalWrapper } from '../components/common';
import CustomerDetailsPage from './CustomerDetailsPage';
import CustomerForm from './CustomerForm';
import { PlusIcon, SearchIcon, MessageSquareIcon } from '../components/icons';

const CustomersPage = () => {
  // Dados
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // UI/Busca
  const [searchTerm, setSearchTerm] = useState('');

  // Navegação de tela
  const [view, setView] = useState('list'); // 'list' | 'details'
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Modal de criar/editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ====== Interações ======
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [activeCustomerName, setActiveCustomerName] = useState('');
  const [interactions, setInteractions] = useState([]);
  const [isSavingInteraction, setIsSavingInteraction] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: '', notes: '' });

  // Carrega clientes
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getCustomers();
        setCustomers(Array.isArray(data) ? data : []);
        setError(null);
      } catch (e) {
        console.error('[CustomersPage] load error', e);
        setError('Falha ao carregar clientes.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Busca (REMOVIDO e-mail do filtro, pois não existe no banco)
  const filtered = useMemo(() => {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.cpfCnpj]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [customers, searchTerm]);

  // Ações
  const openDetails = (customer) => {
    setSelectedCustomer(customer);
    setView('details');
  };

  const handleBackFromDetails = () => {
    setView('list');
    setSelectedCustomer(null);
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  // ⚠️ Correção: agora o CustomerForm envia "id" quando editar.
  // Se houver id, chamamos update; senão, add.
  const handleSaveCustomer = async (formData) => {
    try {
      setIsSaving(true);
      if (formData?.id) {
        await api.updateCustomer(formData.id, formData);
      } else {
        await api.addCustomer(formData);
      }
      // Recarrega lista
      const data = await api.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
      // Fecha modal
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (e) {
      console.error('[CustomersPage] save customer error', e);
      const status = e?.response?.status;
      const msg = e?.response?.data?.error;
      if (status === 409) {
        alert(msg || 'Já existe um cliente com este CPF/CNPJ.');
        return;
      }
      alert('Falha ao salvar cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Interações
  const handleViewInteractions = async (customerId) => {
    try {
      const cust = customers.find(c => String(c.id) === String(customerId));
      setActiveCustomerId(customerId);
      setActiveCustomerName(cust?.name || '');
      const data = await api.getInteractionsByCustomerId(customerId);
      setInteractions(Array.isArray(data) ? data : []);
      setInteractionForm({ type: '', notes: '' });
      setShowInteractionModal(true);
    } catch (e) {
      console.error('[CustomersPage] load interactions error', e);
      alert('Falha ao carregar interações do cliente.');
    }
  };

  const handleCreateInteraction = async () => {
    if (!activeCustomerId) return;
    const { type, notes } = interactionForm;
    if (!type || !notes.trim()) {
      return alert('Informe o tipo da interação e a descrição.');
    }
    try {
      setIsSavingInteraction(true);
      await api.addInteraction({
        customerId: activeCustomerId,
        type,
        notes: notes.trim(),
      });
      const data = await api.getInteractionsByCustomerId(activeCustomerId);
      setInteractions(Array.isArray(data) ? data : []);
      setInteractionForm({ type: '', notes: '' });
    } catch (e) {
      console.error('[CustomersPage] add interaction error', e);
      alert('Falha ao registrar a interação.');
    } finally {
      setIsSavingInteraction(false);
    }
  };

  // Render: detalhes
  if (view === 'details' && selectedCustomer) {
    return (
      <CustomerDetailsPage
        customer={selectedCustomer}
        onBack={handleBackFromDetails}
      />
    );
    }

  // Render: lista
  return (
    <div className="space-y-4">
      {/* Header e botão de novo cliente */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <h2 className="text-base-400 text-xl font-semibold">Clientes</h2>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>
            <PlusIcon /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filtro (REMOVIDO e-mail do label/placeholder) */}
      <Card className="mb-6">
        <div className="relative flex-grow">
          <Input
            id="search"
            label="Buscar por nome ou CPF/CNPJ"
            placeholder="Digite para buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <div className="absolute inset-y-0 left-0 top-6 flex items-center pl-3 pointer-events-none">
            <SearchIcon className="text-base-200" />
          </div>
        </div>
      </Card>

      <Card className="!p-0">
        {loading ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : error ? (
          <div className="p-4 text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-base-300">Nenhum cliente encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base-200">
              <thead className="bg-base-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Nome</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">CPF/CNPJ</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-base-200">
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-sm">{c.name}</td>
                    <td className="px-4 py-2 text-sm text-base-300">{c.cpfCnpj || '-'}</td>
                    <td className="px-4 py-2 text-sm print:hidden">
                      <div className="flex flex-wrap gap-2">
                        <Button title="Ver detalhes" onClick={() => openDetails(c)}>
                          Ver detalhes
                        </Button>
                        <Button title="Editar" onClick={() => openEdit(c)}>
                          Editar
                        </Button>
                        {/* Ver Interações / Criar Interação */}
                        <Button
                          onClick={() => handleViewInteractions(c.id)}
                          className=" inline-flex items-center gap-1"
                          title="Ver Interações"
                        >
                          <MessageSquareIcon /> Ver Interações
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Criar/Editar Cliente */}
      <ModalWrapper
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
      >
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSaving}
        />
      </ModalWrapper>

      {/* Modal de Interações */}
      <ModalWrapper
        isOpen={showInteractionModal}
        onClose={() => setShowInteractionModal(false)}
        title={`Interações de ${activeCustomerName || ''}`}
      >
        {/* Formulário de nova interação */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Interação</label>
            <select
              className="w-full border rounded p-2"
              value={interactionForm.type}
              onChange={(e) => setInteractionForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="">Selecione...</option>
              <option value="Telefone">Telefone</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="E-mail">E-mail</option>
              <option value="Visita">Visita</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição / Notas</label>
            <textarea
              className="w-full border rounded p-2"
              rows={4}
              value={interactionForm.notes}
              onChange={(e) => setInteractionForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Descreva o contato, follow-up, acordo etc."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreateInteraction} disabled={isSavingInteraction}>
              {isSavingInteraction ? 'Salvando...' : 'Adicionar Interação'}
            </Button>
          </div>
        </div>

        {/* Lista de interações */}
        {interactions.length > 0 ? (
          <ul className="space-y-2">
            {interactions.map((i, index) => (
              <li key={index} className="border p-3 rounded-lg shadow-sm text-sm text-base-400">
                <p><strong>Data:</strong> {i.date ? new Date(i.date).toLocaleString() : '-'}</p>
                <p><strong>Tipo:</strong> {i.type}</p>
                <p><strong>Descrição:</strong> {i.notes}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="">Nenhuma interação encontrada.</p>
        )}
      </ModalWrapper>
    </div>
  );
};

export default CustomersPage;
