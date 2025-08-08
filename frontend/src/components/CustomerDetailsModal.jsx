// frontend/src/components/CustomerDetailsModal.jsx

import React, { useEffect, useState, useRef } from 'react';

import { api } from '../api/api';

import { ModalWrapper, Input, Button } from './common';



const CustomerDetailsModal = ({ customer, isOpen, onClose }) => {

  const [interactions, setInteractions] = useState([]);

  const [purchases, setPurchases] = useState([]);

  const [newInteraction, setNewInteraction] = useState({ type: '', notes: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const printRef = useRef(null);



  // LISTA DE INTERAÇÕES POSSÍVEIS

  const interactionTypes = [

    'Telefone',

    'E-mail',

    'WhatsApp',

    'Visita Presencial',

    'Redes Sociais',

    'Outro'

  ];



  useEffect(() => {

    if (customer?.id && isOpen) {

      api.getInteractionsByCustomerId(customer.id).then(setInteractions);

      api.getCustomerPurchases(customer.id).then(setPurchases);

    }

  }, [customer, isOpen]);



  const handleAddInteraction = async () => {

    if (!newInteraction.type || !newInteraction.notes) return;

    setIsSubmitting(true);

    try {

      await api.addInteraction({ customerId: customer.id, ...newInteraction });

      setNewInteraction({ type: '', notes: '' });

      const updated = await api.getInteractionsByCustomerId(customer.id);

      setInteractions(updated);

    } finally {

      setIsSubmitting(false);

    }

  };



  const handlePrint = () => {

    const content = printRef.current.innerHTML;

    const win = window.open('', '_blank');

    win.document.write(`<html><head><title>Relatório do Cliente</title></head><body>${content}</body></html>`);

    win.document.close();

    win.print();

  };



  if (!isOpen || !customer) return null;



  // Agrupa interações e compras por data (formato YYYY-MM-DD)

  const groupedByDate = {};



  interactions.forEach(i => {

    const dateKey = new Date(i.date).toISOString().split('T')[0];

    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];

    groupedByDate[dateKey].push({ type: 'interaction', data: i });

  });



  purchases.forEach(p => {

    const dateKey = new Date(p.createdAt).toISOString().split('T')[0];

    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];

    groupedByDate[dateKey].push({ type: 'purchase', data: p });

  });



  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));



  return (

    <ModalWrapper isOpen={isOpen} onClose={onClose} title={`Detalhes de ${customer.name}`}>

      <div className="space-y-6 max-h-[80vh] overflow-y-auto p-2" ref={printRef}>

        <div className="pt-2 space-y-2 border-t">

          <h4 className="font-bold">Nova Interação</h4>

          <label className="block mb-2 text-sm font-medium text-gray-900">Tipo</label>

          <select

              name="type"

              value={newInteraction.type}

              onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value })}

              className="w-full p-2 border border-gray-300 rounded"

          >

              <option value="" disabled>Selecione um tipo...</option>

              {interactionTypes.map((type) => (

                  <option key={type} value={type}>{type}</option>

              ))}

          </select>

          <Input

            name="notes"

            label="Notas"

            value={newInteraction.notes}

            onChange={(e) => setNewInteraction({ ...newInteraction, notes: e.target.value })}

          />

          <Button onClick={handleAddInteraction} disabled={isSubmitting}>Salvar</Button>

        </div>



        {sortedDates.map(date => (

          <div key={date} className="border-t pt-4">

            <h3 className="text-base font-semibold text-gray-700 mb-2">{new Date(date).toLocaleDateString()}</h3>

            {groupedByDate[date].map((entry, index) => (

              entry.type === 'interaction' ? (

                <div key={index} className="p-2 border rounded mb-2">

                  <p><strong>📋 Interação:</strong> {entry.data.type}</p>

                  <p>{entry.data.notes}</p>

                  <p className="text-sm text-gray-500">{new Date(entry.data.date).toLocaleTimeString()}</p>

                </div>

              ) : (

                <div key={index} className="p-2 border rounded mb-2">

                  <p><strong>🛒 Compra:</strong> ID {entry.data.id}</p>

                  <p>Status: {entry.data.status}</p>

                  <p>Total: R$ {entry.data.total.toFixed(2)}</p>

                  <ul className="list-disc pl-6 mt-1">

                    {entry.data.items.map((i, idx) => (

                      <li key={idx}>{i.quantity}x {i.productName} - R$ {i.subtotal.toFixed(2)}</li>

                    ))}

                  </ul>

                </div>

              )

            ))}

          </div>

        ))}

      </div>



      <div className="flex justify-between pt-4">

        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">Imprimir</Button>

        <Button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white">Fechar</Button>

      </div>

    </ModalWrapper>

  );

};



export default CustomerDetailsModal;