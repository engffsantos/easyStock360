// frontend/src/pages/ReceiptPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/api';
import { Spinner } from '../components/common';

const parseISOWithTZ = (s) => {
  if (!s) return new Date();
  // Se não houver info de timezone, assume UTC para evitar "adiantar/atrasar" local
  if (!/Z|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parseISOWithTZ(dateString));

const formatOnlyDate = (dateString) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parseISOWithTZ(dateString));

const PAYMENT_LABEL = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto',
};

const ReceiptPage = ({ transactionId, onBack }) => {
  const [transaction, setTransaction] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carrega dados da transação e empresa
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

  const isQuote = transaction?.status === 'QUOTE';

  // Rótulo do desconto
  const discountLabel = useMemo(() => {
    if (!transaction) return 'Desconto';
    const { discountType, discountValue } = transaction;
    if (!discountType || !discountValue) return 'Desconto';
    if (discountType === 'PERCENT') return `Desconto (${Number(discountValue)}%)`;
    return 'Desconto (R$)';
  }, [transaction]);

  // Valor de desconto calculado (somente exibição)
  const computedDiscountValue = useMemo(() => {
    if (!transaction) return 0;
    const { discountType, discountValue, subtotal } = transaction;
    if (!discountType || !discountValue) return 0;
    if (discountType === 'PERCENT') {
      const perc = Math.max(0, Math.min(Number(discountValue) || 0, 100));
      return Math.min((Number(subtotal) || 0) * (perc / 100), Number(subtotal) || 0);
    }
    return Math.min(Number(discountValue) || 0, Number(transaction.subtotal) || 0);
  }, [transaction]);

  // Forma de pagamento (VENDA)
  const paymentInfo = useMemo(() => {
    if (!transaction || isQuote) return null;
    const method =
      transaction.paymentMethod ||
      transaction.payment_details?.paymentMethod ||
      transaction.paymentDetails?.paymentMethod ||
      null;

    const installments =
      transaction.installments ??
      transaction.payment_details?.installments ??
      transaction.paymentDetails?.installments ??
      null;

    return { method, installments };
  }, [transaction, isQuote]);

  // Texto dinâmico pagamento/condições
  const paymentConditions = useMemo(() => {
    if (!transaction) return null;
    if (!isQuote) {
      if (paymentInfo?.method) {
        const label = PAYMENT_LABEL[paymentInfo.method] || paymentInfo.method;
        return paymentInfo.installments && Number(paymentInfo.installments) > 1
          ? `Pagamento: ${label} em ${paymentInfo.installments}×.`
          : `Pagamento: ${label}.`;
      }
      return `Pagamento conforme condições acordadas no ato da venda.`;
    }

    // ORÇAMENTO
    const notes = companyInfo?.paymentsNotes;
    return notes || `Formas aceitas: PIX, débito, crédito (em até 3× sem juros) e boleto (PJ). Desconto de 5% para pagamento à vista no PIX.`;
  }, [transaction, isQuote, companyInfo, paymentInfo]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !transaction) return <div className="text-center text-danger p-6">{error || 'Documento não encontrado.'}</div>;

  // Soma das parcelas (se existirem)
  const paymentsTotal = Array.isArray(transaction.payments) && transaction.payments.length > 0
    ? transaction.payments.reduce((a, p) => a + Number(p.amount || 0), 0)
    : null;

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 shadow print:shadow-none print:p-0">
      <style>{`
        @page { margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .table-rows tr { break-inside: avoid; page-break-inside: avoid; }
          .print-border { border-color: #000 !important; }
        }
      `}</style>

      {/* Cabeçalho */}
      <div className="border-b-2 border-gray-200 pb-4 mb-4 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isQuote ? 'ORÇAMENTO' : 'RECIBO DE VENDA'}
          </h1>
          <p className="text-sm text-gray-600">
            Número: <strong>{transaction.id}</strong>
          </p>
          <p className="text-sm text-gray-600">
            Emissão: <strong>{formatDate(transaction.createdAt)}</strong>
          </p>
          {isQuote && (
            <p className="text-sm text-gray-600">
              {transaction.validUntil
                ? <>Válido até: <strong>{formatOnlyDate(transaction.validUntil)}</strong></>
                : <>Válido por <strong>10 dias</strong> a partir da emissão.</>}
            </p>
          )}
        </div>

        {/* Empresa */}
        {companyInfo && (
          <div className="flex items-start gap-4">
            {companyInfo.logoBase64 && (
              <img src={companyInfo.logoBase64} alt="Logo da empresa" className="w-24 h-auto object-contain" />
            )}
            <div className="text-sm text-gray-700">
              <p className="font-semibold">{companyInfo.name}</p>
              <p className="leading-tight">{companyInfo.address}</p>
              <p className="leading-tight">{companyInfo.phone}</p>
              <p className="leading-tight">{companyInfo.email}</p>
              <p className="leading-tight">CNPJ: {companyInfo.cnpj}</p>
              {Array.isArray(companyInfo.companySocials) && companyInfo.companySocials.length > 0 && (
                <p className="leading-tight">
                  Redes: {companyInfo.companySocials.map((s, idx) => (
                    <span key={idx}>
                      {s}{idx < companyInfo.companySocials.length - 1 ? ' • ' : ''}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vendedor (opcional) */}
      {(transaction.sellerName || transaction.sellerEmail) && (
        <div className="mb-4 text-sm text-gray-800 avoid-break">
          <p className="font-semibold">Vendedor responsável</p>
          {transaction.sellerName && <p>Nome: {transaction.sellerName}</p>}
          {transaction.sellerEmail && <p>E-mail: {transaction.sellerEmail}</p>}
        </div>
      )}

      {/* Cliente */}
      <div className="mb-6 avoid-break">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-1 mb-3">Dados do Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-800">
          <div><strong>Nome:</strong> {transaction.customerName || 'Consumidor Final'}</div>
          {transaction.customerCpfCnpj && <div><strong>CPF/CNPJ:</strong> {transaction.customerCpfCnpj}</div>}
          {transaction.customerPhone && <div><strong>Telefone:</strong> {transaction.customerPhone}</div>}
          {transaction.customerEmail && <div><strong>E-mail:</strong> {transaction.customerEmail}</div>}
          {transaction.customerAddress && (
            <div className="md:col-span-2"><strong>Endereço:</strong> {transaction.customerAddress}</div>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="avoid-break">
        <table className="w-full text-sm border border-black border-collapse print:text-sm mb-6">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="w-[40%] text-left border border-black p-2">Produto</th>
              <th className="w-[15%] text-right border border-black p-2">Qtd.</th>
              <th className="w-[20%] text-right border border-black p-2">Preço</th>
              <th className="w-[25%] text-right border border-black p-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="table-rows">
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
        </table>
      </div>

      {/* Resumo financeiro */}
      <div className="flex justify-end mb-6 avoid-break">
        <table className="text-sm w-full md:w-1/2 border border-black border-collapse">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-medium">Subtotal</td>
              <td className="border border-black p-2 text-right">{formatCurrency(transaction.subtotal)}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-medium">{discountLabel}</td>
              <td className="border border-black p-2 text-right">
                {computedDiscountValue > 0 ? `- ${formatCurrency(computedDiscountValue)}` : formatCurrency(0)}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-medium">Frete</td>
              <td className="border border-black p-2 text-right">{formatCurrency(transaction.freight || 0)}</td>
            </tr>
            <tr className="bg-gray-100">
              <td className="border border-black p-2 font-bold">TOTAL</td>
              <td className="border border-black p-2 text-right font-bold">
                {formatCurrency(transaction.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagamento / Condições */}
      <div className="mb-4 text-sm text-gray-800 avoid-break">
        <p className="font-semibold">{isQuote ? 'Condições de pagamento' : 'Forma de pagamento'}</p>
        <p className="leading-relaxed">{paymentConditions}</p>
      </div>

      {/* Parcelas */}
      {!isQuote && Array.isArray(transaction.payments) && transaction.payments.length > 0 && (
        <div className="mb-6 avoid-break">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Parcelas</h3>
          <table className="w-full text-sm border border-black border-collapse">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="text-left border border-black p-2">#</th>
                <th className="text-left border border-black p-2">Vencimento</th>
                <th className="text-right border border-black p-2">Valor</th>
                <th className="text-left border border-black p-2">Forma</th>
                <th className="text-left border border-black p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {transaction.payments.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td className="border border-black p-2">{idx + 1}</td>
                  <td className="border border-black p-2">{p.dueDate ? formatOnlyDate(p.dueDate) : '-'}</td>
                  <td className="border border-black p-2 text-right">{formatCurrency(p.amount)}</td>
                  <td className="border border-black p-2">{PAYMENT_LABEL[p.paymentMethod] || p.paymentMethod || '-'}</td>
                  <td className="border border-black p-2">{p.status || 'ABERTO'}</td>
                </tr>
              ))}
              <tr className="bg-gray-100">
                <td className="border border-black p-2 font-bold" colSpan={2}>Total das parcelas</td>
                <td className="border border-black p-2 text-right font-bold">{formatCurrency(paymentsTotal)}</td>
                <td className="border border-black p-2" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Observações */}
      <div className="mb-6 text-sm text-gray-800 avoid-break">
        <p className="font-semibold">Observações</p>
        <ul className="list-disc pl-6 space-y-1 leading-relaxed">
          <li>
            <strong>Retirada:</strong>{' '}
            {companyInfo?.pickupAddress || companyInfo?.address || 'Retirada no balcão do endereço da empresa durante o horário comercial.'}
          </li>
          <li>
            <strong>Entrega:</strong>{' '}
            {companyInfo?.deliveryPolicy || 'Entrega em até 2 dias úteis. Taxa de entrega não incluída (cotada conforme CEP).'}
          </li>
          <li>
            <strong>Prazo de execução:</strong>{' '}
            {companyInfo?.leadTimeNotes || 'Pedidos sob encomenda exigem 3 dias úteis de antecedência.'}
          </li>
          <li>
            <strong>Formas de pagamento aceitas:</strong>{' '}
            {companyInfo?.paymentsNotes || 'PIX, débito, crédito (até 3× sem juros), boleto (PJ). 5% de desconto para pagamento à vista no PIX.'}
          </li>
          {isQuote && (
            <li>
              <strong>Validade:</strong>{' '}
              {transaction.validUntil
                ? `Proposta válida até ${formatOnlyDate(transaction.validUntil)}.`
                : 'Proposta válida por 10 dias a partir da emissão.'}
            </li>
          )}
        </ul>
      </div>

      {/* Ações */}
      <div className="flex justify-between mt-8 no-print">
        {onBack && (
          <button onClick={onBack} className="px-4 py-2 bg-gray-700 text-white rounded hover:brightness-110">
            Voltar
          </button>
        )}
        <button
          onClick={() => setTimeout(() => window.print(), 100)}
          className="px-4 py-2 bg-[#c05621] text-white rounded hover:brightness-110"
        >
          Imprimir {isQuote ? 'Orçamento' : 'Recibo'}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPage;
