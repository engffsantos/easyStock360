// frontend/src/pages/SaleForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, Spinner } from '../components/common';
import { TrashIcon } from '../components/icons';

const PAYMENT_METHODS = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const SaleForm = ({ transactionToEdit, onSave, onClose, isSaving }) => {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saleItems, setSaleItems] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formType, setFormType] = useState('QUOTE');
  const [paymentDetails, setPaymentDetails] = useState({ paymentMethod: 'PIX', installments: 1 });

  const [currentItem, setCurrentItem] = useState({ productId: '', quantity: 1 });
  const [itemError, setItemError] = useState('');

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
      } catch (e) {
        alert('Erro ao carregar produtos e clientes');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (transactionToEdit) {
      setSaleItems(transactionToEdit.items || []);
      setSelectedCustomerId(transactionToEdit.customerId || '');
      setFormType(transactionToEdit.status);
    }
  }, [transactionToEdit]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === currentItem.productId);
  }, [currentItem.productId, products]);

  const handleAddItem = () => {
    setItemError('');
    if (!selectedProduct) {
      setItemError('Selecione um produto.');
      return;
    }
    if (currentItem.quantity <= 0) {
      setItemError('Quantidade deve ser maior que zero.');
      return;
    }
    if (formType === 'COMPLETED' && currentItem.quantity > selectedProduct.quantity) {
      setItemError(`Estoque insuficiente. Disponível: ${selectedProduct.quantity}.`);
      return;
    }
    if (saleItems.some(item => item.productId === selectedProduct.id)) {
      setItemError('Produto já adicionado.');
      return;
    }

    setSaleItems(prev => [
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: currentItem.quantity,
        price: selectedProduct.price,
      },
    ]);

    setCurrentItem({ productId: '', quantity: 1 });
  };

  const handleRemoveItem = (productId) => {
    setSaleItems(prev => prev.filter(i => i.productId !== productId));
  };

  const totalSale = useMemo(() => {
    return saleItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  }, [saleItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saleItems.length === 0) {
      alert('Adicione pelo menos um item.');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    const payload = {
      items: saleItems,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Consumidor Final',
      status: formType,
      ...(formType === 'COMPLETED' ? { paymentDetails } : {})
    };

    try {
      if (transactionToEdit) {
        await api.updateTransaction(transactionToEdit.id, payload);
      } else {
        await api.addTransaction(payload);
      }
      onSave();
    } catch (err) {
      alert('Erro ao salvar transação');
    }
  };

  if (loading) return <div className="flex justify-center p-6"><Spinner /></div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="!p-4">
        <div className="mb-4">
          <label className="block mb-1 text-sm text-base-300">Tipo de operação</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" value="QUOTE" checked={formType === 'QUOTE'} onChange={() => setFormType('QUOTE')} />
              Orçamento
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="COMPLETED" checked={formType === 'COMPLETED'} onChange={() => setFormType('COMPLETED')} />
              Venda Direta
            </label>
          </div>
        </div>

        <div>
          <label className="block mb-1 text-sm text-base-300">Cliente</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Consumidor Final</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {formType === 'COMPLETED' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block mb-1 text-sm text-base-300">Forma de pagamento</label>
              <select
                value={paymentDetails.paymentMethod}
                onChange={e => setPaymentDetails(p => ({ ...p, paymentMethod: e.target.value, installments: 1 }))}
                className="w-full p-2 border rounded"
              >
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm text-base-300">Parcelas</label>
              <Input
                type="number"
                min="1"
                value={paymentDetails.installments}
                onChange={e => setPaymentDetails(p => ({ ...p, installments: parseInt(e.target.value) || 1 }))}
                disabled={paymentDetails.paymentMethod !== 'CARTAO_CREDITO' && paymentDetails.paymentMethod !== 'BOLETO'}
              />
            </div>
          </div>
        )}
      </Card>

      <Card className="!p-4">
        <h3 className="font-bold mb-2">Adicionar Itens</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={currentItem.productId}
            onChange={e => setCurrentItem(prev => ({ ...prev, productId: e.target.value }))}
            className="col-span-3 p-2 border rounded"
          >
            <option value="">Selecione um produto</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.quantity})</option>
            ))}
          </select>
          <Input
            type="number"
            min="1"
            max={formType === 'COMPLETED' ? selectedProduct?.quantity : undefined}
            value={currentItem.quantity}
            onChange={e => setCurrentItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
          />
          <Button type="button" onClick={handleAddItem}>Adicionar</Button>
        </div>
        {itemError && <p className="text-danger mt-2">{itemError}</p>}
      </Card>

      <Card className="!p-4">
        <h3 className="font-bold mb-2">Itens</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Total</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {saleItems.map(item => (
              <tr key={item.productId}>
                <td>{item.productName}</td>
                <td>{item.quantity} x {formatCurrency(item.price)}</td>
                <td>{formatCurrency(item.quantity * item.price)}</td>
                <td>
                  <button type="button" onClick={() => handleRemoveItem(item.productId)} className="text-danger">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {saleItems.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center text-base-300 py-4">Nenhum item adicionado.</td>
              </tr>
            )}
          </tbody>
          {saleItems.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="2" className="text-right font-bold">TOTAL</td>
                <td colSpan="2" className="font-bold">{formatCurrency(totalSale)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={saleItems.length === 0 || isSaving}>
          {isSaving ? 'Salvando...' : transactionToEdit ? 'Salvar Alterações' : formType === 'QUOTE' ? 'Salvar Orçamento' : 'Registrar Venda'}
        </Button>
      </div>
    </form>
  );
};

export default SaleForm;
