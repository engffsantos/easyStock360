import React, { useState, useEffect } from 'react';
import { Card, Input, Spinner } from '../components/common';
import * as mockApi from '../api/mock';
import { SaveIcon } from '../components/icons';

const SettingsPage = () => {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [themeSettings, setThemeSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const [infoData, themeData] = await Promise.all([
          mockApi.getCompanyInfo(),
          mockApi.getThemeSettings(),
        ]);
        setCompanyInfo(infoData);
        setThemeSettings(themeData);
      } catch (e) {
        setError('Falha ao carregar as configurações.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const applyTheme = (settings) => {
    const root = document.documentElement;
    root.classList.remove('theme-petroleo', 'theme-roxo', 'theme-laranja');
    root.classList.add(`theme-${settings.primaryColor}`);

    root.classList.remove('font-size-sm', 'font-size-base', 'font-size-lg');
    root.classList.add(`font-size-${settings.fontSize}`);
  };

  const handleThemeChange = (key, value) => {
    if (!themeSettings) return;
    const newSettings = { ...themeSettings, [key]: value };
    setThemeSettings(newSettings);
    applyTheme(newSettings);
  };

  const handleInfoChange = (e) => {
    const { name, value } = e.target;
    setCompanyInfo({ ...companyInfo, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('O arquivo é muito grande. O limite é de 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanyInfo({ ...companyInfo, logoBase64: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!companyInfo || !themeSettings) return;
    setIsSaving(true);
    try {
      await Promise.all([
        mockApi.saveCompanyInfo(companyInfo),
        mockApi.saveThemeSettings(themeSettings),
      ]);
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      alert('Falha ao salvar as configurações.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (error) return <div className="text-center text-danger p-12">{error}</div>;
  if (!companyInfo || !themeSettings) return <div className="text-center  p-12">Não foi possível carregar as configurações.</div>;

  const colorOptions = [
    { key: 'petroleo', name: 'Petróleo', className: 'bg-[#2C7A7B]' },
    { key: 'laranja', name: 'Laranja', className: 'bg-[#C05621]' },
    { key: 'roxo', name: 'Roxo', className: 'bg-[#5A67D8]' },
  ];

  const fontOptions = [
    { key: 'sm', name: 'Pequeno' },
    { key: 'base', name: 'Médio' },
    { key: 'lg', name: 'Grande' },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold text-base-400">Configurações</h1>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded text-white"
          style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
        >
          <SaveIcon />
          {isSaving ? 'Salvando...' : 'Salvar Todas as Alterações'}
        </button>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-base-400 mb-4">Informações da Empresa</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Input id="name" name="name" label="Nome da Empresa" value={companyInfo.name} onChange={handleInfoChange} required />
              <Input id="cnpj" name="cnpj" label="CNPJ" value={companyInfo.cnpj} onChange={handleInfoChange} required />
              <Input id="address" name="address" label="Endereço Completo" value={companyInfo.address} onChange={handleInfoChange} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input id="phone" name="phone" label="Telefone de Contato" type="tel" value={companyInfo.phone} onChange={handleInfoChange} required />
                <Input id="email" name="email" label="E-mail de Contato" type="email" value={companyInfo.email} onChange={handleInfoChange} required />
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium ">Logo da Empresa</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-base-200 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {companyInfo.logoBase64 ? (
                    <img src={companyInfo.logoBase64} alt="Logo preview" className="mx-auto h-24 w-auto object-contain" />
                  ) : (
                    <svg className="mx-auto h-12 w-12 " stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <div className="flex text-sm  justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                      <span>Carregar um arquivo</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" />
                    </label>
                  </div>
                  <p className="text-xs ">PNG, JPG até 1MB</p>
                </div>
              </div>
              {companyInfo.logoBase64 && (
                <button
                  type="button"
                  onClick={() => setCompanyInfo({ ...companyInfo, logoBase64: '' })}
                  className="w-full px-4 py-2 rounded text-white"
                  style={{ backgroundColor: 'rgb(var(--color-primary-400))' }}
                >
                  Remover Logo
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-base-400 mb-4">Aparência do Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold  mb-3">Cor Principal</h3>
            <div className="flex flex-wrap gap-4">
              {colorOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleThemeChange('primaryColor', opt.key)}
                  className={`p-2 rounded-lg border-2 text-white ${opt.className} ${
                    themeSettings.primaryColor === opt.key ? 'ring-2 ring-offset-1 ring-primary-600' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="block w-8 h-8 rounded-md bg-white/30"></span>
                    <span className="font-semibold text-white">{opt.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold  mb-3">Tamanho da Fonte</h3>
            <div className="flex flex-wrap items-center gap-2" role="group">
              {fontOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleThemeChange('fontSize', opt.key)}
                  className={`px-6 py-2 rounded text-white ${
                    themeSettings.fontSize === opt.key
                      ? 'bg-[rgb(var(--color-primary-600))]'
                      : 'bg-[rgb(var(--color-primary-300))]'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
};

export default SettingsPage;
