import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Users, Plus, Minus, Trash2, CheckCircle, X, Printer, Banknote, CreditCard, QrCode } from 'lucide-react';
import { format } from 'date-fns';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  id: string;
  type: string;
  status: string;
  customerName: string;
  items: CartItem[];
  total: number;
  createdAt?: string;
  closedAt?: string;
  paymentMethod?: string;
}

interface CashierSession {
  id: string;
  status: string;
}

export default function Fiados() {
  const [products, setProducts] = useState<Product[]>([]);
  const [openFiados, setOpenFiados] = useState<Order[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  
  const [selectedFiado, setSelectedFiado] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  useEffect(() => {
    // Get open cashier session
    const qSession = query(collection(db, 'cashierSessions'), where('status', '==', 'open'));
    const unsubSession = onSnapshot(qSession, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentSession({ id: snapshot.docs[0].id, status: 'open' });
      } else {
        setCurrentSession(null);
      }
    });

    // Get products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => prods.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
    });

    // Get open fiados
    const qFiados = query(collection(db, 'orders'), where('type', '==', 'fiado'), where('status', '==', 'open'));
    const unsubFiados = onSnapshot(qFiados, (snapshot) => {
      const fiados: Order[] = [];
      snapshot.forEach(doc => fiados.push({ id: doc.id, ...doc.data() } as Order));
      setOpenFiados(fiados);
    });

    return () => {
      unsubSession();
      unsubProducts();
      unsubFiados();
    };
  }, []);

  const openFiadoModal = (fiado: Order) => {
    setSelectedFiado(fiado);
    setCart(fiado.items);
  };

  const closeFiadoModal = () => {
    setSelectedFiado(null);
    setCart([]);
  };

  const handleCreateFiado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    try {
      await addDoc(collection(db, 'orders'), {
        type: 'fiado',
        status: 'open',
        customerName: newCustomerName,
        items: [],
        total: 0,
        createdAt: new Date().toISOString()
      });
      setIsNewModalOpen(false);
      setNewCustomerName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSaveFiado = async () => {
    if (!selectedFiado) return;
    
    try {
      await updateDoc(doc(db, 'orders', selectedFiado.id), {
        items: cart.map(item => ({
          productId: item.id || 'unknown',
          name: item.name || 'Produto',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1
        })),
        total: Number(total) || 0,
        createdAt: (typeof selectedFiado.createdAt === 'string' && selectedFiado.createdAt.includes('T')) 
          ? selectedFiado.createdAt 
          : new Date().toISOString()
      });
      closeFiadoModal();
    } catch (error: any) {
      alert("Erro ao salvar fiado: " + (error.message || "Verifique os dados e tente novamente."));
      handleFirestoreError(error, OperationType.UPDATE, `orders/${selectedFiado.id}`);
    }
  };

  const handlePrint = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map((item: any) => `
      <tr>
        <td style="padding: 5px 0;">${item.name} x${item.quantity}</td>
        <td style="text-align: right; padding: 5px 0;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const content = `
      <html>
        <head>
          <title>Fiado - ${order.customerName}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 12px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .total { font-weight: bold; font-size: 14px; margin-top: 10px; display: flex; justify-content: space-between; }
            @media print { body { width: 100%; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">PDV SIMPLES</h2>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt), 'dd/MM/yyyy HH:mm')}</p>
            <h1 style="margin: 10px 0;">FIADO: ${order.customerName}</h1>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; border-bottom: 1px solid #000;">Item</th>
                <th style="text-align: right; border-bottom: 1px solid #000;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total">
            <span>TOTAL PAGO:</span>
            <span>R$ ${order.total.toFixed(2).replace('.', ',')}</span>
          </div>
          <p style="margin: 5px 0;">Pagamento: ${order.paymentMethod.toUpperCase()}</p>
          <div class="footer">
            <p>Obrigado pela preferência!</p>
          </div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleCheckout = async () => {
    if (!currentSession) {
      alert("Abra o caixa primeiro para receber o pagamento!");
      return;
    }
    if (!selectedFiado) return;

    try {
      const orderData = {
        status: 'closed',
        closedAt: new Date().toISOString(),
        cashierId: currentSession.id || 'unknown',
        items: cart.map(item => ({
          productId: item.id || 'unknown',
          name: item.name || 'Produto',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1
        })),
        total: Number(total) || 0,
        paymentMethod: paymentMethod || 'dinheiro',
        createdAt: (typeof selectedFiado.createdAt === 'string' && selectedFiado.createdAt.includes('T')) 
          ? selectedFiado.createdAt 
          : new Date().toISOString()
      };

      await updateDoc(doc(db, 'orders', selectedFiado.id), orderData);
      
      // Update cashier session total
      await updateDoc(doc(db, 'cashierSessions', currentSession.id), {
        totalSales: increment(Number(total) || 0)
      });

      handlePrint({ ...selectedFiado, ...orderData });
      closeFiadoModal();
    } catch (error: any) {
      alert("Erro ao finalizar pagamento: " + (error.message || "Verifique os dados e tente novamente."));
      handleFirestoreError(error, OperationType.UPDATE, `orders/${selectedFiado.id}`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Fiados</h1>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-red-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {openFiados.map(fiado => (
          <button
            key={fiado.id}
            onClick={() => openFiadoModal(fiado)}
            className="bg-white p-6 rounded-lg shadow flex flex-col items-center justify-center transition-transform hover:scale-105 hover:shadow-md border border-gray-100"
          >
            <Users className="w-8 h-8 mb-3 text-red-600" />
            <span className="font-bold text-lg text-gray-800 truncate w-full text-center">{fiado.customerName}</span>
            <span className="text-sm mt-2 text-gray-500">
              Dívida: <span className="font-bold text-red-600">R$ {fiado.total.toFixed(2).replace('.', ',')}</span>
            </span>
          </button>
        ))}
        {openFiados.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            Nenhum fiado em aberto.
          </div>
        )}
      </div>

      {/* New Fiado Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Novo Fiado</h2>
              <button onClick={() => setIsNewModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateFiado}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fiado Modal */}
      {selectedFiado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Conta: {selectedFiado.customerName}</h2>
              <button onClick={closeFiadoModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Products List */}
              <div className="flex-1 border-r overflow-y-auto p-4 bg-gray-50">
                <h3 className="font-bold text-gray-700 mb-4">Adicionar Produtos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((product, index) => (
                    <button
                      key={`prod-${product.id}-${index}`}
                      onClick={() => addToCart(product)}
                      className="border rounded p-3 text-left hover:border-red-500 bg-white"
                    >
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-red-600 font-bold text-sm mt-1">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div className="w-full md:w-96 flex flex-col bg-white">
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-bold text-gray-700">Itens na Conta</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      Conta vazia
                    </div>
                  ) : (
                    cart.map((item, index) => (
                      <div key={`cart-item-${item.id}-${index}`} className="flex items-center justify-between border-b pb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                          <p className="text-gray-500 text-xs">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t bg-gray-50">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod('dinheiro')}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition ${
                          paymentMethod === 'dinheiro' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        <Banknote className="w-5 h-5 mb-1" />
                        Dinheiro
                      </button>
                      <button
                        onClick={() => setPaymentMethod('cartao')}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition ${
                          paymentMethod === 'cartao' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        <CreditCard className="w-5 h-5 mb-1" />
                        Cartão
                      </button>
                      <button
                        onClick={() => setPaymentMethod('pix')}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition ${
                          paymentMethod === 'pix' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        <QrCode className="w-5 h-5 mb-1" />
                        PIX
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600 font-medium">Total da Dívida</span>
                    <span className="text-2xl font-bold text-red-600">
                      R$ {total.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSaveFiado}
                      className="bg-red-100 text-red-700 py-2 rounded-lg font-bold hover:bg-red-200"
                    >
                      Salvar Conta
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || !currentSession}
                      className="bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <CheckCircle className="w-5 h-5 mr-1" />
                      Receber
                    </button>
                  </div>
                  {!currentSession && (
                    <p className="text-red-500 text-xs text-center mt-2">Abra o caixa para receber o pagamento.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
