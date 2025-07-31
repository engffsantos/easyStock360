// frontend/src/pages/ReceiptPage.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/api';
import * as mockApi from '../api/mock';
import { Button, Spinner } from '../components/common';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateString));

const ReceiptPage = ({ transactionId, onBack }) => {
  const [transaction, setTransaction] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!transactionId) {
        setError('ID de transação não fornecido.');
        setLoading(false);
        return;
      }

      try {
        const tx = await api.getTransactionById(transactionId);
        const info = await mockApi.getCompanyInfo();

        setTransaction(tx);
        setCompanyInfo(info);
      } catch (err) {
        console.error('Erro ao carregar dados da transação:', err);
        setError('Erro ao carregar dados da venda.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="text-center text-danger p-6">
        {error || 'Venda não encontrada.'}
      </div>
    );
  }

  return (
    <div className="receipt-content max-w-2xl mx-auto p-6 bg-white rounded shadow print:p-0 print:shadow-none print:bg-white">
      <h1 className="text-2xl font-bold mb-2">
        {transaction.status === 'QUOTE' ? 'Orçamento' : 'Recibo de Venda'}
      </h1>
      <p className="text-sm text-base-400 mb-4">
        Número: <strong>{transaction.id}</strong> — {formatDate(transaction.createdAt)}
      </p>

      {companyInfo && (
        <div className="mb-4 text-sm text-base-300">
          {companyInfo.logoBase64 && (
            <div className="mb-2">
              <img
                src={companyInfo.logoBase64}
                alt="Logo da Empresa"
                className="h-16 object-contain mb-2"
              />
            </div>
          )}
          <p className="font-bold">{companyInfo.name}</p>
          <p>{companyInfo.address}</p>
          <p>{companyInfo.phone}</p>
          <p>{companyInfo.email}</p>
          <p>CNPJ: {companyInfo.cnpj}</p>
        </div>
      )}

      <div className="mb-6 text-sm text-base-300">
        <p>
          <strong className="text-base-400">Cliente:</strong>{' '}
          {transaction.customerName || 'Consumidor Final'}
        </p>
        {transaction.paymentMethod && (
          <p>
            <strong className="text-base-400">Pagamento:</strong>{' '}
            {transaction.paymentMethod.replace('_', ' ')}
          </p>
        )}
        {transaction.installments && transaction.installments > 1 && (
          <p>
            <strong className="text-base-400">Parcelas:</strong>{' '}
            {transaction.installments}x
          </p>
        )}
      </div>

      <table className="w-full text-sm mb-6 border border-base-200">
        <thead className="bg-base-100 text-base-400">
          <tr>
            <th className="p-2 text-left border-b border-base-200">Produto</th>
            <th className="p-2 text-right border-b border-base-200">Qtd.</th>
            <th className="p-2 text-right border-b border-base-200">Preço</th>
            <th className="p-2 text-right border-b border-base-200">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(transaction.items || []).map((item) => (
            <tr key={item.productId}>
              <td className="p-2 border-b border-base-100">{item.productName}</td>
              <td className="p-2 text-right border-b border-base-100">{item.quantity}</td>
              <td className="p-2 text-right border-b border-base-100">
                {formatCurrency(item.price)}
              </td>
              <td className="p-2 text-right border-b border-base-100">
                {formatCurrency(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold text-base-400">
            <td colSpan="3" className="p-2 text-right border-t border-base-200">
              Total:
            </td>
            <td className="p-2 text-right border-t border-base-200">
              {formatCurrency(transaction.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-6 print:hidden flex justify-between">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Voltar
          </Button>
        )}
        <Button
          onClick={() => {
            setTimeout(() => {
              window.print();
            }, 100);
          }}
        >
          Imprimir {transaction.status === 'QUOTE' ? 'Orçamento' : 'Recibo'}
        </Button>
      </div>
    </div>
  );
};

export default ReceiptPage;
