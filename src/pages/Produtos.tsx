import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  RotateCcw, 
  Filter, 
  DollarSign, 
  Package,
  Scale
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  wholesalePrice?: number;
  category: string;
  stock?: number;
  unit?: 'unidade' | 'kg';
  erpOnly?: boolean;
  createdAt: string;
}

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', costPrice: '', wholesalePrice: '', category: '', stock: '', unit: 'unidade', erpOnly: false });
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'available' | 'out'>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'unidade' | 'kg'>('all');
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const normalizedCategory = data.category
            ? data.category.trim()
            : '';
          prods.push({ id: doc.id, ...data, category: normalizedCategory } as Product);
        });
        setProducts(prods);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'products')
    );
    return () => unsubscribe();
  }, []);

  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  const highestProductPrice = useMemo(() => {
    if (products.length === 0) return 100;
    const max = Math.max(...products.map(p => p.price || 0));
    return Math.ceil(max > 0 ? max : 100);
  }, [products]);

  const activePriceLimit = priceFilter !== null ? priceFilter : highestProductPrice;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setPriceFilter(null);
    setStockFilter('all');
    setUnitFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || selectedCategory !== 'all' || priceFilter !== null || stockFilter !== 'all' || unitFilter !== 'all';

  const groupedProducts = useMemo(() => {
    const filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesPrice = priceFilter !== null ? p.price <= priceFilter : true;
      const matchesUnit = unitFilter !== 'all' ? (p.unit || 'unidade') === unitFilter : true;
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = p.stock !== undefined && p.stock <= 5;
      } else if (stockFilter === 'available') {
        matchesStock = p.stock !== undefined ? p.stock > 0 : true;
      } else if (stockFilter === 'out') {
        matchesStock = p.stock !== undefined && p.stock === 0;
      }
      return matchesSearch && matchesCategory && matchesPrice && matchesUnit && matchesStock;
    });

    return filtered.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [products, searchTerm, selectedCategory, priceFilter, unitFilter, stockFilter]);

  const totalFilteredCount = useMemo(() => {
    return Object.values(groupedProducts).reduce((sum, list) => sum + list.length, 0);
  }, [groupedProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const price = parseFloat(formData.price.replace(',', '.'));
      if (isNaN(price) || price < 0) {
        alert("Preço inválido");
        return;
      }

      let costPriceVal: number | undefined = undefined;
      if (formData.costPrice.trim() !== '') {
        costPriceVal = parseFloat(formData.costPrice.replace(',', '.'));
        if (isNaN(costPriceVal) || costPriceVal < 0) {
          alert("Preço de custo inválido");
          return;
        }
      }

      let wholesalePriceVal: number | undefined = undefined;
      if (formData.wholesalePrice.trim() !== '') {
        wholesalePriceVal = parseFloat(formData.wholesalePrice.replace(',', '.'));
        if (isNaN(wholesalePriceVal) || wholesalePriceVal < 0) {
          alert("Preço de atacado inválido");
          return;
        }
      }
      
      const stockVal = formData.stock !== '' ? parseInt(formData.stock, 10) : undefined;
      if (stockVal !== undefined && (isNaN(stockVal) || stockVal < 0)) {
        alert("Estoque inválido");
        return;
      }

      const productData = {
        name: formData.name.trim(),
        price: price,
        ...(costPriceVal !== undefined && { costPrice: costPriceVal }),
        ...(wholesalePriceVal !== undefined && { wholesalePrice: wholesalePriceVal }),
        category: formData.category.trim(),
        ...(stockVal !== undefined && { stock: stockVal }),
        unit: formData.unit || 'unidade',
        erpOnly: formData.erpOnly
      };

      if (!productData.name || !productData.category) {
        alert("Nome e categoria são obrigatórios");
        return;
      }

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productData,
          createdAt: editingProduct.createdAt || new Date().toISOString()
        });
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
        costPrice: product.costPrice !== undefined ? product.costPrice.toString() : '',
        wholesalePrice: product.wholesalePrice !== undefined ? product.wholesalePrice.toString() : '',
        category: product.category,
        stock: product.stock !== undefined ? product.stock.toString() : '',
        unit: product.unit || 'unidade',
        erpOnly: product.erpOnly || false
      });
      setIsNewCategory(false);
    } else {
      setEditingProduct(null);
      const defaultCat = Object.keys(groupedProducts).length > 0 ? Object.keys(groupedProducts).sort()[0] : '';
      setFormData({ name: '', price: '', costPrice: '', wholesalePrice: '', category: defaultCat, stock: '', unit: 'unidade', erpOnly: false });
      setIsNewCategory(Object.keys(groupedProducts).length === 0);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Catálogo de Produtos</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Gerencie o estoque, preços de venda, atacado e insumos da loja
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-shadow bg-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtros & Sliders</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => openModal()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center hover:bg-red-700 shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Category Sliding Bar (Barra Deslizante com Controles de Navegação Suave) */}
      <div className="relative flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-2xs">
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 shrink-0 transition-colors"
          title="Deslizar categorias para a esquerda"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={categoryScrollRef}
          className="flex-1 flex space-x-2 overflow-x-auto py-1 scrollbar-thin scroll-smooth"
        >
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>Todas as Categorias</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategory === 'all' ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {products.length}
            </span>
          </button>

          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-red-800 text-red-100' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 shrink-0 transition-colors"
          title="Deslizar categorias para a direita"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Filters Panel with Range Sliders (Barras Deslizantes Interativas) */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
              <SlidersHorizontal className="w-4 h-4 text-red-600" />
              <span>Ajustes Deslizantes & Filtros do Catálogo</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 transition-colors self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar Filtros Ativos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Slider 1: Barra Deslizante de Preço Máximo */}
            <div className="space-y-2 bg-gray-50/70 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1 text-gray-900">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Barra de Preço Varejo
                </span>
                <span className="text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                  {priceFilter !== null
                    ? `Até R$ ${priceFilter.toFixed(2).replace('.', ',')}`
                    : `Até R$ ${highestProductPrice.toFixed(2).replace('.', ',')} (Máx)`}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max={highestProductPrice}
                step="1"
                value={activePriceLimit}
                onChange={(e) => setPriceFilter(parseFloat(e.target.value))}
                className="custom-range-slider cursor-pointer"
              />

              <div className="flex justify-between text-[11px] text-gray-500 font-medium">
                <span>R$ 0,00</span>
                <button
                  type="button"
                  onClick={() => setPriceFilter(null)}
                  className="text-red-600 hover:underline text-[10px]"
                >
                  Sem limite
                </button>
                <span>R$ {highestProductPrice.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Slider/Control 2: Nível e Status de Estoque */}
            <div className="space-y-2 bg-gray-50/70 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1 text-gray-900">
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  Controle de Estoque
                </span>
                <span className="text-gray-500 font-normal text-[11px]">
                  {stockFilter === 'low'
                    ? '⚠️ Baixo (≤ 5)'
                    : stockFilter === 'available'
                    ? 'Em Estoque'
                    : stockFilter === 'out'
                    ? 'Esgotado'
                    : 'Todos'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setStockFilter('all')}
                  className={`text-xs py-1 px-2 rounded-md font-medium transition-colors ${
                    stockFilter === 'all'
                      ? 'bg-gray-800 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('available')}
                  className={`text-xs py-1 px-2 rounded-md font-medium transition-colors ${
                    stockFilter === 'available'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Disponíveis
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('low')}
                  className={`text-xs py-1 px-2 rounded-md font-medium transition-colors ${
                    stockFilter === 'low'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Baixo Estoque (≤5)
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('out')}
                  className={`text-xs py-1 px-2 rounded-md font-medium transition-colors ${
                    stockFilter === 'out'
                      ? 'bg-red-600 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Zerados (0)
                </button>
              </div>
            </div>

            {/* Control 3: Unidade de Medida */}
            <div className="space-y-2 bg-gray-50/70 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1 text-gray-900">
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  Unidade de Medida
                </span>
                <span className="text-gray-500 font-normal text-[11px]">
                  {unitFilter === 'all' ? 'Todas' : unitFilter === 'kg' ? 'Quilo (KG)' : 'Unidade (UN)'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setUnitFilter('all')}
                  className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                    unitFilter === 'all'
                      ? 'bg-gray-800 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setUnitFilter('kg')}
                  className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                    unitFilter === 'kg'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Por Quilo (KG)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitFilter('unidade')}
                  className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                    unitFilter === 'unidade'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Unidade (UN)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results summary bar */}
      <div className="flex justify-between items-center text-xs text-gray-500 px-1">
        <span>
          Exibindo <strong className="text-gray-900">{totalFilteredCount}</strong> de {products.length} produtos cadastrados
        </span>
        <span className="hidden sm:inline text-[11px] text-gray-400">
          💡 Dica: Role horizontalmente a tabela em telas compactas
        </span>
      </div>

      {/* Main Table with Smooth Horizontal Scrolling */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Varejo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Atacado</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Custo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estoque</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(groupedProducts).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Search className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="font-semibold text-gray-700">Nenhum produto encontrado</p>
                      <p className="text-xs text-gray-400">Tente ajustar o termo de busca ou redefinir as barras de filtros.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-bold"
                        >
                          Limpar Filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                Object.keys(groupedProducts).sort().map(category => (
                  <React.Fragment key={category}>
                    <tr className="bg-gray-100/75">
                      <td colSpan={7} className="px-5 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-y border-gray-200">
                        <span className="flex items-center justify-between">
                          <span>{category}</span>
                          <span className="text-[11px] font-normal text-gray-500 lowercase">
                            {groupedProducts[category].length} {groupedProducts[category].length === 1 ? 'item' : 'itens'}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {groupedProducts[category].sort((a,b) => a.name.localeCompare(b.name)).map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{product.name}</span>
                            {product.unit === 'kg' ? (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Scale className="w-3 h-3 text-amber-700" />
                                Cobrança por Kg
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                                UN
                              </span>
                            )}
                            {product.erpOnly && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                                Apenas ERP
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                          R$ {product.price.toFixed(2).replace('.', ',')}
                          {product.unit === 'kg' && (
                            <span className="text-xs text-amber-800 font-bold ml-1 bg-amber-50 px-1 py-0.5 rounded">/ kg</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
                          {product.wholesalePrice !== undefined ? `R$ ${product.wholesalePrice.toFixed(2).replace('.', ',')}` : '-'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">
                          {product.costPrice !== undefined ? `R$ ${product.costPrice.toFixed(2).replace('.', ',')}` : '-'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold ${product.stock !== undefined && product.stock <= 5 ? 'text-red-600' : 'text-gray-800'}`}>
                              {product.stock !== undefined ? `${product.stock} ${product.unit === 'kg' ? 'kg' : 'un'}` : '-'}
                            </span>
                            {product.stock !== undefined && product.stock <= 5 && (
                              <span title="Estoque baixo">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => openModal(product)} 
                            className="text-gray-400 hover:text-red-600 mr-3 p-1 rounded transition-colors"
                            title="Editar produto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)} 
                            className="text-gray-400 hover:text-red-700 p-1 rounded transition-colors"
                            title="Excluir produto"
                          >
                            <Trash2 className="w-4 h-4" />
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
                {/* Tipo de Cobrança / Unidade de Medida */}
                <div className="bg-gray-50/90 p-3.5 rounded-xl border border-gray-200">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
                    Tipo de Cobrança / Unidade
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, unit: 'unidade' })}
                      className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.unit === 'unidade'
                          ? 'bg-white border-red-600 text-red-700 shadow-sm ring-1 ring-red-600'
                          : 'bg-white/60 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Package className="w-5 h-5 text-gray-600" />
                      <span className="font-extrabold text-sm">Por Unidade (un)</span>
                      <span className="text-[10px] font-normal text-gray-500 text-center leading-tight">
                        Lanches, bebidas, porções prontas
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, unit: 'kg' })}
                      className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.unit === 'kg'
                          ? 'bg-amber-50 border-amber-600 text-amber-900 shadow-sm ring-1 ring-amber-600'
                          : 'bg-white/60 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Scale className="w-5 h-5 text-amber-600" />
                      <span className="font-extrabold text-sm text-amber-900">Cobrança por Quilo (kg)</span>
                      <span className="text-[10px] font-normal text-amber-800 text-center leading-tight">
                        Carnes defumadas, costela, queijos
                      </span>
                    </button>
                  </div>

                  {formData.unit === 'kg' && (
                    <div className="mt-3 bg-amber-100/90 border border-amber-300 text-amber-900 rounded-lg p-2.5 text-xs flex items-start gap-2 animate-fadeIn">
                      <Scale className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Cobrança por Quilo / Balança ativada</strong>
                        <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                          O preço abaixo deve ser <strong>por quilo (R$/kg)</strong>. No atendimento de Mesas e Balcão, ao adicionar este item o sistema abrirá a janela de pesagem para informar o peso em gramas ou calcular o peso a partir do valor desejado pelo cliente.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.unit === 'kg' ? 'Preço Varejo por Kg (R$/kg)' : 'Preço Varejo (R$)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border font-bold"
                    />
                    {formData.unit === 'kg' && (
                      <span className="text-[11px] text-amber-700 font-semibold block mt-1">Ex: R$ 89,90 por quilo</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.unit === 'kg' ? 'Preço Atacado por Kg (R$/kg)' : 'Preço Atacado (R$)'}
                    </label>
                    <input
                      type="text"
                      value={formData.wholesalePrice}
                      onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                      placeholder="0.00 (opcional)"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {formData.unit === 'kg' ? 'Preço de Custo por Kg (R$/kg)' : 'Preço de Custo (R$)'}
                  </label>
                  <input
                    type="text"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  />
                  <p className="text-xs text-gray-500 mt-1">Opcional, usado para cálculo de CMV no Fluxo de Caixa</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {formData.unit === 'kg' ? 'Estoque Opcional em Quilos (kg)' : 'Estoque Opcional (Quant. un)'}
                  </label>
                  <input
                    type="number"
                    step={formData.unit === 'kg' ? "0.01" : "1"}
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="Deixe em branco p/ não controlar"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  />
                </div>
                <div className="flex items-center mt-4">
                  <input
                    id="erpOnly"
                    type="checkbox"
                    checked={formData.erpOnly}
                    onChange={(e) => setFormData({ ...formData, erpOnly: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="erpOnly" className="ml-2 block text-sm font-medium text-gray-700">
                    Exibir este produto SOMENTE no ERP (Atacado)
                  </label>
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
