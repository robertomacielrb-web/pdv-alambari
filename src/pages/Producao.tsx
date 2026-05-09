import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CheckCircle, Clock, Printer, ChefHat, Bell, Volume2, VolumeX } from 'lucide-react';
import { format } from 'date-fns';
import { executePrint } from '../lib/printHelper';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  observation?: string;
  productionStatus?: 'pending' | 'preparing' | 'ready';
}

interface Order {
  id: string;
  type: string;
  status: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  createdAt: string;
  closedAt?: string;
  password?: number;
  tableNumber?: number;
  customerName?: string;
  observations?: string;
}

export default function Producao() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(new Date());
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrdersRef = useRef<Order[]>([]);

  const toggleSound = () => {
    if (!soundEnabled) {
      if (audioRef.current) {
        audioRef.current.volume = 0.5;
        audioRef.current.play().then(() => {
          setSoundEnabled(true);
        }).catch(e => {
          console.error("Audio blocked:", e);
          alert("Navegador bloqueou o áudio. Tente interagir com a página.");
        });
      }
    } else {
      setSoundEnabled(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Buscar todos os pedidos que não estão finalizados/closed (ou que ainda têm itens pendentes)
    // Para simplificar e pegar apenas os do dia de hoje aberto (se não foram closed de vez, ou mesmo os closed que têm item pendente)
    // Como Firestore não permite query the array "items.productionStatus", vamos buscar pedidos da data atual ou com status open
    // e filtrar no cliente para garantir q mostre apenas com pending ou recently ready
    
    // Vamos pegar todos os pedidos dos ultimos 2 dias pra garantir que não perdemos. 
    // Pra PDV simples, os que tem status 'open' (mesas) ou criados hoje (balcão que já foi pago)
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.toISOString();

    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startOfToday),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const prods: Order[] = [];
      snapshot.forEach(doc => prods.push({ id: doc.id, ...doc.data() } as Order));
      
      setOrders(prods);

      // Check for new incoming orders
      const prevIds = prevOrdersRef.current.map(o => o.id);
      const newOrders = prods.filter(o => 
        !prevIds.includes(o.id) && 
        o.items && 
        o.items.some(i => i.productionStatus === 'pending' || i.productionStatus === 'preparing')
      );

      if (prevOrdersRef.current.length > 0 && newOrders.length > 0) {
        // Play notification sound
        if (soundEnabled && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 1.0;
          audioRef.current.play().catch(e => console.log('Audio autoplay blocked:', e));
        }

        // Add visual flash
        const newIds = newOrders.map(o => o.id);
        setNewOrderIds(prev => [...prev, ...newIds]);

        // Remove flash after 5 seconds
        setTimeout(() => {
          setNewOrderIds(prev => prev.filter(id => !newIds.includes(id)));
        }, 5000);
      }

      prevOrdersRef.current = prods;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    return () => unsub();
  }, []);

  const markItemAsReady = async (orderId: string, itemIndex: number, currentItems: OrderItem[]) => {
    try {
      const newItems = [...currentItems];
      if (newItems[itemIndex]) {
        newItems[itemIndex].productionStatus = 'ready';
      }
      
      await updateDoc(doc(db, 'orders', orderId), { 
        items: newItems
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const markOrderAllReady = async (orderId: string, currentItems: OrderItem[]) => {
    try {
      const newItems = currentItems.map(item => ({ ...item, productionStatus: 'ready' as const }));
      
      await updateDoc(doc(db, 'orders', orderId), { 
        items: newItems
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handlePrint = async (order: Order) => {
    const itemsHtml = order.items.map((item) => `
      <tr>
        <td style="padding: 5px 0;"><strong>${item.quantity}x</strong> ${item.name}
          ${item.observation ? `<br><small style="font-style: italic;">OBS: ${item.observation}</small>` : ''}
        </td>
      </tr>
    `).join('');

    const content = `
      <html>
        <head>
          <title>Produção Pedido #${order.password || order.tableNumber || 'Sn'}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 14px; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 10px 0; border-bottom: 1px dashed black; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .info { text-align: center; margin-bottom: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Ticket de Produção</h1>
          <div class="info">
            ${order.type === 'balcao' ? `SENHA: ${order.password}` : ''}
            ${order.type === 'mesa' ? `MESA: ${order.tableNumber}` : ''}
            ${order.customerName ? `<br>Cliente: ${order.customerName}` : ''}
          </div>
          <table>
            ${itemsHtml}
          </table>
          <p style="text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed black; padding-top: 10px;">
            ${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm:ss')}
          </p>
          <script>
            setTimeout(() => { 
                window.print(); 
                setTimeout(() => { window.close(); }, 500);
            }, 300);
          </script>
        </body>
      </html>
    `;

    executePrint(order, content);

    // Update status to preparing
    const hasPending = order.items.some(i => i.productionStatus === 'pending');
    if (hasPending) {
      try {
        const newItems = order.items.map(item => 
          item.productionStatus === 'pending' ? { ...item, productionStatus: 'preparing' as const } : item
        );
        await updateDoc(doc(db, 'orders', order.id), { items: newItems });
      } catch (error) {
        console.error('Error updating status to preparing:', error);
      }
    }
  };

  // Filtrar ordens que têm pelo menos um item pending ou preparing
  const ordersWithPending = orders.filter(o => o.items && o.items.some(item => item.productionStatus === 'pending' || item.productionStatus === 'preparing'));

  const getElapsedTime = (createdAt: string) => {
    const diffInMinutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes < 60) return `Há ${diffInMinutes} min`;
    const hours = Math.floor(diffInMinutes / 60);
    const mins = diffInMinutes % 60;
    return `Há ${hours}h ${mins}m`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
          <div className="flex items-center text-gray-800 font-bold text-xl">
            <ChefHat className="w-6 h-6 mr-2 text-red-600" />
            Painel de Produção
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSound}
              className={`flex items-center px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                soundEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 mr-1.5" />
                  Som Ativado
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 mr-1.5" />
                  Ativar Som
                </>
              )}
            </button>
            <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full flex items-center">
              {newOrderIds.length > 0 && <Bell className="w-4 h-4 mr-1 animate-bounce" />}
              {ordersWithPending.length} pedidos pendentes
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-100">
          {ordersWithPending.length === 0 ? (
            <div className="text-center text-gray-500 py-12 flex flex-col items-center">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4 opacity-50" />
              <p className="font-bold text-xl">Tudo limpo!</p>
              <p>Não há pedidos aguardando produção no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ordersWithPending.map((order) => {
                const pendingItems = order.items.filter(i => i.productionStatus === 'pending');
                const isNew = newOrderIds.includes(order.id);

                return (
                  <div key={order.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col relative transition-all duration-500 ${isNew ? 'border-red-500 ring-2 ring-red-300 ring-offset-2' : 'border-orange-200'}`}>
                    {isNew && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
                    )}
                    <div className={`${isNew ? 'bg-red-50' : 'bg-orange-50'} border-b ${isNew ? 'border-red-100' : 'border-orange-100'} p-3 flex justify-between items-center transition-colors duration-500`}>
                      <div className="flex items-center space-x-2">
                        <span className={`${isNew ? 'bg-red-600' : 'bg-orange-600'} text-white text-xs font-bold px-2 py-1 rounded transition-colors duration-500`}>
                          {order.type === 'balcao' ? `SENHA ${order.password}` : `MESA ${order.tableNumber}`}
                        </span>
                        {order.customerName && (
                          <span className="text-sm font-bold text-gray-700 truncate max-w-[120px]">
                            {order.customerName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isNew && <span className="text-xs font-bold text-red-600 animate-pulse uppercase tracking-wider">Novo!</span>}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-sm ${isNew ? 'text-red-700 bg-red-100' : 'text-orange-600 bg-orange-100'}`}>
                          {getElapsedTime(order.createdAt)}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(new Date(order.createdAt), 'HH:mm')}
                        </span>
                        <button 
                          onClick={() => handlePrint(order)}
                          className="text-gray-500 hover:text-gray-800 bg-white p-1 rounded border shadow-sm"
                          title="Imprimir ticket da cozinha"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {order.observations && (
                      <div className="px-4 py-2 bg-yellow-50 text-yellow-800 text-xs font-bold border-b border-yellow-100">
                        OBS PEDIDO: {order.observations}
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <ul className="space-y-3">
                        {order.items.map((item, idx) => (
                          <li key={idx} className={`flex justify-between items-start ${item.productionStatus === 'ready' ? 'opacity-40 line-through' : ''} ${item.productionStatus === 'preparing' ? 'text-blue-700' : ''}`}>
                            <div className="flex-1 pr-2">
                              <span className="font-bold text-gray-800">
                                {item.quantity}x {item.name}
                                {item.productionStatus === 'preparing' && <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Em Preparo</span>}
                              </span>
                              {item.observation && (
                                <p className="text-sm text-red-600 font-medium bg-red-50 p-1 rounded mt-1 border border-red-100">
                                  {item.observation}
                                </p>
                              )}
                            </div>
                            {(item.productionStatus === 'pending' || item.productionStatus === 'preparing') && (
                              <button 
                                onClick={() => markItemAsReady(order.id, idx, order.items)}
                                className="bg-green-100 text-green-700 hover:bg-green-200 p-1.5 rounded-lg border border-green-200 transition-colors shrink-0"
                                title="Marcar como pronto"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-gray-50 border-t flex justify-end">
                      <button 
                        onClick={() => markOrderAllReady(order.id, order.items)}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg w-full transition-colors flex items-center justify-center shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Tudo Pronto
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
