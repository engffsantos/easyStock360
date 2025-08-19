// frontend/src/pages/SaleForm.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/api';
import { Card, Input, Spinner, ModalWrapper } from '../components/common';
import { TrashIcon, PlusIcon } from '../components/icons';
import Select from 'react-select';
import CustomerForm from './CustomerForm';

/**
 * ============================================
 *  Utilitários e constantes
 * ============================================
 */
const PAYMENT_METHODS = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(value || 0));

/** Divide em centavos e fecha diferença na última parcela */
function splitAmountsBRL(totalNumber, n) {
  const total = Math.round(Number(totalNumber || 0) * 100);
  const base = Math.floor(total / n);
  const remainder = total % n;
  const arr = Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
  return arr.map(v => v / 100);
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function toInputDate(d) {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Chama o endpoint de checagem de estoque (sempre 200; ok true/false no JSON) */
async function checkStockApi(items) {
  const res = await fetch('/api/sales/check_stock/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  // Backend garante 200 com { ok, items }
  return res.json();
}

/** Botões simples */
const PrimaryButton = ({ children, type = 'button', onClick, className = '', ...props }) => (
  <button
    type={type}
    onClick={onClick}
    className={`px-4 py-2 rounded text-white ${className}`}
    style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
    {...props}
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded text-white bg-base-400 hover:brightness-110 ${className}`}
  >
    {children}
  </button>
);

const SaleForm = ({ transactionToEdit, onSave, onClose, isSaving }) => {
  /**
   * ============================================
   *  Estados principais
   * ============================================
   */
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saleItems, setSaleItems] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formType, setFormType] = useState('QUOTE'); // QUOTE | COMPLETED

  // Pagamento
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [installments, setInstallments] = useState(1);

  // Datas de boleto
  const [boletoDueDates, setBoletoDueDates] = useState(['']);

  // Item atual em edição (autocomplete + quantidade)
  const [currentItem, setCurrentItem] = useState({ productId: '', quantity: 1 });
  const [itemError, setItemError] = useState('');
  const qtyInputRef = useRef(null);

  // Cliente (modal criar)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Desconto & Frete
  // 'PERCENT' | 'VALUE' | null
  const [discountType, setDiscountType] = useState(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [freight, setFreight] = useState(0);

  /**
   * ============================================
   *  Modal de ERRO DE ESTOQUE (mesmo estilo usado na conversão)
   *  - Abre quando o backend retorna ok: false no /check_stock/
   * ============================================
   */
  const [stockError, setStockError] = useState({
    open: false,
    message: '',
    items: [], // [{ productId, productName, available, requested }]
  });
  const openStockErrorModal = (message, items = []) =>
    setStockError({ open: true, message: message || 'Estoque insuficiente para um ou mais itens.', items: items || [] });
  const closeStockErrorModal = () => setStockError({ open: false, message: '', items: [] });

  /**
   * ============================================
   *  Carregamento inicial de produtos/clientes
   * ============================================
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, customersData] = await Promise.all([
          api.getProducts(),
          api.getCustomers(),
        ]);
        setProducts(productsData);
        setCustomers(customersData);
      } catch {
        alert('Erro ao carregar produtos e clientes');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /**
   * ============================================
   *  Preenchimento ao editar
   * ============================================
   */
  useEffect(() => {
    if (transactionToEdit) {
      setSaleItems(transactionToEdit.items || []);
      setSelectedCustomerId(transactionToEdit.customerId || '');
      setFormType(transactionToEdit.status);

      setDiscountType(transactionToEdit.discountType || null);
      setDiscountValue(transactionToEdit.discountValue || 0);
      setFreight(transactionToEdit.freight || 0);

      if (transactionToEdit.paymentMethod) setPaymentMethod(transactionToEdit.paymentMethod);
      if (transactionToEdit.installments) setInstallments(transactionToEdit.installments);

      // Extrai vencimentos (se existirem) para pré-preencher boleto
      if (Array.isArray(transactionToEdit.payments) && transactionToEdit.payments.length > 0) {
        const dds = transactionToEdit.payments.map(p =>
          p.dueDate ? toInputDate(new Date(p.dueDate)) : ''
        );
        setBoletoDueDates(dds.length ? dds : ['']);
      } else {
        setBoletoDueDates(['']);
      }
    } else {
      // Reset novo
      setSaleItems([]);
      setSelectedCustomerId('');
      setFormType('QUOTE');
      setDiscountType(null);
      setDiscountValue(0);
      setFreight(0);
      setPaymentMethod('PIX');
      setInstallments(1);
      setBoletoDueDates(['']);
    }
  }, [transactionToEdit]);

  /**
   * ============================================
   *  Derivados e opções (Select)
   * ============================================
   */
  const selectedProduct = useMemo(
    () => products.find(p => p.id === currentItem.productId),
    [currentItem.productId, products]
  );

  const customerOptions = useMemo(() => {
    return customers.map(c => ({
      value: c.id,
      label: `${c.name} - ${c.cpfCnpj}`,
      tokens: `${c.name} ${c.cpfCnpj} ${c.phone}`.toLowerCase()
    }));
  }, [customers]);

  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: p.id,
      label: `${p.name} • SKU: ${p.sku} • ${p.quantity} em estoque`,
      tokens: `${p.name} ${p.sku}`.toLowerCase(),
      raw: p
    }));
  }, [products]);

  const selectFilter = (option, input) => option.data.tokens.includes((input || '').toLowerCase());

  /**
   * ============================================
   *  Cálculos de subtotal/total (pré-visualização)
   * ============================================
   */
  const subtotal = useMemo(
    () => saleItems.reduce((acc, item) => acc + item.quantity * item.price, 0),
    [saleItems]
  );

  const computedDiscount = useMemo(() => {
    if (!discountType || !discountValue) return 0;
    const v = Number(discountValue) || 0;
    if (discountType === 'PERCENT') {
      const perc = Math.max(0, Math.min(v, 100));
      return Math.min(subtotal * (perc / 100), subtotal);
    }
    // VALUE (R$)
    return Math.min(Math.max(v, 0), subtotal);
  }, [discountType, discountValue, subtotal]);

  const total = useMemo(() => {
    const frete = Number(freight) || 0;
    return Math.max(subtotal - computedDiscount + frete, 0);
  }, [subtotal, computedDiscount, freight]);

  /**
   * ============================================
   *  Ações: cliente
   * ============================================
   */
  const handleCreateCustomer = async (customerData) => {
    setIsCreatingCustomer(true);
    try {
      const { data: saved } = await api.addCustomer(customerData);
      const updated = await api.getCustomers();
      setCustomers(updated);
      setSelectedCustomerId(saved.id);
      setIsCustomerModalOpen(false);
    } catch (e) {
      alert('Erro ao cadastrar cliente.');
      setIsCustomerModalOpen(true);
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  /**
   * ============================================
   *  AÇÕES: ITENS
   *  (1) Validação acontece NO CLIQUE DO BOTÃO "Adicionar".
   *  (2) Checamos localmente se a quantidade excede o disponível e, em seguida,
   *      confirmamos com o backend (/sales/check_stock/) para exibir o modal completo.
   *  (3) Em caso de insuficiência, NÃO adicionamos o item.
   * ============================================
   */
  const handleAddItem = async () => {
    setItemError('');

    const p = selectedProduct;
    if (!p) return setItemError('Selecione um produto.');
    const qty = Number(currentItem.quantity) || 0;
    if (qty <= 0) return setItemError('Quantidade deve ser maior que zero.');
    if (saleItems.some(item => item.productId === p.id)) {
      return setItemError('Produto já foi adicionado.');
    }

    // 1) Checagem local (rápida) para sinalizar bloqueio visual
    if (qty > (p.quantity ?? 0)) {
      openStockErrorModal(
        'Este item não possui saldo suficiente em estoque.',
        [{ productId: p.id, productName: p.name, available: p.quantity ?? 0, requested: qty }]
      );
      return setItemError(`Estoque insuficiente. Disponível: ${p.quantity ?? 0}.`);
    }

    // 2) Checagem autoritativa no backend (mostra modal detalhado se faltar)
    try {
      const res = await checkStockApi([{ productId: p.id, quantity: qty }]);
      if (!res?.ok) {
        openStockErrorModal(
          'O item selecionado não possui estoque suficiente.',
          Array.isArray(res.items) ? res.items : []
        );
        return setItemError('Estoque insuficiente para a quantidade informada.');
      }
    } catch {
      // Em caso de falha de rede, mantemos o local como fallback. Como passou na checagem local,
      // seguimos em frente. (A conversão/venda ainda será validada no backend.)
    }

    // 3) OK → adiciona
    setSaleItems(prev => ([
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity: qty,
        price: p.price,
      },
    ]));
    setCurrentItem({ productId: '', quantity: 1 });
    setItemError('');
  };

  const handleRemoveItem = (productId) => {
    setSaleItems(prev => prev.filter(i => i.productId !== productId));
  };

  /**
   * ============================================
   *  Boleto: ajuste de campos ao mudar nº de parcelas
   * ============================================
   */
  useEffect(() => {
    if (paymentMethod !== 'BOLETO') return;
    setBoletoDueDates(prev => {
      const next = [...prev];
      if (installments > next.length) {
        while (next.length < installments) next.push('');
      } else if (installments < next.length) {
        next.length = installments;
      }
      return next;
    });
  }, [installments, paymentMethod]);

  const autofillMonthlyBoleto = () => {
    const today = new Date();
    const first = addMonths(today, 1);
    const arr = Array.from({ length: Math.max(1, Number(installments) || 1) }, (_, i) =>
      toInputDate(addMonths(first, i))
    );
    setBoletoDueDates(arr);
  };

  const handleChangeBoletoDate = (index, value) => {
    setBoletoDueDates(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  /**
   * ============================================
   *  Submit (criar/editar)
   *  - Mantemos o "guardião final" para evitar salvar com inconsistências,
   *    mas a validação principal do item acontece no botão "Adicionar".
   * ============================================
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saleItems.length === 0) return alert('Adicione pelo menos um item.');
    if (total < 0) return alert('O total não pode ser negativo. Verifique o desconto/frete.');

    // Guardião final de estoque: checa todos os itens antes de salvar
    try {
      const payloadCheck = saleItems.map(i => ({ productId: i.productId, quantity: i.quantity }));
      const resCheck = await checkStockApi(payloadCheck);
      if (!resCheck?.ok) {
        openStockErrorModal(
          'Saldo de estoque insuficiente. Ajuste as quantidades para prosseguir.',
          Array.isArray(resCheck.items) ? resCheck.items : []
        );
        return; // NÃO salva nada
      }
    } catch {
      // Se falhar a checagem, não bloqueamos orçamento automaticamente,
      // mas a conversão e venda direta serão validadas no backend novamente.
    }

    // Se venda direta + boleto, prepara parcelas
    let boletoPayments = [];
    if (formType === 'COMPLETED' && paymentMethod === 'BOLETO') {
      const n = Math.max(1, Number(installments) || 1);
      if (boletoDueDates.length !== n || boletoDueDates.some(d => !d)) {
        return alert('Preencha todas as datas de vencimento das parcelas de boleto.');
      }
      const amounts = splitAmountsBRL(total, n);
      boletoPayments = boletoDueDates.map((d, i) => ({
        dueDate: new Date(`${d}T00:00:00Z`).toISOString(),
        amount: amounts[i],
        paymentMethod: 'BOLETO',
        status: 'ABERTO', // backend normaliza depois
      }));
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    const payload = {
      items: saleItems,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Consumidor Final',
      status: formType,

      // Backend recalcula
      discountType,
      discountValue: Number(discountValue) || 0,
      freight: Number(freight) || 0,

      // Pré-visualização
      subtotal,
      total,

      // Cabeçalho de pagamento (venda direta)
      ...(formType === 'COMPLETED'
        ? {
            paymentMethod,
            installments: Number(installments) || 1,
          }
        : {}),

      // Parcelas detalhadas (boleto)
      ...(formType === 'COMPLETED' && paymentMethod === 'BOLETO'
        ? { payments: boletoPayments }
        : {}),
    };

    try {
      if (transactionToEdit) {
        await api.updateTransaction(transactionToEdit.id, payload);
      } else {
        await api.addTransaction(payload);
      }
      onSave();
    } catch (err) {
      alert(`Erro ao salvar transação: ${err?.response?.data?.error || err.message || err}`);
    }
  };

  if (loading) return <div className="flex justify-center p-6"><Spinner /></div>;

  /**
   * ============================================
   *  Render
   * ============================================
   */
  // ======== Regras de desabilitação do botão "Adicionar" ========
  const qty = Number(currentItem.quantity) || 0;
  const available = selectedProduct?.quantity ?? 0;
  const isInsufficientLocal = !!currentItem.productId && qty > available; // vale para ORÇAMENTO e VENDA DIRETA
  const isAddDisabled = !currentItem.productId || isSaving || qty <= 0 || isInsufficientLocal;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo & Cliente */}
      <Card className="!p-4">
        <div className="mb-4">
          <label className="block mb-1 text-sm ">Tipo de operação</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="QUOTE"
                checked={formType === 'QUOTE'}
                onChange={() => setFormType('QUOTE')}
              />
              <span>Orçamento</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="COMPLETED"
                checked={formType === 'COMPLETED'}
                onChange={() => setFormType('COMPLETED')}
              />
              <span>Venda Direta</span>
            </label>
          </div>
          {formType === 'QUOTE' && (
            <p className="mt-2 text-xs text-base-400">
              Este orçamento terá validade de <strong>10 dias</strong> a partir da emissão.
            </p>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm">Cliente</label>

          <div className="grid grid-cols-6 gap-2 items-center">
            <div className="col-span-4">
              <Select
                options={customerOptions}
                onChange={(selected) => setSelectedCustomerId(selected?.value || '')}
                value={customerOptions.find(o => o.value === selectedCustomerId) || null}
                placeholder="Selecione o cliente"
                isClearable
                filterOption={selectFilter}
                className="w-full"
              />
            </div>

            <PrimaryButton
              className="col-span-2 w-full"
              onClick={() => setIsCustomerModalOpen(true)}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> Novo Cliente
              </span>
            </PrimaryButton>
          </div>
        </div>

        <ModalWrapper
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          title="Adicionar Cliente"
        >
          <CustomerForm
            customer={null}
            onSave={handleCreateCustomer}
            onClose={() => setIsCustomerModalOpen(false)}
            isSaving={isCreatingCustomer}
          />
        </ModalWrapper>

        {formType === 'COMPLETED' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block mb-1 text-sm ">Forma de pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={e => {
                    setPaymentMethod(e.target.value);
                    setInstallments(1);
                    setBoletoDueDates(['']);
                  }}
                  className="w-full p-2 border rounded"
                >
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm ">Parcelas</label>
                <Input
                  type="number"
                  min="1"
                  value={installments}
                  onChange={e => setInstallments(parseInt(e.target.value, 10) || 1)}
                  disabled={!['CARTAO_CREDITO', 'BOLETO'].includes(paymentMethod)}
                />
              </div>
            </div>

            {paymentMethod === 'BOLETO' && (
              <div className="mt-4 border rounded p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-semibold">Vencimentos do Boleto</h4>
                  <div className="flex gap-2">
                    <SecondaryButton onClick={autofillMonthlyBoleto}>
                      Preencher mensalmente
                    </SecondaryButton>
                  </div>
                </div>
                <p className="text-sm text-base-400 mb-2">
                  Informe o <strong>vencimento</strong> de cada parcela. Os valores serão distribuídos automaticamente.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: Math.max(1, Number(installments) || 1) }).map((_, i) => (
                    <div key={i}>
                      <label className="block text-sm mb-1">Parcela #{i + 1} - Vencimento</label>
                      <input
                        type="date"
                        className="w-full p-2 border rounded"
                        value={boletoDueDates[i] || ''}
                        onChange={(e) => handleChangeBoletoDate(i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Adicionar Itens */}
      <Card className="!p-4">
        <h3 className="font-bold mb-2">Adicionar Itens</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
          <div className="md:col-span-3">
            <label className="block mb-1 text-sm">Produto (digite nome ou SKU)</label>
            <Select
              options={productOptions}
              value={
                currentItem.productId
                  ? productOptions.find(o => o.value === currentItem.productId) || null
                  : null
              }
              onChange={(opt) => {
                const p = opt?.raw;
                if (!p) {
                  setCurrentItem(prev => ({ ...prev, productId: '' }));
                  return;
                }
                setItemError('');
                setCurrentItem(prev => ({ ...prev, productId: p.id }));
                setTimeout(() => qtyInputRef.current?.focus(), 0);
              }}
              isClearable
              placeholder="Busque por nome ou SKU…"
              filterOption={selectFilter}
              className="w-full"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block mb-1 text-sm">Quantidade</label>
            <Input
              ref={qtyInputRef}
              type="number"
              min="1"
              value={currentItem.quantity}
              onChange={e =>
                setCurrentItem(prev => ({
                  ...prev,
                  quantity: parseInt(e.target.value, 10) || 1
                }))
              }
              disabled={!currentItem.productId}
            />
            {/* Feedback rápido de estoque local */}
            {!!currentItem.productId && qty > 0 && isInsufficientLocal && (
              <p className="text-xs mt-1 text-danger">
                Estoque insuficiente. Disponível: {available}, Solicitado: {qty}.
              </p>
            )}
          </div>

          {/* >>> VALIDAÇÃO OCORRE AQUI NO CLIQUE <<< */}
          <div className="md:col-span-1 pt-6">
            <PrimaryButton
              onClick={handleAddItem}
              disabled={isAddDisabled}
              title={isInsufficientLocal ? 'Estoque insuficiente para esta quantidade' : undefined}
            >
              Adicionar
            </PrimaryButton>
          </div>
        </div>
        {itemError && <p className="text-danger mt-2">{itemError}</p>}
      </Card>

      {/* Lista de Itens */}
      <Card className="!p-4">
        <h3 className="font-bold mb-2">Itens</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">Produto</th>
              <th className="text-left">Qtd.</th>
              <th className="text-right">Subtotal</th>
              <th className="text-left">Ação</th>
            </tr>
          </thead>
        </table>
        <div className="max-h-80 overflow-auto">
          <table className="w-full">
            <tbody>
              {saleItems.length > 0 ? saleItems.map(item => (
                <tr key={item.productId} className="border-t">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2">{item.quantity} × {formatCurrency(item.price)}</td>
                  <td className="py-2 text-right">{formatCurrency(item.quantity * item.price)}</td>
                  <td className="py-2">
                    <button type="button" onClick={() => handleRemoveItem(item.productId)} className="text-danger">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="text-center py-4">Nenhum item adicionado.</td>
                </tr>
              )}
            </tbody>
            {saleItems.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="2" className="text-right font-bold pt-2">Subtotal</td>
                  <td colSpan="2" className="font-bold pt-2">{formatCurrency(subtotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Resumo & Descontos */}
      <Card className="!p-4">
        <h3 className="font-bold mb-3">Resumo & Descontos</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm">Tipo de Desconto</label>
            <select
              value={discountType || ''}
              onChange={(e) => setDiscountType(e.target.value || null)}
              className="w-full p-2 border rounded"
            >
              <option value="">Sem desconto</option>
              <option value="PERCENT">% (percentual)</option>
              <option value="VALUE">R$ (valor)</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block mb-1 text-sm">
              {discountType === 'PERCENT' ? 'Percentual (%)' : 'Desconto (R$)'}
            </label>
            <Input
              type="number"
              min="0"
              max={discountType === 'PERCENT' ? '100' : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              disabled={!discountType}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block mb-1 text-sm">Frete (R$)</label>
            <Input
              type="number"
              min="0"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block mb-1 text-sm">Total (pré-visualização)</label>
            <div className="p-2 border rounded bg-white font-bold">
              {formatCurrency(total)}
            </div>
          </div>
        </div>

        {paymentMethod === 'BOLETO' && formType === 'COMPLETED' && (
          <div className="mt-4 text-sm">
            <p className="font-medium">Distribuição do total por parcela (estimativa):</p>
            <ul className="list-disc pl-5">
              {splitAmountsBRL(total, Math.max(1, Number(installments) || 1)).map((v, i) => (
                <li key={i}>Parcela #{i + 1}: {formatCurrency(v)}</li>
              ))}
            </ul>
          </div>
        )}

        {discountType === 'PERCENT' && Number(discountValue) > 100 && (
          <p className="text-danger text-sm mt-2">
            Percentual de desconto não pode exceder 100%.
          </p>
        )}
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
        <PrimaryButton type="submit" disabled={saleItems.length === 0 || isSaving}>
          {isSaving
            ? 'Salvando...'
            : transactionToEdit
              ? 'Salvar Alterações'
              : formType === 'QUOTE'
                ? 'Salvar Orçamento'
                : 'Registrar Venda'}
        </PrimaryButton>
      </div>

      {/* ============================================
          MODAL DE ERRO DE ESTOQUE (mesmo estilo do exemplo)
          ============================================ */}
      {stockError.open && (
        <div
          id="modal-erro-estoque"
          className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 transition-opacity duration-300 opacity-100"
          onClick={(e) => { if (e.target.id === 'modal-erro-estoque') closeStockErrorModal(); }}
        >
          <div className="bg-white p-6 md:p-8 rounded-lg shadow-2xl max-w-sm w-full mx-4 transition-transform duration-300 transform scale-100">
            {/* Ícone vermelho */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>

            <h2 className="text-xl font-bold text-center mt-4 text-gray-800">
              Oops! Estoque Insuficiente
            </h2>

            <p className="text-gray-600 text-center mt-2 whitespace-pre-line">
              {stockError.message || 'Estoque insuficiente para um ou mais itens.'}
            </p>

            {/* Tabela com Produto / Disponível / Solicitado */}
            {Array.isArray(stockError.items) && stockError.items.length > 0 && (
              <div className="mt-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-700">
                      <th className="py-1 pr-2">Produto</th>
                      <th className="py-1 pr-2 text-right">Disponível</th>
                      <th className="py-1 text-right">Solicitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockError.items.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-1 pr-2 text-gray-800">{it.productName || it.productId}</td>
                        <td className="py-1 pr-2 text-right">{Number(it.available ?? 0)}</td>
                        <td className="py-1 text-right font-semibold text-red-600">{Number(it.requested ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              id="btn-fechar-modal"
              className="mt-6 w-full bg-red-600 text-white py-2 rounded-md font-medium hover:bg-red-700 transition duration-200"
              onClick={closeStockErrorModal}
              type="button"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

export default SaleForm;
