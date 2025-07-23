import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, Spinner } from '../components/common';
import { CalendarIcon, TargetIcon, TrendingUpIcon, XCircleIcon } from '../components/icons';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const ReportsPage = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState({ sales: '', revenue: '' });
  const [message, setMessage] = useState('');

  const fetchReport = async () => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const data = await api.getReportsData(start, end);
      setReportData(data);
    } catch (err) {
      alert('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleSetGoals = async () => {
    if (!goals.sales || !goals.revenue) return;
    try {
      await api.setGoals(goals);
      setMessage('Metas atualizadas com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      alert('Erro ao definir metas');
    }
  };

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStart(firstDay);
    setEnd(lastDay);
  }, []);

  useEffect(() => {
    if (start && end) fetchReport();
  }, [start, end]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-base-400">Relatórios Gerenciais</h1>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input type="date" label="Data Inicial" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="date" label="Data Final" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={fetchReport}>
            <CalendarIcon className="mr-2" />
            Gerar Relatório
          </Button>
        </div>
      </Card>

      {loading && <div className="flex justify-center p-12"><Spinner /></div>}

      {reportData && !loading && (
        <>
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-base-400 mb-4">Resumo de Vendas</h2>
            <ul className="space-y-2 text-base-400">
              <li><TrendingUpIcon className="inline mr-2 text-primary-600" /> Total de Vendas: {reportData.totalSales}</li>
              <li><TrendingUpIcon className="inline mr-2 text-green-600" /> Receita Total: {formatCurrency(reportData.totalRevenue)}</li>
              <li><TrendingUpIcon className="inline mr-2 text-yellow-600" /> Produtos Mais Vendidos: {reportData.topProducts?.join(', ') || 'N/A'}</li>
            </ul>
          </Card>

          <Card className="mb-6">
            <h2 className="text-xl font-bold text-base-400 mb-4">Inadimplência</h2>
            {reportData.inadimplentes?.length > 0 ? (
              <ul className="space-y-1">
                {reportData.inadimplentes.map((cliente, idx) => (
                  <li key={idx} className="text-red-600 font-medium flex items-center gap-2">
                    <XCircleIcon /> {cliente}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base-300">Sem inadimplentes no período.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-base-400 mb-4">Definir Metas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="number"
                label="Meta de Vendas"
                value={goals.sales}
                onChange={(e) => setGoals({ ...goals, sales: parseInt(e.target.value) })}
              />
              <Input
                type="number"
                step="0.01"
                label="Meta de Receita (R$)"
                value={goals.revenue}
                onChange={(e) => setGoals({ ...goals, revenue: parseFloat(e.target.value) })}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSetGoals}>
                <TargetIcon className="mr-2" /> Salvar Metas
              </Button>
            </div>
            {message && <p className="text-success mt-2">{message}</p>}
          </Card>
        </>
      )}
    </>
  );
};

export default ReportsPage;
