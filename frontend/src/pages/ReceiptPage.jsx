import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Spinner } from '../components/common';
import { ArrowLeftIcon, PrintIcon } from '../components/icons';
import * as mockApi from '../api/mock'; // substitua depois por integração real

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(dateString));

const ReceiptPage = ({ transactionId, onBack }) => {
  const [transaction, setTransaction] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tx, info] = await Promise.all([
          mockApi.getTransactionById(transactionId),
          mockApi.getCompanyInfo(),
        ]);
        setTransaction(tx);
        setCompanyInfo(info);
      } catch (err) {
        setError('Erro ao carregar dados.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [transactionId]);

  const { subtotal, discountAmount, finalTotal } = useMemo(() => {
    if (!transaction) return { subtotal: 0, discountAmount: 0, finalTotal: 0 };
    const sub = transaction.total;
    let disc = discountType === 'percentage' ? (sub * discountValue) / 100 : discountValue;
    disc = Math.min(sub, disc);
    return { subtotal: sub, discountAmount: disc, finalTotal: sub - disc };
  }, [transaction, discountType, discountValue]);

  const handlePrint = () => window.print();

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;
  if (error || !transaction || !companyInfo) return <div className="text-center text-danger p-12">{error || 'Dados indisponíveis.'}</div>;

  const isQuote = transaction.status === 'QUOTE';

  return (
    <div>
      <div className="flex justify-between items-center mb-6 no-print">
        <Button onClick={onBack} variant="secondary"><ArrowLeftIcon />Voltar</Button>
        <h1 className="text-3xl font-bold text-base-400">{isQuote ? 'Visualizar Orçamento' : 'Recibo de Venda'}</h1>
        <Button onClick={handlePrint} variant="primary"><PrintIcon />Imprimir</Button>
      </div>

      <div id="printable-area">
        <Card className="max-w-4xl mx-auto p-8">
          <header className="flex justify-between items-start border-b-2 border-base-200 pb-4 mb-6">
            <div className="text-left">
              <h2 className="text-4xl font-bold text-primary-800">{companyInfo.name}</h2>
              <p className="text-base-300">{companyInfo.address}</p>
              <p className="text-base-300">{companyInfo.phone} | {companyInfo.email}</p>
              <p className="text-base-300">CNPJ: {companyInfo.cnpj}</p>
            </div>
            {companyInfo.logoBase64 && <img src={companyInfo.logoBase64} alt="Logo" className="max-h-24 object-contain" />}
          </header>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-base-400 mb-2">{isQuote ? 'Dados do Orçamento' : 'Dados da Venda'}</h3>
              <p><strong className="text-base-300">ID:</strong> #{transaction.id}</p>
              <p><strong className="text-base-300">Data:</strong> {formatDate(transaction.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-base-400 mb-2">Cliente</h3>
              <p><strong className="text-base-300">Nome:</strong> {transaction.customerName}</p>
              {transaction.customerId && <p><strong className="text-base-300">ID Cliente:</strong> #{transaction.customerId}</p>}
            </div>
          </div>

          <h3 className="text-lg font-semibold text-base-400 mb-2">Itens</h3>
          <div className="border rounded-md overflow-hidden border-base-200 mb-8">
            <table className="min-w-full">
              <thead className="bg-base-100">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-base-300">Produto</th>
                  <th className="p-3 text-left text-sm font-semibold text-base-300">Quantidade</th>
                  <th className="p-3 text-left text-sm font-semibold text-base-300">Preço Unitário</th>
                  <th className="p-3 text-right text-sm font-semibold text-base-300">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 bg-white">
                {transaction.items.map(item => (
                  <tr key={item.productId}>
                    <td className="p-3 text-base-400">{item.productName}</td>
                    <td className="p-3 text-base-300">{item.quantity}</td>
                    <td className="p-3 text-base-300">{formatCurrency(item.price)}</td>
                    <td className="p-3 font-semibold text-base-400 text-right">{formatCurrency(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="no-print">
              <h3 className="text-lg font-semibold text-base-400 mb-2">Aplicar Desconto</h3>
              <div className="p-4 border rounded-md bg-primary-50 space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="discountType" value="percentage" checked={discountType === 'percentage'} onChange={() => { setDiscountType('percentage'); setDiscountValue(0); }} />
                    Percentual (%)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="discountType" value="fixed" checked={discountType === 'fixed'} onChange={() => { setDiscountType('fixed'); setDiscountValue(0); }} />
                    Fixo (R$)
                  </label>
                </div>
                {discountType === 'percentage' ? (
                  <div className="flex gap-2">
                    {[0, 5, 10].map(p => (
                      <Button key={p} variant={discountValue === p ? 'primary' : 'secondary'} onClick={() => setDiscountValue(p)}>{p}%</Button>
                    ))}
                  </div>
                ) : (
                  <Input label="Valor do Desconto (R$)" type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} />
                )}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-lg">
                  <span className="text-base-300">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-lg text-danger">
                  <span className="text-base-300">Desconto:</span>
                  <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="border-t border-base-200 my-2"></div>
                <div className="flex justify-between text-2xl font-bold text-primary-800">
                  <span>Total:</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <footer className="text-center text-xs text-base-300 mt-12 pt-4 border-t border-base-200">
            <p>Obrigado pela sua preferência!</p>
            <p>{companyInfo.name} &copy; 2024</p>
          </footer>
        </Card>
      </div>
    </div>
  );
};

export default ReceiptPage;
