import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, deleteDoc, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, getNextPassword } from "../firebase";
import { Users, ShoppingCart, List, Search, Plus, Trash2, Edit2, CheckCircle, Printer, Banknote, CreditCard, QrCode, Wallet, PackageOpen, Truck, Save, X } from "lucide-react";
import { format } from "date-fns";
import { executePrint } from "../lib/printHelper";

interface Product {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  category: string;
  stock?: number;
  unit?: 'unidade' | 'kg';
}

interface Customer {
  id: string;
  name: string;
  document: string;
  phone: string;
  address: string;
  createdAt: string;
}

interface CartItem extends Product {
  quantity: number;
  observation?: string;
  isWholesale: boolean;
}

interface CashierSession {
  id: string;
  status: string;
}

export default function ERP() {
  const [activeTab, setActiveTab] = useState<'nova_venda' | 'vendas_aberto' | 'clientes'>('nova_venda');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);

  useEffect(() => {
    // Fetch products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Fetch customers
    const unsubCustomers = onSnapshot(collection(db, "erp_customers"), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    // Fetch session
    const unsubSession = onSnapshot(
      query(collection(db, "cashierSessions"), where("status", "==", "open")),
      (snapshot) => {
        if (!snapshot.empty) {
          setCurrentSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CashierSession);
        } else {
          setCurrentSession(null);
        }
      }
    );

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubSession();
    };
  }, []);
  
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-gray-50 overflow-hidden">
      <div className="bg-white shadow-sm border-b p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <PackageOpen className="w-6 h-6 mr-2 text-indigo-600" />
          Módulo ERP (Atacado)
        </h1>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('nova_venda')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center whitespace-nowrap transition-colors ${activeTab === 'nova_venda' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Nova Venda
          </button>
          <button
            onClick={() => setActiveTab('vendas_aberto')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center whitespace-nowrap transition-colors ${activeTab === 'vendas_aberto' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <List className="w-5 h-5 mr-2" />
            Vendas em Aberto
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center whitespace-nowrap transition-colors ${activeTab === 'clientes' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Users className="w-5 h-5 mr-2" />
            Clientes
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'nova_venda' && <ERPNovaVenda products={products} customers={customers} currentSession={currentSession} />}
        {activeTab === 'vendas_aberto' && <ERPVendasAberto currentSession={currentSession} />}
        {activeTab === 'clientes' && <ERPClientes customers={customers} />}
      </div>
    </div>
  );
}

function ERPNovaVenda({ products, customers, currentSession }: { products: Product[], customers: Customer[], currentSession: CashierSession | null }) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [step, setStep] = useState<1|2>(1);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix' | 'fiado'>('dinheiro');
  const [observations, setObservations] = useState('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const subtotal = cart.reduce((acc, item) => acc + (item.isWholesale && item.wholesalePrice !== undefined ? item.wholesalePrice : item.price) * item.quantity, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setQtyInput('');
    setShowQtyModal(true);
  };

  const handleAddToCart = () => {
    if (!selectedProduct || !qtyInput) return;
    const qty = parseFloat(qtyInput.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) return;
    
    // Check if it should be wholesale (if > 10 units? Or let user decide? We can use wholesale price if it exists)
    // The prompt says "opção de vendas produtos em atacado" so we'll just check if it has a wholesale price.
    const isWholesale = selectedProduct.wholesalePrice !== undefined && selectedProduct.wholesalePrice > 0;
    
    const existing = cart.find(i => i.id === selectedProduct.id);
    if (existing) {
      setCart(cart.map(i => i.id === selectedProduct.id ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      setCart([...cart, { ...selectedProduct, quantity: qty, isWholesale }]);
    }
    setShowQtyModal(false);
    setSelectedProduct(null);
  };

  const handleCheckout = async () => {
    if (!currentSession) {
      alert("Abra o caixa primeiro!");
      return;
    }
    if (cart.length === 0 || !selectedCustomer) {
      alert("Selecione um cliente e adicione itens.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const password = await getNextPassword(currentSession.id);
      const customer = customers.find(c => c.id === selectedCustomer);
      const orderData = {
        type: 'atacado',
        status: paymentMethod === 'fiado' ? 'open' : 'closed', // Fiado stays open? Usually open sales wait for payment.
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.isWholesale && item.wholesalePrice !== undefined ? item.wholesalePrice : item.price,
          quantity: item.quantity,
          unit: item.unit || 'unidade'
        })),
        total,
        discount: Number(discount) || 0,
        paymentMethod,
        customerName: customer?.name || '',
        customerId: selectedCustomer,
        observations,
        createdAt: new Date().toISOString(),
        closedAt: paymentMethod !== 'fiado' ? new Date().toISOString() : null,
        password,
        sessionId: currentSession.id
      };
      
      const docRef = await addDoc(collection(db, "orders"), orderData);
      executePrint({ id: docRef.id, ...orderData }, `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px;">ATACADO - ${orderData.status === 'open' ? 'EM ABERTO' : 'FECHADO'}</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Cliente: ${customer?.name}</p>
        </div>
      `);
      
      setCart([]);
      setSelectedCustomer('');
      setStep(1);
    } catch (e) {
      console.error(e);
      alert("Erro ao finalizar venda.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 2) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-4">Finalizar Venda Atacado</h2>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-700">Resumo</h3>
            <p className="text-gray-600">Cliente: {customers.find(c => c.id === selectedCustomer)?.name}</p>
            <p className="text-gray-600">Total: R$ {total.toFixed(2).replace('.', ',')}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Desconto (R$)</label>
            <input 
              type="number" 
              value={discount} 
              onChange={e => setDiscount(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded-lg p-2"
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button onClick={() => setPaymentMethod('dinheiro')} className={`p-3 rounded-xl border-2 font-bold flex flex-col items-center ${paymentMethod === 'dinheiro' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <Banknote className="w-6 h-6 mb-1" /> Dinheiro
              </button>
              <button onClick={() => setPaymentMethod('cartao')} className={`p-3 rounded-xl border-2 font-bold flex flex-col items-center ${paymentMethod === 'cartao' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <CreditCard className="w-6 h-6 mb-1" /> Cartão
              </button>
              <button onClick={() => setPaymentMethod('pix')} className={`p-3 rounded-xl border-2 font-bold flex flex-col items-center ${paymentMethod === 'pix' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <QrCode className="w-6 h-6 mb-1" /> PIX
              </button>
              <button onClick={() => setPaymentMethod('fiado')} className={`p-3 rounded-xl border-2 font-bold flex flex-col items-center ${paymentMethod === 'fiado' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <Users className="w-6 h-6 mb-1" /> A Prazo (Fiado/Aberto)
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea 
              value={observations} 
              onChange={e => setObservations(e.target.value)}
              className="w-full border rounded-lg p-2"
              rows={3}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50">Voltar</button>
            <button onClick={handleCheckout} disabled={isProcessing} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center">
              {isProcessing ? 'Processando...' : <><CheckCircle className="w-5 h-5 mr-2" /> Confirmar</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Left side - Product Selection */}
      <div className="w-full md:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex space-x-2 overflow-x-auto mt-3 pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleProductClick(p)}
                className="p-3 border rounded-lg text-left hover:border-indigo-500 hover:shadow-md transition-all bg-gray-50"
              >
                <div className="font-bold text-gray-800 line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                <div className="text-xs text-gray-500 mt-1">{p.category}</div>
                <div className="mt-2 text-indigo-700 font-bold flex justify-between items-center">
                  <span>R$ {(p.wholesalePrice || p.price).toFixed(2).replace('.', ',')}</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">{p.unit === 'kg' ? 'KG' : 'UN'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Cart */}
      <div className="w-full md:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <select 
            value={selectedCustomer} 
            onChange={e => setSelectedCustomer(e.target.value)}
            className="w-full border rounded-lg p-2 bg-white"
          >
            <option value="">Selecione um cliente...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-10">Carrinho vazio</div>
          ) : (
            <ul className="space-y-3">
              {cart.map(item => (
                <li key={item.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.quantity} {item.unit === 'kg' ? 'kg' : 'un'} x R$ {(item.isWholesale && item.wholesalePrice !== undefined ? item.wholesalePrice : item.price).toFixed(2).replace('.', ',')}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">R$ {((item.isWholesale && item.wholesalePrice !== undefined ? item.wholesalePrice : item.price) * item.quantity).toFixed(2).replace('.', ',')}</span>
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-500 hover:bg-red-50 p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between font-bold text-lg mb-4 text-gray-800">
            <span>Total:</span>
            <span>R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
          <button 
            onClick={() => {
              if (cart.length > 0 && selectedCustomer) setStep(2);
              else alert('Selecione um cliente e adicione itens ao carrinho.');
            }} 
            disabled={cart.length === 0 || !selectedCustomer}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Avançar
          </button>
        </div>
      </div>

      {/* Quantity Modal */}
      {showQtyModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-lg mb-2">{selectedProduct.name}</h3>
            <div className="flex justify-between text-sm text-gray-500 mb-4">
              <span>Varejo: R$ {selectedProduct.price.toFixed(2)}</span>
              {selectedProduct.wholesalePrice && <span className="font-bold text-indigo-600">Atacado: R$ {selectedProduct.wholesalePrice.toFixed(2)}</span>}
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade ({selectedProduct.unit === 'kg' ? 'Quilogramas' : 'Unidades'})
            </label>
            <input 
              type="number"
              step={selectedProduct.unit === 'kg' ? '0.001' : '1'}
              min="0"
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4 text-lg text-center"
              placeholder="0"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddToCart(); }}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowQtyModal(false)} className="flex-1 py-2 border rounded-lg text-gray-700 font-bold hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAddToCart} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ERPVendasAberto({ currentSession }: { currentSession: CashierSession | null }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [viewMode, setViewMode] = useState<'open' | 'closed'>('open');
  
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "orders"), where("type", "==", "atacado"), where("status", "==", viewMode)),
      snapshot => {
        const sorted = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(sorted);
      }
    );
    return () => unsub();
  }, [viewMode]);

  const handlePrint = (order: any) => {
    executePrint(order, `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 18px;">ATACADO - ${order.status === 'open' ? 'EM ABERTO' : 'FECHADO'}</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px;">Cliente: ${order.customerName}</p>
        <p style="margin: 5px 0 0 0; font-size: 12px;">Data: ${format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</p>
      </div>
    `);
  };

  const confirmCloseOrder = async () => {
    if (!currentSession) {
      alert("Caixa fechado. Abra o caixa primeiro.");
      return;
    }
    if (closingOrderId) {
      await updateDoc(doc(db, "orders", closingOrderId), {
        status: "closed",
        closedAt: new Date().toISOString(),
        paymentMethod: paymentMethod,
        sessionId: currentSession.id
      });
      setClosingOrderId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-bold mb-4 sm:mb-0">Vendas Atacado</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('open')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'open' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Em Aberto
          </button>
          <button
            onClick={() => setViewMode('closed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'closed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Histórico (Fechadas)
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-gray-500">Nenhuma venda encontrada.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => (
            <div key={order.id} className="border rounded-lg p-4 shadow-sm relative flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-gray-800">{order.customerName}</div>
                  <div className="text-xs text-gray-500">{format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</div>
                </div>
                <button onClick={() => handlePrint(order)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Printer className="w-5 h-5" />
                </button>
              </div>
              
              <ul className="text-sm mb-4 space-y-1 flex-1">
                {order.items?.map((item: any, idx: number) => (
                  <li key={idx} className="flex justify-between">
                    <span className="text-gray-600">{item.quantity} {item.unit === 'kg' ? 'kg' : 'un'} {item.name}</span>
                    <span className="font-medium text-gray-800">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-auto">
                {order.discount > 0 && (
                  <div className="text-sm text-red-500 flex justify-between mb-1">
                    <span>Desconto:</span>
                    <span>- R$ {order.discount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div className="font-bold text-lg text-indigo-700 border-t pt-2 mb-3 flex justify-between">
                  <span>Total:</span>
                  <span>R$ {order.total.toFixed(2).replace('.', ',')}</span>
                </div>
                
                {viewMode === 'open' ? (
                  <button 
                    onClick={() => setClosingOrderId(order.id)}
                    className="w-full py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 flex items-center justify-center transition-colors"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Receber e Fechar
                  </button>
                ) : (
                  <div className="w-full py-2 bg-gray-100 text-gray-600 rounded-md font-bold text-center capitalize">
                    Pago em {order.paymentMethod}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {closingOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-lg mb-4">Confirmar Pagamento</h3>
            <div className="space-y-2 mb-6">
              <button onClick={() => setPaymentMethod('dinheiro')} className={`w-full py-3 rounded-lg border-2 font-bold flex items-center justify-center ${paymentMethod === 'dinheiro' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <Banknote className="w-5 h-5 mr-2" /> Dinheiro
              </button>
              <button onClick={() => setPaymentMethod('cartao')} className={`w-full py-3 rounded-lg border-2 font-bold flex items-center justify-center ${paymentMethod === 'cartao' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <CreditCard className="w-5 h-5 mr-2" /> Cartão
              </button>
              <button onClick={() => setPaymentMethod('pix')} className={`w-full py-3 rounded-lg border-2 font-bold flex items-center justify-center ${paymentMethod === 'pix' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                <QrCode className="w-5 h-5 mr-2" /> PIX
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setClosingOrderId(null)} className="flex-1 py-2 border rounded-lg text-gray-700 font-bold hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmCloseOrder} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ERPClientes({ customers }: { customers: Customer[] }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', document: '', phone: '', address: '' });

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const openModal = (c?: Customer) => {
    if (c) {
      setEditingId(c.id);
      setFormData({ name: c.name, document: c.document, phone: c.phone, address: c.address });
    } else {
      setEditingId(null);
      setFormData({ name: '', document: '', phone: '', address: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Nome é obrigatório");
    
    try {
      if (editingId) {
        await updateDoc(doc(db, "erp_customers", editingId), formData);
      } else {
        await addDoc(collection(db, "erp_customers"), { ...formData, createdAt: new Date().toISOString() });
      }
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar cliente.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 className="text-xl font-bold">Clientes (Atacado)</h2>
        <div className="flex items-center w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white text-sm"
            />
          </div>
          <button onClick={() => openModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center shrink-0">
            <Plus className="w-5 h-5 sm:mr-1" /> <span className="hidden sm:inline">Novo Cliente</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPF/CNPJ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endereço</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredCustomers.map(c => (
              <tr key={c.id}>
                <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                <td className="px-6 py-4 text-gray-500">{c.document || '-'}</td>
                <td className="px-6 py-4 text-gray-500">{c.phone || '-'}</td>
                <td className="px-6 py-4 text-gray-500 truncate max-w-xs">{c.address || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openModal(c)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => { if(window.confirm('Excluir cliente?')) deleteDoc(doc(db, "erp_customers", c.id)); }} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Nenhum cliente encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                <input type="text" value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border rounded p-2" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
