import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { History, Calendar, Search, Printer, FileText, CreditCard, Banknote, QrCode, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { executePrint } from '../lib/printHelper';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  observation?: string;
}

interface Order {
  id: string;
  type: 'balcao' | 'mesa' | 'fiado' | 'delivery';
  status: 'open' | 'closed';
  items: OrderItem[];
  total: number;
  paymentMethod?: 'dinheiro' | 'cartao' | 'pix';
  createdAt: string;
  closedAt?: string;
  password?: number;
  tableNumber?: number;
  customerName?: string;
  observations?: string;
  cashierId?: string;
  deliveryFee?: number;
  deliveryPhone?: string;
  deliveryAddress?: string;
}

interface CashierSession {
  id: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  initialBalance: number;
  totalSales: number;
}

export default function Historico() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<CashierSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    // Get all sessions for the dropdown
    const qSessions = query(collection(db, 'cashierSessions'), orderBy('openedAt', 'desc'));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      const sess: CashierSession[] = [];
      snapshot.forEach(doc => sess.push({ id: doc.id, ...doc.data() } as CashierSession));
      setSessions(sess);
    });

    return () => unsubSessions();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetch orders using a simple query to avoid composite index errors
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'closed')
      );

      const snapshot = await getDocs(q);
      let fetchedOrders: Order[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        fetchedOrders.push({ 
          id: doc.id,
          type: data.type,
          status: data.status,
          items: data.items,
          total: data.total,
          paymentMethod: data.paymentMethod,
          createdAt: data.createdAt,
          closedAt: data.closedAt,
          password: data.password,
          tableNumber: data.tableNumber,
          customerName: data.customerName,
          observations: data.observations,
          cashierId: data.cashierId,
          deliveryFee: data.deliveryFee,
          deliveryPhone: data.deliveryPhone,
          deliveryAddress: data.deliveryAddress
        } as Order);
      });

      // Filter locally based on session or date
      if (selectedSessionId !== 'all') {
        fetchedOrders = fetchedOrders.filter(o => o.cashierId === selectedSessionId);
      } else {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        fetchedOrders = fetchedOrders.filter(o => {
          if (!o.closedAt) return false;
          const closed = new Date(o.closedAt);
          return closed >= start && closed <= end;
        });
      }

      // Sort locally by closedAt descending
      fetchedOrders.sort((a, b) => {
        const dateA = a.closedAt ? new Date(a.closedAt).getTime() : 0;
        const dateB = b.closedAt ? new Date(b.closedAt).getTime() : 0;
        return dateB - dateA;
      });

      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error fetching history:", error);
      alert("Erro ao buscar histórico. Verifique se os índices do Firestore foram criados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedSessionId, startDate, endDate]);

  const handlePrint = (order: Order) => {
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 5px 0;">
          ${item.name} x${item.quantity}
          ${item.observation ? `<br><small style="font-size: 10px; font-style: italic;">Obs: ${item.observation}</small>` : ""}
        </td>
        <td style="text-align: right; padding: 5px 0;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const productionItemsHtml = order.items
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px dotted #000;">
          <strong>${item.quantity}x</strong> ${item.name}
          ${item.observation ? `<br><span style="font-size: 14px; font-weight: bold; display: block; margin-top: 5px; padding: 3px; border: 1px solid #000;">Obs: ${item.observation}</span>` : ""}
        </td>
      </tr>
    `,
      )
      .join("");

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pedido #${order.password || order.id.slice(0, 5)}</title>
          <style>
            html, body { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 80mm; margin: 0 auto; padding: 10px; font-size: 13px; font-weight: bold; overflow-y: auto; overflow-x: hidden; min-height: 100vh; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .total { font-weight: bold; font-size: 14px; margin-top: 10px; display: flex; justify-content: space-between; }
            .cut-line { border-top: 1px dashed #000; margin: 30px 0; position: relative; text-align: center; }
            .cut-line span { background: #fff; padding: 0 5px; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-size: 10px; }
            .receipt-type { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px; padding: 5px; border: 1px solid #000; }
            
            .no-print { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 8px; position: sticky; top: 0; z-index: 100; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .btn { flex: 1; padding: 12px 10px; margin: 0 5px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; text-align: center; font-size: 14px; }
            .btn-print { background: #10b981; color: white; }
            .btn-close { background: #ef4444; color: white; }
            
            @media print { 
              @page { margin: 0; margin-top: 2mm; margin-bottom: 2mm; }
              .no-print { display: none !important; }
              body { width: 100%; max-width: none; overflow: visible; padding: 0; margin: 0; }
              html, body { height: auto; }
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn btn-close" onclick="window.close()">Fechar</button>
            <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir</button>
          </div>
          
          <!-- VIA DO CLIENTE -->
          <div class="receipt-type">VIA DO CLIENTE</div>
          <div class="header">
            <h2 style="margin: 0;">PDV ALAMBARI DEFUMADOS</h2>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), 'dd/MM/yyyy HH:mm')}</p>
            <p style="margin: 5px 0;">Tipo: ${order.type.toUpperCase()}</p>
            ${order.password ? `<h1 style="margin: 10px 0;">SENHA: ${order.password}</h1>` : ''}
            ${order.tableNumber ? `<p style="margin: 5px 0;">MESA: ${order.tableNumber}</p>` : ''}
            ${order.customerName ? `<p style="margin: 5px 0;">CLIENTE: ${order.customerName}</p>` : ''}
            ${order.observations ? `<p style="margin: 5px 0; font-weight: bold;">OBS: ${order.observations}</p>` : ''}
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
          <p style="margin: 5px 0;">Pagamento: ${order.paymentMethod?.toUpperCase() || 'N/A'}</p>
          <div class="footer">
            <p>Obrigado pela preferência!</p>
          </div>

          <div class="cut-line page-break"><span>✂-----------------------</span></div>

          <!-- VIA DA PRODUÇÃO -->
          <div class="receipt-type">VIA DA PRODUÇÃO</div>
          <div class="header">
            ${order.password ? `<h1 style="margin: 10px 0; font-size: 32px;">SENHA: ${order.password}</h1>` : ''}
            ${order.tableNumber ? `<h1 style="margin: 10px 0; font-size: 32px;">MESA: ${order.tableNumber}</h1>` : ''}
            ${!order.password && !order.tableNumber && order.customerName ? `<h1 style="margin: 10px 0; font-size: 32px;">ID: ${order.customerName}</h1>` : ''}
            
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), 'dd/MM/yyyy HH:mm')}</p>
            <p style="margin: 5px 0; font-weight: bold;">Tipo: ${order.type.toUpperCase()}</p>
            ${order.customerName ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold;">CLIENTE: ${order.customerName}</p>` : ''}
            ${order.observations ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 5px;">OBS GERAL: ${order.observations}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; border-bottom: 2px solid #000; font-size: 16px;">Itens</th>
              </tr>
            </thead>
            <tbody style="font-size: 16px;">
              ${productionItemsHtml}
            </tbody>
          </table>

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
  };

  const getPaymentIcon = (method?: string) => {
    switch (method) {
      case 'dinheiro': return <Banknote className="w-4 h-4 text-green-600" />;
      case 'cartao': return <CreditCard className="w-4 h-4 text-red-600" />;
      case 'pix': return <QrCode className="w-4 h-4 text-purple-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <History className="w-6 h-6 mr-2 text-red-600" />
          Histórico de Vendas
        </h1>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center bg-white border rounded-md px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border-none focus:ring-0 p-0"
            />
            <span className="mx-2 text-gray-400">até</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border-none focus:ring-0 p-0"
            />
          </div>

          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-white border rounded-md px-3 py-1.5 text-sm shadow-sm focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">Todos os Caixas</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                Caixa {format(new Date(s.openedAt), 'dd/MM HH:mm')} 
                {s.status === 'closed' ? ` (Fechado)` : ' (Aberto)'}
              </option>
            ))}
          </select>

          <button
            onClick={fetchOrders}
            className="bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-red-700 flex items-center"
          >
            <Search className="w-4 h-4 mr-2" />
            Filtrar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identificação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pagamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Carregando histórico...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Nenhuma venda encontrada para este período.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(order.closedAt || order.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        order.type === 'balcao' ? 'bg-red-100 text-red-800' :
                        order.type === 'mesa' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {order.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.type === 'balcao' && `Senha: ${order.password}`}
                      {order.type === 'mesa' && `Mesa ${order.tableNumber}`}
                      {order.type === 'fiado' && order.customerName}
                      {order.type === 'delivery' && `Entrega: ${order.customerName}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        {getPaymentIcon(order.paymentMethod)}
                        <span className="capitalize">{order.paymentMethod || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      R$ {order.total.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Ver Detalhes"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handlePrint(order)}
                        className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                        title="Imprimir"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold">Detalhes do Pedido</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Data/Hora</p>
                  <p className="font-medium">{format(new Date(selectedOrder.closedAt || selectedOrder.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tipo</p>
                  <p className="font-medium capitalize">{selectedOrder.type}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pagamento</p>
                  <p className="font-medium capitalize">{selectedOrder.paymentMethod || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-gray-500">ID do Pedido</p>
                  <p className="font-medium text-xs truncate">{selectedOrder.id}</p>
                </div>
              </div>

              {selectedOrder.customerName && (
                <div className="mt-2">
                  <p className="text-gray-500 text-sm">Cliente</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
              )}

              {selectedOrder.observations && (
                <div className="mt-2">
                  <p className="text-gray-500 text-sm">Observações</p>
                  <p className="font-medium text-red-700 bg-red-50 p-2 rounded text-sm border border-red-100">{selectedOrder.observations}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Itens</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="flex justify-between text-sm items-center">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-gray-500">{item.quantity}x de R$ {(item.price || 0).toFixed(2).replace('.', ',')}</span>
                      </div>
                      <span className="font-medium">R$ {((item.price || 0) * (item.quantity || 1)).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-black text-red-600">
                  R$ {selectedOrder.total.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex gap-2 sm:gap-3 flex-wrap">
              {selectedOrder.type === 'delivery' && (
                <button
                  onClick={() => {
                    const itemsText = selectedOrder.items
                      .map((item: any) => `*${item.quantity}x* ${item.name} - R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}`)
                      .join('\n');
                    
                    let message = `*Olá, ${selectedOrder.customerName || 'Cliente'}!* Aqui é do Alambari Defumados 🍖\n\nSeu pedido foi confirmado!\n\n`;
                    message += `*RESUMO DO PEDIDO:*\n${itemsText}\n\n`;
                    message += `*Subtotal:* R$ ${(selectedOrder.total - (selectedOrder.deliveryFee || 0)).toFixed(2).replace('.', ',')}\n`;
                    message += `*Taxa de Entrega:* R$ ${(selectedOrder.deliveryFee || 0).toFixed(2).replace('.', ',')}\n`;
                    message += `*TOTAL:* R$ ${selectedOrder.total.toFixed(2).replace('.', ',')}\n\n`;
                    message += `*Previsão de entrega:* 40 à 60 minutos dependendo da sua localidade.\n`;
                    message += `Obrigado pela preferência!`;

                    const phoneObj = selectedOrder.deliveryPhone ? selectedOrder.deliveryPhone.replace(/\D/g, '') : '';
                    const phoneUrl = phoneObj.length >= 10 ? `https://wa.me/55${phoneObj}` : 'https://wa.me/';
                    
                    window.open(`${phoneUrl}?text=${encodeURIComponent(message)}`, '_blank');
                  }}
                  className="w-full sm:flex-1 bg-green-500 text-white py-2 rounded-md font-bold hover:bg-green-600 flex items-center justify-center transition-colors"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Recibo WhatsApp
                </button>
              )}
              <button
                onClick={() => handlePrint(selectedOrder)}
                className="flex-1 bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 flex items-center justify-center"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </button>
              <button
                onClick={async () => {
                  if (window.confirm("Deseja realmente cancelar esta venda? Esta ação não pode ser desfeita e o registro será excluído.")) {
                    try {
                      const { deleteDoc, doc } = await import('firebase/firestore');
                      await deleteDoc(doc(db, "orders", selectedOrder.id));
                      setSelectedOrder(null);
                      alert("Venda cancelada e excluída com sucesso.");
                      fetchOrders();
                    } catch (error) {
                      console.error(error);
                      alert("Erro ao cancelar venda.");
                    }
                  }
                }}
                className="flex-1 bg-white border border-red-300 text-red-600 py-2 rounded-md font-bold hover:bg-red-50"
              >
                Cancelar Venda
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-[0.5] sm:flex-none px-4 bg-white border border-gray-300 text-gray-700 py-2 rounded-md font-bold hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
