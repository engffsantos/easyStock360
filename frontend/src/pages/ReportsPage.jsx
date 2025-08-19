// frontend/src/pages/ReportsPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/api';
import { Card, Input, Spinner, ModalWrapper } from '../components/common';
import {
  TargetIcon,
  SaveIcon,
  ChartBarIcon,
  DownloadIcon,
  PrintIcon,
  AlertTriangleIcon,
} from '../components/icons';

/* ======================= Helpers ======================= */
const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  if (/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(`${s}Z`);
};
const yyyymmdd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const formatDate = (date) =>
  date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parseISOWithTZ(date)) : '-';
const todayISO = () => new Date().toISOString().slice(0, 10);

/* === Formas de pagamento (inclui CREDITO - crédito do cliente, e TRANSFERENCIA) === */
const METHOD_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Crédito',
  CARTAO_DEBITO: 'Débito',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
  CREDITO: 'Crédito do Cliente', // <<< linha virtual que vem do backend para indicar uso de crédito
  OUTRO: 'Outro',
};

/* Normaliza rótulos diversos do backend para os códigos acima */
const normalizeMethod = (m = '') => {
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = strip(String(m || '').toUpperCase()).replace(/\s+/g, '_');

  // distingue o "Crédito do Cliente" (CREDITO) do Cartão de Crédito (CARTAO_CREDITO)
  if (t === 'CREDITO' || t === 'CREDITO_DO_CLIENTE') return 'CREDITO';
  if (t.includes('TRANSFER')) return 'TRANSFERENCIA';
  if (t.includes('DEBITO')) return 'CARTAO_DEBITO';
  if (t.includes('CARTAO') && t.includes('CREDITO')) return 'CARTAO_CREDITO';
  if (['PIX', 'DINHEIRO', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA'].includes(t)) return t;

  return 'OUTRO';
};

const inferStatus = (rawStatus, dueDate) => {
  if (rawStatus === 'PAGO') return 'PAGO';
  if (!dueDate) return rawStatus || 'PENDENTE';
  const now = new Date(`${todayISO()}T23:59:59`);
  const d = parseISOWithTZ(dueDate);
  if (rawStatus && rawStatus !== 'PENDENTE') return rawStatus;
  return d < now ? 'VENCIDO' : 'PENDENTE';
};
const daysDiffInclusive = (start, end) => {
  const s = parseISOWithTZ(start);
  const e = parseISOWithTZ(end);
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, 1);
};
const withinRange = (d, start, end) => {
  if (!d) return false;
  const x = parseISOWithTZ(d);
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T23:59:59`);
  return x >= s && x <= e;
};
const sum = (arr) => arr.reduce((a, b) => a + Number(b || 0), 0);

// CSV util
const downloadCSV = (headers, rows, filename) => {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// UI helpers locais
const Button = ({ children, onClick, type = 'button', variant = 'primary', className = '', ...props }) => {
  const baseStyle = 'px-4 py-2 rounded text-white flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const style =
    variant === 'secondary'
      ? 'bg-base-400 hover:brightness-110 focus:ring-base-300'
      : 'bg-[rgb(var(--color-primary-600))] hover:brightness-110 focus:ring-[rgb(var(--color-primary-500))]';
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${style} ${className}`} {...props}>
      {children}
    </button>
  );
};

const ReportCard = ({ title, right, children }) => (
  <Card className="mb-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-base-400">{title}</h2>
      {/* Oculta ações no modo de impressão */}
      {right ? <div className="print:hidden">{right}</div> : null}
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
            <th key={i} className="p-2 border-b border-base-200 text-left font-medium text-base-600 uppercase text-xs">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const StatBadge = ({ label, value, danger = false }) => (
  <div className={`px-3 py-2 rounded-lg border ${danger ? 'border-red-300 bg-red-50' : 'border-base-200 bg-base-100'}`}>
    <div className={`text-xs ${danger ? 'text-red-600' : 'text-base-300'} flex items-center gap-1`}>
      {danger && <AlertTriangleIcon className="w-3 h-3" />} {label}
    </div>
    <div className={`font-semibold ${danger ? 'text-red-700' : 'text-base-400'}`}>{value}</div>
  </div>
);

/* ======================= Página ======================= */
const ReportsPage = () => {
  //Empresa
  const [companyInfo, setCompanyInfo] = useState(null);
  // período padrão = mês atual
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [activeTab, setActiveTab] = useState('desempenho'); // abas

  // dados
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [financial, setFinancial] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [logoBase64, setLogoBase64] = useState('');

  // metas
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [goals, setGoals] = useState({ monthlyRevenue: 0, monthlyProfit: 0 });

  // init
  useEffect(() => {
    let cancelled = false; // evita setState após unmount / StrictMode

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStart(firstDay);
    setEnd(lastDay);

    (async () => {
      try {
        const [company, s, q, p, f, c, r, g] = await Promise.all([
          api.getCompanyInfo().catch(() => ({})),
          api.getSales(),
          api.getQuotes().catch(() => []),
          api.getProducts(),
          api.getFinancialEntries(),
          api.getCustomers().catch(() => []),
          api.getReturns().catch(() => []),
          api.getGoals().catch(() => null),
        ]);

        if (cancelled) return;

        setCompanyInfo(company || null);               // <-- necessário pro Header
        setLogoBase64(company?.logoBase64 || '');

        setSales(s || []);
        setQuotes(q || []);
        setProducts(p || []);
        setFinancial(f || []);
        setCustomers(c || []);
        setReturnsList(r || []);

        if (g) setGoals({ monthlyRevenue: g.monthlyRevenue || 0, monthlyProfit: g.monthlyProfit || 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /* =================== Derivados por período =================== */
  const salesInPeriod = useMemo(
    () => (sales || []).filter((v) => withinRange(v.createdAt || v.created_at, start, end)),
    [sales, start, end]
  );

  /* ---- Parcelas no período (inclui método "CREDITO" virtual do backend) ---- */
  const paymentsInPeriod = useMemo(() => {
    const rows = [];
    (sales || []).forEach((s) => {
      const fallback = normalizeMethod(s.paymentMethod || s.payment_method || 'OUTRO');
      (s.payments || []).forEach((p, i) => {
        const due = p.dueDate || p.due_date || null;
        const method = normalizeMethod(p.paymentMethod || p.payment_method || fallback);
        if (!due || !withinRange(due, start, end)) return;
        rows.push({
          saleId: s.id,
          customerName: s.customerName || s.customer_name || 'Consumidor Final',
          parcela: i + 1,
          dueDate: due,
          amount: Number(p.amount || p.valor || 0),
          method, // agora pode ser 'CREDITO'
          status: inferStatus(p.status, due),
        });
      });
    });
    return rows;
  }, [sales, start, end]);

  const receivableByStatus = useMemo(() => {
    const acc = { PAGO: 0, PENDENTE: 0, VENCIDO: 0 };
    paymentsInPeriod.forEach((p) => (acc[p.status] += p.amount));
    return acc;
  }, [paymentsInPeriod]);

  const receivableByMethod = useMemo(() => {
    const acc = {};
    paymentsInPeriod
      .filter((p) => p.status !== 'PAGO') // foco em a receber (pendente/vencido); linhas de CREDITO normalmente vêm como PAGO
      .forEach((p) => {
        acc[p.method] = (acc[p.method] || 0) + p.amount;
      });
    return acc;
  }, [paymentsInPeriod]);

  /* === NOVO: Crédito do Cliente no período ===
   * - Utilizado em vendas: soma das parcelas com method === 'CREDITO'
   * - Gerado por devoluções: soma das devoluções com resolution === 'CREDITO'
   */
  const creditUsedRows = useMemo(
    () => paymentsInPeriod.filter((p) => p.method === 'CREDITO'),
    [paymentsInPeriod]
  );
  const creditUsedTotal = useMemo(
    () => sum(creditUsedRows.map((r) => r.amount)),
    [creditUsedRows]
  );

  const creditGeneratedRows = useMemo(() => {
    const list = (returnsList || []).filter(
      (r) =>
        withinRange(r.createdAt || r.created_at, start, end) &&
        String(r.resolution || r.type || r.tipo || '').toUpperCase() === 'CREDITO'
    );
    return list.map((r) => ({
      id: r.id,
      date: r.createdAt || r.created_at,
      customerName: r.customerName || r.customer_name || '-',
      // tenta várias chaves de valor; ajuste conforme seu backend
      amount: Number(r.total ?? r.amount ?? r.value ?? 0),
    }));
  }, [returnsList, start, end]);

  const creditGeneratedTotal = useMemo(
    () => sum(creditGeneratedRows.map((r) => r.amount)),
    [creditGeneratedRows]
  );

  // vendas por cliente
  const salesByCustomer = useMemo(() => {
    const map = new Map();
    salesInPeriod.forEach((s) => {
      const name = s.customerName || s.customer_name || 'Consumidor Final';
      const total = Number(s.total || 0);
      const bucket = map.get(name) || { name, total: 0, count: 0, last: null };
      bucket.total += total;
      bucket.count += 1;
      const created = s.createdAt || s.created_at;
      bucket.last = !bucket.last || parseISOWithTZ(created) > parseISOWithTZ(bucket.last) ? created : bucket.last;
      map.set(name, bucket);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [salesInPeriod]);

  /* =================== Estoque: filtros & métricas =================== */
  // Normalizador: remove acentos, trim e lowercase
  const normalize = useCallback((v) => {
    return String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }, []);

  // Listas únicas (preservam rótulo original; deduplicam pelo normalizado)
  const uniqueBrands = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      const label = p.marca ?? p.brand ?? '';
      const key = normalize(label);
      if (key && !map.has(key)) map.set(key, label);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products, normalize]);

  const uniqueTypes = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      const label = p.tipo ?? p.type ?? p.category ?? '';
      const key = normalize(label);
      if (key && !map.has(key)) map.set(key, label);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products, normalize]);

  // Estados como arrays (multi-seleção)
  const [filterBrands, setFilterBrands] = useState([]); // ex: ["BMW","Audi"]
  const [filterTypes, setFilterTypes] = useState([]);
  const brandRef = useRef(null);
  const typeRef = useRef(null);

  // util: ler opções selecionadas do <select multiple>
  const handleMultiChange = (setter) => (e) => {
    const values = Array.from(e.target.selectedOptions, (o) => o.value);
    setter(values);
  };

  // limpar tudo (sincroniza DOM + plugin)
  const clearAll = () => {
    setFilterBrands([]);
    setFilterTypes([]);
    [brandRef, typeRef].forEach((ref) => {
      if (!ref.current) return;
      Array.from(ref.current.options).forEach((o) => (o.selected = false));
      ref.current.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  // Filtro efetivo com comparação normalizada (marca e tipo) — agora multi
  const filteredProducts = useMemo(() => {
    const selectedBrands = (filterBrands || []).map((x) => normalize(x));
    const selectedTypes = (filterTypes || []).map((x) => normalize(x));

    return (products || []).filter((p) => {
      const b = normalize(p.marca ?? p.brand);
      const t = normalize(p.tipo ?? p.type ?? p.category);
      const byB = selectedBrands.length ? selectedBrands.includes(b) : true;
      const byT = selectedTypes.length ? selectedTypes.includes(t) : true;
      return byB && byT;
    });
  }, [products, filterBrands, filterTypes, normalize]);

  // valor e rupturas
  const inventoryValue = useMemo(() => {
    return sum(
      (filteredProducts || []).map((p) => {
        const cost = Number(p.cost || p.costPrice || p.custo || 0);
        return cost * Number(p.quantity || 0);
      })
    );
  }, [filteredProducts]);

  const lowStockCount = useMemo(() => {
    return (filteredProducts || []).filter(
      (p) => Number(p.quantity || 0) <= Number(p.minStock ?? p.min_stock ?? 0)
    ).length;
  }, [filteredProducts]);

  // metas/forecast simples
  const periodDays = useMemo(() => daysDiffInclusive(start, end), [start, end]);
  const elapsedDays = useMemo(() => {
    const s = parseISOWithTZ(start);
    const now = parseISOWithTZ(yyyymmdd(new Date()));
    const until = parseISOWithTZ(end);
    const ref = now > until ? until : now;
    return daysDiffInclusive(yyyymmdd(s), yyyymmdd(ref));
  }, [start, end]);

  const revenueSoFar = useMemo(() => sum(salesInPeriod.map((s) => s.total || 0)), [salesInPeriod]);
  const naiveForecast = useMemo(
    () => (revenueSoFar / Math.max(elapsedDays, 1)) * periodDays,
    [revenueSoFar, elapsedDays, periodDays]
  );

  // RFM (CRM light)
  const rfm = useMemo(() => {
    const map = new Map();
    (sales || []).forEach((s) => {
      const name = s.customerName || s.customer_name || 'Consumidor Final';
      const total = Number(s.total || 0);
      const created = s.createdAt || s.created_at;
      const b = map.get(name) || { name, total: 0, count: 0, last: null };
      b.total += total;
      b.count += 1;
      b.last = !b.last || parseISOWithTZ(created) > parseISOWithTZ(b.last) ? created : b.last;
      map.set(name, b);
    });
    const arr = Array.from(map.values());
    // recência em dias
    const recDays = arr.map((x) => Math.max(0, Math.ceil((new Date() - parseISOWithTZ(x.last)) / (1000 * 60 * 60 * 24))));
    const freq = arr.map((x) => x.count);
    const mon = arr.map((x) => x.total);
    const q = (xs, q) => {
      const sorted = [...xs].sort((a, b) => a - b);
      const i = Math.floor((sorted.length - 1) * q);
      return sorted[i] ?? 0;
    };
    const rCuts = [q(recDays, 0.2), q(recDays, 0.4), q(recDays, 0.6), q(recDays, 0.8)];
    const fCuts = [q(freq, 0.2), q(freq, 0.4), q(freq, 0.6), q(freq, 0.8)];
    const mCuts = [q(mon, 0.2), q(mon, 0.4), q(mon, 0.6), q(mon, 0.8)];
    const score = (val, cuts, invert = false) => {
      const s = val <= cuts[0] ? 5 : val <= cuts[1] ? 4 : val <= cuts[2] ? 3 : val <= cuts[3] ? 2 : 1;
      return invert ? 6 - s : s; // invert quando valor alto é bom
    };
    return arr
      .map((x) => {
        const rec = Math.max(0, Math.ceil((new Date() - parseISOWithTZ(x.last)) / (1000 * 60 * 60 * 24)));
        const R = score(rec, rCuts, true);
        const F = score(x.count, fCuts, false);
        const M = score(x.total, mCuts, false);
        return { ...x, R, F, M, segment: `${R}${F}${M}` };
      })
      .sort((a, b) => b.total - a.total);
  }, [sales]);

  /* =================== UI comuns =================== */
  const Header = (
    <div className="flex justify-between items-start">
      <h1 className="text-3xl font-bold text-base-900 print:text-black">Relatórios</h1>

      <div className="flex items-start gap-4">
        {(companyInfo?.logoBase64 || logoBase64) && (
          <img
            src={companyInfo?.logoBase64 || logoBase64}
            alt="Logo da empresa"
            className="w-24 h-auto object-contain"
          />
        )}

        {(companyInfo &&
          (companyInfo.name ||
            companyInfo.address ||
            companyInfo.phone ||
            companyInfo.email ||
            companyInfo.cnpj ||
            (Array.isArray(companyInfo.companySocials) && companyInfo.companySocials.length > 0))) && (
          <div className="text-sm leading-tight text-base-700 print:text-black">
            {companyInfo.name && <p className="font-semibold">{companyInfo.name}</p>}
            {companyInfo.address && <p>{companyInfo.address}</p>}
            {companyInfo.phone && <p>{companyInfo.phone}</p>}
            {companyInfo.email && <p>{companyInfo.email}</p>}
            {companyInfo.cnpj && <p>CNPJ: {companyInfo.cnpj}</p>}
            {Array.isArray(companyInfo.companySocials) && companyInfo.companySocials.length > 0 && (
              <p>Redes: {companyInfo.companySocials.filter(Boolean).join(' • ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );


  /* ======== Filtro por período (reuso em várias abas) ======== */
  const FiltersBar = (
    <Card>
      <div className="print:grid print:grid-cols-2 print:gap-4  grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input type="date" label="Data Inicial" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" label="Data Final" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {/* ações de filtro não aparecem na impressão */}
      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()} variant="secondary" title="Imprimir">
          <PrintIcon /> Imprimir
        </Button>
        <Button onClick={() => {}} title="Gerar">
          <ChartBarIcon /> Atualizar
        </Button>
      </div>
    </Card>
  );

  /* ======== Filtros de Estoque (multiselect com tags) ======== */
  const FiltersBarEstoque = (
    <Card className='mb-4 print:hidden'>
      {/* 1ª linha: filtros + ações (ações ocultas na impressão) */}
      <div className="grid grid-cols-1 m-auto md:grid-cols-3 gap-4 items-center">
        {/* MARCA (multi) */}
        <div>
          <label htmlFor="filterBrands" className="block mb-1 text-sm">Marca</label>
          <select
            ref={brandRef}
            id="filterBrands"
            multiple
            multiselect-search="true"
            multiselect-select-all="true"
            multiselect-max-items="3"
            className="w-full"
            onChange={handleMultiChange(setFilterBrands)}
          >
            {uniqueBrands.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* TIPO/CATEGORIA (multi) */}
        <div>
          <label htmlFor="filterTypes" className="block mb-1 text-sm">Tipo/Categoria</label>
          <select
            ref={typeRef}
            id="filterTypes"
            multiple
            multiselect-search="true"
            multiselect-select-all="true"
            multiselect-max-items="3"
            className="w-full "
            onChange={handleMultiChange(setFilterTypes)}
          >
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Ações no topo (direita) */}
        <div className="flex gap-2 print:hidden">
          <Button onClick={() => window.print()} variant="secondary" title="Imprimir">
            <PrintIcon /> Imprimir
          </Button>

          <Button
            onClick={() => {
              const headers = ['Produto', 'SKU', 'Qtd', 'Mínimo', 'Status'];
              const rows = filteredProducts.map((p) => [
                p.name,
                p.sku,
                p.quantity,
                p.minStock ?? p.min_stock ?? 0,
                Number(p.quantity || 0) <= Number(p.minStock ?? p.min_stock ?? 0) ? 'Abaixo do mínimo' : 'OK',
              ]);

              const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'posicao_estoque.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Exportar CSV"
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* 2ª linha: tags (esquerda) + limpar (direita) — oculta na impressão */}
      <div className=" grid grid-cols-1 md:grid-cols-3 gap-2 items-start print:hidden">
        {/* Tags selecionadas ocupam 2 colunas */}
        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          {filterBrands.map((b) => (
            <span key={`b-${b}`} className="inline-flex items-center gap-2 bg-base-100 px-2 py-1 rounded-lg text-sm">
              {b}
              <button
                className="text-danger-600"
                title="Remover"
                onClick={() => {
                  const next = filterBrands.filter((x) => x !== b);
                  setFilterBrands(next);
                  if (brandRef.current) {
                    const opt = Array.from(brandRef.current.options).find((o) => o.value === b);
                    if (opt) opt.selected = false;
                    brandRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }}
              >
                ×
              </button>
            </span>
          ))}

          {filterTypes.map((t) => (
            <span key={`t-${t}`} className="inline-flex items-center gap-2 bg-base-100 px-2 py-1 rounded-lg text-sm">
              {t}
              <button
                className="text-danger-600"
                title="Remover"
                onClick={() => {
                  const next = filterTypes.filter((x) => x !== t);
                  setFilterTypes(next);
                  if (typeRef.current) {
                    const opt = Array.from(typeRef.current.options).find((o) => o.value === t);
                    if (opt) opt.selected = false;
                    typeRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      {/* Botão limpar à direita */}
      <div className="flex mt-2">
        <button className="text-sm underline" onClick={clearAll}>
          Limpar filtros
        </button>
      </div>
    </Card>
  );


  /* =================== Blocos por aba =================== */

  // 1) Desempenho de Vendas
  const TabDesempenho = (
    <>
      {FiltersBar}
      <ReportCard title="KPIs de Vendas">
        <div className="print:grid print:grid-cols-12 print:gap-4 mb-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatBadge label="Vendas (qtd)" value={salesInPeriod.length} />
          <StatBadge label="Receita (R$)" value={formatCurrency(sum(salesInPeriod.map((s) => s.total || 0)))} />
          <StatBadge
            label="Ticket Médio"
            value={formatCurrency(
              sum(salesInPeriod.map((s) => s.total || 0)) / Math.max(salesInPeriod.length, 1)
            )}
          />
          <StatBadge
            label="Itens/Venda"
            value={(sum(salesInPeriod.map((s) => (s.items || []).length)) / Math.max(salesInPeriod.length, 1)).toFixed(2)}
          />
          <StatBadge label="Devoluções (qtd)" value={(returnsList || []).filter((r)=>withinRange(r.createdAt || r.created_at, start, end)).length} />
        </div>
      </ReportCard>
    </>
  );

  // 2) Financeiro & Análises
  const TabFinanceiro = (
    <>
      {FiltersBar}

      {/* NOVO: Crédito do Cliente no período */}
      <ReportCard
        title="Crédito do Cliente (período)"
        right={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const headers = ['Venda', 'Cliente', 'Data (parcela)', 'Valor'];
                const rows = creditUsedRows.map((r) => [
                  String(r.saleId).slice(0, 8),
                  r.customerName,
                  formatDate(r.dueDate),
                  String((r.amount || 0).toFixed(2)).replace('.', ','),
                ]);
                downloadCSV(headers, rows, 'credito_utilizado_vendas.csv');
              }}
            >
              <DownloadIcon /> Exportar “Crédito utilizado”
            </Button>
            <Button
              onClick={() => {
                const headers = ['Devolução', 'Cliente', 'Data', 'Valor'];
                const rows = creditGeneratedRows.map((r) => [
                  String(r.id).slice(0, 8),
                  r.customerName,
                  formatDate(r.date),
                  String((r.amount || 0).toFixed(2)).replace('.', ','),
                ]);
                downloadCSV(headers, rows, 'credito_gerado_devolucoes.csv');
              }}
            >
              <DownloadIcon /> Exportar “Crédito gerado”
            </Button>
          </div>
        }
      >
        <div className="print:grid print:grid-cols-2 print:gap-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatBadge label="Utilizado em vendas" value={formatCurrency(creditUsedTotal)} />
          <StatBadge label="Gerado por devoluções" value={formatCurrency(creditGeneratedTotal)} />
        </div>
      </ReportCard>

      <ReportCard title="A Receber por Status (parcelas no período)">
        <div className="print:grid print:grid-cols-3 print:gap-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatBadge label="Recebido" value={formatCurrency(receivableByStatus.PAGO || 0)} />
          <StatBadge label="Pendente" value={formatCurrency(receivableByStatus.PENDENTE || 0)} />
          <StatBadge label="Vencido" value={formatCurrency(receivableByStatus.VENCIDO || 0)} danger />
        </div>
      </ReportCard>

      <ReportCard
        title="A Receber por Forma (pendente/vencido)"
        right={
          <Button
            onClick={() => {
              const headers = ['Forma', 'Total (R$)'];
              const rows = Object.entries(receivableByMethod).map(([k, v]) => [
                METHOD_LABEL[k] || k,
                String(v.toFixed(2)).replace('.', ','),
              ]);
              downloadCSV(headers, rows, 'a_receber_por_forma.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        }
      >
        <ReportTable headers={['Forma de Pagamento', 'Total (R$)']}>
          {Object.keys(receivableByMethod).length > 0 ? (
            Object.entries(receivableByMethod).map(([k, v]) => (
              <tr key={k} className="border-t">
                <td className="p-2">{METHOD_LABEL[k] || k}</td>
                <td className="p-2">{formatCurrency(v)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="p-3 text-center text-base-300">
                Sem parcelas pendentes/vencidas no período.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>

      <ReportCard
        title="Parcelas (detalhe)"
        right={
          <Button
            onClick={() => {
              const headers = ['Venda', 'Cliente', 'Parcela', 'Vencimento', 'Forma', 'Valor', 'Status'];
              const rows = paymentsInPeriod.map((r) => [
                String(r.saleId).slice(0, 8),
                r.customerName,
                r.parcela,
                formatDate(r.dueDate),
                METHOD_LABEL[r.method] || r.method,
                String((r.amount || 0).toFixed(2)).replace('.', ','),
                r.status,
              ]);
              downloadCSV(headers, rows, 'parcelas_periodo.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        }
      >
        <ReportTable headers={['Venda', 'Cliente', 'Parcela', 'Vencimento', 'Forma', 'Valor', 'Status']}>
          {paymentsInPeriod.map((r, i) => (
            <tr key={`${r.saleId}-${i}`} className="border-t">
              <td className="p-2">{String(r.saleId).slice(0, 8)}</td>
              <td className="p-2">{r.customerName}</td>
              <td className="p-2">{r.parcela}</td>
              <td className="p-2">{formatDate(r.dueDate)}</td>
              <td className="p-2">{METHOD_LABEL[r.method] || r.method}</td>
              <td className="p-2">{formatCurrency(r.amount)}</td>
              <td className="p-2">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    r.status === 'PAGO'
                      ? 'bg-green-100 text-green-800'
                      : r.status === 'VENCIDO'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {r.status === 'PAGO' ? 'Recebido' : r.status}
                </span>
              </td>
            </tr>
          ))}
          {paymentsInPeriod.length === 0 && (
            <tr>
              <td colSpan={7} className="p-3 text-center text-base-300">
                Nenhuma parcela no período selecionado.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>
    </>
  );

  // 3) Funil de Vendas
  const conv = useMemo(() => {
    const qCount = (quotes || []).filter((q) => withinRange(q.createdAt || q.created_at, start, end)).length;
    const sCount = salesInPeriod.length;
    const rate = qCount > 0 ? (sCount / qCount) * 100 : 0;
    const qVal = sum(
      (quotes || []).filter((q) => withinRange(q.createdAt || q.created_at, start, end)).map((q) => q.total || 0)
    );
    const sVal = sum(salesInPeriod.map((s) => s.total || 0));
    return { qCount, sCount, rate, qVal, sVal };
  }, [quotes, salesInPeriod, start, end]);

  const TabFunil = (
    <>
      {FiltersBar}
      <ReportCard title="Resumo do Funil (QUOTE → COMPLETED)">
        <div className="print:grid print:grid-cols-12 print:gap-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatBadge label="Orçamentos" value={conv.qCount} />
          <StatBadge label="Vendas" value={conv.sCount} />
          <StatBadge label="Conversão (%)" value={`${conv.rate.toFixed(1)}%`} />
          <StatBadge label="Valor (Quote→Venda)" value={`${formatCurrency(conv.qVal)} → ${formatCurrency(conv.sVal)}`} />
        </div>
      </ReportCard>
    </>
  );

  // 4) Vendas por Cliente
  const TabClientesVendas = (
    <>
      {FiltersBar}
      <ReportCard
        title="Vendas por Cliente"
        right={
          <Button
            onClick={() => {
              const headers = ['Cliente', 'Total (R$)', 'Compras', 'Última Compra'];
              const rows = salesByCustomer.map((c) => [
                c.name,
                String((c.total || 0).toFixed(2)).replace('.', ','),
                c.count,
                formatDate(c.last),
              ]);
              downloadCSV(headers, rows, 'vendas_por_cliente.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        }
      >
        <ReportTable headers={['Cliente', 'Total (R$)', 'Compras', 'Última Compra']}>
          {salesByCustomer.map((c) => (
            <tr key={c.name} className="border-t">
              <td className="p-2">{c.name}</td>
              <td className="p-2">{formatCurrency(c.total)}</td>
              <td className="p-2">{c.count}</td>
              <td className="p-2">{formatDate(c.last)}</td>
            </tr>
          ))}
          {salesByCustomer.length === 0 && (
            <tr>
              <td colSpan={4} className="p-3 text-center text-base-300">
                Sem dados.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>
    </>
  );

  // 5) Metas & Previsões
  const [newGoals, setNewGoals] = useState({ monthlyRevenue: 0, monthlyProfit: 0 });
  useEffect(() => {
    setNewGoals(goals);
  }, [goals]);

  const saveGoals = async () => {
    try {
      await api.setGoals(newGoals);
      setGoals(newGoals);
      setGoalsModalOpen(false);
    } catch {
      alert('Erro ao salvar metas');
    }
  };

  const TabMetas = (
    <>
      {FiltersBar}
      <ReportCard
        title="Progresso de Metas (Receita)"
        right={
          <Button variant="secondary" onClick={() => setGoalsModalOpen(true)}>
            <TargetIcon /> Definir Metas
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatBadge label="Receita até agora" value={formatCurrency(revenueSoFar)} />
          <StatBadge label="Forecast simples" value={formatCurrency(naiveForecast)} />
          <StatBadge label="Meta do mês" value={formatCurrency(goals.monthlyRevenue || 0)} />
        </div>
      </ReportCard>
    </>
  );

  // 6) Posição de Estoque
  const TabEstoque = (
    <>
      {FiltersBarEstoque}

      <ReportCard title="Resumo de Estoque">
        <div className="print:grid print:grid-cols-3 print:gap-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatBadge label="Itens filtrados" value={filteredProducts.length} />
          <StatBadge label="Valor de Estoque (custo)" value={formatCurrency(inventoryValue)} />
          <StatBadge label="Rupturas (<= mínimo)" value={lowStockCount} danger={lowStockCount > 0} />
        </div>
      </ReportCard>

      <ReportCard title="Lista de Produtos">
        <ReportTable headers={['Produto', 'SKU', 'Qtd', 'Mínimo', 'Status']}>
          {filteredProducts.map((p) => {
            const isLow = Number(p.quantity || 0) <= Number(p.minStock ?? p.min_stock ?? 0);
            return (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-medium text-base-400">{p.name}</td>
                <td className="p-2 font-mono">{p.sku}</td>
                <td className="p-2 text-center">{p.quantity}</td>
                <td className="p-2 text-center">{p.minStock ?? p.min_stock ?? 0}</td>
                <td className={`p-2 font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                  {isLow ? 'Abaixo do mínimo' : 'OK'}
                </td>
              </tr>
            );
          })}
          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={5} className="p-3 text-center text-base-300">
                Sem itens com os filtros atuais.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>
    </>
  );

  // 7) Análise & Desempenho
  const byProduct = useMemo(() => {
    const map = new Map();
    salesInPeriod.forEach((s) => {
      (s.items || []).forEach((it) => {
        const key = it.productName || it.product_name || `#${it.productId}`;
        const total = Number(it.price || 0) * Number(it.quantity || 0);
        const b = map.get(key) || { name: key, total: 0, units: 0 };
        b.total += total;
        b.units += Number(it.quantity || 0);
        map.set(key, b);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [salesInPeriod]);

  const TabAnalise = (
    <>
      {FiltersBar}
      <ReportCard
        title="Curva ABC (por receita)"
        right={
          <Button
            onClick={() => {
              const headers = ['Produto', 'Receita', 'Unidades', 'Participação %', 'Classe'];
              const sumTot = sum(byProduct.map((x) => x.total));
              let acc = 0;
              const rows = byProduct.map((x) => {
                acc += x.total;
                const pct = sumTot > 0 ? (x.total / sumTot) * 100 : 0;
                const cum = sumTot > 0 ? (acc / sumTot) * 100 : 0;
                const klass = cum <= 80 ? 'A' : cum <= 95 ? 'B' : 'C';
                return [x.name, String(x.total.toFixed(2)).replace('.', ','), x.units, pct.toFixed(1) + '%', klass];
              });
              downloadCSV(headers, rows, 'curva_abc.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        }
      >
        <ReportTable headers={['Produto', 'Receita', 'Unidades', 'Participação', 'Classe']}>
          {(() => {
            const sumTot = sum(byProduct.map((x) => x.total));
            let acc = 0;
            return byProduct.slice(0, 50).map((x) => {
              acc += x.total;
              const pct = sumTot > 0 ? (x.total / sumTot) * 100 : 0;
              const cum = sumTot > 0 ? (acc / sumTot) * 100 : 0;
              const klass = cum <= 80 ? 'A' : cum <= 95 ? 'B' : 'C';
              return (
                <tr key={x.name} className="border-t">
                  <td className="p-2">{x.name}</td>
                  <td className="p-2 text-green-700">{formatCurrency(x.total)}</td>
                  <td className="p-2">{x.units}</td>
                  <td className="p-2">{pct.toFixed(1)}%</td>
                  <td className="p-2">{klass}</td>
                </tr>
              );
            });
          })()}
          {byProduct.length === 0 && (
            <tr>
              <td colSpan={5} className="p-3 text-center text-base-300">
                Sem dados.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>
    </>
  );

  // 8) Operacionais
  const returnsInPeriod = useMemo(
    () => (returnsList || []).filter((r) => withinRange(r.createdAt || r.created_at, start, end)),
    [returnsList, start, end]
  );
  const TabOperacionais = (
    <>
      {FiltersBar}
      <ReportCard title="Indicadores Operacionais">
        <div className="print:grid print:grid-cols-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatBadge label="Devoluções" value={returnsInPeriod.length} danger={returnsInPeriod.length > 0} />
          <StatBadge
            label="% Devolução vs Vendas"
            value={`${((returnsInPeriod.length / Math.max(salesInPeriod.length, 1)) * 100).toFixed(1)}%`}
          />
          <StatBadge label="Pedidos sem itens? (placeholder)" value="—" />
        </div>
      </ReportCard>
      <ReportCard title="Devoluções (lista)">
        <ReportTable headers={['ID', 'Cliente', 'Data', 'Status', 'Motivo']}>
          {returnsInPeriod.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{String(r.id).slice(0, 8)}</td>
              <td className="p-2">{r.customerName || r.customer_name || '-'}</td>
              <td className="p-2">{formatDate(r.createdAt || r.created_at)}</td>
              <td className="p-2">{r.status || '-'}</td>
              <td className="p-2">{r.reason || '-'}</td>
            </tr>
          ))}
          {returnsInPeriod.length === 0 && (
            <tr>
              <td colSpan={5} className="p-3 text-center text-base-300">
                Sem devoluções no período.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>
    </>
  );

  // 9) Vendas & Pipeline
  const byStage = useMemo(() => {
    const q = (quotes || []).filter((q) => withinRange(q.createdAt || q.created_at, start, end));
    const s = salesInPeriod;
    return {
      QUOTE: { count: q.length, value: sum(q.map((x) => x.total || 0)) },
      COMPLETED: { count: s.length, value: sum(s.map((x) => x.total || 0)) },
    };
  }, [quotes, salesInPeriod, start, end]);

  const TabPipeline = (
    <>
      {FiltersBar}
      <ReportCard title="Pipeline por Etapa">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-xs text-base-300 mb-1">QUOTE (orçamentos no período)</div>
            <div className="text-base-400 font-semibold">Qtd: {byStage.QUOTE.count}</div>
            <div className="text-green-700">{formatCurrency(byStage.QUOTE.value)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-base-300 mb-1">COMPLETED (vendas no período)</div>
            <div className="text-base-400 font-semibold">Qtd: {byStage.COMPLETED.count}</div>
            <div className="text-green-700">{formatCurrency(byStage.COMPLETED.value)}</div>
          </Card>
        </div>
      </ReportCard>
    </>
  );

  // 10) Clientes & Relacionamento (CRM light)
  const TabCRM = (
    <>
      {FiltersBar}
      <ReportCard
        title="RFM (Top 50 por valor)"
        right={
          <Button
            onClick={() => {
              const headers = ['Cliente', 'Total (R$)', 'Compras', 'Última Compra', 'R', 'F', 'M', 'Segmento'];
              const rows = rfm.slice(0, 50).map((x) => [
                x.name,
                String((x.total || 0).toFixed(2)).replace('.', ','),
                x.count,
                formatDate(x.last),
                x.R,
                x.F,
                x.M,
                x.segment,
              ]);
              downloadCSV(headers, rows, 'rfm_top50.csv');
            }}
          >
            <DownloadIcon /> Exportar CSV
          </Button>
        }
      >
        <ReportTable headers={['Cliente', 'Total (R$)', 'Compras', 'Última Compra', 'R', 'F', 'M', 'Segmento']}>
          {rfm.slice(0, 50).map((x) => (
            <tr key={x.name} className="border-t">
              <td className="p-2">{x.name}</td>
              <td className="p-2">{formatCurrency(x.total)}</td>
              <td className="p-2">{x.count}</td>
              <td className="p-2">{formatDate(x.last)}</td>
              <td className="p-2">{x.R}</td>
              <td className="p-2">{x.F}</td>
              <td className="p-2">{x.M}</td>
              <td className="p-2">{x.segment}</td>
            </tr>
          ))}
          {rfm.length === 0 && (
            <tr>
              <td colSpan={8} className="p-3 text-center text-base-300">
                Sem dados.
              </td>
            </tr>
          )}
        </ReportTable>
      </ReportCard>
    </>
  );

  // 11) Marketing & Atendimento
  const TabMktAtendimento = (
    <>
      {FiltersBar}
      <ReportCard title="Marketing & Atendimento">
        <p className="text-sm text-base-300">
          Para métricas completas (CAC, ROI por campanha, FRT/CSAT), habilite endpoints de <code>campaigns</code> e{' '}
          <code>tickets</code> no backend. No momento, os relatórios usam somente dados de vendas (canal/vendedor se
          presentes).
        </p>
      </ReportCard>
    </>
  );

  /* =================== Render raiz =================== */

  const tabs = [
    { key: 'desempenho', label: 'Desempenho de Vendas', node: TabDesempenho  },
    { key: 'financeiro',label: 'Financeiro & Análises', node: TabFinanceiro },
    { key: 'funil', label: 'Funil de Vendas', node: TabFunil },
    { key: 'clientes-vendas', label: 'Vendas por Cliente', node: TabClientesVendas },
    { key: 'metas', label: 'Metas & Previsões', node: TabMetas },
    { key: 'estoque', label: 'Posição de Estoque', node: (TabEstoque) },
    { key: 'analise', label: 'Análise & Desempenho', node: TabAnalise },
    { key: 'operacionais', label: 'Operacionais', node: TabOperacionais },
    { key: 'pipeline', label: 'Vendas & Pipeline', node: TabPipeline },
    { key: 'crm', label: 'Clientes & Relacionamento', node: TabCRM },
    { key: 'mkt', label: 'Marketing & Atendimento', node: TabMktAtendimento },
  ];

  return (
    // <<< IMPORTANTE PARA IMPRESSÃO >>>
    // Removemos 'report-content' do wrapper raiz para imprimir apenas a aba Estoque
    <div className="report-content space-y-6" id="printable-area">
      {Header}

      {/* Tabs - não imprimir */}
      <div className="flex flex-wrap gap-4 border-b pb-2 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`text-sm font-medium ${
              activeTab === t.key ? 'bg-base-300 text-primary-500 border-b-2 border-primary-600' : 'text-base-100'
            }`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        tabs.find((t) => t.key === activeTab)?.node || null
      )}

      {/* Modal de Metas */}
      <ModalWrapper isOpen={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title="Definir Metas">
        <div className="space-y-4">
          <Input
            label="Meta de Receita (R$)"
            type="number"
            value={newGoals.monthlyRevenue}
            onChange={(e) =>
              setNewGoals((g) => ({ ...g, monthlyRevenue: Number.parseFloat(e.target.value) || 0 }))
            }
          />
          <Input
            label="Meta de Lucro (R$)"
            type="number"
            value={newGoals.monthlyProfit}
            onChange={(e) =>
              setNewGoals((g) => ({ ...g, monthlyProfit: Number.parseFloat(e.target.value) || 0 }))
            }
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setGoalsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveGoals}>
              <SaveIcon className="mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </ModalWrapper>
    </div>
  );
};

export default ReportsPage;
