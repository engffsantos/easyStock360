// frontend/src/pages/InventoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api, importProductsFromCSV } from '../api/api';
import { Card, Input, ModalWrapper, Spinner } from '../components/common';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, AlertTriangleIcon } from '../components/icons';

const PrimaryButton = ({ children, onClick, type = 'button', className = '', ...props }) => (
  <button
    type={type}
    onClick={onClick}
    className={`px-4 py-2 rounded text-white flex items-center gap-2 ${className}`}
    style={{ backgroundColor: 'rgb(var(--color-primary-600))' }}
    {...props}
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, type = 'button', className = '', ...props }) => (
  <button
    type={type}
    onClick={onClick}
    className={`px-4 py-2 rounded text-white bg-base-400 hover:brightness-110 flex items-center gap-2 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// rótulos legíveis para os campos do histórico
const FIELD_LABELS = {
  name: 'Nome',
  sku: 'SKU',
  marca: 'Marca',
  tipo: 'Tipo',
  price: 'Preço',
  cost: 'Custo',
  quantity: 'Quantidade',
  min_stock: 'Estoque Mínimo',
  created_at: 'Criação',
  Criação: 'Criação',
  Exclusão: 'Exclusão',
};

const ProductForm = ({ product, onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    marca: '',
    tipo: '',
    price: 0,
    cost: 0,
    quantity: 0,
    minStock: 0,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        marca: product.marca || '',
        tipo: product.tipo || '',
        price: product.price || 0,
        cost: product.cost || 0,
        quantity: product.quantity || 0,
        minStock: product.minStock || 0,
      });
    } else {
      setFormData({ name: '', sku: '', marca: '', tipo: '', price: 0, cost: 0, quantity: 0, minStock: 0 });
    }
    setErrors({});
  }, [product]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório.';
    if (formData.price <= 0) newErrors.price = 'Preço deve ser positivo.';
    if (!formData.marca.trim()) newErrors.marca = 'Marca é obrigatória.';
    if (formData.cost < 0) newErrors.cost = 'Custo não pode ser negativo.';
    if (formData.quantity < 0) newErrors.quantity = 'Quantidade não pode ser negativa.';
    if (formData.minStock < 0) newErrors.minStock = 'Estoque mínimo não pode ser negativo.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="name" name="name" label="Nome do Produto" value={formData.name} onChange={handleChange} required />
      {errors.name && <p className="text-danger text-sm">{errors.name}</p>}

      <Input id="sku" name="sku" label="SKU (automático se vazio)" value={formData.sku} onChange={handleChange} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input id="marca" name="marca" label="Marca" value={formData.marca} onChange={handleChange} required />
        <Input id="tipo" name="tipo" label="Tipo (opcional)" value={formData.tipo} onChange={handleChange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input id="cost" name="cost" label="Custo (R$)" type="number" step="0.01" value={formData.cost} onChange={handleChange} required />
        <Input id="price" name="price" label="Preço (R$)" type="number" step="0.01" value={formData.price} onChange={handleChange} required />
        <Input id="quantity" name="quantity" label="Quantidade" type="number" value={formData.quantity} onChange={handleChange} required />
        <Input id="minStock" name="minStock" label="Estoque Mínimo" type="number" value={formData.minStock} onChange={handleChange} required />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <SecondaryButton onClick={onClose} disabled={isSaving}>Cancelar</SecondaryButton>
        <PrimaryButton type="submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Produto'}
        </PrimaryButton>
      </div>
    </form>
  );
};

const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // modal de histórico
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyProduct, setHistoryProduct] = useState(null);

  // filtros do histórico
  const [historyField, setHistoryField] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const printRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (e) {
      setError('Falha ao carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Tem certeza que deseja remover este produto?')) {
      try {
        await api.deleteProduct(id);
        await fetchProducts();
      } catch (e) {
        alert('Falha ao remover o produto.');
      }
    }
  };

  const handleSaveProduct = async (productData) => {
    setIsSaving(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productData);
      } else {
        await api.addProduct(productData);
      }
      setIsModalOpen(false);
      await fetchProducts();
    } catch (e) {
      alert(`Falha ao salvar o produto.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowHistory = async (product) => {
    setHistoryProduct(product);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    // reset filtros ao abrir
    setHistoryField('');
    setHistoryStart('');
    setHistoryEnd('');
    try {
      const items = await api.getProductHistory(product.id);
      setHistoryItems(items || []);
    } catch (e) {
      alert('Falha ao buscar histórico do produto.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const historyFieldOptions = useMemo(() => {
    const set = new Set();
    historyItems.forEach((h) => {
      if (h.changedField) set.add(h.changedField);
    });
    return Array.from(set).sort((a, b) =>
      (FIELD_LABELS[a] || a).localeCompare(FIELD_LABELS[b] || b, 'pt-BR')
    );
  }, [historyItems]);

  const filteredHistory = useMemo(() => {
    const startTs = historyStart ? new Date(`${historyStart}T00:00:00`).getTime() : null;
    const endTs = historyEnd ? new Date(`${historyEnd}T23:59:59.999`).getTime() : null;
    return (historyItems || []).filter((h) => {
      if (historyField && h.changedField !== historyField) return false;
      if (h.changedAt) {
        const t = new Date(h.changedAt).getTime();
        if (startTs !== null && t < startTs) return false;
        if (endTs !== null && t > endTs) return false;
      }
      return true;
    });
  }, [historyItems, historyField, historyStart, historyEnd]);

  const clearHistoryFilters = () => {
    setHistoryField('');
    setHistoryStart('');
    setHistoryEnd('');
  };

  const handlePrintHistory = () => {
    // a área imprimível está marcada com .report-content para usar seu preset @media print
    window.print();
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => !showLowStockOnly || p.quantity <= p.minStock)
      .filter(p => {
        const term = searchTerm.toLowerCase();
        return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
      });
  }, [products, searchTerm, showLowStockOnly]);

  return (
    <>
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold text-base-400">Estoque</h1>
        <div className="flex gap-2 items-center">
          <PrimaryButton onClick={handleAddProduct}>
            <PlusIcon /> Adicionar Produto
          </PrimaryButton>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                  await importProductsFromCSV(file);
                  await fetchProducts();
                  alert('Importação concluída com sucesso!');
                } catch (err) {
                  alert(`Erro: ${err.message}`);
                  console.error('[IMPORTAÇÃO FALHOU]', err);
                  alert(`Erro ao importar CSV:\n${err.message}`);
                }

                e.target.value = '';
              }}
            />
            <PrimaryButton type="button">
              📥 Importar CSV
            </PrimaryButton>
          </div>
        </div>
      </div>

      <Card className="mb-6  no-print">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Input id="search" label="Buscar por nome ou SKU" placeholder="Digite para buscar..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            <div className="absolute inset-y-0 left-0 top-6 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="text-base-200" />
            </div>
          </div>
          <div className="flex items-center pt-6">
            <input
              type="checkbox"
              id="low-stock-filter"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="h-4 w-4 rounded border-base-200 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="low-stock-filter" className="ml-2 block text-sm text-base-400">
              Mostrar apenas estoque baixo
            </label>
          </div>
        </div>
      </Card>

      <Card>
        {loading && <div className="flex justify-center p-12 no-print"><Spinner /></div>}
        {error && <div className="text-center text-danger p-12">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto no-print">
            <table className="min-w-full divide-y divide-base-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Custo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Preço</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Quantidade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-base-200">
                {filteredProducts.length > 0 ? filteredProducts.map(product => {
                  const isLowStock = product.quantity <= product.minStock;
                  return (
                    <tr key={product.id} className={isLowStock ? 'bg-warning/10' : ''}>
                      <td className="px-6 py-4 text-sm font-mono">{product.sku}</td>
                      <td className="px-6 py-4 text-sm font-medium text-base-400">{product.name}</td>
                      <td className="px-6 py-4 text-sm">{formatCurrency(product.cost)}</td>
                      <td className="px-6 py-4 text-sm">{formatCurrency(product.price)}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {isLowStock && <AlertTriangleIcon className="w-5 h-5 text-warning" title={`Estoque baixo (mínimo: ${product.minStock})`} />}
                          <span className={isLowStock ? 'text-danger font-bold' : ''}>{product.quantity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium">
                        <div className="flex gap-2">
                          <button onClick={() => handleEditProduct(product)} className="text-primary-100 hover:brightness-90" title="Editar">Editar</button>
                          <button onClick={() => handleShowHistory(product)} className="text-primary-100 hover:brightness-90" title="Ver histórico">Histórico</button>
                          <button onClick={() => handleDeleteProduct(product.id)} className="bg-red-600 text-primary-100 hover:brightness-90 px-2 rounded" title="Remover">Apagar</button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12">Nenhum produto encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de cadastro/edição */}
      <ModalWrapper
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
      >
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSaving}
        />
      </ModalWrapper>

      {/* Modal de Histórico */}
      <ModalWrapper
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`Histórico — ${historyProduct?.name || ''}`}
      >
        {historyLoading ? (
          <div className="flex justify-center p-8 no-print"><Spinner /></div>
        ) : (
          <>
            {/* Filtros do histórico */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 no-print ">
              <div>
                <label className="block text-sm mb-1">Campo</label>
                <select
                  value={historyField}
                  onChange={(e) => setHistoryField(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Todos</option>
                  {historyFieldOptions.map((f) => (
                    <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
                  ))}
                </select>
              </div>

              <Input
                id="hist-start"
                label="Início"
                type="date"
                value={historyStart}
                onChange={(e) => setHistoryStart(e.target.value)}
              />
              <Input
                id="hist-end"
                label="Fim"
                type="date"
                value={historyEnd}
                onChange={(e) => setHistoryEnd(e.target.value)}
              />

              <div className="flex items-end gap-2 no-print">
                <SecondaryButton onClick={clearHistoryFilters}>Limpar filtros</SecondaryButton>
                <PrimaryButton onClick={handlePrintHistory}>🖨️ Imprimir</PrimaryButton>
              </div>
            </div>

            {/* Área imprimível */}
            <div className="report-content">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">
                  Histórico de alterações — {historyProduct?.name}
                </h3>
                {(historyField || historyStart || historyEnd) && (
                    <p className="text-sm text-base-300">
                      Filtros: {historyField ? `Campo = ${FIELD_LABELS[historyField] || historyField}` : 'Campo = Todos'}
                      {historyStart ? ` · Início = ${new Date(historyStart + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                      {historyEnd ? ` · Fim = ${new Date(historyEnd + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                    </p>
                )}
              </div>

              <div className="overflow-x-auto">
                {filteredHistory.length === 0 ? (
                    <p className="text-sm text-base-300">Nenhum registro encontrado com os filtros aplicados.</p>
                ) : (
                    <table className="min-w-full divide-y divide-base-200">
                      <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Data</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Campo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">De</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Para</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                      {filteredHistory.map((h) => (
                        <tr key={h.id}>
                          <td className="px-4 py-2 text-sm">
                            {h.changedAt ? new Date(h.changedAt).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm">{FIELD_LABELS[h.changedField] || h.changedField}</td>
                          <td className="px-4 py-2 text-sm">{h.oldValue ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{h.newValue ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </ModalWrapper>
    </>
  );
};

export default InventoryPage;
