import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { Card, Spinner } from '../components/common';
import {
  SalesIcon,
  ReceiptIcon,
  AlertTriangleIcon,
  WalletIcon,
  MoneyIcon,
  ClockIcon,
  DollarSignIcon
} from '../components/icons';

const formatCurrency = value =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (err) {
        setError('Falha ao carregar os dados do dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <>
      <h1 className="text-3xl font-bold text-base-400 mb-6">Dashboard</h1>

      {loading && <div className="flex justify-center p-12"><Spinner /></div>}
      {error && <div className="text-center text-danger p-12">{error}</div>}

      {!loading && stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-base-300 mb-1">Vendas Hoje</p>
                <p className="text-xl font-bold text-primary-800">{stats.salesTodayCount}</p>
              </div>
              <SalesIcon className="w-8 h-8 text-primary-600" />
            </Card>

            <Card className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-base-300 mb-1">Valor Total Hoje</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(stats.salesTodayValue)}</p>
              </div>
              <ReceiptIcon className="w-8 h-8 text-green-500" />
            </Card>

            <Card className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-base-300 mb-1">Recebíveis Pendentes</p>
                <p className="text-xl font-bold text-yellow-600">{formatCurrency(stats.totalReceivable)}</p>
              </div>
              <WalletIcon className="w-8 h-8 text-yellow-500" />
            </Card>

            <Card className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-base-300 mb-1">Contas a Pagar</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalPayable)}</p>
              </div>
              <MoneyIcon className="w-8 h-8 text-red-500" />
            </Card>

            <Card className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-base-300 mb-1">Contas Vencidas</p>
                <p className="text-xl font-bold text-red-700">{stats.overduePayableCount}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-red-600" />
            </Card>

            <Card className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-base-300 mb-1">Produtos com Estoque Baixo</p>
                <p className="text-xl font-bold text-warning">{stats.lowStockProductsCount}</p>
              </div>
              <AlertTriangleIcon className="w-8 h-8 text-warning" />
            </Card>

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
                          <td className="px-6 py-4 text-sm text-base-300">{new Date(sale.createdAt).toLocaleString('pt-BR')}</td>
                          <td className="px-6 py-4 text-sm font-medium text-base-400">{sale.customerName}</td>
                          <td className="px-6 py-4 text-sm text-green-600">{formatCurrency(sale.total)}</td>
                          <td className="px-6 py-4 text-sm text-base-300">{sale.items.length}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-base-300">Nenhuma venda recente.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
};

export default DashboardPage;
