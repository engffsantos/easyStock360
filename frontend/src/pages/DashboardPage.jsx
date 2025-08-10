// frontend/src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { Card, Spinner, Input } from '../components/common';
import {
  SalesIcon,
  ReceiptIcon,
  AlertTriangleIcon,
  WalletIcon,
  MoneyIcon,
  ClockIcon,
  TargetIcon,
  RefreshCwIcon,
} from '../components/icons';

// Chart.js
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
  BarElement
);

// --------- helpers ---------
const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  if (!/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
};
const yyyymmdd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

function getRange(period) {
  const now = new Date();
  const todayStr = yyyymmdd(now);
  if (period.kind === 'today') return { start: todayStr, end: todayStr };
  if (period.kind === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: yyyymmdd(d), end: todayStr };
  }
  if (period.kind === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { start: yyyymmdd(d), end: todayStr };
  }
  // custom
  return { start: period.start, end: period.end };
}

// Lê cores do tema a partir das CSS variables (usadas na style.css)
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const rgba = (rgbTupleVar, alpha = 1) => `rgba(${css(rgbTupleVar)}, ${alpha})`;
const rgb = (rgbTupleVar) => `rgb(${css(rgbTupleVar)})`;

const METHOD_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  BOLETO: 'Boleto',
};

// --------- componente ---------
const DashboardPage = () => {
  // período
  const [period, setPeriod] = useState({ kind: '7d' }); // 'today' | '7d' | '30d' | {kind:'custom', start, end}
  const { start, end } = getRange(period);

  // estados
  const [stats, setStats] = useState(null);
  const [goals, setGoals] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ---- carregar KPI rápidos + metas
  const loadStats = async () => {
    try {
      setLoading(true);
      const [kpi, g] = await Promise.all([api.getDashboardStats(), api.getGoals().catch(() => null)]);
      setStats(kpi);
      setGoals(g || null);
    } catch (err) {
      setError('Falha ao carregar os dados do dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // ---- carregar vendas (para gráficos e comps)
  const loadSalesForPeriod = async () => {
    try {
      setLoadingCharts(true);
      const all = await api.getSales();
      // Filtra por período (createdAt)
      const s = new Date(`${start}T00:00:00`);
      const e = new Date(`${end}T23:59:59`);
      const filtered = (all || []).filter((v) => {
        const d = parseISOWithTZ(v.createdAt);
        return d >= s && d <= e;
      });
      setSales(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCharts(false);
    }
  };

  // inicial
  useEffect(() => {
    loadStats();
  }, []);

  // quando período mudar -> gráficos
  useEffect(() => {
    loadSalesForPeriod();
  }, [start, end]);

  // polling a cada 2 minutos (para KPIs e gráficos) — desligável
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      loadStats();
      loadSalesForPeriod();
    }, 120000);
    return () => clearInterval(id);
  }, [autoRefresh, start, end]);

  // --------- dados derivados ---------
  // Tendência diária de vendas (faturamento)
  const salesTrend = useMemo(() => {
    // Cria vetor de dias do período
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const labels = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      labels.push(yyyymmdd(d));
    }
    const map = Object.fromEntries(labels.map((d) => [d, 0]));
    sales.forEach((s) => {
      const key = yyyymmdd(parseISOWithTZ(s.createdAt));
      map[key] = (map[key] || 0) + Number(s.total || 0);
    });
    const data = labels.map((d) => map[d] || 0);
    return { labels, data };
  }, [sales, start, end]);

  // Top produtos (faturamento) – 5
  const topProducts = useMemo(() => {
    const totals = new Map();
    sales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const key = it.productName || `#${it.productId}`;
        totals.set(key, (totals.get(key) || 0) + Number(it.price || 0) * Number(it.quantity || 0));
      });
    });
    const arr = Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const sum = arr.reduce((a, b) => a + b.total, 0);
    return { items: arr, total: sum };
  }, [sales]);

  // A receber por forma (no período)
  const receivableByMethod = useMemo(() => {
    const acc = {};
    sales.forEach((s) => {
      if (Array.isArray(s.payments) && s.payments.length) {
        s.payments.forEach((p) => {
          // considera parcelas que vencem no período e não pagas
          if (p.status === 'PAGO') return;
          if (!p.dueDate) return;
          const d = parseISOWithTZ(p.dueDate);
          const sD = new Date(`${start}T00:00:00`);
          const eD = new Date(`${end}T23:59:59`);
          if (d >= sD && d <= eD) {
            const k = p.paymentMethod || s.paymentMethod || 'OUTRO';
            acc[k] = (acc[k] || 0) + Number(p.amount || 0);
          }
        });
      }
    });
    return acc;
  }, [sales, start, end]);

  // Progresso da meta (se houver)
  const salesSumPeriod = useMemo(() => sales.reduce((a, s) => a + Number(s.total || 0), 0), [sales]);
  const goalCurrent = goals?.monthlyRevenue ? salesSumPeriod : null;
  const goalTarget = goals?.monthlyRevenue || null;
  const goalPercent = goalCurrent && goalTarget ? Math.min(100, Math.round((goalCurrent / goalTarget) * 100)) : null;

  // --------- UI pequenos ----------
  const PeriodButtons = () => (
    <div className="flex flex-wrap items-end gap-2">
      <button
        onClick={() => setPeriod({ kind: 'today' })}
        className={`px-3 py-2 rounded text-sm ${
          period.kind === 'today' ? 'bg-primary-600 text-white' : 'bg-base-200 text-base-400'
        }`}
      >
        Hoje
      </button>
      <button
        onClick={() => setPeriod({ kind: '7d' })}
        className={`px-3 py-2 rounded text-sm ${
          period.kind === '7d' ? 'bg-primary-600 text-white' : 'bg-base-200 text-base-400'
        }`}
      >
        Últimos 7 dias
      </button>
      <button
        onClick={() => setPeriod({ kind: '30d' })}
        className={`px-3 py-2 rounded text-sm ${
          period.kind === '30d' ? 'bg-primary-600 text-white' : 'bg-base-200 text-base-400'
        }`}
      >
        Últimos 30 dias
      </button>
      <div className="flex items-center gap-2 ml-2">
        <Input
          type="date"
          value={period.kind === 'custom' ? period.start : start}
          onChange={(e) =>
            setPeriod({ kind: 'custom', start: e.target.value, end: period.kind === 'custom' ? period.end : end })
          }
          label="Início"
        />
        <Input
          type="date"
          value={period.kind === 'custom' ? period.end : end}
          onChange={(e) =>
            setPeriod({ kind: 'custom', start: period.kind === 'custom' ? period.start : start, end: e.target.value })
          }
          label="Fim"
        />
      </div>
      <button
        onClick={() => {
          setAutoRefresh((v) => !v);
        }}
        className={`ml-auto px-3 py-2 rounded text-sm flex items-center gap-2 ${
          autoRefresh ? 'bg-base-200 text-base-400' : 'bg-base-200 text-base-400 opacity-60'
        }`}
        title="Atualização automática a cada 2 minutos"
      >
        <RefreshCwIcon className="w-4 h-4" />
        Auto
      </button>
    </div>
  );

  // --------- Cores dos gráficos com o tema ---------
  const linePrimary = rgb('--color-primary-600');
  const linePrimaryFill = rgba('--color-primary-100', 0.4);

  const donutPalette = [
    rgba('--color-primary-600', 0.9),
    rgba('--color-primary-500', 0.9),
    rgba('--color-primary-400', 0.9),
    rgba('--color-primary-300', 0.9),
    rgba('--color-primary-200', 0.9),
  ];

  const barPrimary = rgba('--color-primary-600', 0.85);
  const barPrimaryHover = rgba('--color-primary-700', 0.95);

  // --------- render ---------
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-base-400">Dashboard</h1>
        <PeriodButtons />
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      )}
      {error && <div className="text-center text-danger p-12">{error}</div>}

      {!loading && stats && (
        <>
          {/* KPIs com drill-down */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Link to="/sales" className="block">
              <Card
                className="flex items-center justify-between p-6 hover:brightness-105 transition"
                style={{ borderTop: `3px solid ${rgb('--color-primary-600')}` }}
              >
                <div>
                  <p className="text-sm text-base-300 mb-1">Vendas Hoje</p>
                  <p className="text-xl font-bold text-primary-800">{stats.salesTodayCount}</p>
                </div>
                <SalesIcon className="w-8 h-8 text-primary-600" />
              </Card>
            </Link>

            <Card
              className="flex items-center justify-between p-6"
              style={{ borderTop: `3px solid var(--color-success)` }}
            >
              <div>
                <p className="text-sm text-base-300 mb-1">Valor Total Hoje</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(stats.salesTodayValue)}</p>
              </div>
              <ReceiptIcon className="w-8 h-8 text-green-500" />
            </Card>

            <Link to={`/financial?tab=receivable&status=PENDENTE&from=${start}&to=${end}`} className="block">
              <Card
                className="flex items-center justify-between p-6 hover:brightness-105 transition"
                style={{ borderTop: `3px solid var(--color-warning)` }}
              >
                <div>
                  <p className="text-sm text-base-300 mb-1">Recebíveis Pendentes</p>
                  <p className="text-xl font-bold text-yellow-600">{formatCurrency(stats.totalReceivable)}</p>
                </div>
                <WalletIcon className="w-8 h-8 text-yellow-500" />
              </Card>
            </Link>

            <Link to={`/financial?tab=payable&status=PENDENTE&from=${start}&to=${end}`} className="block">
              <Card
                className="flex items-center justify-between p-6 hover:brightness-105 transition"
                style={{ borderTop: `3px solid var(--color-danger)` }}
              >
                <div>
                  <p className="text-sm text-base-300 mb-1">Contas a Pagar</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalPayable)}</p>
                </div>
                <MoneyIcon className="w-8 h-8 text-red-500" />
              </Card>
            </Link>

            <Link to={`/financial?tab=payable&status=VENCIDO`} className="block">
              <Card
                className="flex items-center justify-between p-6 hover:brightness-105 transition"
                style={{ borderTop: `3px solid var(--color-danger)` }}
              >
                <div>
                  <p className="text-sm text-base-300 mb-1">Contas Vencidas</p>
                  <p className="text-xl font-bold text-red-700">{stats.overduePayableCount}</p>
                </div>
                <ClockIcon className="w-8 h-8 text-red-600" />
              </Card>
            </Link>

            <Link to="/products?filter=lowStock" className="block">
              <Card
                className="flex items-center justify-between p-6 hover:brightness-105 transition"
                style={{ borderTop: `3px solid var(--color-warning)` }}
              >
                <div>
                  <p className="text-sm text-base-300 mb-1">Produtos com Estoque Baixo</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.lowStockProductsCount}</p>
                </div>
                <AlertTriangleIcon className="w-8 h-8 text-yellow-500" />
              </Card>
            </Link>
          </div>

          {/* Metas (gamificação) */}
          {goals && goalTarget ? (
            <Card className="mb-6 p-5">
              <div className="flex items-center gap-3 mb-2">
                <TargetIcon className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-base-400">Meta de Receita (mês/período)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2">
                  <div className="w-full bg-base-200 rounded h-3">
                    <div
                      className="h-3 rounded"
                      style={{
                        width: `${goalPercent}%`,
                        background: goalPercent >= 70
                          ? rgb('--color-primary-600')
                          : goalPercent >= 40
                          ? 'var(--color-warning)'
                          : 'var(--color-danger)',
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm md:text-right">
                  <div>
                    Atual: <strong>{formatCurrency(goalCurrent)}</strong>
                  </div>
                  <div>
                    Meta: <strong>{formatCurrency(goalTarget)}</strong>
                  </div>
                  <div>
                    Progresso: <strong>{goalPercent}%</strong>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Gráfico de tendência */}
          <Card className="mb-6 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-base-400">
                Tendência de Vendas ({start} a {end})
              </h2>
              {loadingCharts && <Spinner />}
            </div>
            {!loadingCharts && (
              <Line
                data={{
                  labels: salesTrend.labels.map((d) =>
                    new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  ),
                  datasets: [
                    {
                      label: 'Faturamento Diário',
                      data: salesTrend.data,
                      borderColor: linePrimary,
                      backgroundColor: linePrimaryFill,
                      pointBackgroundColor: linePrimary,
                      pointBorderColor: linePrimary,
                      fill: true,
                      tension: 0.35,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: { mode: 'index', intersect: false },
                  },
                  scales: {
                    y: {
                      ticks: {
                        callback: (v) => formatCurrency(v),
                      },
                    },
                  },
                }}
              />
            )}
          </Card>

          {/* Composição: Top Produtos (doughnut) + A Receber por Forma (barra) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h2 className="text-lg font-bold text-base-400 mb-3">Top Produtos do Período</h2>
              {!loadingCharts && topProducts.items.length > 0 ? (
                <Doughnut
                  data={{
                    labels: topProducts.items.map((i) => i.name),
                    datasets: [
                      {
                        data: topProducts.items.map((i) => i.total),
                        backgroundColor: donutPalette,
                        hoverBackgroundColor: donutPalette.map(() => rgba('--color-primary-700', 0.95)),
                        borderColor: donutPalette.map(() => rgba('--color-primary-50', 1)),
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
                        },
                      },
                      legend: { position: 'bottom' },
                    },
                  }}
                />
              ) : (
                <p className="text-sm text-base-300">Sem dados para o período.</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-bold text-base-400 mb-3">A Receber por Forma (no período)</h2>
              {!loadingCharts ? (
                <Bar
                  data={{
                    labels: Object.keys(METHOD_LABEL),
                    datasets: [
                      {
                        label: 'A Receber',
                        data: Object.keys(METHOD_LABEL).map((k) => receivableByMethod[k] || 0),
                        backgroundColor: barPrimary,
                        hoverBackgroundColor: barPrimaryHover,
                        borderRadius: 6,
                        maxBarThickness: 28,
                      },
                    ],
                  }}
                  options={{
                    indexAxis: 'y',
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${METHOD_LABEL[ctx.label]}: ${formatCurrency(ctx.parsed.x)}`,
                        },
                      },
                      legend: { display: false },
                    },
                    scales: {
                      x: { ticks: { callback: (v) => formatCurrency(v) } },
                    },
                  }}
                />
              ) : (
                <Spinner />
              )}
            </Card>
          </div>

          {/* Vendas Recentes (tabela) */}
          <Card className="col-span-1 sm:col-span-2 lg:col-span-4">
            <h2 className="text-lg font-bold text-base-400 mb-4">Vendas Recentes</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-base-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Itens</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-base-200">
                  {stats.recentSales && stats.recentSales.length > 0 ? (
                    stats.recentSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-6 py-4 text-sm text-base-300">
                          {new Date(sale.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-base-400">
                          {sale.customerName || 'Consumidor Final'}
                        </td>
                        <td className="px-6 py-4 text-sm text-green-600">{formatCurrency(sale.total)}</td>
                        <td className="px-6 py-4 text-sm text-base-300">{sale.items?.length || 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-base-300">
                        Nenhuma venda recente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
};

export default DashboardPage;
