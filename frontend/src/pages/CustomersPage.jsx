// frontend/src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, Spinner, ModalWrapper } from '../components/common';
import CustomerDetailsPage from './CustomerDetailsPage';
import CustomerForm from './CustomerForm';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, MessageSquareIcon } from '../components/icons';
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

  // Busca
  const filtered = useMemo(() => {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.cpfCnpj, c.email /*, c.phone*/] // foco em nome/CPF-CNPJ/email como você pediu
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

  const handleSaveCustomer = async (formData) => {
    try {
      setIsSaving(true);
      if (formData?.id) {
        await api.updateCustomer(formData.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      // Recarrega lista
      const data = await api.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
      // Fecha modal
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (e) {
      console.error('[CustomersPage] save customer error', e);
      alert('Falha ao salvar cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  // ===========================================
  // Render: quando em detalhes, só a página de detalhes
  // ===========================================
  if (view === 'details' && selectedCustomer) {
    return (
      <CustomerDetailsPage
        customer={selectedCustomer}
        onBack={handleBackFromDetails}
      />
    );
  }

  // ===========================================
  // Render: LISTA
  // ===========================================
  return (
    <div className="space-y-4">
      {/* Header e botão de novo cliente (fora da impressão) */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <h2 className="text-base-400 text-xl font-semibold">Clientes</h2>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>Novo Cliente</Button>
        </div>
      </div>

      {/* ====== Filtro exatamente como solicitado ====== */}
      <Card className="mb-6">
        <div className="relative flex-grow">
          <Input
            id="search"
            label="Buscar por nome, CPF/CNPJ ou E-mail"
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
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">E-mail</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-base-200">
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-sm">{c.name}</td>
                    <td className="px-4 py-2 text-sm text-base-300">{c.cpfCnpj || '-'}</td>
                    <td className="px-4 py-2 text-sm text-base-300">{c.email || '-'}</td>
                    <td className="px-4 py-2 text-sm print:hidden">
                      <div className="flex gap-2">
                        <Button title="Ver detalhes" onClick={() => openDetails(c)}>
                          Ver detalhes
                        </Button>
                        <Button title="Editar" onClick={() => openEdit(c)}>
                          Editar
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

      {/* ====== Modal de Criar/Editar exatamente como solicitado ====== */}
      <ModalWrapper
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
      >
        {/* O formulário de cadastro/edição não é um documento imprimível; deixamos sem report-content */}
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSaving}
        />
      </ModalWrapper>
    </div>
  );
};

export default CustomersPage;
