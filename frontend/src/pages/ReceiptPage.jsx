import React, { useEffect, useState } from 'react';
import { api } from '../api/api';
import { Spinner } from '../components/common';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateString));

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
        const info = await api.getCompanyInfo();
        setTransaction(tx);
        setCompanyInfo(info);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Erro ao carregar os dados.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [transactionId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !transaction) return <div className="text-center text-danger p-6">{error || 'Venda não encontrada.'}</div>;

  return (
      <div className="receipt-content max-w-3xl mx-auto bg-white p-8 shadow print:shadow-none print:p-0">
        {/* Cabeçalho */}
        <div className="border-b-2 border-gray-200 pb-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {transaction.status === 'QUOTE' ? 'Orçamento' : 'Recibo de Venda'}
          </h1>
          <p className="text-sm text-gray-500">
            Número: <strong>{transaction.id}</strong> — {formatDate(transaction.createdAt)}
          </p>
        </div>

        {/* Empresa */}
        {companyInfo && (
            <div className="flex items-start gap-6 mb-6">
              {companyInfo.logoBase64 && (
                  <img src={companyInfo.logoBase64} alt="Logo da empresa" className="w-24 h-auto object-contain"/>
              )}
              <div className="text-sm text-gray-700">
                <p><strong>{companyInfo.name}</strong></p>
                <p>{companyInfo.address}</p>
                <p>{companyInfo.phone}</p>
                <p>{companyInfo.email}</p>
                <p>CNPJ: {companyInfo.cnpj}</p>
              </div> {/* Cliente */}
        <div className="text-sm text-gray-800 mb-6 space-y-1">
          <p><strong>Cliente:</strong> {transaction.customerName || 'Consumidor Final'}</p>
          {(transaction.customerCpfCnpj || transaction.customerPhone) && (
              <p>
                {transaction.customerCpfCnpj && <span><strong>CPF/CNPJ:</strong> {transaction.customerCpfCnpj}</span>}
                {transaction.customerCpfCnpj && transaction.customerPhone && <span className="mx-2">|</span>}
                {transaction.customerPhone && <span><strong>Telefone:</strong> {transaction.customerPhone}</span>}
              </p>
          )}
          {transaction.customerAddress && (
              <p><strong>Endereço:</strong> {transaction.customerAddress}</p>
          )}
        </div>
            </div>
        )}




       {/* Tabela de produtos */}
<table className="w-full text-sm border border-black border-collapse print:text-sm mb-6">
  <thead className="bg-gray-100 text-gray-700">
    <tr>
      <th className="w-[40%] text-left border border-black p-2">Produto</th>
      <th className="w-[15%] text-right border border-black p-2">Qtd.</th>
      <th className="w-[20%] text-right border border-black p-2">Preço</th>
      <th className="w-[25%] text-right border border-black p-2">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    {transaction.items.map((item) => (
      <tr key={item.productId}>
        <td className="border border-black p-2">{item.productName}</td>
        <td className="text-right border border-black p-2">{item.quantity}</td>
        <td className="text-right border border-black p-2">{formatCurrency(item.price)}</td>
        <td className="text-right border border-black p-2">
          {formatCurrency(item.price * item.quantity)}
        </td>
      </tr>
    ))}
  </tbody>
  <tfoot>
    <tr className="font-bold text-gray-800">
      <td colSpan="3" className="text-right border border-black p-2">Total:</td>
      <td className="text-right border border-black p-2">{formatCurrency(transaction.total)}</td>
    </tr>
  </tfoot>
</table>

          {/* Botões */}
          <div className="flex justify-between mt-8 print:hidden">
            {onBack && (
                <button onClick={onBack} className="px-4 py-2 bg-gray-700 text-white rounded hover:brightness-110">
                  Voltar
                </button>
            )}
            <button
                onClick={() => setTimeout(() => window.print(), 100)}
                className="px-4 py-2 bg-[#c05621] text-white rounded hover:brightness-110"
            >
              Imprimir {transaction.status === 'QUOTE' ? 'Orçamento' : 'Recibo'}
            </button>
          </div>
      </div>
);
};

export default ReceiptPage;
