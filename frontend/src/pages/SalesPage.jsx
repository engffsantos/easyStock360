import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { Card, Button, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, TrashIcon, CheckCircleIcon, EditIcon } from '../components/icons';

const formatCurrency = value =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = dateString =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateString));

const SalesPage = ({ onNavigateToReceipt }) => {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' ou 'quotes'
  const [sales, setSales] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quoteToConvert, setQuoteToConvert] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [salesData, quotesData] = await Promise.all([
        api.getSales(),
        api.getQuotes()
      ]);
      setSales(salesData);
      setQuotes(quotesData);
    } catch (e) {
      setError('Falha ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConvertToSale = async (quoteId) => {
    try {
      await api.convertToSale(quoteId, {}); // não exige paymentDetails por enquanto
      alert('Orçamento convertido em venda com sucesso!');
      setQuoteToConvert(null);
      fetchData();
    } catch (err) {
      alert(`Erro ao converter: ${err.message}`);
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (window.confirm('Deseja excluir este orçamento?')) {
      try {
        await api.deleteTransaction(quoteId);
        fetchData();
      } catch (err) {
        alert('Erro ao excluir orçamento.');
      }
    }
  };

  const TabButton = ({ label, isActive, onClick, count }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-lg font-semibold border-b-4 transition-colors duration-200 ${
        isActive
          ? 'border-primary-700 text-primary-700'
          : 'border-transparent text-base-300 hover:border-primary-200 hover:text-primary-700'
      }`}
    >
      {label}{' '}
      <span className={`ml-2 px-2 py-0.5 rounded-full text-sm ${isActive ? 'bg-primary-700 text-white' : 'bg-base-200 text-base-400'}`}>
        {count}
      </span>
    </button>
  );

  const renderSales = () => (
    <table className="min-w-full divide-y divide-base-200">
      <thead className="bg-white">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Data</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Cliente</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Nº Itens</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Total</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Ações</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-base-200">
        {sales.length > 0 ? sales.map(sale => (
          <tr key={sale.id}>
            <td className="px-6 py-4 text-sm text-base-300">{formatDate(sale.createdAt)}</td>
            <td className="px-6 py-4 text-sm font-medium text-base-400">{sale.customerName}</td>
            <td className="px-6 py-4 text-sm text-base-300">{sale.items.length}</td>
            <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(sale.total)}</td>
            <td className="px-6 py-4 text-sm">
              <Button variant="secondary" className="!py-1 !px-2" onClick={() => onNavigateToReceipt(sale.id)}>
                Ver Recibo
              </Button>
            </td>
          </tr>
        )) : (
          <tr><td colSpan={5} className="text-center py-12 text-base-300">Nenhuma venda registrada.</td></tr>
        )}
      </tbody>
    </table>
  );

  const renderQuotes = () => (
    <table className="min-w-full divide-y divide-base-200">
      <thead className="bg-white">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Data</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Cliente</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Total</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase">Ações</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-base-200">
        {quotes.length > 0 ? quotes.map(quote => (
          <tr key={quote.id}>
            <td className="px-6 py-4 text-sm text-base-300">{formatDate(quote.createdAt)}</td>
            <td className="px-6 py-4 text-sm font-medium text-base-400">{quote.customerName}</td>
            <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(quote.total)}</td>
            <td className="px-6 py-4 text-sm">
              <div className="flex gap-2 items-center">
                <Button onClick={() => handleConvertToSale(quote.id)} className="!py-1 !px-2 text-sm bg-secondary-600 hover:bg-secondary-700 text-white">
                  <CheckCircleIcon className="w-4 h-4" /> Converter
                </Button>
                <Button variant="secondary" className="!py-1 !px-2" onClick={() => onNavigateToReceipt(quote.id)}>
                  Ver Orçamento
                </Button>
                <button onClick={() => handleDeleteQuote(quote.id)} className="text-danger hover:brightness-90 p-1 rounded" title="Excluir Orçamento">
                  <TrashIcon />
                </button>
              </div>
            </td>
          </tr>
        )) : (
          <tr><td colSpan={4} className="text-center py-12 text-base-300">Nenhum orçamento encontrado.</td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Vendas e Orçamentos</h1>
        <Button variant="primary" onClick={() => alert("Formulário de venda será reimplementado em breve")}>
          <PlusIcon /> Nova Venda / Orçamento
        </Button>
      </div>

      <div className="mb-6 border-b border-base-200">
        <nav className="flex gap-4">
          <TabButton label="Vendas" isActive={activeTab === 'sales'} onClick={() => setActiveTab('sales')} count={sales.length} />
          <TabButton label="Orçamentos" isActive={activeTab === 'quotes'} onClick={() => setActiveTab('quotes')} count={quotes.length} />
        </nav>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : error ? (
          <div className="text-center text-danger p-12">{error}</div>
        ) : (
          activeTab === 'sales' ? renderSales() : renderQuotes()
        )}
      </Card>
    </>
  );
};

export default SalesPage;
