// frontend/src/pages/CustomersPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/api';
import { Card, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, MessageSquareIcon } from '../components/icons';
import CustomerDetailsModal from '../components/CustomerDetailsModal';
import CustomerForm from './CustomerForm';

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

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);
    } catch {
      setError('Falha ao carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDeleteCustomer = async (id) => {
    if (window.confirm('Tem certeza que deseja remover este cliente?')) {
      try {
        await api.deleteCustomer(id);
        await fetchCustomers();
      } catch {
        alert('Falha ao remover o cliente.');
      }
    }
  };

  const handleSaveCustomer = async (data) => {
    setIsSaving(true);
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, data);
      } else {
        await api.addCustomer(data);
      }
      setIsModalOpen(false);
      await fetchCustomers();
    } catch (e) {
      if (e.response?.status === 409) {
        alert('Já existe um cliente com este CPF/CNPJ.');
      } else if (e.response?.data?.error) {
        alert(e.response.data.error);
      } else {
        alert('Falha ao salvar o cliente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.cpfCnpj.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term))
      );
    });
  }, [customers, searchTerm]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Clientes</h1>
        <PrimaryButton onClick={handleAddCustomer}>
          <PlusIcon /> Adicionar Cliente
        </PrimaryButton>
      </div>

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

      <Card>
        {loading && <div className="flex justify-center p-12"><Spinner /></div>}
        {error && <div className="text-center text-danger p-12">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">CPF/CNPJ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">Telefone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">E-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">Endereço</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-base-200">
                {filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 text-sm font-medium text-base-400">{customer.name}</td>
                    <td className="px-6 py-4 text-sm">{customer.cpfCnpj}</td>
                    <td className="px-6 py-4 text-sm">{customer.phone}</td>
                    <td className="px-6 py-4 text-sm">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-sm truncate max-w-xs">{customer.address}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex gap-2">
                        <button onClick={() => handleEditCustomer(customer)} title="Editar"><EditIcon /></button>
                        <button onClick={() => handleDeleteCustomer(customer.id)} className="text-danger" title="Remover"><TrashIcon /></button>
                        <button onClick={() => setSelectedCustomer(customer)} title="Ver Detalhes"><MessageSquareIcon /></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12">Nenhum cliente encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalWrapper isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? 'Editar Cliente' : 'Adicionar Novo Cliente'}>
        <CustomerForm customer={editingCustomer} onSave={handleSaveCustomer} onClose={() => setIsModalOpen(false)} isSaving={isSaving} />
      </ModalWrapper>

      <CustomerDetailsModal
        customer={selectedCustomer}
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </>
  );
};

export default CustomersPage;
