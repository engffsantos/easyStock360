// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { Card, Input, Spinner } from '../components/common';
import { api } from '../api/api';
import { SaveIcon, TrashIcon, PlusIcon } from '../components/icons';

const SettingsPage = () => {
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Campos auxiliares para inputs de adição
  const [newPhone, setNewPhone] = useState('');
  const [newSocial, setNewSocial] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const infoData = await api.getCompanyInfo();

        // Garante defaults sem quebrar se backend ainda não tiver os campos
        const normalized = ensureDefaults(infoData);
        setCompanyInfo(normalized);
        applyTheme(normalized);
      } catch (e) {
        setError('Falha ao carregar as configurações.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const ensureDefaults = (settings) => ({
    ...settings,
    // listas
    companyPhones: Array.isArray(settings?.companyPhones)
      ? settings.companyPhones
      : (settings?.phone ? [settings.phone] : []),
    companySocials: Array.isArray(settings?.companySocials) ? settings.companySocials : [],
    // textos padrão do documento
    pickupAddress: settings?.pickupAddress || '',
    deliveryPolicy: settings?.deliveryPolicy || '',
    leadTimeNotes: settings?.leadTimeNotes || '',
    paymentsNotes: settings?.paymentsNotes || '',
    documentFooter: settings?.documentFooter || '',
    // validade do orçamento
    quoteValidityDays:
      typeof settings?.quoteValidityDays === 'number' ? settings.quoteValidityDays : 10,
  });

  const applyTheme = (settings) => {
    const root = document.documentElement;
    root.classList.remove('theme-petroleo', 'theme-roxo', 'theme-laranja');
    root.classList.add(`theme-${settings.themeColor}`);

    root.classList.remove('font-size-sm', 'font-size-base', 'font-size-lg');
    const fontMap = { '1': 'sm', '2': 'base', '3': 'lg' };
    root.classList.add(`font-size-${fontMap[settings.fontSize || '2']}`);
  };

  const handleThemeChange = (key, value) => {
    const updated = { ...companyInfo, [key]: value };
    setCompanyInfo(updated);
    applyTheme(updated);
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

  // ------ Phones ------
  const addPhone = () => {
    const v = (newPhone || '').trim();
    if (!v) return;
    if (companyInfo.companyPhones.includes(v)) return;
    setCompanyInfo({ ...companyInfo, companyPhones: [...companyInfo.companyPhones, v] });
    setNewPhone('');
  };
  const removePhone = (idx) => {
    const updated = [...companyInfo.companyPhones];
    updated.splice(idx, 1);
    setCompanyInfo({ ...companyInfo, companyPhones: updated });
  };

  // ------ Socials ------
  const addSocial = () => {
    const v = (newSocial || '').trim();
    if (!v) return;
    if (companyInfo.companySocials.includes(v)) return;
    setCompanyInfo({ ...companyInfo, companySocials: [...companyInfo.companySocials, v] });
    setNewSocial('');
  };
  const removeSocial = (idx) => {
    const updated = [...companyInfo.companySocials];
    updated.splice(idx, 1);
    setCompanyInfo({ ...companyInfo, companySocials: updated });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!companyInfo) return;
    setIsSaving(true);
    try {
      // Mantém compatibilidade: preenche 'phone' com o primeiro telefone (se houver)
      const payload = {
        ...companyInfo,
        phone: companyInfo.companyPhones?.[0] || companyInfo.phone || '',
      };
      await api.saveCompanyInfo(payload);
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
  if (!companyInfo) return <div className="text-center  p-12">Não foi possível carregar as configurações.</div>;

  const colorOptions = [
    { key: 'petroleo', name: 'Petróleo', className: 'bg-[#2C7A7B]' },
    { key: 'laranja', name: 'Laranja', className: 'bg-[#C05621]' },
    { key: 'roxo', name: 'Roxo', className: 'bg-[#5A67D8]' },
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

      {/* Informações da Empresa (básico) */}
      <Card>
        <h2 className="text-xl font-bold text-base-400 mb-4">Informações da Empresa</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Input id="name" name="name" label="Nome da Empresa" value={companyInfo.name} onChange={handleInfoChange} required />
              <Input id="cnpj" name="cnpj" label="CNPJ" value={companyInfo.cnpj} onChange={handleInfoChange} required />
              <Input id="address" name="address" label="Endereço Completo" value={companyInfo.address} onChange={handleInfoChange} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Campo 'phone' mantido só para compatibilidade; lista oficial abaixo */}
                <Input id="email" name="email" label="E-mail de Contato" type="email" value={companyInfo.email} onChange={handleInfoChange} required />
                <Input id="phone" name="phone" label="Telefone (principal - compatibilidade)" type="tel" value={companyInfo.phone || companyInfo.companyPhones?.[0] || ''} onChange={handleInfoChange} />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium">Logo da Empresa</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-base-200 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {companyInfo.logoBase64 ? (
                    <img src={companyInfo.logoBase64} alt="Logo preview" className="mx-auto h-24 w-auto object-contain" />
                  ) : (
                    <svg className="mx-auto h-12 w-12 " stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <div className="flex text-sm justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                      <span>Carregar um arquivo</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" />
                    </label>
                  </div>
                  <p className="text-xs">PNG, JPG até 1MB</p>
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

      {/* Contatos & Redes */}
      <Card>
        <h2 className="text-xl font-bold text-base-400 mb-4">Contatos & Redes</h2>

        {/* Telefones */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Telefones (lista)</label>
          <div className="flex gap-2 items-center mb-3">
            <Input
              id="newPhone"
              label=""
              placeholder="(XX) 9XXXX-XXXX"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <button
              type="button"
              onClick={addPhone}
              className="px-3 py-2 rounded text-white flex items-center gap-2"
              style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
            >
              <PlusIcon /> Adicionar
            </button>
          </div>
          {companyInfo.companyPhones?.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {companyInfo.companyPhones.map((p, idx) => (
                <li key={`${p}-${idx}`} className="px-3 py-1 rounded border flex items-center gap-2">
                  <span>{p}</span>
                  <button
                    type="button"
                    onClick={() => removePhone(idx)}
                    className="text-danger hover:brightness-110"
                    title="Remover"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Redes sociais */}
        <div>
          <label className="block text-sm font-medium mb-2">Redes sociais (URLs ou @user)</label>
          <div className="flex gap-2 items-center mb-3">
            <Input
              id="newSocial"
              label=""
              placeholder="https://instagram.com/suaempresa"
              value={newSocial}
              onChange={(e) => setNewSocial(e.target.value)}
            />
            <button
              type="button"
              onClick={addSocial}
              className="px-3 py-2 rounded text-white flex items-center gap-2"
              style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
            >
              <PlusIcon /> Adicionar
            </button>
          </div>
          {companyInfo.companySocials?.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {companyInfo.companySocials.map((s, idx) => (
                <li key={`${s}-${idx}`} className="px-3 py-1 rounded border flex items-center gap-2">
                  <span className="truncate max-w-[320px]">{s}</span>
                  <button
                    type="button"
                    onClick={() => removeSocial(idx)}
                    className="text-danger hover:brightness-110"
                    title="Remover"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Textos padrão do documento (usados em Orçamento/Recibo) */}
      <Card>
        <h2 className="text-xl font-bold text-base-400 mb-4">Textos Padrão do Documento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Retirada */}
          <div>
            <label className="block text-sm font-medium mb-1">Local de retirada</label>
            <textarea
              name="pickupAddress"
              value={companyInfo.pickupAddress}
              onChange={handleInfoChange}
              className="w-full p-2 border rounded min-h-[72px]"
              placeholder="Ex.: Retirada no balcão: Rua Exemplo, 123 – Centro – Seg a Sex, 8h–18h."
            />
          </div>

          {/* Entrega */}
          <div>
            <label className="block text-sm font-medium mb-1">Política de entrega</label>
            <textarea
              name="deliveryPolicy"
              value={companyInfo.deliveryPolicy}
              onChange={handleInfoChange}
              className="w-full p-2 border rounded min-h-[72px]"
              placeholder="Ex.: Entrega em até 2 dias úteis. Taxa de entrega não incluída (cotada conforme CEP)."
            />
          </div>

          {/* Antecedência */}
          <div>
            <label className="block text-sm font-medium mb-1">Antecedência / prazo de execução</label>
            <textarea
              name="leadTimeNotes"
              value={companyInfo.leadTimeNotes}
              onChange={handleInfoChange}
              className="w-full p-2 border rounded min-h-[72px]"
              placeholder="Ex.: Pedidos sob encomenda exigem 3 dias úteis de antecedência."
            />
          </div>

          {/* Formas de pagamento / descontos */}
          <div>
            <label className="block text-sm font-medium mb-1">Formas de pagamento aceitas</label>
            <textarea
              name="paymentsNotes"
              value={companyInfo.paymentsNotes}
              onChange={handleInfoChange}
              className="w-full p-2 border rounded min-h-[72px]"
              placeholder="Ex.: PIX, débito, crédito (até 3× sem juros), boleto (PJ). 5% de desconto à vista no PIX."
            />
          </div>
        </div>

        {/* Validade do orçamento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div>
            <label className="block text-sm font-medium mb-1">Validade do orçamento (dias)</label>
            <Input
              id="quoteValidityDays"
              name="quoteValidityDays"
              type="number"
              min="1"
              value={companyInfo.quoteValidityDays}
              onChange={(e) =>
                setCompanyInfo({ ...companyInfo, quoteValidityDays: parseInt(e.target.value || '10', 10) })
              }
            />
            <p className="text-xs text-base-400 mt-1">
              Usado para exibir “Válido até” no orçamento. Padrão: 10 dias.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Rodapé do documento (opcional)</label>
            <textarea
              name="documentFooter"
              value={companyInfo.documentFooter}
              onChange={handleInfoChange}
              className="w-full p-2 border rounded min-h-[72px]"
              placeholder="Ex.: Obrigado pela preferência! Dúvidas? Fale conosco."
            />
          </div>
        </div>
      </Card>

      {/* Aparência do Sistema */}
      <Card>
        <h2 className="text-xl font-bold text-base-400 mb-4">Aparência do Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-3">Cor Principal</h3>
            <div className="flex flex-wrap gap-4">
              {colorOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleThemeChange('themeColor', opt.key)}
                  className={`p-2 rounded-lg border-2 text-white ${opt.className} ${
                    companyInfo.themeColor === opt.key ? 'ring-2 ring-offset-1 ring-primary-600' : 'border-transparent'
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
            <h3 className="text-lg font-semibold mb-3">Tamanho da Fonte</h3>
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={companyInfo.fontSize || '2'}
              onChange={(e) => handleThemeChange('fontSize', e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-sm mt-1 text-gray-600">
              <span>Pequeno</span>
              <span>Médio</span>
              <span>Grande</span>
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
};

export default SettingsPage;
