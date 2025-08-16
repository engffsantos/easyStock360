// frontend/src/pages/CustomerDetailsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { Card, Button, Spinner } from '../components/common';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (dateString) =>
  dateString
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(dateString))
    : '-';

// Helpers de status/parcelas
const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  if (!/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
function inferStatus(rawStatus, dueDate) {
  if (rawStatus === 'PAGO') return 'PAGO';
  if (!dueDate) return rawStatus || 'PENDENTE';
  const d = parseISOWithTZ(dueDate);
  const now = new Date(`${todayISO()}T23:59:59`);
  if (rawStatus && rawStatus !== 'PENDENTE') return rawStatus;
  return d < now ? 'VENCIDO' : 'PENDENTE';
}
const statusBadgeClass = (st) => {
  const status = st || 'PENDENTE';
  const map = {
    PAGO: 'bg-primary-100 text-primary-800',
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    VENCIDO: 'bg-red-100 text-red-800',
  };
  return `px-2 py-1 rounded ${map[status] || map.PENDENTE}`;
};
const saleFinanceStatus = (sale) => {
  const payments = Array.isArray(sale?.payments) ? sale.payments : [];
  if (payments.length === 0) return sale?.status === 'COMPLETED' ? 'PAGO' : 'PENDENTE';
  const statuses = payments.map((p) => inferStatus(p.status, p.dueDate));
  if (statuses.every((s) => s === 'PAGO')) return 'PAGO';
  if (statuses.some((s) => s === 'VENCIDO')) return 'VENCIDO';
  return 'PENDENTE';
};

// Tabs simples
const Tabs = ({ tabs, active, onChange }) => (
  <div className="border-b border-base-200 flex gap-2 overflow-x-auto no-scrollbar print:hidden">
    {tabs.map((t) => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className={`px-4 py-2 rounded-t-md font-medium transition-colors whitespace-nowrap
          ${active === t.key ? 'bg-white text-base-400 border border-b-transparent border-base-200' : 'text-base-300 hover:text-base-400'}
        `}
      >
        {t.label}
      </button>
    ))}
  </div>
);

const CustomerDetailsPage = ({ customer: initialCustomer, customerId, onBack }) => {
  const [customer, setCustomer] = useState(initialCustomer || null);
  const [activeTab, setActiveTab] = useState('resumo');

  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState([]);
  const [purchases, setPurchases] = useState([]); // com payments anexados
  const [returns, setReturns] = useState([]);
  const [credits, setCredits] = useState({ totalBalance: 0, entries: [] });

  // Carrega o cliente se vier só o id
  useEffect(() => {
    (async () => {
      if (!customer && customerId) {
        try {
          const list = await api.getCustomers();
          const found = (list || []).find((c) => String(c.id) === String(customerId));
          if (found) setCustomer(found);
        } catch (e) {
          console.error('[CustomerDetailsPage] fetch customer by id failed', e);
        }
      }
    })();
  }, [customer, customerId]);

  // Carrega dados ao abrir
  useEffect(() => {
    const load = async () => {
      if (!customer?.id) return;
      try {
        setLoading(true);
        const [ints, purch, allReturns, creditData] = await Promise.all([
          api.getInteractionsByCustomerId(customer.id),
          api.getCustomerPurchases(customer.id),
          api.getReturns(),
          (api.getCustomerCredits
            ? api.getCustomerCredits(customer.id)
            : Promise.resolve({ totalBalance: 0, entries: [] })
          ).catch(() => ({ totalBalance: 0, entries: [] })),
        ]);

        // detalhe da venda para anexar parcelas e método
        const details = await Promise.all((purch || []).map((p) => api.getTransactionById(p.id).catch(() => null)));
        const byId = {};
        details.forEach((d) => { if (d?.id) byId[d.id] = d; });
        const purchWithPayments = (purch || []).map((p) => ({
          ...p,
          payments: byId[p.id]?.payments || [],
          paymentMethod: byId[p.id]?.paymentMethod || p.paymentMethod,
        }));

        setInteractions(ints || []);
        setPurchases(purchWithPayments || []);
        setReturns((allReturns || []).filter((r) => r.customerId === customer.id));
        setCredits(creditData || { totalBalance: 0, entries: [] });
      } catch (e) {
        console.error('[CustomerDetailsPage] load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customer?.id]);

  // Histórico unificado
  const history = useMemo(() => {
    const rows = [];
    interactions.forEach((i) => rows.push({
      kind: 'INTERAÇÃO',
      timestamp: i.date,
      title: i.type,
      description: i.notes,
      amount: null,
      link: null,
    }));
    purchases.forEach((p) => {
      const st = saleFinanceStatus(p);
      rows.push({
        kind: 'COMPRA',
        timestamp: p.createdAt,
        title: `Venda #${String(p.id).slice(0, 5)}`,
        description: `Status: ${st} — Itens: ${p.items?.length || 0}`,
        amount: p.total,
        link: `/receipt/${p.id}`,
      });
    });
    returns.forEach((r) => rows.push({
      kind: 'DEVOLUÇÃO',
      timestamp: r.createdAt,
      title: `Devolução #${String(r.id).slice(0, 5)} (Venda #${String(r.saleId).slice(0, 5)})`,
      description: `Resolução: ${r.resolution} — Status: ${r.status}`,
      amount: r.total ? -Math.abs(r.total) : 0,
      link: `/receipt/${r.saleId}`,
    }));
    return rows.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [interactions, purchases, returns]);

  const handlePrint = () => {
    // pequena espera garante layout estável antes de imprimir
    setTimeout(() => window.print(), 50);
  };

  if (!customer) {
    return (
      <div className="report-content">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <Button onClick={onBack}>Voltar</Button>
        </div>
        <div className="p-12 flex justify-center"><Spinner /></div>
      </div>
    );
  }

  const tabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'creditos', label: 'Créditos' },
    { key: 'compras', label: 'Compras' },
    { key: 'devolucoes', label: 'Devoluções' },
    { key: 'interacoes', label: 'Interações' },
    { key: 'historico', label: 'Histórico' },
  ];

  return (
    // IMPORTANTE: tudo dentro de .report-content para o CSS de impressão liberar só essa página
    <div className="report-content space-y-4">
      {/* Barra de ações (não imprime) */}
      <div className="flex items-center justify-between print:hidden">
        <Button onClick={onBack}>Voltar</Button>
        <div className="flex gap-2">
          <Button onClick={handlePrint}>Imprimir</Button>
        </div>
      </div>

      {/* Cabeçalho do cliente (imprime) */}
      <Card className="!p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base-400 mb-1">{customer.name}</h3>
            <p className="text-sm text-base-300">
              {customer.cpfCnpj} · {customer.phone} · {customer.address}
            </p>
            {customer.email ? <p className="text-sm text-base-300">{customer.email}</p> : null}
          </div>
          <div className="text-right">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                Number(credits.totalBalance) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              Crédito disponível: {formatCurrency(credits.totalBalance)}
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs (UI) */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Conteúdo por aba (apenas a ativa é renderizada → imprime separada) */}
      {loading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <>
          {activeTab === 'resumo' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="!p-4">
                <h3 className="font-semibold text-base-400 mb-3">Resumo de Compras</h3>
                <div className="text-sm text-base-300 space-y-1">
                  <p>Total de compras: <strong>{purchases.length}</strong></p>
                  <p>Última compra: <strong>{purchases[0]?.createdAt ? formatDate(purchases[0].createdAt) : '-'}</strong></p>
                  <p>Valor total compras: <strong>{formatCurrency(purchases.reduce((s, p) => s + (p.total || 0), 0))}</strong></p>
                </div>
              </Card>

              <Card className="!p-4">
                <h3 className="font-semibold text-base-400 mb-3">Resumo de Devoluções</h3>
                <div className="text-sm text-base-300 space-y-1">
                  <p>Total de devoluções: <strong>{returns.length}</strong></p>
                  <p>Última devolução: <strong>{returns[0]?.createdAt ? formatDate(returns[0].createdAt) : '-'}</strong></p>
                  <p>Valor total devolvido: <strong>{formatCurrency(returns.reduce((s, r) => s + (r.total || 0), 0))}</strong></p>
                </div>
              </Card>

              <Card className="!p-4 lg:col-span-2">
                <h3 className="font-semibold text-base-400 mb-3">Créditos do Cliente</h3>
                {(!credits.entries || credits.entries.length === 0) ? (
                  <p className="text-sm text-base-300">Nenhum crédito registrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-200">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase">Origem</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase">Valor</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-base-200">
                        {credits.entries.map((c) => (
                          <tr key={c.id}>
                            <td className="px-4 py-2 text-sm text-base-300">{formatDate(c.createdAt)}</td>
                            <td className="px-4 py-2 text-sm">
                              {c.returnId ? <span>Devolução #{String(c.returnId).slice(0, 5)}</span> : 'Crédito'}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium">{formatCurrency(c.amount)}</td>
                            <td className="px-4 py-2 text-sm">{formatCurrency(c.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'creditos' && (
            <Card className="!p-4">
              <h3 className="font-semibold text-base-400 mb-3">Créditos</h3>
              {(!credits.entries || credits.entries.length === 0) ? (
                <p className="text-sm text-base-300">Nenhum crédito registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Origem</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Valor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-base-200">
                      {credits.entries.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-2 text-sm text-base-300">{formatDate(c.createdAt)}</td>
                          <td className="px-4 py-2 text-sm">{c.returnId ? <span>Devolução #{String(c.returnId).slice(0, 5)}</span> : 'Crédito'}</td>
                          <td className="px-4 py-2 text-sm font-medium">{formatCurrency(c.amount)}</td>
                          <td className="px-4 py-2 text-sm">{formatCurrency(c.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'compras' && (
            <Card className="!p-4">
              <h3 className="font-semibold text-base-400 mb-3">Compras</h3>
              {purchases.length === 0 ? (
                <p className="text-sm text-base-300">Nenhuma compra encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Venda</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Valor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-base-200">
                      {purchases.map((s) => {
                        const st = saleFinanceStatus(s);
                        return (
                          <tr key={s.id}>
                            <td className="px-4 py-2 text-sm text-base-300">{formatDate(s.createdAt)}</td>
                            <td className="px-4 py-2 text-sm">#{String(s.id).slice(0, 5)}</td>
                            <td className="px-4 py-2 text-sm font-medium">{formatCurrency(s.total)}</td>
                            <td className="px-4 py-2 text-sm"><span className={statusBadgeClass(st)}>{st}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'devolucoes' && (
            <Card className="!p-4">
              <h3 className="font-semibold text-base-400 mb-3">Devoluções</h3>
              {returns.length === 0 ? (
                <p className="text-sm text-base-300">Nenhuma devolução encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Venda</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Resolução</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Valor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-base-200">
                      {returns.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2 text-sm text-base-300">{formatDate(r.createdAt)}</td>
                          <td className="px-4 py-2 text-sm">#{String(r.saleId).slice(0, 5)}</td>
                          <td className="px-4 py-2 text-sm">{r.resolution}</td>
                          <td className="px-4 py-2 text-sm font-medium">{formatCurrency(r.total)}</td>
                          <td className="px-4 py-2 text-sm">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'interacoes' && (
            <Card className="!p-4">
              <h3 className="font-semibold text-base-400 mb-3">Interações</h3>
              {interactions.length === 0 ? (
                <p className="text-sm text-base-300">Nenhuma interação registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data/Hora</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Tipo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-base-200">
                      {interactions.map((i) => (
                        <tr key={i.id}>
                          <td className="px-4 py-2 text-sm text-base-300">{formatDate(i.date)}</td>
                          <td className="px-4 py-2 text-sm">{i.type}</td>
                          <td className="px-4 py-2 text-sm">{i.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'historico' && (
            <Card className="!p-4">
              <h3 className="font-semibold text-base-400 mb-3">Histórico</h3>
              {history.length === 0 ? (
                <p className="text-sm text-base-300">Nada por aqui ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Quando</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Tipo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Título</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Descrição</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Valor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-base-200">
                      {history.map((h, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-base-300">{formatDate(h.timestamp)}</td>
                          <td className="px-4 py-2 text-sm">{h.kind}</td>
                          <td className="px-4 py-2 text-sm">{h.title}</td>
                          <td className="px-4 py-2 text-sm">{h.description}</td>
                          <td className="px-4 py-2 text-sm font-medium">{h.amount == null ? '-' : formatCurrency(h.amount)}</td>
                          <td className="px-4 py-2 text-sm">{h.link ? 'Abrir' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerDetailsPage;
