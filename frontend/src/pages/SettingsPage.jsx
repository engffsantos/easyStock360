import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Spinner } from '../components/common';
import * as mockApi from '../api/mock';
import { SaveIcon } from '../components/icons';

const SettingsPage = () => {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await mockApi.getCompanyInfo();
        setCompanyInfo(data);
      } catch (e) {
        setError('Falha ao carregar as informações da empresa.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, []);

  const handleChange = (e) => {
    if (!companyInfo) return;
    const { name, value } = e.target;
    setCompanyInfo({ ...companyInfo, [name]: value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0] && companyInfo) {
      const file = e.target.files[0];
      if (file.size > 1024 * 1024) {
        alert('O arquivo é muito grande. O limite é de 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyInfo({ ...companyInfo, logoBase64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!companyInfo) return;
    setIsSaving(true);
    try {
      await mockApi.saveCompanyInfo(companyInfo);
      alert('Informações salvas com sucesso!');
    } catch (err) {
      alert('Falha ao salvar as informações.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (error) return <div className="text-center text-danger p-12">{error}</div>;
  if (!companyInfo) return <div className="text-center text-base-300 p-12">Não foi possível carregar as informações.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-base-400">Configurações da Empresa</h1>

      <Card>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Input id="name" name="name" label="Nome da Empresa" value={companyInfo.name} onChange={handleChange} required />
              <Input id="cnpj" name="cnpj" label="CNPJ" value={companyInfo.cnpj} onChange={handleChange} required />
              <Input id="address" name="address" label="Endereço Completo" value={companyInfo.address} onChange={handleChange} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input id="phone" name="phone" label="Telefone de Contato" type="tel" value={companyInfo.phone} onChange={handleChange} required />
                <Input id="email" name="email" label="E-mail de Contato" type="email" value={companyInfo.email} onChange={handleChange} required />
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-base-300">Logo da Empresa</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-base-200 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {companyInfo.logoBase64 ? (
                    <img src={companyInfo.logoBase64} alt="Logo preview" className="mx-auto h-24 w-auto object-contain" />
                  ) : (
                    <svg className="mx-auto h-12 w-12 text-base-300" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <div className="flex text-sm text-base-300 justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                      <span>Carregar um arquivo</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" />
                    </label>
                  </div>
                  <p className="text-xs text-base-300">PNG, JPG até 1MB</p>
                </div>
              </div>
              {companyInfo.logoBase64 && (
                <Button type="button" variant="secondary" onClick={() => setCompanyInfo({ ...companyInfo, logoBase64: '' })}>
                  Remover Logo
                </Button>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" variant="primary" disabled={isSaving}>
              <SaveIcon />
              {isSaving ? 'Salvando...' : 'Salvar Informações'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SettingsPage;
