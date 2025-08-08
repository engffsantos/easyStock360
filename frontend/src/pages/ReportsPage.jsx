//frontend/src/pages/ReportsPage.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { Card, Input, Spinner, ModalWrapper, Select } from '../components/common';
import { TargetIcon, SaveIcon, ChartBarIcon, DownloadIcon, PrintIcon } from '../components/icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (date) => new Date(date).toLocaleDateString('pt-BR');

const Button = ({ children, onClick, type = 'button', variant = 'primary', className = '', ...props }) => {
  const baseStyle = 'px-4 py-2 rounded text-white flex items-center';
  const style = variant === 'secondary'
    ? 'bg-base-400 hover:brightness-110'
    : 'bg-[rgb(var(--color-primary-600))] hover:brightness-110';
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${style} ${className}`} {...props}>
      {children}
    </button>
  );
};

const ProgressBar = ({ value, max }) => {
  const percent = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-base-200 rounded h-3">
      <div className="bg-primary-500 h-3 rounded" style={{ width: `${percent}%` }} />
    </div>
  );
};

const ReportCard = ({ title, children }) => (
  <Card className="mb-6">
    <h2 className="text-xl font-bold text-base-400 mb-4">{title}</h2>
    {children}
  </Card>
);

const downloadCSV = (data, filename) => {
  const headers = ['Produto', 'SKU', 'Qtd. Estoque', 'Estoque Mínimo', 'Status'];
  const rows = data.map(p => [
    p.name,
    p.sku,
    p.quantity,
    p.min_stock,
    p.quantity < p.min_stock ? 'Abaixo do mínimo' : 'OK'
  ]);
  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const ReportsPage = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoBase64, setLogoBase64] = useState('');
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [newGoals, setNewGoals] = useState({ monthlyRevenue: 0, monthlyProfit: 0 });
  const [activeTab, setActiveTab] = useState('gerencial');
  const [products, setProducts] = useState([]);
  const [filterMarca, setFilterMarca] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const fetchReport = async () => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const report = await api.getReportsData(start, end);
      setReportData(report);
    } catch {
      alert('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogo = async () => {
    try {
      const company = await api.getCompanyInfo();
      setLogoBase64(company.logoBase64);
    } catch {
      console.warn('Logo não encontrada');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.getProducts();
      setProducts(response);
    } catch {
      alert('Erro ao carregar produtos');
    }
  };

  const updateGoals = async () => {
    try {
      await api.setGoals(newGoals);
      setGoalsModalOpen(false);
      fetchReport();
    } catch {
      alert('Erro ao salvar metas');
    }
  };

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStart(firstDay);
    setEnd(lastDay);
    fetchLogo();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (start && end && activeTab === 'gerencial') fetchReport();
  }, [start, end, activeTab]);

  const filteredProducts = products.filter(p => {
    const byMarca = filterMarca ? p.marca === filterMarca : true;
    const byTipo = filterTipo ? p.tipo === filterTipo : true;
    return byMarca && byTipo;
  });

  const uniqueMarcas = [...new Set(products.map(p => p.marca))];
  const uniqueTipos = [...new Set(products.map(p => p.tipo).filter(Boolean))];

  const renderEstoqueTable = () => (
    <ReportCard title="Relatório de Estoque">
      <div className="flex flex-wrap gap-4 mb-4">
        <Select label="Filtrar por Marca" value={filterMarca} onChange={(e) => setFilterMarca(e.target.value)}>
          <option value="">Todas</option>
          {uniqueMarcas.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select label="Filtrar por Tipo" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
          <option value="">Todos</option>
          {uniqueTipos.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Button onClick={() => downloadCSV(filteredProducts, 'relatorio_estoque.csv')}><DownloadIcon className="mr-2" />Exportar CSV</Button>
        <Button onClick={() => window.print()}><PrintIcon className="mr-2" />Imprimir</Button>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left ">
            <th className="p-2">Produto</th>
            <th className="p-2">SKU</th>
            <th className="p-2 text-center">Qtd. Estoque</th>
            <th className="p-2 text-center">Estoque Mínimo</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map((p) => {
            const isLow = p.quantity < p.min_stock;
            return (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-medium text-base-400">{p.name}</td>
                <td className="p-2 font-mono ">{p.sku}</td>
                <td className="p-2 text-center">{p.quantity}</td>
                <td className="p-2 text-center">{p.min_stock}</td>
                <td className={`p-2 font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>{isLow ? 'Abaixo do mínimo' : 'OK'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ReportCard>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-base-400">Relatórios</h1>
        {logoBase64 && <img src={logoBase64} alt="Logo da empresa" className="max-h-16" />}
      </div>

      <div className="flex space-x-4 border-b pb-2">
        <button className={`text-sm font-medium ${activeTab === 'gerencial' ? 'text-primary-600 border-b-2 border-primary-600' : ''}`} onClick={() => setActiveTab('gerencial')}>Relatório Gerencial</button>
        <button className={`text-sm font-medium ${activeTab === 'estoque' ? 'text-primary-600 border-b-2 border-primary-600' : ''}`} onClick={() => setActiveTab('estoque')}>Relatório de Estoque</button>
      </div>

      {activeTab === 'gerencial' && (
        <>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input type="date" label="Data Inicial" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input type="date" label="Data Final" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setGoalsModalOpen(true)} variant="secondary"><TargetIcon className="mr-2" />Metas</Button>
              <Button onClick={fetchReport}><ChartBarIcon className="mr-2" />Gerar Relatório</Button>
            </div>
          </Card>

          {loading && <div className="flex justify-center p-12"><Spinner /></div>}

          {!loading && reportData && (
            <>
              <ReportCard title="Resumo do Período">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm ">Receita Total</p>
                    <p className="font-bold text-2xl text-primary-600">{formatCurrency(reportData.summary.totalRevenue)}</p>
                    <ProgressBar value={reportData.summary.totalRevenue} max={reportData.goals.monthlyRevenue} />
                  </div>
                  <div>
                    <p className="text-sm ">Lucro Total</p>
                    <p className="font-bold text-2xl text-green-600">{formatCurrency(reportData.summary.totalProfit)}</p>
                    <ProgressBar value={reportData.summary.totalProfit} max={reportData.goals.monthlyProfit} />
                  </div>
                  <div>
                    <p className="text-sm ">Custo Total</p>
                    <p className="font-bold text-2xl text-yellow-600">{formatCurrency(reportData.summary.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-sm ">Vendas Realizadas</p>
                    <p className="font-bold text-xl">{reportData.summary.salesCount}</p>
                  </div>
                  <div>
                    <p className="text-sm ">Ticket Médio</p>
                    <p className="font-bold text-xl">{formatCurrency(reportData.summary.averageTicket)}</p>
                  </div>
                </div>
              </ReportCard>

              <ReportCard title="Clientes Inadimplentes">
                {reportData.defaultingCustomers.length > 0 ? (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left ">
                        <th className="p-2">Cliente</th>
                        <th className="p-2">Valor</th>
                        <th className="p-2">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.defaultingCustomers.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-medium">{c.customerName}</td>
                          <td className="p-2 text-red-600">{formatCurrency(c.amountDue)}</td>
                          <td className="p-2">{formatDate(c.dueDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="">Sem inadimplentes no período.</p>}
              </ReportCard>
            </>
          )}
        </>
      )}

      {activeTab === 'estoque' && renderEstoqueTable()}

      <ModalWrapper isOpen={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title="Definir Metas">
        <div className="space-y-4">
          <Input label="Meta de Receita (R$)" type="number" value={newGoals.monthlyRevenue} onChange={(e) => setNewGoals(g => ({ ...g, monthlyRevenue: parseFloat(e.target.value) }))} />
          <Input label="Meta de Lucro (R$)" type="number" value={newGoals.monthlyProfit} onChange={(e) => setNewGoals(g => ({ ...g, monthlyProfit: parseFloat(e.target.value) }))} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setGoalsModalOpen(false)}>Cancelar</Button>
            <Button onClick={updateGoals}><SaveIcon className="mr-2" />Salvar</Button>
          </div>
        </div>
      </ModalWrapper>
    </div>
  );
};

export default ReportsPage;
