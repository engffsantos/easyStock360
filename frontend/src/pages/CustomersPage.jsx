// frontend/src/pages/CustomersPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, MessageSquareIcon } from '../components/icons';
import InputMask from 'react-input-mask';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateString));

const CustomerForm = ({ customer, onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    cpfCnpj: '',
    phone: '',
    address: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        cpfCnpj: customer.cpfCnpj || '',
        phone: customer.phone || '',
        address: customer.address || '',
      });
    } else {
      setFormData({ name: '', cpfCnpj: '', phone: '', address: '' });
    }
    setErrors({});
  }, [customer]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório.';
    if (!formData.cpfCnpj.trim()) newErrors.cpfCnpj = 'CPF/CNPJ é obrigatório.';
    if (!formData.phone.trim()) newErrors.phone = 'Telefone é obrigatório.';
    if (!formData.address.trim()) newErrors.address = 'Endereço é obrigatório.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const sanitizedData = {
        ...formData,
        cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
      };
      onSave(sanitizedData);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="name"
        name="name"
        label="Nome Completo / Razão Social"
        value={formData.name}
        onChange={handleChange}
        required
      />
      {errors.name && <p className="text-danger text-sm">{errors.name}</p>}

      <div className="space-y-1">
        <label htmlFor="cpfCnpj" className="block text-sm font-medium text-gray-700">
          CPF / CNPJ
        </label>
        <InputMask
          mask={formData.cpfCnpj.replace(/\D/g, '').length > 11 ? '99.999.999/9999-99' : '999.999.999-99'}
          value={formData.cpfCnpj}
          onChange={handleChange}
        >
          {(inputProps) => (
            <input
              {...inputProps}
              id="cpfCnpj"
              name="cpfCnpj"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          )}
        </InputMask>
        {errors.cpfCnpj && <p className="text-danger text-sm">{errors.cpfCnpj}</p>}
      </div>

      <Input
        id="phone"
        name="phone"
        label="Telefone"
        type="tel"
        value={formData.phone}
        onChange={handleChange}
        required
      />
      {errors.phone && <p className="text-danger text-sm">{errors.phone}</p>}

      <Input
        id="address"
        name="address"
        label="Endereço Completo"
        value={formData.address}
        onChange={handleChange}
        required
      />
      {errors.address && <p className="text-danger text-sm">{errors.address}</p>}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSaving}>
          <span>{isSaving ? 'Salvando...' : 'Salvar Cliente'}</span>
        </Button>
      </div>
    </form>
  );
};

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [interactions, setInteractions] = useState([]);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [activeCustomerName, setActiveCustomerName] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (e) {
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
      } catch (e) {
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
      if (e.response && e.response.status === 409) {
        alert('Já existe um cliente com este CPF/CNPJ.');
      } else if (e.response && e.response.data?.error) {
        alert(e.response.data.error);
      } else {
        alert('Falha ao salvar o cliente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewInteractions = async (customerId) => {
    try {
      const data = await api.getInteractionsByCustomerId(customerId);
      const customer = customers.find(c => c.id === customerId);
      setActiveCustomerName(customer?.name || '');
      setInteractions(data);
      setShowInteractionModal(true);
    } catch (e) {
      alert('Erro ao buscar interações do cliente.');
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const term = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(term) || c.cpfCnpj.toLowerCase().includes(term);
    });
  }, [customers, searchTerm]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Clientes</h1>
        <Button variant="primary" onClick={handleAddCustomer}>
          <span className="inline-flex items-center gap-2">
            <PlusIcon />
            Adicionar Cliente
          </span>
        </Button>
      </div>

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

      <Card>
        {loading && <div className="flex justify-center p-12"><Spinner /></div>}
        {error && <div className="text-center text-danger p-12">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">CPF / CNPJ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Telefone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-base-200">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 text-sm font-medium text-base-400">{customer.name}</td>
                      <td className="px-6 py-4 text-sm text-base-300">{customer.cpfCnpj}</td>
                      <td className="px-6 py-4 text-sm text-base-300">{customer.phone}</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex gap-2">
                          <button onClick={() => handleEditCustomer(customer)} className="text-primary-700 hover:text-primary-800" title="Editar">
                            <EditIcon />
                          </button>
                          <button onClick={() => handleDeleteCustomer(customer.id)} className="text-danger hover:brightness-90" title="Remover">
                            <TrashIcon />
                          </button>
                          <button onClick={() => handleViewInteractions(customer.id)} className="text-blue-600 hover:underline" title="Ver Interações">
                            <MessageSquareIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-base-300">Nenhum cliente encontrado.</td>
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
        title={editingCustomer ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
      >
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSaving}
        />
      </ModalWrapper>

      <ModalWrapper
        isOpen={showInteractionModal}
        onClose={() => setShowInteractionModal(false)}
        title={`Interações de ${activeCustomerName}`}
      >
        {interactions.length > 0 ? (
          <ul className="space-y-2">
            {interactions.map((i, index) => (
              <li key={index} className="border p-3 rounded-lg shadow-sm text-sm text-base-400">
                <p><strong>Data:</strong> {new Date(i.createdAt).toLocaleString()}</p>
                <p><strong>Tipo:</strong> {i.type}</p>
                <p><strong>Descrição:</strong> {i.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base-300">Nenhuma interação encontrada.</p>
        )}
      </ModalWrapper>
    </>
  );
};

export default CustomersPage;
