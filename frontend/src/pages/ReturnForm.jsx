// frontend/src/pages/ReturnForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, Spinner } from '../components/common';

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

const ReturnForm = ({ onSave, onClose }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros para facilitar achar a venda
  const [saleSearch, setSaleSearch] = useState('');
  const [saleDateFrom, setSaleDateFrom] = useState('');
  const [saleDateTo, setSaleDateTo] = useState('');

  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [itemsToReturn, setItemsToReturn] = useState({});
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('REEMBOLSO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        // Mantemos o método existente — se não tiver, troque por api.getSales({ status: 'COMPLETED' })
        const salesData = await api.getCompletedSales();
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

  // Aplica filtros de busca/período nas vendas
  const filteredSales = useMemo(() => {
    const term = saleSearch.trim().toLowerCase();
    return (sales || []).filter((s) => {
      const d = new Date(s.createdAt || s.created_at || 0);
      const okFrom = !saleDateFrom || d >= new Date(`${saleDateFrom}T00:00:00`);
      const okTo = !saleDateTo || d <= new Date(`${saleDateTo}T23:59:59`);

      const txt =
        (s.customerName || 'Consumidor Final').toLowerCase() +
        ' ' +
        String(s.id || '').toLowerCase();

      const okText = !term || txt.includes(term);
      return okText && okFrom && okTo;
    });
  }, [sales, saleSearch, saleDateFrom, saleDateTo]);

  const selectedSale = useMemo(
    () => filteredSales.find((s) => s.id === selectedSaleId) || sales.find((s) => s.id === selectedSaleId),
    [filteredSales, sales, selectedSaleId]
  );

  const handleSaleChange = (saleId) => {
    setSelectedSaleId(saleId);
    setItemsToReturn({});
    setReason('');
  };

  const handleQuantityChange = (productId, quantity, maxQuantity) => {
    const q = Math.max(0, Math.min(Number.isFinite(quantity) ? quantity : 0, maxQuantity));
    setItemsToReturn((prev) => ({ ...prev, [String(productId)]: q }));
  };

  const totalReturnedValue = useMemo(() => {
    if (!selectedSale) return 0;
    return Object.entries(itemsToReturn).reduce((total, [productId, qty]) => {
      const item = (selectedSale.items || []).find((i) => String(i.productId) === String(productId));
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
        const saleItem = (selectedSale.items || []).find((i) => String(i.productId) === String(productId));
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
      // IMPORTANTE:
      // - REEMBOLSO: backend gera despesa financeira automaticamente na criação.
      // - CREDITO: backend cria registro em CustomerCredit automaticamente.
      // Não é necessário "process_refund" após isso.
      await api.addReturn({
        saleId: selectedSale.id,
        items: finalItems,
        reason,
        resolution, // 'REEMBOLSO' ou 'CREDITO'
      });
      onSave();
    } catch (err) {
      console.error(err);
      alert(`Erro ao registrar devolução: ${err?.response?.data?.error || err?.message || 'Desconhecido'}`);
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
      {/* FILTROS para facilitar encontrar a venda */}
      <Card className="!p-4">
        <h3 className="font-semibold mb-3">Filtrar Vendas</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Input
              id="saleSearch"
              label="Buscar por Cliente ou Nº da Venda"
              placeholder="Ex.: Maria, 7b0c-..."
              value={saleSearch}
              onChange={(e) => setSaleSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Data inicial</label>
            <input
              type="date"
              value={saleDateFrom}
              onChange={(e) => setSaleDateFrom(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Data final</label>
            <input
              type="date"
              value={saleDateTo}
              onChange={(e) => setSaleDateTo(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>
        </div>
        <p className="text-xs text-base-400 mt-2">
          Dica: deixe as datas em branco para listar todas as vendas concluídas.
        </p>
      </Card>

      {/* Seleção de venda (lista já filtrada acima) */}
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
          {filteredSales.map((s) => (
            <option key={s.id} value={s.id}>
              #{String(s.id).slice(0, 5)} - {s.customerName || 'Consumidor Final'}
              {s.createdAt ? ` (${formatDate(s.createdAt)})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Itens para devolver */}
      {selectedSale && (
        <>
          <Card className="!p-4 bg-primary-50/50 border border-primary-100">
            <h3 className="font-bold text-lg mb-3 text-primary-800">Itens a Devolver</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {(selectedSale.items || []).map((item) => {
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
                            maxQ
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
              Valor da Devolução: {formatCurrency(totalReturnedValue)}
            </div>
          </Card>

          {/* Motivo e Resolução */}
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
                  ? 'Ao salvar, será criada uma despesa no financeiro referente ao reembolso.'
                  : 'Ao salvar, o crédito é gerado automaticamente para o cliente e poderá ser usado em novas vendas.'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Ações */}
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

export default ReturnForm;
