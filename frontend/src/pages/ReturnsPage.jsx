// frontend/src/pages/ReturnsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon } from '../components/icons';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(dateString));

const RESOLUTION_LABEL = {
  REEMBOLSO: 'Reembolso',
  CREDITO: 'Crédito',
};

const StatusBadge = ({ status }) => {
  const map = {
    ABERTA: 'bg-blue-100 text-blue-800',
    CONCLUIDA: 'bg-green-100 text-green-800',
    CANCELADA: 'bg-gray-100 text-gray-800',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cls}`}>
      {status}
    </span>
  );
};

const ReturnForm = ({ onSave, onClose }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [itemsToReturn, setItemsToReturn] = useState({});
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('REEMBOLSO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const salesData = await api.getCompletedSales(); // apenas vendas concluídas
        setSales(salesData || []);
      } catch (error) {
        console.error('Failed to load completed sales for return form', error);
        alert('Não foi possível carregar as vendas concluídas.');
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, []);

  const selectedSale = useMemo(() => {
    return sales.find((s) => s.id === selectedSaleId);
  }, [sales, selectedSaleId]);

  const handleSaleChange = (saleId) => {
    setSelectedSaleId(saleId);
    setItemsToReturn({});
    setReason('');
  };

  const handleQuantityChange = (productId, quantity, maxQuantity) => {
    const newQuantity = Math.max(0, Math.min(quantity, maxQuantity));
    setItemsToReturn((prev) => ({ ...prev, [String(productId)]: newQuantity }));
  };

  const totalReturnedValue = useMemo(() => {
    if (!selectedSale) return 0;
    return Object.entries(itemsToReturn).reduce((total, [productId, qty]) => {
      const item = selectedSale.items.find((i) => String(i.productId) === String(productId));
      return total + (item ? Number(item.price) * Number(qty) : 0);
    }, 0);
  }, [itemsToReturn, selectedSale]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSale) {
      alert('Selecione uma venda.');
      return;
    }

    const finalItems = Object.entries(itemsToReturn)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([productId, quantity]) => {
        const saleItem = selectedSale.items.find((i) => String(i.productId) === String(productId));
        if (!saleItem) return null;
        return {
          productId,
          quantity: Number(quantity),
          price: Number(saleItem.price),
          productName: saleItem.productName,
        };
      })
      .filter(Boolean);

    if (finalItems.length === 0) {
      alert('Selecione pelo menos um item para devolver.');
      return;
    }
    if (!reason.trim()) {
      alert('O motivo da devolução é obrigatório.');
      return;
    }

    try {
      setSaving(true);
      await api.addReturn({
        saleId: selectedSale.id,
        items: finalItems,
        reason,
        resolution,
      });
      onSave(); // parent fecha modal, recarrega lista e mostra sucesso
    } catch (err) {
      console.error(err);
      alert(
        `Erro ao registrar devolução: ${
          err?.response?.data?.error || err?.message || 'Desconhecido'
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="sale" className="block text-sm font-medium text-base-300 mb-1">
          Venda Original
        </label>
        <select
          id="sale"
          value={selectedSaleId}
          onChange={(e) => handleSaleChange(e.target.value)}
          required
          className="w-full bg-white border border-base-200 rounded-md shadow-sm p-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-base-400"
        >
          <option value="" disabled>
            Selecione uma venda para devolução
          </option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              #{String(s.id).slice(0, 5)} - {s.customerName}{' '}
              {s.createdAt ? `(${formatDate(s.createdAt)})` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedSale && (
        <>
          <Card className="!p-4 bg-primary-50/50 border border-primary-100">
            <h3 className="font-bold text-lg mb-3 text-primary-800">Itens a Devolver</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {selectedSale.items.map((item) => {
                const maxQ = Number(item.quantity) || 0;
                const current = Number(itemsToReturn[String(item.productId)] || 0);
                const subtotal = current * Number(item.price || 0);

                return (
                  <div
                    key={String(item.productId)}
                    className="grid grid-cols-5 items-center gap-3 p-2 bg-white rounded-md"
                  >
                    <span className="col-span-3 text-sm font-medium text-base-400">
                      {item.productName}
                    </span>
                    <span className="text-sm text-base-300">Vendido: {maxQ}</span>
                    <div className="flex flex-col">
                      <Input
                        label=""
                        type="number"
                        min="0"
                        step="1"
                        max={maxQ}
                        value={String(current)}
                        onChange={(e) =>
                          handleQuantityChange(
                            String(item.productId),
                            parseInt(e.target.value || '0', 10),
                            maxQ,
                          )
                        }
                      />
                      {current > 0 && (
                        <span className="text-xs text-base-300 mt-1">
                          Subtotal: <strong>{formatCurrency(subtotal)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-right mt-4 font-bold text-lg text-primary-900">
              Valor a ser Devolvido: {formatCurrency(totalReturnedValue)}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-base-300 mb-1">
                Motivo da Devolução
              </label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-base-200 rounded-md shadow-sm placeholder-base-200 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-base-400"
                required
              />
            </div>
            <div>
              <label htmlFor="resolution" className="block text-sm font-medium text-base-300 mb-1">
                Resolução
              </label>
              <select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-white border border-base-200 rounded-md shadow-sm p-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-base-400"
              >
                <option value="REEMBOLSO">{RESOLUTION_LABEL.REEMBOLSO}</option>
                <option value="CREDITO">{RESOLUTION_LABEL.CREDITO}</option>
              </select>
              <p className="text-xs text-base-300 mt-2">
                {resolution === 'REEMBOLSO'
                  ? 'Será gerada uma despesa no financeiro.'
                  : 'O crédito deverá ser controlado manualmente.'}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-base-200 mt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={saving || !selectedSaleId}>
          {saving ? 'Registrando...' : 'Registrar Devolução'}
        </Button>
      </div>
    </form>
  );
};

const ReturnsPage = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getReturns();
      setReturns(data || []);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar as devoluções.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    fetchData();
    alert('Devolução registrada com sucesso!');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      );
    }
    if (error) {
      return <div className="text-center text-red-600 p-12">{error}</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">
                Venda Original
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">
                Valor Devolvido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">
                Resolução
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-base-200">
            {returns.length > 0 ? (
              returns.map((ret) => (
                <tr key={ret.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-base-300">
                    {ret.createdAt ? formatDate(ret.createdAt) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {/* Opcional: link para o recibo */}
                    <a
                      href={`/receipt/${ret.saleId}`}
                      className="text-primary-700 hover:underline"
                      title="Abrir recibo"
                    >
                      #{String(ret.saleId).slice(0, 5)}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-base-400">
                    {ret.customerName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                    {formatCurrency(ret.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-base-300">
                    {RESOLUTION_LABEL[ret.resolution] || ret.resolution}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={ret.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12 text-base-300">
                  Nenhuma devolução registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Devoluções</h1>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <PlusIcon />
          Registrar Devolução
        </Button>
      </div>

      <Card>{renderContent()}</Card>

      <ModalWrapper isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nova Devolução">
        <ReturnForm onSave={handleSaveSuccess} onClose={() => setIsModalOpen(false)} />
      </ModalWrapper>
    </>
  );
};

export default ReturnsPage;
