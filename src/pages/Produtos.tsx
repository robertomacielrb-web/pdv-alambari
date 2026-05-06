import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock?: number;
  createdAt: string;
}

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', category: '', stock: '' });
  const [isNewCategory, setIsNewCategory] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const normalizedCategory = data.category
            ? data.category.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            : '';
          prods.push({ id: doc.id, ...data, category: normalizedCategory } as Product);
        });
        setProducts(prods);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'products')
    );
    return () => unsubscribe();
  }, []);

  const groupedProducts = useMemo(() => {
    return products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const price = parseFloat(formData.price.replace(',', '.'));
      if (isNaN(price) || price < 0) {
        alert("Preço inválido");
        return;
      }
      
      const stockVal = formData.stock !== '' ? parseInt(formData.stock, 10) : undefined;
      if (stockVal !== undefined && (isNaN(stockVal) || stockVal < 0)) {
        alert("Estoque inválido");
        return;
      }

      const productData = {
        name: formData.name.trim(),
        price: price,
        category: formData.category.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        ...(stockVal !== undefined && { stock: stockVal }),
      };

      if (!productData.name || !productData.category) {
        alert("Nome e categoria são obrigatórios");
        return;
      }

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error: any) {
      alert("Erro ao salvar produto: verifique os dados e tente novamente.");
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingProductId(id);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ 
        name: product.name, 
        price: product.price.toString(), 
        category: product.category,
        stock: product.stock !== undefined ? product.stock.toString() : ''
      });
      setIsNewCategory(false);
    } else {
      setEditingProduct(null);
      const defaultCat = Object.keys(groupedProducts).length > 0 ? Object.keys(groupedProducts).sort()[0] : '';
      setFormData({ name: '', price: '', category: defaultCat, stock: '' });
      setIsNewCategory(Object.keys(groupedProducts).length === 0);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
        <button
          onClick={() => openModal()}
          className="bg-red-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-red-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(groupedProducts).length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Nenhum produto cadastrado.</td>
               </tr>
            ) : (
              Object.keys(groupedProducts).sort().map(category => (
                <React.Fragment key={category}>
                  <tr className="bg-gray-100/80">
                    <td colSpan={5} className="px-6 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-y border-gray-200">
                      {category}
                    </td>
                  </tr>
                  {groupedProducts[category].sort((a,b) => a.name.localeCompare(b.name)).map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className={`font-semibold ${product.stock !== undefined && product.stock <= 5 ? 'text-red-600' : 'text-gray-700'}`}>
                            {product.stock !== undefined ? product.stock : '-'}
                          </span>
                          {product.stock !== undefined && product.stock <= 5 && (
                            <span title="Estoque baixo">
                              <AlertTriangle className="w-4 h-4 ml-2 text-red-500 animate-pulse" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => openModal(product)} className="text-red-600 hover:text-red-900 mr-4">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button 
                onClick={closeModal} 
                className="text-gray-500 hover:text-gray-700"
                type="button"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Categoria</label>
                  {(!isNewCategory && Object.keys(groupedProducts).length > 0) ? (
                    <div className="mt-1 flex space-x-2">
                      <select
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === 'NEW_CATEGORY') {
                            setIsNewCategory(true);
                            setFormData({ ...formData, category: '' });
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                          }
                        }}
                        required
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border bg-white"
                      >
                        <option value="" disabled>Selecione uma categoria...</option>
                        {Object.keys(groupedProducts).sort().map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="NEW_CATEGORY" className="font-bold text-red-600">+ Criar Nova Categoria...</option>
                      </select>
                    </div>
                  ) : (
                    <div className="mt-1 flex space-x-2 items-center">
                      <input
                        type="text"
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                        placeholder="Digite o nome da nova categoria"
                        autoFocus
                      />
                      {Object.keys(groupedProducts).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewCategory(false);
                            setFormData({ ...formData, category: Object.keys(groupedProducts).sort()[0] || '' });
                          }}
                          className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100"
                        >
                          Voltar
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Preço (R$)</label>
                  <input
                    type="text"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estoque Opcional (Quant.)</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="Deixe em branco p/ não controlar"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-between items-center">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(editingProduct.id);
                      closeModal();
                    }}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-md font-medium transition-colors"
                  >
                    Excluir Produto
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProductId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Produto</h3>
            <p className="text-gray-500 mb-6">
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmDelete(deletingProductId);
                  setDeletingProductId(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
