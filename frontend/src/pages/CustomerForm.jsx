import React, { useState, useEffect } from 'react';
import { Input } from '../components/common';
import InputMask from 'react-input-mask';

// Botões personalizados com cor dinâmica
const PrimaryButton = ({ children, onClick, type = 'button', className = '', ...props }) => (
  <button
    type={type}
    onClick={onClick}
    className={`px-4 py-2 rounded text-white flex items-center justify-center gap-2 ${className}`}
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
    className={`px-4 py-2 rounded text-white bg-base-400 hover:brightness-110 flex items-center justify-center gap-2 ${className}`}
    {...props}
  >
    {children}
  </button>
);

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

  const handleClickSave = () => {
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
    <div className="space-y-4">
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
        <SecondaryButton onClick={onClose} disabled={isSaving}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton onClick={handleClickSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Cliente'}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default CustomerForm;
