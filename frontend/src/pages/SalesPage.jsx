import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import SaleForm from './SaleForm';
import { Card, Button, Spinner, ModalWrapper } from '../components/common';
import { PlusIcon, TrashIcon, CheckCircleIcon, EditIcon } from '../components/icons';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateString));

const SalesPage = ({ onNavigateToReceipt }) => {
  const [activeTab, setActiveTab] = useState('sales');
  const [sales, setSales] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState({ paymentMethod: 'PIX', installments: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [quoteToConvert, setQuoteToConvert] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [salesData, quotesData] = await Promise.all([
        api.getSales(),
        api.getQuotes(),
      ]);
      setSales(salesData);
      setQuotes(quotesData);
    } catch (e) {
      setError('Erro ao carregar vendas e orçamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    fetchData();
  };

  const handleConvertToSale = async (quoteId, paymentDetails) => {
    try {
      setIsConverting(true);
      await api.convertToSale(quoteId, paymentDetails);
      alert('Orçamento convertido com sucesso!');
      setQuoteToConvert(null);
      fetchData();
    } catch (err) {
      alert('Erro ao converter orçamento');
    } finally {
      setIsConverting(false);
    }
  };

  const handleEditQuote = (quote) => {
    setEditingTransaction(quote);
    setIsModalOpen(true);
  };

  const handleDeleteQuote = async (quoteId) => {
    if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
      try {
        await api.deleteTransaction(quoteId);
        alert('Orçamento excluído com sucesso!');
        fetchData();
      } catch (err) {
        alert('Erro ao excluir orçamento');
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
      {label}
      <span className={`ml-2 px-2 py-0.5 rounded-full text-sm ${isActive ? 'bg-primary-700 text-white' : 'bg-base-200 text-base-400'}`}>
        {count}
      </span>
    </button>
  );

  const renderSalesTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-base-200">
        <thead className="bg-white">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Data</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Cliente</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Itens</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Total</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-base-200">
          {sales.length > 0 ? (
            sales.map(sale => (
              <tr key={sale.id}>
                <td className="px-6 py-4 text-sm text-base-300">{formatDate(sale.createdAt)}</td>
                <td className="px-6 py-4 text-sm font-medium text-base-400">{sale.customerName}</td>
                <td className="px-6 py-4 text-sm text-base-300">{sale.items.length}</td>
                <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(sale.total)}</td>
                <td className="px-6 py-4">
                  <Button variant="secondary" className="!py-1 !px-2" onClick={() => onNavigateToReceipt(sale.id)}>
                    Ver Recibo
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="5" className="text-center py-12 text-base-300">Nenhuma venda registrada.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderQuotesTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-base-200">
        <thead className="bg-white">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Data</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Cliente</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Total</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-base-300 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-base-200">
          {quotes.length > 0 ? (
            quotes.map(quote => (
              <tr key={quote.id}>
                <td className="px-6 py-4 text-sm text-base-300">{formatDate(quote.createdAt)}</td>
                <td className="px-6 py-4 text-sm font-medium text-base-400">{quote.customerName}</td>
                <td className="px-6 py-4 text-sm font-bold text-primary-800">{formatCurrency(quote.total)}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2 items-center">
                    <Button onClick={() => setQuoteToConvert(quote)} className="!py-1 !px-2 text-sm bg-secondary-600 text-white">
                      <CheckCircleIcon className="w-4 h-4" /> Converter
                    </Button>
                    <Button variant="secondary" className="!py-1 !px-2" onClick={() => onNavigateToReceipt(quote.id)}>
                      Ver Orçamento
                    </Button>
                    <button onClick={() => handleEditQuote(quote)} className="text-primary-700 hover:text-primary-800 p-1 rounded" title="Editar Orçamento">
                      <EditIcon />
                    </button>
                    <button onClick={() => handleDeleteQuote(quote.id)} className="text-danger hover:brightness-90 p-1 rounded" title="Excluir Orçamento">
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="4" className="text-center py-12 text-base-300">Nenhum orçamento registrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderContent = () => {
    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
    if (error) return <div className="text-center text-danger p-12">{error}</div>;
    return activeTab === 'sales' ? renderSalesTable() : renderQuotesTable();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-400">Vendas e Orçamentos</h1>
        <Button variant="primary" onClick={handleOpenModal}>
          <PlusIcon />
          Nova Venda / Orçamento
        </Button>
      </div>

      <div className="mb-6 border-b border-base-200">
        <nav className="flex gap-4">
          <TabButton label="Vendas" isActive={activeTab === 'sales'} onClick={() => setActiveTab('sales')} count={sales.length} />
          <TabButton label="Orçamentos" isActive={activeTab === 'quotes'} onClick={() => setActiveTab('quotes')} count={quotes.length} />
        </nav>
      </div>

      <Card>{renderContent()}</Card>

      <ModalWrapper
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTransaction ? 'Editar Orçamento' : 'Registrar Nova Transação'}
      >
        <SaleForm
          transactionToEdit={editingTransaction}
          onSave={handleSaveSuccess}
          onClose={handleCloseModal}
          isSaving={false}
        />
      </ModalWrapper>

      {quoteToConvert && (
        <ModalWrapper
          isOpen={true}
          onClose={() => setQuoteToConvert(null)}
          title="Converter Orçamento"
        >
          <div className="space-y-4">
            <p>Confirme os detalhes de pagamento para converter este orçamento em uma venda.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm text-base-300">Forma de pagamento</label>
                <select
                  value={paymentDetails.paymentMethod}
                  onChange={(e) =>
                    setPaymentDetails((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value,
                      installments: 1
                    }))
                  }
                  className="w-full p-2 border rounded"
                >
                  <option value="PIX">PIX</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="BOLETO">Boleto</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm text-base-300">Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={paymentDetails.installments}
                  onChange={(e) =>
                    setPaymentDetails((prev) => ({
                      ...prev,
                      installments: parseInt(e.target.value) || 1
                    }))
                  }
                  disabled={
                    paymentDetails.paymentMethod !== 'CARTAO_CREDITO' &&
                    paymentDetails.paymentMethod !== 'BOLETO'
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => handleConvertToSale(quoteToConvert.id, paymentDetails)}
              disabled={isConverting}
            >
              {isConverting ? 'Convertendo...' : 'Confirmar Conversão'}
            </Button>
          </div>
        </ModalWrapper>
      )}
    </>
  );
};

export default SalesPage;
