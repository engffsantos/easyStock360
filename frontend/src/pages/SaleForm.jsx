// frontend/src/pages/SaleForm.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/api';
import { Card, Input, Spinner, ModalWrapper } from '../components/common';
import { TrashIcon, PlusIcon } from '../components/icons';
import Select from 'react-select';
import CustomerForm from './CustomerForm';

const PAYMENT_METHODS = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

function splitAmountsBRL(totalNumber, n) {
  // Distribui em centavos para evitar erro de arredondamento
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
  // Ajuste para meses com menos dias
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

function toInputDate(d) {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saleItems, setSaleItems] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formType, setFormType] = useState('QUOTE');

  // Pagamento
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [installments, setInstallments] = useState(1);

  // Datas de boleto
  const [boletoDueDates, setBoletoDueDates] = useState(['']);

  // Item atual
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

  // Carregar dados
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

  // Preencher ao editar
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

      // Se vierem parcelas (edição), tenta extrair vencimentos para boleto
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

  // Produto selecionado (objeto)
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === currentItem.productId);
  }, [currentItem.productId, products]);

  // Opções de cliente (busca por nome/cpf/telefone)
  const customerOptions = useMemo(() => {
    return customers.map(c => ({
      value: c.id,
      label: `${c.name} - ${c.cpfCnpj}`,
      tokens: `${c.name} ${c.cpfCnpj} ${c.phone}`.toLowerCase()
    }));
  }, [customers]);

  // Opções de produto para autocomplete (busca por nome e SKU)
  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: p.id,
      label: `${p.name} • SKU: ${p.sku} • ${p.quantity} em estoque`,
      tokens: `${p.name} ${p.sku}`.toLowerCase(),
      raw: p
    }));
  }, [products]);

  // Filtro customizado para react-select (produto)
  const productFilter = (option, input) => {
    return option.data.tokens.includes((input || '').toLowerCase());
  };

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

  // Cálculos
  const subtotal = useMemo(() => {
    return saleItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  }, [saleItems]);

  const computedDiscount = useMemo(() => {
    if (!discountType || !discountValue) return 0;
    const v = Number(discountValue) || 0;
    if (discountType === 'PERCENT') {
      const perc = Math.max(0, Math.min(v, 100));
      return Math.min(subtotal * (perc / 100), subtotal);
    }
    // VALUE
    return Math.min(Math.max(v, 0), subtotal);
  }, [discountType, discountValue, subtotal]);

  const total = useMemo(() => {
    const frete = Number(freight) || 0;
    return Math.max(subtotal - computedDiscount + frete, 0);
  }, [subtotal, computedDiscount, freight]);

  // Adicionar item
  const handleAddItem = () => {
    setItemError('');
    if (!selectedProduct) return setItemError('Selecione um produto.');
    if (currentItem.quantity <= 0) return setItemError('Quantidade deve ser maior que zero.');
    if (formType === 'COMPLETED' && selectedProduct && currentItem.quantity > selectedProduct.quantity) {
      return setItemError(`Estoque insuficiente. Disponível: ${selectedProduct.quantity}.`);
    }
    if (saleItems.some(item => item.productId === selectedProduct.id)) {
      return setItemError('Produto já foi adicionado.');
    }

    setSaleItems(prev => ([
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: currentItem.quantity,
        price: selectedProduct.price,
      },
    ]));
    setCurrentItem({ productId: '', quantity: 1 });
  };

  const handleRemoveItem = (productId) => {
    setSaleItems(prev => prev.filter(i => i.productId !== productId));
  };

  // Atualiza quantidade de campos de vencimento ao mudar nº de parcelas
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

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saleItems.length === 0) return alert('Adicione pelo menos um item.');
    if (total < 0) return alert('O total não pode ser negativo. Verifique o desconto/frete.');

    // Validação de datas para boleto
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
        status: 'ABERTO',
      }));
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    const payload = {
      items: saleItems,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Consumidor Final',
      status: formType,

      // Desconto/Frete (backend recalcula como fonte da verdade)
      discountType,
      discountValue: Number(discountValue) || 0,
      freight: Number(freight) || 0,

      // Pré-visualização
      subtotal,
      total,

      // Forma de pagamento (na raiz) quando COMPLETED
      ...(formType === 'COMPLETED'
        ? {
            paymentMethod,
            installments: Number(installments) || 1,
          }
        : {}),

      // Parcelas detalhadas (quando BOLETO)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo & Cliente */}
      <Card className="!p-4">
        <div className="mb-4">
          <label className="block mb-1 text-sm ">Tipo de operação</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                  type="radio"
                  value="QUOTE"
                  checked={formType === 'QUOTE'}
                  onChange={() => setFormType('QUOTE')}
              />
              Orçamento
            </label>
            <label className="flex items-center gap-2">
              <input
                  type="radio"
                  value="COMPLETED"
                  checked={formType === 'COMPLETED'}
                  onChange={() => setFormType('COMPLETED')}
              />
              Venda Direta
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
                  filterOption={productFilter}
                  className="w-full"
              />
            </div>

            <PrimaryButton
                className="col-span-2 w-full"
                onClick={() => setIsCustomerModalOpen(true)}
            >
      <span className="inline-flex items-center gap-2">
        <PlusIcon/> Novo Cliente
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
                      onChange={e => setInstallments(parseInt(e.target.value) || 1)}
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
                      Informe o <strong>vencimento</strong> de cada parcela. Os valores serão distribuídos
                      automaticamente.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.from({length: Math.max(1, Number(installments) || 1)}).map((_, i) => (
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
                    setCurrentItem(prev => ({...prev, productId: ''}));
                    return;
                }
                if (formType === 'COMPLETED' && p.quantity <= 0) {
                  setItemError('Produto sem estoque para venda direta.');
                  setCurrentItem(prev => ({ ...prev, productId: '' }));
                  return;
                }
                setItemError('');
                setCurrentItem(prev => ({ ...prev, productId: p.id }));
                setTimeout(() => qtyInputRef.current?.focus(), 0);
              }}
              isClearable
              placeholder="Busque por nome ou SKU…"
              filterOption={productFilter}
              className="w-full"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm">Quantidade</label>
            <Input
              ref={qtyInputRef}
              type="number"
              min="1"
              max={formType === 'COMPLETED' ? (selectedProduct?.quantity ?? undefined) : undefined}
              value={currentItem.quantity}
              onChange={e => setCurrentItem(prev => ({
                ...prev,
                quantity: parseInt(e.target.value) || 1
              }))}
              disabled={!currentItem.productId}
            />
            {formType === 'COMPLETED' && selectedProduct && (
              <p className="text-xs mt-1">Estoque: {selectedProduct.quantity}</p>
            )}
          </div>
          <div className="md:col-span-1 pt-6">
            <PrimaryButton onClick={handleAddItem} disabled={!currentItem.productId || isSaving}>
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
    </form>
  );
};

export default SaleForm;
