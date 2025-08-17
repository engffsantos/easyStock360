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
  Filler,
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

/* ===================== Helpers ===================== */

// Datas
const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  // 1) YYYY-MM-DD → meia-noite local
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  // 2) ISO já com timezone
  if (/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // 3) ISO sem timezone → assume UTC
  return new Date(`${s}Z`);
};
const yyyymmdd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hh = (d) => `${String(d.getHours()).padStart(2, '0')}:00`;
const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const todayISO = () => new Date().toISOString().slice(0, 10);

const isBetweenInclusive = (date, start, end) => {
  const d = parseISOWithTZ(date);
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T23:59:59`);
  return d >= s && d <= e;
};

// Status a partir do dueDate quando backend não define
const inferStatus = (rawStatus, dueDate) => {
  if (rawStatus === 'PAGO') return 'PAGO';
  if (!dueDate) return rawStatus || 'PENDENTE';
  const now = new Date(`${todayISO()}T23:59:59`);
  const d = parseISOWithTZ(dueDate);
  if (rawStatus && rawStatus !== 'PENDENTE') return rawStatus;
  return d < now ? 'VENCIDO' : 'PENDENTE';
};

// Período
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
  return { start: period.start, end: period.end };
}

/* ======= Formas de pagamento (normalização e labels) ======= */

const METHOD_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  BOLETO: 'Boleto',
  OUTRO: 'Outro',
};

const normalizeMethod = (m = '') => {
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = strip(String(m || '').toUpperCase()).replace(/\s+/g, '_');
  if (t.includes('DEBITO')) return 'CARTAO_DEBITO';
  if (t.includes('CREDITO')) return 'CARTAO_CREDITO';
  if (t === 'CARTAO') return 'CARTAO_CREDITO';
  if (t === 'PIX' || t === 'DINHEIRO' || t === 'BOLETO') return t;
  if (t === 'CARTAO_CREDITO' || t === 'CARTAO_DEBITO') return t;
  return 'OUTRO';
};

const METHOD_KEYS = ['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'OUTRO'];
const STATUS_KEYS = ['PAGO', 'PENDENTE', 'VENCIDO'];

// Badges e cores p/ status
const statusBadgeClass = (st) => {
  const map = {
    PAGO: 'bg-green-100 text-green-800',
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    VENCIDO: 'bg-red-100 text-red-800',
  };
  return `px-2 py-1 rounded text-xs ${map[st] || map.PENDENTE}`;
};
const statusFill = {
  PAGO: 'rgba(16,185,129,0.85)', // verde
  PENDENTE: 'rgba(234,179,8,0.85)', // amarelo
  VENCIDO: 'rgba(239,68,68,0.85)', // vermelho
};
const statusHover = {
  PAGO: 'rgba(16,185,129,0.95)',
  PENDENTE: 'rgba(234,179,8,0.95)',
  VENCIDO: 'rgba(239,68,68,0.95)',
};

// Normalização de venda e parcelas (snake/camel)
const normalizeSalePayment = (p = {}, fallbackMethod = 'PIX') => {
  const amount = p.amount ?? p.valor ?? 0;
  const dueDate = p.dueDate ?? p.due_date ?? p.vencimento ?? null;
  const paymentMethod = (p.paymentMethod ?? p.payment_method ?? fallbackMethod ?? 'OUTRO') || 'OUTRO';
  const status = p.status || 'PENDENTE';
  return {
    id: p.id,
    amount: Number(amount || 0),
    dueDate,
    paymentMethod: normalizeMethod(paymentMethod),
    status,
  };
};

const normalizeSale = (sale) => {
  if (!sale) return sale;
  const normalized = {
    ...sale,
    id: sale.id,
    customerName: sale.customerName ?? sale.customer_name,
    status: sale.status,
    subtotal: sale.subtotal,
    discountType: sale.discountType ?? sale.discount_type,
    discountValue: sale.discountValue ?? sale.discount_value,
    freight: sale.freight,
    total: sale.total,
    paymentMethod: normalizeMethod(sale.paymentMethod ?? sale.payment_method ?? 'OUTRO'),
    installments: sale.installments,
    validUntil: sale.validUntil ?? sale.valid_until,
    createdAt: sale.createdAt ?? sale.created_at,
    items: (sale.items || []).map((it) => ({
      ...it,
      productName: it.productName ?? it.product_name,
    })),
  };
  const fallbackMethod = normalized.paymentMethod || 'OUTRO';
  const rawPayments = Array.isArray(sale.payments) ? sale.payments : [];
  normalized.payments = rawPayments.map((p) => normalizeSalePayment(p, fallbackMethod));
  return normalized;
};

/* ===================== Componente ===================== */

const DashboardPage = () => {
  // período
  const [period, setPeriod] = useState({ kind: '7d' });
  const { start, end } = getRange(period);

  // estados
  const [stats, setStats] = useState(null);
  const [goals, setGoals] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showRecvDebug, setShowRecvDebug] = useState(false);

  // carregar KPIs + metas
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

  // carregar vendas
  const loadSalesForPeriod = async () => {
    try {
      setLoadingCharts(true);
      const all = await api.getSales();
      const normalized = (all || []).map(normalizeSale);

      // filtro para o gráfico de tendência; (createdAt da venda)
      const s = new Date(`${start}T00:00:00`);
      const e = new Date(`${end}T23:59:59`);
      const filtered = normalized.filter((v) => {
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

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadSalesForPeriod();
  }, [start, end]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      loadStats();
      loadSalesForPeriod();
    }, 120000);
    return () => clearInterval(id);
  }, [autoRefresh, start, end]);

  /* ===== Tendência (hoje por hora; demais por dia) ===== */
  const salesTrend = useMemo(() => {
    if (period.kind === 'today') {
      const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
      const map = Object.fromEntries(labels.map((h) => [h, 0]));
      (sales || []).forEach((s) => {
        const d = parseISOWithTZ(s.createdAt);
        const key = hh(d);
        map[key] = (map[key] || 0) + Number(s.total || 0);
      });
      const data = labels.map((h) => map[h] || 0);
      return { labels, data, mode: 'hour' };
    }
    // por dia
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const labels = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      labels.push(yyyymmdd(d));
    }
    const map = Object.fromEntries(labels.map((d) => [d, 0]));
    (sales || []).forEach((s) => {
      const key = yyyymmdd(parseISOWithTZ(s.createdAt));
      map[key] = (map[key] || 0) + Number(s.total || 0);
    });
    const data = labels.map((d) => map[d] || 0);
    return { labels, data, mode: 'day' };
  }, [sales, start, end, period.kind]);

  /* ===== Top produtos ===== */
  const topProducts = useMemo(() => {
    const totals = new Map();
    (sales || []).forEach((s) => {
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

  /* ===== A Receber/Recebido por forma e status (usa dueDate da parcela) ===== */
  const receivableByMethodStatus = useMemo(() => {
    const acc = {};
    METHOD_KEYS.forEach((m) => {
      acc[m] = { PAGO: 0, PENDENTE: 0, VENCIDO: 0 };
    });

    (sales || []).forEach((s) => {
      (s.payments || []).forEach((p) => {
        const dueDate = p.dueDate ?? null;
        if (!dueDate) return;
        if (!isBetweenInclusive(dueDate, start, end)) return;
        const st = inferStatus(p.status, dueDate); // PAGO|PENDENTE|VENCIDO
        const method = normalizeMethod(p.paymentMethod || s.paymentMethod || 'OUTRO');
        if (!acc[method]) acc[method] = { PAGO: 0, PENDENTE: 0, VENCIDO: 0 };
        acc[method][st] += Number(p.amount || 0);
      });
    });

    return acc;
  }, [sales, start, end]);

  // Linhas consideradas (debug)
  const receivableRows = useMemo(() => {
    const rows = [];
    (sales || []).forEach((s) => {
      (s.payments || []).forEach((p, idx) => {
        const due = p.dueDate ?? null;
        if (!due || !isBetweenInclusive(due, start, end)) return;
        const st = inferStatus(p.status, due);
        const method = normalizeMethod(p.paymentMethod || s.paymentMethod || 'OUTRO');
        rows.push({
          saleId: s.id,
          customerName: s.customerName || 'Consumidor Final',
          parcela: idx + 1,
          dueDate: due,
          paymentMethod: method,
          amount: Number(p.amount || 0),
          status: st,
        });
      });
    });
    return rows;
  }, [sales, start, end]);

  // Soma total por método (para suggestedMax)
  const receivableMaxSuggested = useMemo(() => {
    const totals = METHOD_KEYS.map((m) =>
      STATUS_KEYS.reduce((sum, st) => sum + (receivableByMethodStatus[m]?.[st] || 0), 0)
    );
    const max = Math.max(0, ...totals);
    return max > 0 ? max * 1.15 : 100;
  }, [receivableByMethodStatus]);

  /* ===== Cores do tema p/ outros gráficos ===== */
  const { linePrimary, linePrimaryFill, donutPalette } = useMemo(() => {
    const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const rgba = (rgbTupleVar, alpha = 1) => `rgba(${css(rgbTupleVar)}, ${alpha})`;
    const rgb = (rgbTupleVar) => `rgb(${css(rgbTupleVar)})`;
    return {
      linePrimary: rgb('--color-primary-600'),
      linePrimaryFill: rgba('--color-primary-100', 0.4),
      donutPalette: [
        rgba('--color-primary-600', 0.9),
        rgba('--color-primary-500', 0.9),
        rgba('--color-primary-400', 0.9),
        rgba('--color-primary-300', 0.9),
        rgba('--color-primary-200', 0.9),
      ],
    };
  }, []);

  /* ===== UI: botões de período ===== */
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
        onClick={() => setAutoRefresh((v) => !v)}
        className={`ml-auto px-3 py-2 rounded text-sm flex items-center gap-2 ${
          autoRefresh ? 'bg-base-200 text-base-400' : 'bg-base-200 text-base-400 opacity-60'
        }`}
        title="Atualiza a cada 2 minutos"
      >
        <RefreshCwIcon className="w-4 h-4" />
        Auto
      </button>
    </div>
  );

  /* ===================== Render ===================== */
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
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Link to="/sales" className="block">
              <Card
                className="flex items-center justify-between p-6 hover:brightness-105 transition"
                style={{ borderTop: '3px solid rgb(var(--color-primary-600))' }}
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
              style={{ borderTop: '3px solid var(--color-success)' }}
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
                style={{ borderTop: '3px solid var(--color-warning)' }}
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
                style={{ borderTop: '3px solid var(--color-danger)' }}
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
                style={{ borderTop: '3px solid var(--color-danger)' }}
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
                style={{ borderTop: '3px solid var(--color-warning)' }}
              >
                <div>
                  <p className="text-sm text-base-300 mb-1">Produtos com Estoque Baixo</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.lowStockProductsCount}</p>
                </div>
                <AlertTriangleIcon className="w-8 h-8 text-yellow-500" />
              </Card>
            </Link>
          </div>

          {/* Metas */}
          {goals?.monthlyRevenue ? (
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
                        width: `${Math.min(100, Math.round((stats.salesPeriodValue / goals.monthlyRevenue) * 100))}%`,
                        background:
                          Math.min(100, Math.round((stats.salesPeriodValue / goals.monthlyRevenue) * 100)) >= 70
                            ? 'rgb(var(--color-primary-600))'
                            : Math.min(100, Math.round((stats.salesPeriodValue / goals.monthlyRevenue) * 100)) >= 40
                            ? 'var(--color-warning)'
                            : 'var(--color-danger)',
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm md:text-right">
                  <div>
                    Atual: <strong>{formatCurrency(stats.salesPeriodValue || 0)}</strong>
                  </div>
                  <div>
                    Meta: <strong>{formatCurrency(goals.monthlyRevenue || 0)}</strong>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Tendência */}
          <Card className="mb-6 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-base-400">
                {period.kind === 'today' ? `Tendência de Vendas (Hoje por hora)` : `Tendência de Vendas (${start} a ${end})`}
              </h2>
              {loadingCharts && <Spinner />}
            </div>
            {!loadingCharts && (
              <Line
                data={{
                  labels:
                    salesTrend.mode === 'hour'
                      ? salesTrend.labels // "HH:00"
                      : salesTrend.labels.map((d) =>
                          new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        ),
                  datasets: [
                    {
                      label: salesTrend.mode === 'hour' ? 'Faturamento por hora' : 'Faturamento diário',
                      data: salesTrend.data,
                      borderColor: 'rgb(var(--color-primary-600))',
                      backgroundColor: 'rgba(var(--color-primary-100), 0.4)',
                      pointBackgroundColor: 'rgb(var(--color-primary-600))',
                      pointBorderColor: 'rgb(var(--color-primary-600))',
                      fill: true,
                      tension: 0.35,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                      callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y) },
                    },
                  },
                  scales: {
                    y: { ticks: { callback: (v) => formatCurrency(v) } },
                  },
                }}
              />
            )}
          </Card>

          {/* Top produtos + A Receber/Recebido por Forma */}
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
                        hoverBackgroundColor: donutPalette.map(() => 'rgba(var(--color-primary-700), 0.95)'),
                        borderColor: donutPalette.map(() => 'rgba(var(--color-primary-50), 1)'),
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    plugins: {
                      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } },
                      legend: { position: 'bottom' },
                    },
                  }}
                />
              ) : (
                <p className="text-sm text-base-300">Sem dados para o período.</p>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-base-400">A Receber/Recebido por Forma (no período)</h2>
                <div className="flex items-center gap-2">
                  <span className={statusBadgeClass('PAGO')}>Recebido</span>
                  <span className={statusBadgeClass('PENDENTE')}>Pendente</span>
                  <span className={statusBadgeClass('VENCIDO')}>Vencido</span>
                  <button
                    className="text-xs px-2 py-1 rounded bg-base-200 ml-2"
                    onClick={() => setShowRecvDebug((v) => !v)}
                    title="Mostrar/ocultar depuração"
                  >
                    {showRecvDebug ? 'Ocultar debug' : 'Mostrar debug'}
                  </button>
                </div>
              </div>

              {!loadingCharts ? (
                <>
                  <Bar
                    data={{
                      labels: METHOD_KEYS.map((k) => METHOD_LABEL[k] || k),
                      datasets: STATUS_KEYS.map((st) => ({
                        label: st === 'PAGO' ? 'Recebido' : st,
                        data: METHOD_KEYS.map((m) => receivableByMethodStatus[m]?.[st] || 0),
                        backgroundColor: statusFill[st],
                        hoverBackgroundColor: statusHover[st],
                        borderRadius: 6,
                        maxBarThickness: 28,
                        stack: 'status',
                      })),
                    }}
                    options={{
                      indexAxis: 'y',
                      plugins: {
                        legend: { display: true, position: 'bottom' },
                        tooltip: {
                          callbacks: {
                            title: (items) => items?.[0]?.label || '',
                            label: (ctx) => {
                              const label = ctx.dataset.label || '';
                              const val = ctx.parsed?.x || 0;
                              return `${label}: ${formatCurrency(val)}`;
                            },
                            footer: (items) => {
                              const methodIdx = items?.[0]?.dataIndex ?? -1;
                              if (methodIdx < 0) return '';
                              const mKey = METHOD_KEYS[methodIdx];
                              const total = STATUS_KEYS.reduce(
                                (s, st) => s + (receivableByMethodStatus[mKey]?.[st] || 0),
                                0
                              );
                              return `Total: ${formatCurrency(total)}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          stacked: true,
                          ticks: { callback: (v) => formatCurrency(v) },
                          suggestedMax: receivableMaxSuggested,
                        },
                        y: { stacked: true },
                      },
                    }}
                  />

                  {showRecvDebug && (
                    <div className="overflow-x-auto mt-4">
                      <table className="min-w-full text-xs border">
                        <thead className="bg-base-100">
                          <tr>
                            <th className="p-2 text-left">Venda</th>
                            <th className="p-2 text-left">Cliente</th>
                            <th className="p-2 text-left">Parcela</th>
                            <th className="p-2 text-left">Vencimento</th>
                            <th className="p-2 text-left">Forma</th>
                            <th className="p-2 text-right">Valor</th>
                            <th className="p-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receivableRows.map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{String(r.saleId).slice(0, 8)}</td>
                              <td className="p-2">{r.customerName}</td>
                              <td className="p-2">{r.parcela}</td>
                              <td className="p-2">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
                              <td className="p-2">{METHOD_LABEL[r.paymentMethod] || r.paymentMethod || '-'}</td>
                              <td className="p-2 text-right">{formatCurrency(r.amount)}</td>
                              <td className="p-2">
                                <span className={statusBadgeClass(r.status)}>
                                  {r.status === 'PAGO' ? 'Recebido' : r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {receivableRows.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-3 text-center text-base-300">
                                Nada a exibir
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <Spinner />
              )}
            </Card>
          </div>

          {/* Vendas Recentes */}
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
                          {new Date(sale.createdAt || sale.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-base-400">
                          {sale.customerName || sale.customer_name || 'Consumidor Final'}
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
