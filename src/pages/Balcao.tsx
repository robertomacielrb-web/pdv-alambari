import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Printer, Banknote, CreditCard, QrCode } from 'lucide-react';
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

interface CashierSession {
  id: string;
  status: string;
}

export default function Balcao() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  const [lastPassword, setLastPassword] = useState<number | null>(null);
  const [lastOrder, setLastOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [step, setStep] = useState<1 | 2>(1);

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

    return () => {
      unsubSession();
      unsubProducts();
    };
  }, []);

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
          <title>Pedido #${order.password}</title>
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
            <h1 style="margin: 10px 0;">SENHA: ${order.password}</h1>
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
    if (cart.length === 0) return;

    try {
      // Generate a random 3-digit password
      const password = Math.floor(100 + Math.random() * 900);

      const orderData = {
        type: 'balcao',
        status: 'closed',
        items: cart.map(item => ({
          productId: item.id || 'unknown',
          name: item.name || 'Produto',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1
        })),
        total: Number(total) || 0,
        paymentMethod: paymentMethod || 'dinheiro',
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        password: password || 0,
        cashierId: currentSession.id || 'unknown'
      };

      await addDoc(collection(db, 'orders'), orderData);
      
      // Update cashier session total
      await updateDoc(doc(db, 'cashierSessions', currentSession.id), {
        totalSales: increment(Number(total) || 0)
      });

      handlePrint(orderData);
      setLastOrder(orderData);
      setLastPassword(password);
      setCart([]);
      setStep(1);
    } catch (error: any) {
      alert("Erro ao finalizar venda: " + (error.message || "Verifique os dados e tente novamente."));
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  if (!currentSession) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Caixa Fechado</h2>
        <p className="text-gray-600">Você precisa abrir o caixa para realizar vendas.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative">
      {/* Step 1: Products List */}
      {step === 1 && (
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Selecione os Produtos</h2>
            {cart.length > 0 && (
              <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full">
                {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
              </span>
            )}
          </div>
          <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start pb-24">
            {products.map((product, index) => {
              const cartItem = cart.find(item => item.id === product.id);
              return (
                <button
                  key={`prod-${product.id}-${index}`}
                  onClick={() => addToCart(product)}
                  className="relative border rounded-xl p-4 text-left hover:border-red-500 hover:shadow-lg transition-all bg-white flex flex-col h-full group overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-100 group-hover:bg-red-500 transition-colors"></div>
                  <span className="font-bold text-gray-800 flex-1 text-lg leading-tight mb-2">{product.name}</span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md self-start mb-3">{product.category}</span>
                  <div className="flex justify-between items-end w-full mt-auto">
                    <span className="text-red-600 font-black text-lg">
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
            {products.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                Nenhum produto cadastrado.
              </div>
            )}
          </div>

          {/* Floating Next Step Button */}
          {cart.length > 0 && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
              <button
                onClick={() => setStep(2)}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-red-700 hover:shadow-2xl transition-all flex items-center justify-between px-6"
              >
                <div className="flex items-center">
                  <ShoppingCart className="w-6 h-6 mr-3" />
                  <span>Ver Carrinho</span>
                </div>
                <span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Cart & Checkout */}
      {step === 2 && (
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col max-w-2xl mx-auto w-full">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => setStep(1)} className="mr-4 text-gray-500 hover:text-gray-800">
                ← Voltar
              </button>
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <ShoppingCart className="w-6 h-6 mr-2" />
                Revisar Pedido
              </h2>
            </div>
            <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full">
              {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 mb-8">
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  O carrinho está vazio.
                  <button onClick={() => setStep(1)} className="block mx-auto mt-4 text-red-600 font-bold">
                    Adicionar Produtos
                  </button>
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

            {/* Forma de Pagamento - Moved inside scroll area */}
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
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full bg-green-600 text-white py-3 sm:py-4 rounded-xl font-bold text-lg sm:text-xl shadow-lg hover:bg-green-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <CheckCircle className="w-6 h-6 sm:w-7 h-7 mr-2" />
              Finalizar Venda
            </button>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {lastPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Venda Concluída!</h2>
            <p className="text-gray-600 mb-6">Senha do pedido:</p>
            <div className="text-6xl font-black text-red-600 mb-8 tracking-widest">
              {lastPassword}
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (lastOrder) handlePrint(lastOrder);
                }}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 flex items-center justify-center"
              >
                <Printer className="w-5 h-5 mr-2" />
                Imprimir Novamente
              </button>
              <button
                onClick={() => {
                  setLastPassword(null);
                  setLastOrder(null);
                }}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700"
              >
                Novo Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
