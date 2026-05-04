import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { History, Calendar, Search, Printer, FileText, CreditCard, Banknote, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  type: 'balcao' | 'mesa' | 'fiado';
  status: 'open' | 'closed';
  items: OrderItem[];
  total: number;
  paymentMethod?: 'dinheiro' | 'cartao' | 'pix';
  createdAt: string;
  closedAt?: string;
  password?: number;
  tableNumber?: number;
  customerName?: string;
  cashierId?: string;
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
      let q;
      if (selectedSessionId !== 'all') {
        q = query(
          collection(db, 'orders'),
          where('status', '==', 'closed'),
          where('cashierId', '==', selectedSessionId),
          orderBy('closedAt', 'desc')
        );
      } else {
        // Firestore doesn't support range filters on one field and equality on another easily without composite indexes
        // For simplicity, we'll fetch closed orders and filter by date in memory if needed, 
        // but let's try to filter by date range if possible.
        // Note: This requires an index on status and closedAt.
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        q = query(
          collection(db, 'orders'),
          where('status', '==', 'closed'),
          where('closedAt', '>=', start.toISOString()),
          where('closedAt', '<=', end.toISOString()),
          orderBy('closedAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const fetchedOrders: Order[] = [];
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
          cashierId: data.cashierId
        } as Order);
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 5px 0;">${item.name} x${item.quantity}</td>
        <td style="text-align: right; padding: 5px 0;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const content = `
      <html>
        <head>
          <title>Pedido #${order.password || order.id.slice(0, 5)}</title>
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
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), 'dd/MM/yyyy HH:mm')}</p>
            <p style="margin: 5px 0;">Tipo: ${order.type.toUpperCase()}</p>
            ${order.password ? `<h1 style="margin: 10px 0;">SENHA: ${order.password}</h1>` : ''}
            ${order.tableNumber ? `<p style="margin: 5px 0;">MESA: ${order.tableNumber}</p>` : ''}
            ${order.customerName ? `<p style="margin: 5px 0;">CLIENTE: ${order.customerName}</p>` : ''}
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
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
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
                <Search className="w-5 h-5 rotate-45" /> {/* Using Search as a close icon replacement if X is not imported */}
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

              <div className="border-t pt-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Itens</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
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
            <div className="p-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => handlePrint(selectedOrder)}
                className="flex-1 bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 flex items-center justify-center"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-md font-bold hover:bg-gray-50"
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
