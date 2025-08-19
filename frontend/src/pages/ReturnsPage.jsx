// frontend/src/pages/ReturnsPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../api/api';
import { Card, Input, ModalWrapper, Spinner } from '../components/common';
import ReturnForm from './ReturnForm';

/* ----------------------- Utils de formatação ----------------------- */
const formatCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

const formatDate = (dateString) =>
  dateString
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateString))
    : '-';

/* ----------------------- Normalizações robustas ----------------------- */
/** Normaliza status vindos do backend para {PENDENTE|CONCLUIDA|CANCELADA} */
const normalizeStatus = (s) => {
  const t = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (['PENDENTE', 'PENDING', 'ABERTA', 'OPEN'].includes(t)) return 'PENDENTE';
  if (['CONCLUIDA', 'CONCLUIDA', 'CONCLUIDO', 'CONCLUIDO', 'COMPLETED', 'DONE', 'FINALIZADA', 'FINALIZADO'].includes(t))
    return 'CONCLUIDA';
  if (['CANCELADA', 'CANCELADO', 'CANCELLED', 'CANCELED'].includes(t)) return 'CANCELADA';
  // fallback: considera como pendente para permitir ações
  return 'PENDENTE';
};

/** Normaliza resolução para {REEMBOLSO|CREDITO} */
const normalizeResolution = (r) => {
  const t = String(r || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (t.includes('CREDIT')) return 'CREDITO';
  if (['CREDITO', 'CREDITO_DO_CLIENTE'].includes(t)) return 'CREDITO';
  return 'REEMBOLSO';
};

const RES_LABEL = { REEMBOLSO: 'Reembolso', CREDITO: 'Crédito' };
const STATUS_COLORS = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  CONCLUIDA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

/* ----------------------- Botões locais ----------------------- */
const PrimaryButton = ({ children, ...p }) => (
  <button
    {...p}
    className={`px-3 py-2 rounded text-white ${p.className || ''}`}
    style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
  >
    {children}
  </button>
);
const SecondaryButton = ({ children, ...p }) => (
  <button {...p} className={`px-3 py-2 rounded bg-base-300 text-base-900 ${p.className || ''}`}>
    {children}
  </button>
);
const DangerButton = ({ children, ...p }) => (
  <button {...p} className={`px-3 py-2 rounded bg-red-600 text-white ${p.className || ''}`}>
    {children}
  </button>
);

/** Soma segura do total da devolução (caso backend ainda não envie "total") */
function sumReturnTotal(ret) {
  if (typeof ret?.total === 'number') return Number(ret.total);
  // também tenta 'amount' ou 'value' caso haja variação
  if (typeof ret?.amount === 'number') return Number(ret.amount);
  if (typeof ret?.value === 'number') return Number(ret.value);
  return (ret?.items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0);
}

/* =======================================================================
 *  Página de Devoluções
 * ======================================================================= */
const ReturnsPage = () => {
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);

  // modal de nova devolução
  const [isFormOpen, setIsFormOpen] = useState(false);

  // filtros
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resolutionFilter, setResolutionFilter] = useState('ALL');

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.getReturns();
      setReturns(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      alert('Falha ao carregar devoluções.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  /* ----------------------- Filtro com normalização ----------------------- */
  const filteredReturns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (returns || []).filter((r) => {
      const created = r.createdAt || r.created_at || r.date || null;
      const d = created ? new Date(created) : null;

      const okFrom = !dateFrom || (d && d >= new Date(`${dateFrom}T00:00:00`));
      const okTo = !dateTo || (d && d <= new Date(`${dateTo}T23:59:59`));

      const txt =
        (r.customerName || r.customer_name || '').toLowerCase() +
        ' ' +
        String(r.id || '').toLowerCase() +
        ' ' +
        String(r.saleId || r.sale_id || '').toLowerCase();

      const okText = !term || txt.includes(term);

      const normStatus = normalizeStatus(r.status);
      const okStatus = statusFilter === 'ALL' || normStatus === statusFilter;

      const normRes = normalizeResolution(r.resolution || r.type);
      const okRes = resolutionFilter === 'ALL' || normRes === resolutionFilter;

      return okText && okFrom && okTo && okStatus && okRes;
    });
  }, [returns, search, dateFrom, dateTo, statusFilter, resolutionFilter]);

  /* ----------------------- Ações ----------------------- */
  // Observação: o financeiro/crédito já é tratado na criação (POST /api/returns).
  // Aqui apenas concluímos/cancelamos via PATCH /api/returns/:id/status.
  const concludeReturn = async (ret) => {
    if (!window.confirm('Concluir esta devolução?')) return;
    try {
      await api.updateReturnStatus(ret.id, 'CONCLUIDA');
      await fetchReturns();
      alert('Devolução concluída com sucesso.');
    } catch (e) {
      console.error(e);
      alert(`Falha ao concluir devolução: ${e?.response?.data?.error || e.message}`);
    }
  };

  const cancelReturn = async (ret) => {
    if (!window.confirm('Cancelar esta devolução?')) return;
    try {
      await api.updateReturnStatus(ret.id, 'CANCELADA');
      await fetchReturns();
      alert('Devolução cancelada.');
    } catch (e) {
      console.error(e);
      alert(`Falha ao cancelar: ${e?.response?.data?.error || e.message}`);
    }
  };

  /* ----------------------- UI ----------------------- */
  const handleClearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('ALL');
    setResolutionFilter('ALL');
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Devoluções</h1>
        <PrimaryButton onClick={() => setIsFormOpen(true)}>Nova Devolução</PrimaryButton>
      </div>

      {/* Filtros */}
      <Card className="!p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <Input
              id="search"
              label="Buscar (cliente, ID de devolução ou venda)"
              placeholder="Ex.: Maria, e9431e..., 7b0c..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full"
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Resolução</label>
            <select
              value={resolutionFilter}
              onChange={(e) => setResolutionFilter(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full bg-white"
            >
              <option value="ALL">Todas</option>
              <option value="REEMBOLSO">Reembolso</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-base-200 rounded-xl text-sm w-full bg-white"
            >
              <option value="ALL">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          {/* Linha com ações dos filtros */}
          <div className="md:col-span-5 flex flex-wrap gap-2 items-center">
            <span className="text-sm text-base-400">
              Dica: deixe as datas em branco para ver todas as devoluções.
            </span>
            <SecondaryButton className="ml-auto" onClick={handleClearFilters}>
              Limpar filtros
            </SecondaryButton>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Venda</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Itens</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Resolução</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs uppercase">Ações</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-base-200">
                {filteredReturns.length > 0 ? (
                  filteredReturns.map((ret) => {
                    const total = sumReturnTotal(ret);
                    const created = ret.createdAt || ret.created_at;
                    const status = normalizeStatus(ret.status);
                    const res = normalizeResolution(ret.resolution || ret.type);

                    const canAct = status !== 'CONCLUIDA' && status !== 'CANCELADA';

                    return (
                      <tr key={ret.id}>
                        <td className="px-4 py-2 text-sm">{formatDate(created)}</td>
                        <td className="px-4 py-2 text-sm text-base-400">
                          {ret.customerName || 'Consumidor Final'}
                        </td>
                        <td className="px-4 py-2 text-sm">{String(ret.saleId || '').slice(0, 8)}</td>
                        <td className="px-4 py-2 text-sm">{(ret.items || []).length}</td>
                        <td className="px-4 py-2 text-sm font-semibold text-primary-800">
                          {formatCurrency(total)}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className="px-2 py-1 rounded bg-base-100 border border-base-200">
                            {RES_LABEL[res] || res}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded ${STATUS_COLORS[status] || 'bg-base-100'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2 flex-wrap">
                            {canAct ? (
                              <>
                                <PrimaryButton onClick={() => concludeReturn(ret)}>Concluir</PrimaryButton>
                                <DangerButton onClick={() => cancelReturn(ret)}>Cancelar</DangerButton>
                              </>
                            ) : (
                              <SecondaryButton title="Sem ações disponíveis" disabled>
                                —
                              </SecondaryButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      Nenhuma devolução encontrada com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Nova Devolução */}
      <ModalWrapper
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Registrar Devolução"
      >
        <div className="p-1">
          <ReturnForm
            onSave={() => {
              setIsFormOpen(false);
              fetchReturns();
              alert('Devolução registrada com sucesso.');
            }}
            onClose={() => setIsFormOpen(false)}
          />
        </div>
      </ModalWrapper>
    </>
  );
};

export default ReturnsPage;
