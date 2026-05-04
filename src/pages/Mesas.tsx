import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Coffee, Plus, Minus, Trash2, CheckCircle, X, Printer, Banknote, CreditCard, QrCode, ShoppingCart } from 'lucide-react';
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
  tableNumber: number;
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

export default function Mesas() {
  const [products, setProducts] = useState<Product[]>([]);
  const [openTables, setOpenTables] = useState<Order[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [step, setStep] = useState<1 | 2>(1);

  const totalTables = 20;

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

    // Get open tables
    const qTables = query(collection(db, 'orders'), where('type', '==', 'mesa'), where('status', '==', 'open'));
    const unsubTables = onSnapshot(qTables, (snapshot) => {
      const tables: Order[] = [];
      snapshot.forEach(doc => tables.push({ id: doc.id, ...doc.data() } as Order));
      setOpenTables(tables);
    });

    return () => {
      unsubSession();
      unsubProducts();
      unsubTables();
    };
  }, []);

  const openTableModal = (tableNumber: number) => {
    setSelectedTable(tableNumber);
    const existingOrder = openTables.find(t => t.tableNumber === tableNumber);
    if (existingOrder) {
      setCart(existingOrder.items);
    } else {
      setCart([]);
    }
    setStep(1);
  };

  const closeTableModal = () => {
    setSelectedTable(null);
    setCart([]);
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

  const handleSaveTable = async () => {
    if (!selectedTable) return;
    
    try {
      const existingOrder = openTables.find(t => t.tableNumber === selectedTable);
      
      const orderData: any = {
        type: 'mesa',
        status: 'open',
        tableNumber: selectedTable,
        items: cart.map(item => ({
          productId: item.id || 'unknown',
          name: item.name || 'Produto',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1
        })),
        total: Number(total) || 0,
        createdAt: (typeof existingOrder?.createdAt === 'string' && existingOrder.createdAt.includes('T')) 
          ? existingOrder.createdAt 
          : new Date().toISOString()
      };

      if (existingOrder) {
        if (cart.length === 0) {
           // If cart is empty, delete the order
           // Wait, the rules don't allow delete easily, let's just close it with 0 total
           await updateDoc(doc(db, 'orders', existingOrder.id), { status: 'closed', total: 0, items: [] });
        } else {
           await updateDoc(doc(db, 'orders', existingOrder.id), { items: orderData.items, total: orderData.total });
        }
      } else {
        if (cart.length > 0) {
          await addDoc(collection(db, 'orders'), orderData);
        }
      }
      closeTableModal();
    } catch (error: any) {
      alert("Erro ao salvar mesa: " + (error.message || "Verifique os dados e tente novamente."));
      handleFirestoreError(error, OperationType.WRITE, 'orders');
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
          <title>Mesa ${order.tableNumber}</title>
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
            <h1 style="margin: 10px 0;">MESA: ${order.tableNumber}</h1>
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
            <span>TOTAL:</span>
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
      alert("Abra o caixa primeiro!");
      return;
    }
    if (!selectedTable || cart.length === 0) return;

    try {
      const existingOrder = openTables.find(t => t.tableNumber === selectedTable);
      
      const orderData: any = {
        type: 'mesa',
        status: 'closed',
        tableNumber: selectedTable,
        items: cart.map(item => ({
          productId: item.id || 'unknown',
          name: item.name || 'Produto',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1
        })),
        total: Number(total) || 0,
        paymentMethod: paymentMethod || 'dinheiro',
        createdAt: (typeof existingOrder?.createdAt === 'string' && existingOrder.createdAt.includes('T')) 
          ? existingOrder.createdAt 
          : new Date().toISOString(),
        closedAt: new Date().toISOString(),
        cashierId: currentSession.id || 'unknown'
      };

      if (existingOrder) {
        await updateDoc(doc(db, 'orders', existingOrder.id), orderData);
      } else {
        await addDoc(collection(db, 'orders'), {
          ...orderData,
          createdAt: new Date().toISOString()
        });
      }
      
      // Update cashier session total
      await updateDoc(doc(db, 'cashierSessions', currentSession.id), {
        totalSales: increment(Number(total) || 0)
      });

      handlePrint(orderData);
      closeTableModal();
    } catch (error: any) {
      alert("Erro ao fechar conta: " + (error.message || "Verifique os dados e tente novamente."));
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mesas</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: totalTables }, (_, i) => i + 1).map((tableNumber, index) => {
          const isOpen = openTables.some(t => t.tableNumber === tableNumber);
          const order = openTables.find(t => t.tableNumber === tableNumber);
          
          return (
            <button
              key={`table-${tableNumber}-${index}`}
              onClick={() => openTableModal(tableNumber)}
              className={`p-6 rounded-lg shadow flex flex-col items-center justify-center transition-transform hover:scale-105 ${
                isOpen ? 'bg-red-600 text-white' : 'bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Coffee className={`w-8 h-8 mb-2 ${isOpen ? 'text-white' : 'text-gray-400'}`} />
              <span className="font-bold text-lg">Mesa {tableNumber}</span>
              {isOpen && order && (
                <span className="text-sm mt-1 bg-red-700 px-2 py-1 rounded">
                  R$ {order.total.toFixed(2).replace('.', ',')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[95vh] sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Mesa {selectedTable}</h2>
              <button onClick={closeTableModal} className="text-gray-500 hover:text-gray-700 p-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Step 1: Products List */}
              {step === 1 && (
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col">
                  <h3 className="font-bold text-gray-700 mb-4 text-lg">Adicionar Produtos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-28">
                    {products.map((product, index) => {
                      const cartItem = cart.find(item => item.id === product.id);
                      return (
                        <button
                          key={`prod-${product.id}-${index}`}
                          onClick={() => addToCart(product)}
                          className="relative border rounded-xl p-4 text-left hover:border-red-500 hover:shadow-lg transition-all bg-white flex flex-col h-full group overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-full h-1 bg-red-100 group-hover:bg-red-500 transition-colors"></div>
                          <span className="font-bold text-gray-800 flex-1 text-md leading-tight mb-2">{product.name}</span>
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md self-start mb-3">{product.category}</span>
                          <div className="flex justify-between items-end w-full mt-auto">
                            <span className="text-red-600 font-black">
                              R$ {product.price.toFixed(2).replace('.', ',')}
                            </span>
                            {cartItem && (
                              <span className="bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
                                {cartItem.quantity}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Floating Next Step Button */}
                  <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none">
                    <div className="w-full max-w-md flex gap-2 pointer-events-auto">
                      <button
                        onClick={handleSaveTable}
                        className="flex-1 bg-white text-red-600 border-2 border-red-600 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-red-50 transition-all"
                      >
                        Salvar Mesa
                      </button>
                      {cart.length > 0 && (
                        <button
                          onClick={() => setStep(2)}
                          className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all flex items-center justify-center"
                        >
                          <ShoppingCart className="w-5 h-5 mr-2" />
                          Ver Carrinho
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Cart & Checkout */}
              {step === 2 && (
                <div className="flex-1 flex flex-col bg-white max-w-2xl mx-auto w-full overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center">
                      <button onClick={() => setStep(1)} className="mr-4 text-gray-500 hover:text-gray-800 font-bold p-1">
                        ← Voltar
                      </button>
                      <h3 className="font-bold text-gray-700 text-lg">Revisar Pedido</h3>
                    </div>
                    <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full">
                      {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-4 mb-8">
                      {cart.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          Mesa vazia
                        </div>
                      ) : (
                        cart.map((item, index) => (
                          <div key={`cart-item-${item.id}-${index}`} className="flex items-center justify-between border-b pb-4">
                            <div className="flex-1">
                              <p className="font-bold text-gray-800 text-lg leading-tight mb-1">{item.name}</p>
                              <p className="text-gray-500 text-sm font-medium">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div className="flex items-center space-x-2 sm:space-x-3 bg-gray-50 p-1.5 rounded-lg border">
                              <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-100 flex items-center justify-center">
                                <Minus className="w-4 h-4 sm:w-5 h-5" />
                              </button>
                              <span className="w-6 sm:w-8 text-center font-bold text-md sm:text-lg">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-100 flex items-center justify-center">
                                <Plus className="w-4 h-4 sm:w-5 h-5" />
                              </button>
                              <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded ml-1 sm:ml-2 flex items-center justify-center">
                                <Trash2 className="w-4 h-4 sm:w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Forma de Pagamento - Moved semi-inside scroll area */}
                    <div className="mb-6">
                      <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Escolha a Forma de Pagamento</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setPaymentMethod('dinheiro')}
                          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                            paymentMethod === 'dinheiro' ? 'bg-green-50 border-green-500 text-green-700 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <Banknote className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                          <span className="text-xs sm:text-base text-center">Dinheiro</span>
                        </button>
                        <button
                          onClick={() => setPaymentMethod('cartao')}
                          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                            paymentMethod === 'cartao' ? 'bg-red-50 border-red-500 text-red-700 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <CreditCard className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                          <span className="text-xs sm:text-base text-center">Cartão</span>
                        </button>
                        <button
                          onClick={() => setPaymentMethod('pix')}
                          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                            paymentMethod === 'pix' ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <QrCode className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                          <span className="text-xs sm:text-base text-center">PIX</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 border-t bg-gray-50 shrink-0">
                    <div className="flex justify-between items-center mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
                      <span className="text-gray-600 font-bold text-md sm:text-lg">Total a Pagar</span>
                      <span className="text-2xl sm:text-3xl font-black text-gray-800">
                        R$ {total.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        onClick={handleSaveTable}
                        className="bg-red-100 text-red-700 py-3 sm:py-4 rounded-xl font-bold text-md sm:text-lg hover:bg-red-200 transition-all border border-red-200"
                      >
                        Salvar Mesa
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !currentSession}
                        className="bg-green-600 text-white py-3 sm:py-4 rounded-xl font-bold text-md sm:text-lg shadow-lg hover:bg-green-700 hover:shadow-xl disabled:opacity-50 flex items-center justify-center transition-all"
                      >
                        <CheckCircle className="w-5 h-5 sm:w-6 h-6 mr-2" />
                        Fechar Conta
                      </button>
                    </div>
                    {!currentSession && (
                      <p className="text-red-500 text-xs sm:text-sm text-center mt-3 font-bold bg-red-50 py-1 rounded">Abra o caixa para fechar a conta.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
