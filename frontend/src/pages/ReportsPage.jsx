// frontend/src/pages/ReportsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { Card, Input, Spinner, ModalWrapper, Select } from '../components/common';
import { TargetIcon, SaveIcon, ChartBarIcon, DownloadIcon, PrintIcon, AlertTriangleIcon } from '../components/icons';

// --------- helpers ---------
const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  if (!/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
};
const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const formatDate = (date) =>
  date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parseISOWithTZ(date)) : '-';

const Button = ({ children, onClick, type = 'button', variant = 'primary', className = '', ...props }) => {
  const baseStyle = 'px-4 py-2 rounded text-white flex items-center gap-2';
  const style =
    variant === 'secondary'
      ? 'bg-base-400 hover:brightness-110'
      : 'bg-[rgb(var(--color-primary-600))] hover:brightness-110';
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${style} ${className}`} {...props}>
      {children}
    </button>
  );
};

const ProgressBar = ({ value = 0, max = 0 }) => {
  const v = Number(value) || 0;
  const m = Math.max(Number(max) || 0, 1);
  const percent = Math.min(100, (v / m) * 100);
  const bgColor = percent >= 100 ? 'bg-primary-600' : percent >= 75 ? 'bg-primary-500' : 'bg-yellow-500';
  return (
    <div className="w-full bg-base-200 rounded h-3">
      <div className={`${bgColor} h-3 rounded`} style={{ width: `${percent}%` }} />
    </div>
  );
};

const ReportCard = ({ title, right, children }) => (
  <Card className="mb-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-base-400">{title}</h2>
      {right}
    </div>
    {children}
  </Card>
);

const ReportTable = ({ headers, children }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm border border-base-200">
      <thead className="bg-base-100">
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className="p-2 border-b border-base-200 text-left font-medium text-base-400 uppercase text-xs"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

// CSV util
const downloadCSV = (headers, rows, filename) => {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => String(c).replace(/,/g, ' ')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --------- mapeamentos reaproveitando a lógica do Financeiro ---------
const METHOD_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  BOLETO: 'Boleto',
};
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function inferStatus(rawStatus, dueDate) {
  if (rawStatus === 'PAGO') return 'PAGO';
  if (!dueDate) return rawStatus || 'PENDENTE';
  const d = parseISOWithTZ(dueDate);
  const now = new Date(`${todayISO()}T23:59:59`);
  if (rawStatus && rawStatus !== 'PENDENTE') return rawStatus;
  return d < now ? 'VENCIDO' : 'PENDENTE';
}
function mapSalesToReceivables(sales) {
  const receivables = [];
  (sales || []).forEach((s) => {
    const baseDesc = `Venda ${String(s.id).slice(0, 8)} — ${s.customerName || 'Consumidor Final'}`;
    const fallbackMethod = s.paymentMethod || 'PIX';

    if (Array.isArray(s.payments) && s.payments.length > 0) {
      const ordered = [...s.payments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      ordered.forEach((p, idx) => {
        receivables.push({
          id: p.id || `sale-${s.id}-p${idx + 1}`,
          description: `${baseDesc} (Parcela ${idx + 1})`,
          amount: Number(p.amount || 0),
          dueDate: p.dueDate || s.createdAt,
          createdAt: s.createdAt,
          paymentMethod: p.paymentMethod || fallbackMethod,
          type: 'RECEITA',
          status: inferStatus(p.status, p.dueDate),
          __source: 'sale_payment',
          __saleId: s.id,
          __installment: idx + 1,
          __paymentId: p.id || null,
          customerName: s.customerName,
        });
      });
    }
  });
  return receivables;
}

// --------- Página ---------
const ReportsPage = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  // Dados do relatório gerencial da API
  const [reportData, setReportData] = useState(null);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [newGoals, setNewGoals] = useState({ monthlyRevenue: 0, monthlyProfit: 0 });
  const [logoBase64, setLogoBase64] = useState('');

  // Dados auxiliares para enriquecer relatórios
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterMarca, setFilterMarca] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const [activeTab, setActiveTab] = useState('gerencial'); // 'gerencial' | 'estoque'

  // ---- carregamentos ----
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStart(firstDay);
    setEnd(lastDay);
    (async () => {
      try {
        const company = await api.getCompanyInfo();
        setLogoBase64(company.logoBase64);
      } catch {
        // ok
      }
      try {
        const [prods, s] = await Promise.all([api.getProducts(), api.getSales()]);
        setProducts(prods || []);
        setSales(s || []);
      } catch {
        // ok
      }
    })();
  }, []);

  const fetchReport = async () => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const report = await api.getReportsData(start, end);
      setReportData(report);
      if (report?.goals) setNewGoals(report.goals);
    } catch {
      alert('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (start && end && activeTab === 'gerencial') fetchReport();

  }, [start, end, activeTab]);

  const updateGoals = async () => {
    try {
      await api.setGoals(newGoals);
      setGoalsModalOpen(false);
      fetchReport();
    } catch {
      alert('Erro ao salvar metas');
    }
  };

  // ---- derivados / cálculos locais com base nas vendas ----
  const receivablesFromSales = useMemo(() => mapSalesToReceivables(sales), [sales]);

  const inRange = (d) => {
    if (!d) return false;
    const dt = parseISOWithTZ(d);
    const from = new Date(`${start}T00:00:00`);
    const to = new Date(`${end}T23:59:59`);
    return dt >= from && dt <= to;
  };

  const receivablesInPeriod = useMemo(
    () => receivablesFromSales.filter((r) => inRange(r.dueDate) && r.status !== 'PAGO'),
    [receivablesFromSales, start, end]
  );

  const overdueBoletos = useMemo(
    () => receivablesFromSales.filter((r) => r.paymentMethod === 'BOLETO' && inferStatus(r.status, r.dueDate) === 'VENCIDO'),
    [receivablesFromSales]
  );

  const receivableByMethod = useMemo(() => {
    const acc = {};
    receivablesInPeriod.forEach((r) => {
      const k = r.paymentMethod || 'OUTRO';
      acc[k] = (acc[k] || 0) + Number(r.amount || 0);
    });
    return acc;
  }, [receivablesInPeriod]);

  // ---- estoque (filtros) ----
  const filteredProducts = useMemo(() => {
    return (products || []).filter((p) => {
      const byMarca = filterMarca ? p.marca === filterMarca : true;
      const byTipo = filterTipo ? p.tipo === filterTipo : true;
      return byMarca && byTipo;
    });
  }, [products, filterMarca, filterTipo]);

  const uniqueMarcas = useMemo(() => [...new Set((products || []).map((p) => p.marca).filter(Boolean))], [products]);
  const uniqueTipos = useMemo(() => [...new Set((products || []).map((p) => p.tipo).filter(Boolean))], [products]);

  // ---- UI peças ----
  const Header = (
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold text-base-400">Relatórios</h1>
      {logoBase64 && <img src={logoBase64} alt="Logo da empresa" className="max-h-16" />}
    </div>
  );

  // ---- cards gerenciais ----
  const GerencialFilters = (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input type="date" label="Data Inicial" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" label="Data Final" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => setGoalsModalOpen(true)} variant="secondary">
          <TargetIcon className="mr-1" /> Metas
        </Button>
        <Button onClick={fetchReport}>
          <ChartBarIcon className="mr-1" /> Gerar Relatório
        </Button>
      </div>
    </Card>
  );

  const SummaryCard = reportData && (
    <ReportCard title="Resumo do Período">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <p className="text-sm">Receita Total</p>
          <p className="font-bold text-2xl text-primary-600">{formatCurrency(reportData.summary?.totalRevenue || 0)}</p>
          <ProgressBar value={reportData.summary?.totalRevenue || 0} max={reportData.goals?.monthlyRevenue || 0} />
          <p className="text-xs text-base-300 mt-1">
            Meta: {formatCurrency(reportData.goals?.monthlyRevenue || 0)}
          </p>
        </div>
        <div>
          <p className="text-sm">Lucro Total</p>
          <p className="font-bold text-2xl text-green-600">{formatCurrency(reportData.summary?.totalProfit || 0)}</p>
          <ProgressBar value={reportData.summary?.totalProfit || 0} max={reportData.goals?.monthlyProfit || 0} />
          <p className="text-xs text-base-300 mt-1">
            Meta: {formatCurrency(reportData.goals?.monthlyProfit || 0)}
          </p>
        </div>
        <div>
          <p className="text-sm">Custo Total</p>
          <p className="font-bold text-2xl text-yellow-600">{formatCurrency(reportData.summary?.totalCost || 0)}</p>
        </div>
        <div>
          <p className="text-sm">Vendas Realizadas</p>
          <p className="font-bold text-xl">{reportData.summary?.salesCount || 0}</p>
        </div>
        <div>
          <p className="text-sm">Ticket Médio</p>
          <p className="font-bold text-xl">{formatCurrency(reportData.summary?.averageTicket || 0)}</p>
        </div>
      </div>
    </ReportCard>
  );

  const InadimplentesCard = reportData && (
    <ReportCard
      title="Clientes Inadimplentes"
      right={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => window.print()}
            title="Imprimir"
          >
            <PrintIcon />
          </Button>
          <Button
            onClick={() => {
              const headers = ['Cliente', 'Valor', 'Vencimento'];
              const rows = (reportData.defaultingCustomers || []).map((c) => [
                c.customerName,
                String(Number(c.amountDue || 0).toFixed(2)).replace('.', ','),
                formatDate(c.dueDate),
              ]);
              downloadCSV(headers, rows, 'inadimplentes.csv');
            }}
            title="Exportar CSV"
          >
            <DownloadIcon />
          </Button>
        </div>
      }
    >
      {(reportData.defaultingCustomers || []).length > 0 ? (
        <ReportTable headers={['Cliente', 'Valor', 'Vencimento']}>
          {reportData.defaultingCustomers.map((c, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 font-medium">{c.customerName}</td>
              <td className="p-2 text-red-600">{formatCurrency(c.amountDue)}</td>
              <td className="p-2">{formatDate(c.dueDate)}</td>
            </tr>
          ))}
        </ReportTable>
      ) : (
        <p className="">Sem inadimplentes no período.</p>
      )}
    </ReportCard>
  );

  const RecebiveisCard = (
    <ReportCard
      title="A Receber no Período (Parcelas de Vendas)"
      right={
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const headers = ['Cliente', 'Descrição', 'Vencimento', 'Valor', 'Forma', 'Status'];
              const rows = receivablesInPeriod.map((r) => [
                r.customerName || '-',
                r.description,
                formatDate(r.dueDate),
                String(Number(r.amount || 0).toFixed(2)).replace('.', ','),
                METHOD_LABEL[r.paymentMethod] || r.paymentMethod || '-',
                inferStatus(r.status, r.dueDate),
              ]);
              downloadCSV(headers, rows, 'a_receber_periodo.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatBadge label="Quantidade" value={receivablesInPeriod.length} />
        <StatBadge
          label="Soma"
          value={formatCurrency(receivablesInPeriod.reduce((s, r) => s + Number(r.amount || 0), 0))}
        />
        <StatBadge
          label="Boletos Vencidos"
          value={overdueBoletos.length}
          danger={overdueBoletos.length > 0}
        />
      </div>

      {receivablesInPeriod.length > 0 ? (
        <ReportTable headers={['Cliente', 'Descrição', 'Vencimento', 'Valor', 'Forma', 'Status']}>
          {receivablesInPeriod.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.customerName || '-'}</td>
              <td className="p-2">{r.description}</td>
              <td className="p-2">{formatDate(r.dueDate)}</td>
              <td className="p-2">{formatCurrency(r.amount)}</td>
              <td className="p-2">{METHOD_LABEL[r.paymentMethod] || r.paymentMethod || '-'}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  inferStatus(r.status, r.dueDate) === 'VENCIDO'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {inferStatus(r.status, r.dueDate)}
                </span>
              </td>
            </tr>
          ))}
        </ReportTable>
      ) : (
        <p className="text-base-300">Nada a receber nas datas selecionadas.</p>
      )}
    </ReportCard>
  );

  const PorFormaCard = (
    <ReportCard title="A Receber por Forma de Pagamento (Período)">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'].map((m) => (
          <MiniKPI
            key={m}
            label={METHOD_LABEL[m]}
            value={formatCurrency(receivableByMethod[m] || 0)}
          />
        ))}
      </div>
      <p className="text-xs text-base-300 mt-2">
        Baseado nas <strong>parcelas de vendas</strong> com vencimento entre {formatDate(start)} e {formatDate(end)} e status pendente/vencido.
      </p>
    </ReportCard>
  );

  const EstoqueCard = (
    <ReportCard
      title="Relatório de Estoque"
      right={
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const headers = ['Produto', 'SKU', 'Qtd. Estoque', 'Estoque Mínimo', 'Status'];
              const rows = filteredProducts.map((p) => [
                p.name,
                p.sku,
                p.quantity,
                p.min_stock,
                p.quantity < p.min_stock ? 'Abaixo do mínimo' : 'OK',
              ]);
              downloadCSV(headers, rows, 'relatorio_estoque.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <PrintIcon /> Imprimir
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-4 mb-4">
        <Select label="Filtrar por Marca" value={filterMarca} onChange={(e) => setFilterMarca(e.target.value)}>
          <option value="">Todas</option>
          {uniqueMarcas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Select label="Filtrar por Tipo" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
          <option value="">Todos</option>
          {uniqueTipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <ReportTable headers={['Produto', 'SKU', 'Qtd. Estoque', 'Estoque Mínimo', 'Status']}>
        {filteredProducts.map((p) => {
          const isLow = p.quantity < p.min_stock;
          return (
            <tr key={p.id} className="border-t">
              <td className="p-2 font-medium text-base-400">{p.name}</td>
              <td className="p-2 font-mono">{p.sku}</td>
              <td className="p-2 text-center">{p.quantity}</td>
              <td className="p-2 text-center">{p.min_stock}</td>
              <td className={`p-2 font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                {isLow ? 'Abaixo do mínimo' : 'OK'}
              </td>
            </tr>
          );
        })}
      </ReportTable>
    </ReportCard>
  );

  // ---- render ----
  return (
    <div className="space-y-6">
      {Header}

      <div className="flex space-x-4 border-b pb-2">
        <button
          className={`text-sm font-medium ${activeTab === 'gerencial' ? 'text-primary-600 border-b-2 border-primary-600' : ''}`}
          onClick={() => setActiveTab('gerencial')}
        >
          Relatório Gerencial
        </button>
        <button
          className={`text-sm font-medium ${activeTab === 'estoque' ? 'text-primary-600 border-b-2 border-primary-600' : ''}`}
          onClick={() => setActiveTab('estoque')}
        >
          Relatório de Estoque
        </button>
      </div>

      {activeTab === 'gerencial' && (
        <>
          {GerencialFilters}
          {loading && (
            <div className="flex justify-center p-12">
              <Spinner />
            </div>
          )}

          {!loading && (
            <>
              {reportData && SummaryCard}
              {InadimplentesCard}
              {RecebiveisCard}
              {PorFormaCard}
            </>
          )}
        </>
      )}

      {activeTab === 'estoque' && EstoqueCard}

      <ModalWrapper isOpen={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title="Definir Metas">
        <div className="space-y-4">
          <Input
            label="Meta de Receita (R$)"
            type="number"
            value={newGoals.monthlyRevenue}
            onChange={(e) => setNewGoals((g) => ({ ...g, monthlyRevenue: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Meta de Lucro (R$)"
            type="number"
            value={newGoals.monthlyProfit}
            onChange={(e) => setNewGoals((g) => ({ ...g, monthlyProfit: parseFloat(e.target.value) || 0 }))}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setGoalsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={updateGoals}>
              <SaveIcon className="mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </ModalWrapper>
    </div>
  );
};

// ---- pequenos componentes ----
const StatBadge = ({ label, value, danger = false }) => (
  <div className={`px-3 py-2 rounded-lg border ${danger ? 'border-red-300 bg-red-50' : 'border-base-200 bg-base-100'}`}>
    <div className={`text-xs ${danger ? 'text-red-600' : 'text-base-300'} flex items-center gap-1`}>
      {danger && <AlertTriangleIcon className="w-3 h-3" />} {label}
    </div>
    <div className={`font-semibold ${danger ? 'text-red-700' : 'text-base-400'}`}>{value}</div>
  </div>
);

const MiniKPI = ({ label, value }) => (
  <Card className="text-center py-3">
    <div className="text-xs text-base-300">{label}</div>
    <div className="text-lg font-bold text-base-400">{value}</div>
  </Card>
);

export default ReportsPage;
