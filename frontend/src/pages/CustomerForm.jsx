// frontend/src/pages/CustomerForm.jsx
import React, { useState, useEffect } from 'react';
import { Input } from '../components/common';
import InputMask from 'react-input-mask';

const PrimaryButton = ({ children, ...props }) => (
  <button
    type="button"
    className="px-4 py-2 rounded text-white flex items-center justify-center gap-2"
    style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
    {...props}
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, ...props }) => (
  <button
    type="button"
    className="px-4 py-2 rounded text-white bg-base-400 hover:brightness-110 flex items-center justify-center gap-2"
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
    email: '',
    street: '',
    number: '',
    district: '',
    city: '',
    state: '',
    zip: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (customer) {
      const [street = '', number = '', district = '', city = '', state = '', zip = ''] =
        (customer.address || '').split(',').map(s => s.trim());
      setFormData({
        name: customer.name || '',
        cpfCnpj: customer.cpfCnpj || '',
        phone: customer.phone || '',
        email: customer.email || '',
        street, number, district, city, state, zip
      });
    } else {
      setFormData({
        name: '', cpfCnpj: '', phone: '', email: '',
        street: '', number: '', district: '', city: '', state: '', zip: ''
      });
    }
    setErrors({});
  }, [customer]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório.';
    if (!formData.cpfCnpj.trim()) newErrors.cpfCnpj = 'CPF/CNPJ é obrigatório.';
    else if (!/^\d{11}$|^\d{14}$/.test(formData.cpfCnpj.replace(/\D/g, '')))
      newErrors.cpfCnpj = 'CPF/CNPJ inválido.';
    if (!formData.phone.trim()) newErrors.phone = 'Telefone é obrigatório.';
    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'E-mail inválido.';
    if (!formData.street.trim()) newErrors.street = 'Logradouro é obrigatório.';
    if (!formData.number.trim()) newErrors.number = 'Número é obrigatório.';
    if (!formData.city.trim()) newErrors.city = 'Cidade é obrigatória.';
    if (!formData.state.trim()) newErrors.state = 'UF é obrigatória.';
    if (!formData.zip.trim()) newErrors.zip = 'CEP é obrigatório.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClickSave = () => {
    if (validate()) {
      const address = `${formData.street}, ${formData.number}, ${formData.district}, ${formData.city}, ${formData.state}, ${formData.zip}`;
      onSave({
        name: formData.name.trim(),
        cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-3">
      <Input id="name" name="name" label="Nome Completo / Razão Social" value={formData.name} onChange={handleChange} required />
      {errors.name && <p className="text-danger text-sm">{errors.name}</p>}

      <label className="block text-sm font-medium">CPF / CNPJ</label>
      <InputMask
        mask={formData.cpfCnpj.replace(/\D/g, '').length > 11 ? '99.999.999/9999-99' : '999.999.999-99'}
        value={formData.cpfCnpj}
        onChange={handleChange}
      >
        {(inputProps) => (
          <input {...inputProps} id="cpfCnpj" name="cpfCnpj" required className="w-full border rounded p-2" />
        )}
      </InputMask>
      {errors.cpfCnpj && <p className="text-danger text-sm">{errors.cpfCnpj}</p>}

      <Input id="phone" name="phone" label="Telefone" type="tel" value={formData.phone} onChange={handleChange} required />
      {errors.phone && <p className="text-danger text-sm">{errors.phone}</p>}

      <Input id="email" name="email" label="E-mail" type="email" value={formData.email} onChange={handleChange} required />
      {errors.email && <p className="text-danger text-sm">{errors.email}</p>}

      <Input id="street" name="street" label="Logradouro" value={formData.street} onChange={handleChange} required />
      {errors.street && <p className="text-danger text-sm">{errors.street}</p>}

      <Input id="number" name="number" label="Número" value={formData.number} onChange={handleChange} required />
      {errors.number && <p className="text-danger text-sm">{errors.number}</p>}

      <Input id="district" name="district" label="Bairro" value={formData.district} onChange={handleChange} />
      <Input id="city" name="city" label="Cidade" value={formData.city} onChange={handleChange} required />
      {errors.city && <p className="text-danger text-sm">{errors.city}</p>}

      <Input id="state" name="state" label="UF" maxLength="2" value={formData.state} onChange={handleChange} required />
      {errors.state && <p className="text-danger text-sm">{errors.state}</p>}

      <label className="block text-sm font-medium">CEP</label>
      <InputMask
        mask="99999-999"
        value={formData.zip}
        onChange={handleChange}
      >
        {(inputProps) => (
          <input {...inputProps} id="zip" name="zip" required className="w-full border rounded p-2" />
        )}
      </InputMask>
      {errors.zip && <p className="text-danger text-sm">{errors.zip}</p>}

      <div className="flex justify-end gap-3 pt-4">
        <SecondaryButton onClick={onClose} disabled={isSaving}>Cancelar</SecondaryButton>
        <PrimaryButton onClick={handleClickSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Cliente'}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default CustomerForm;
