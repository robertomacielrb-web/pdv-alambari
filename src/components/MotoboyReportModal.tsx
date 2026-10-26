import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Truck,
  Calendar,
  Search,
  Printer,
  Trash2,
  X,
  MessageCircle,
  Banknote,
  CreditCard,
  QrCode,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Phone,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { format, isToday, parseISO, isYesterday, subDays, startOfDay, endOfDay } from 'date-fns';
import { executePrint } from '../lib/printHelper';
import { useStoreSettings } from '../contexts/StoreSettingsContext';

interface DeliveryOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  observation?: string;
  unit?: string;
}

interface DeliveryOrder {
  id: string;
  type: string;
  status: string;
  password?: number;
  customerName?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;
  deliveryRegion?: string;
  deliveryFee?: number;
  total: number;
  subtotal?: number;
  discount?: number;
  paymentMethod?: 'dinheiro' | 'cartao' | 'pix' | 'multiplo';
  splitPayments?: { method: string; amount: number }[];
  observations?: string;
  createdAt: string;
  closedAt?: string;
  cashierId?: string;
  items?: DeliveryOrderItem[];
}

interface MotoboyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string | null;
  onOrderDeleted?: (orderId: string) => void;
}

export default function MotoboyReportModal({
  isOpen,
  onClose,
  currentSessionId,
  onOrderDeleted
}: MotoboyReportModalProps) {
  const { storeName, whatsappNumber } = useStoreSettings();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'caixa_atual' | 'ontem' | '7dias' | 'custom'>('hoje');
  const [customDate, setCustomDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('todos');
  const [motoboyName, setMotoboyName] = useState('');
  const [motoboyPhone, setMotoboyPhone] = useState('');

  // Confirmation & Feedback
  const [orderToDelete, setOrderToDelete] = useState<DeliveryOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    // Listen to delivery orders in realtime
    const q = query(
      collection(db, 'orders'),
      where('type', '==', 'delivery')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: DeliveryOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as DeliveryOrder);
        });
        // Sort descending by closedAt or createdAt
        list.sort((a, b) => {
          const dateA = new Date(a.closedAt || a.createdAt).getTime();
          const dateB = new Date(b.closedAt || b.createdAt).getTime();
          return dateB - dateA;
        });
        setOrders(list);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao buscar pedidos de delivery:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  // Filter orders by period, search and payment
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');
    const sevenDaysAgo = subDays(now, 7);

    return orders.filter((order) => {
      const orderDateStr = order.closedAt || order.createdAt;
      const orderDate = orderDateStr ? parseISO(orderDateStr) : null;
      const orderDayStr = orderDateStr ? orderDateStr.split('T')[0] : '';

      // 1. Period filter
      if (periodFilter === 'hoje') {
        if (orderDayStr !== todayStr) return false;
      } else if (periodFilter === 'caixa_atual') {
        if (!currentSessionId || order.cashierId !== currentSessionId) return false;
      } else if (periodFilter === 'ontem') {
        if (orderDayStr !== yesterdayStr) return false;
      } else if (periodFilter === '7dias') {
        if (!orderDate || orderDate < sevenDaysAgo) return false;
      } else if (periodFilter === 'custom') {
        if (orderDayStr !== customDate) return false;
      }

      // 2. Payment filter
      if (paymentFilter !== 'todos') {
        if (order.paymentMethod !== paymentFilter) return false;
      }

      // 3. Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesClient = (order.customerName || '').toLowerCase().includes(term);
        const matchesAddress = (order.deliveryAddress || '').toLowerCase().includes(term);
        const matchesRegion = (order.deliveryRegion || '').toLowerCase().includes(term);
        const matchesPhone = (order.deliveryPhone || '').includes(term);
        const matchesPassword = String(order.password || '').includes(term);
        if (!matchesClient && !matchesAddress && !matchesRegion && !matchesPhone && !matchesPassword) {
          return false;
        }
      }

      return true;
    });
  }, [orders, periodFilter, customDate, currentSessionId, paymentFilter, searchTerm]);

  // Financial calculations for motoboy settlement
  const stats = useMemo(() => {
    let totalFees = 0;
    let totalSales = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalPix = 0;

    filteredOrders.forEach((ord) => {
      totalFees += Number(ord.deliveryFee) || 0;
      totalSales += Number(ord.total) || 0;

      if (ord.paymentMethod === 'dinheiro') {
        totalCash += Number(ord.total) || 0;
      } else if (ord.paymentMethod === 'cartao') {
        totalCard += Number(ord.total) || 0;
      } else if (ord.paymentMethod === 'pix') {
        totalPix += Number(ord.total) || 0;
      } else if (ord.paymentMethod === 'multiplo' && Array.isArray(ord.splitPayments)) {
        ord.splitPayments.forEach((p) => {
          if (p.method === 'dinheiro') totalCash += Number(p.amount) || 0;
          if (p.method === 'cartao') totalCard += Number(p.amount) || 0;
          if (p.method === 'pix') totalPix += Number(p.amount) || 0;
        });
      }
    });

    // Settlement: Cash collected by motoboy minus delivery fees owed to motoboy
    // If > 0: motoboy owes the restaurant
    // If < 0: restaurant owes the motoboy
    const netBalance = totalCash - totalFees;

    return {
      count: filteredOrders.length,
      totalFees,
      totalSales,
      totalCash,
      totalCard,
      totalPix,
      netBalance
    };
  }, [filteredOrders]);

  // Delete an order permanently
  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete.id));
      showNotification(`Pedido #${orderToDelete.password || ''} de ${orderToDelete.customerName || 'Cliente'} excluído com sucesso.`);
      onOrderDeleted?.(orderToDelete.id);
      setOrderToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err);
      alert('Não foi possível excluir o pedido: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate WhatsApp text for motoboy
  const generateWhatsAppMessage = () => {
    const displayDate = periodFilter === 'hoje'
      ? format(new Date(), 'dd/MM/yyyy')
      : periodFilter === 'ontem'
      ? format(subDays(new Date(), 1), 'dd/MM/yyyy')
      : periodFilter === 'custom'
      ? format(parseISO(customDate), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy');

    let msg = `🛵 *${(storeName || 'ALAMBARI DEFUMADOS').toUpperCase()} - ACERTO DO MOTOBOY* 🛵\n`;
    if (motoboyName.trim()) {
      msg += `👤 *Motoboy:* ${motoboyName.trim()}\n`;
    }
    msg += `📅 *Data / Período:* ${displayDate}\n`;
    msg += `📦 *Total de Corridas Realizadas:* ${stats.count}\n\n`;

    msg += `📋 *DETALHAMENTO DAS ENTREGAS:*\n`;
    filteredOrders.forEach((ord, index) => {
      const timeStr = ord.closedAt || ord.createdAt ? format(parseISO(ord.closedAt || ord.createdAt), 'HH:mm') : '--:--';
      const pgto = ord.paymentMethod ? ord.paymentMethod.toUpperCase() : 'N/D';
      const fee = Number(ord.deliveryFee || 0).toFixed(2).replace('.', ',');
      const ordTotal = Number(ord.total || 0).toFixed(2).replace('.', ',');
      const reg = ord.deliveryRegion || 'Padrão';
      msg += `${index + 1}. *#${ord.password || ord.id.slice(-4)}* (${timeStr}) - ${ord.customerName || 'Cliente'}\n`;
      msg += `   📍 ${reg} | Pgto: *${pgto}*\n`;
      msg += `   💵 Taxa Motoboy: *R$ ${fee}* | Total Pedido: R$ ${ordTotal}\n\n`;
    });

    msg += `📊 *RESUMO FINANCEIRO DO ACERTO:*\n`;
    msg += `• Total das Taxas de Entrega: *R$ ${stats.totalFees.toFixed(2).replace('.', ',')}*\n`;
    msg += `• Dinheiro Cobrado em Mãos: *R$ ${stats.totalCash.toFixed(2).replace('.', ',')}*\n`;
    msg += `• Pedidos em Cartão / PIX: R$ ${(stats.totalCard + stats.totalPix).toFixed(2).replace('.', ',')}\n\n`;

    msg += `💰 *SALDO FINAL DO FECHAMENTO:*\n`;
    if (stats.netBalance > 0) {
      msg += `👉 *O MOTOBOY REPASSA AO CAIXA:* *R$ ${stats.netBalance.toFixed(2).replace('.', ',')}*\n`;
      msg += `_(Recebeu R$ ${stats.totalCash.toFixed(2).replace('.', ',')} em dinheiro - R$ ${stats.totalFees.toFixed(2).replace('.', ',')} de suas taxas)_\n`;
    } else if (stats.netBalance < 0) {
      msg += `👉 *O CAIXA PAGA AO MOTOBOY:* *R$ ${Math.abs(stats.netBalance).toFixed(2).replace('.', ',')}*\n`;
      msg += `_(Taxas devidas superam o dinheiro cobrado em mãos)_\n`;
    } else {
      msg += `👉 *ACERTO EQUILIBRADO / ZERADO (R$ 0,00)*\n`;
    }

    msg += `\nQualquer dúvida estamos à disposição! Obrigado pelo excelente trabalho! 🤝`;
    return msg;
  };

  const handleSendWhatsApp = () => {
    const text = generateWhatsAppMessage();
    let cleanPhone = motoboyPhone.replace(/\D/g, '');
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyWhatsApp = async () => {
    const text = generateWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2500);
    } catch {
      alert('Não foi possível copiar automaticamente.');
    }
  };

  // Print Motoboy Statement (Thermal 80mm or A4)
  const handlePrintMotoboyStatement = () => {
    const displayDate = periodFilter === 'hoje'
      ? format(new Date(), 'dd/MM/yyyy')
      : periodFilter === 'ontem'
      ? format(subDays(new Date(), 1), 'dd/MM/yyyy')
      : periodFilter === 'custom'
      ? format(parseISO(customDate), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy');

    const deliveriesRows = filteredOrders.map((ord, idx) => {
      const timeStr = ord.closedAt || ord.createdAt ? format(parseISO(ord.closedAt || ord.createdAt), 'HH:mm') : '';
      const fee = Number(ord.deliveryFee || 0).toFixed(2).replace('.', ',');
      const totalStr = Number(ord.total || 0).toFixed(2).replace('.', ',');
      const pgto = (ord.paymentMethod || 'OUTRO').toUpperCase();

      return `
        <tr>
          <td style="padding: 4px 0; border-bottom: 1px dotted #ccc;">
            <strong>#${ord.password || ord.id.slice(-4)}</strong> (${timeStr})<br/>
            ${ord.customerName || 'Cliente'}<br/>
            <small style="color: #444;">${ord.deliveryRegion || ord.deliveryAddress || ''}</small>
          </td>
          <td style="text-align: center; padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 11px;">
            ${pgto}
          </td>
          <td style="text-align: right; padding: 4px 0; border-bottom: 1px dotted #ccc;">
            R$ ${totalStr}<br/>
            <strong style="color: #c2410c;">Taxa: R$ ${fee}</strong>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fechamento Motoboy - ${motoboyName || 'Entregas'}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px;
            font-size: 12px;
            color: #000;
            font-weight: bold;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 4px; }
          .box {
            border: 1px solid #000;
            padding: 8px;
            margin: 8px 0;
            background: #fff;
          }
          .signatures {
            margin-top: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .sign-line {
            border-top: 1px solid #000;
            text-align: center;
            padding-top: 4px;
            font-size: 11px;
          }
          @media print {
            body { max-width: none; width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0; font-size: 16px;">${storeName || 'ALAMBARI DEFUMADOS'}</h2>
          <div style="font-size: 13px; margin: 4px 0;">ACERTO / TAXAS DO MOTOBOY</div>
          ${motoboyName ? `<div style="font-size: 12px;">MOTOBOY: <strong>${motoboyName.toUpperCase()}</strong></div>` : ''}
          <div style="font-size: 11px; color: #333;">Data do Fechamento: ${displayDate}</div>
          <div style="font-size: 10px; color: #555;">Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th>CORRIDA / CLIENTE</th>
              <th style="text-align: center;">PGTO</th>
              <th class="right">VALOR / TAXA</th>
            </tr>
          </thead>
          <tbody>
            ${deliveriesRows}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="box">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Qtd. de Corridas:</span>
            <strong>${stats.count} entregas</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Total Taxas Motoboy:</span>
            <strong>R$ ${stats.totalFees.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Dinheiro Cobrado em Mãos:</span>
            <strong>R$ ${stats.totalCash.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
            <span>Pagos no Cartão / PIX:</span>
            <span>R$ ${(stats.totalCard + stats.totalPix).toFixed(2).replace('.', ',')}</span>
          </div>

          <div class="divider"></div>

          <div style="font-size: 14px; margin-top: 4px;">
            ${stats.netBalance > 0 ? `
              <div style="color: #000;">
                MOTOBOY REPASSA AO CAIXA:<br/>
                <span style="font-size: 18px; font-weight: 900;">R$ ${stats.netBalance.toFixed(2).replace('.', ',')}</span>
              </div>
            ` : stats.netBalance < 0 ? `
              <div style="color: #000;">
                CAIXA PAGA AO MOTOBOY:<br/>
                <span style="font-size: 18px; font-weight: 900;">R$ ${Math.abs(stats.netBalance).toFixed(2).replace('.', ',')}</span>
              </div>
            ` : `
              <div style="color: #000;">ACERTO EQUILIBRADO (R$ 0,00)</div>
            `}
          </div>
        </div>

        <div class="signatures">
          <div class="sign-line">
            ${motoboyName || 'Assinatura do Motoboy'}
          </div>
          <div class="sign-line">
            Responsável pelo Caixa / PDV
          </div>
        </div>

        <script>
          setTimeout(() => {
            window.print();
            setTimeout(() => { window.close(); }, 500);
          }, 300);
        </script>
      </body>
      </html>
    `;

    executePrint({ id: 'fechamento_motoboy_' + Date.now() }, htmlContent);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight leading-tight flex items-center gap-2">
                Relatório de Taxas do Motoboy
              </h2>
              <p className="text-xs text-orange-100 font-medium">
                Controle de entregas, fechamento de taxas e conferência de dinheiro cobrado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toast feedback */}
        {successToast && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 animate-fade-in shadow-inner">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-b border-gray-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Period selector buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase text-gray-500 mr-1">Período:</span>
              <button
                type="button"
                onClick={() => setPeriodFilter('hoje')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodFilter === 'hoje'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Hoje
              </button>
              {currentSessionId && (
                <button
                  type="button"
                  onClick={() => setPeriodFilter('caixa_atual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    periodFilter === 'caixa_atual'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Apenas entregas da sessão atual de caixa aberta"
                >
                  Caixa Atual
                </button>
              )}
              <button
                type="button"
                onClick={() => setPeriodFilter('ontem')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodFilter === 'ontem'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('7dias')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodFilter === '7dias'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodFilter === 'custom'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Data Específica
              </button>

              {periodFilter === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold border border-gray-300 rounded-lg bg-white outline-none focus:border-orange-500"
                />
              )}
            </div>

            {/* Motoboy identification */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nome do Motoboy..."
                value={motoboyName}
                onChange={(e) => setMotoboyName(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white outline-none focus:border-orange-500 w-36 sm:w-44"
              />
              <input
                type="tel"
                placeholder="Wpp Motoboy..."
                value={motoboyPhone}
                onChange={(e) => setMotoboyPhone(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white outline-none focus:border-orange-500 w-32"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, endereço, região ou senha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white outline-none focus:border-orange-500 font-medium"
              />
            </div>

            {/* Payment filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase text-gray-500 shrink-0">Pgto:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold border border-gray-300 rounded-lg bg-white outline-none focus:border-orange-500"
              >
                <option value="todos">Todos Pagamentos</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="pix">PIX</option>
                <option value="multiplo">Múltiplo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="p-3.5 sm:p-4 bg-orange-50/50 border-b border-orange-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Card 1: Entregas */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Total de Entregas</span>
              <div className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">
                {stats.count} <span className="text-xs font-semibold text-gray-500">corridas</span>
              </div>
              <span className="text-[10px] text-gray-400">Total vendido: R$ {stats.totalSales.toFixed(2).replace('.', ',')}</span>
            </div>

            {/* Card 2: Total Taxas Motoboy */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 rounded-xl border border-orange-300 shadow-2xs">
              <span className="text-[10px] uppercase font-black text-orange-800 block">Taxas a Repassar (Motoboy)</span>
              <div className="text-xl sm:text-2xl font-black text-orange-600 mt-0.5">
                R$ {stats.totalFees.toFixed(2).replace('.', ',')}
              </div>
              <span className="text-[10px] text-orange-800/80 font-medium">Ganhos do motoboy</span>
            </div>

            {/* Card 3: Dinheiro Cobrado em Mãos */}
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Dinheiro Cobrado em Mãos</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
                R$ {stats.totalCash.toFixed(2).replace('.', ',')}
              </div>
              <span className="text-[10px] text-gray-500">Cartão/PIX: R$ {(stats.totalCard + stats.totalPix).toFixed(2).replace('.', ',')}</span>
            </div>

            {/* Card 4: Saldo do Fechamento (Acerto) */}
            <div className={`p-3 rounded-xl border shadow-2xs ${
              stats.netBalance > 0
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : stats.netBalance < 0
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-gray-50 border-gray-300 text-gray-900'
            }`}>
              <span className="text-[10px] uppercase font-black block">
                {stats.netBalance > 0
                  ? 'Motoboy Repassa ao Caixa'
                  : stats.netBalance < 0
                  ? 'Caixa Paga ao Motoboy'
                  : 'Acerto Equilibrado'}
              </span>
              <div className="text-xl sm:text-2xl font-black mt-0.5">
                R$ {Math.abs(stats.netBalance).toFixed(2).replace('.', ',')}
              </div>
              <span className="text-[10px] font-semibold opacity-80">
                {stats.netBalance > 0
                  ? `(Dinheiro ${stats.totalCash.toFixed(2)} - Taxas ${stats.totalFees.toFixed(2)})`
                  : stats.netBalance < 0
                  ? `(Taxas ${stats.totalFees.toFixed(2)} - Dinheiro ${stats.totalCash.toFixed(2)})`
                  : 'Valores em dia'}
              </span>
            </div>
          </div>
        </div>

        {/* Deliveries List / Table */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
              <span>Carregando histórico de entregas...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Truck className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-bold text-gray-700">Nenhuma entrega encontrada para o filtro selecionado.</p>
              <p className="text-xs text-gray-400">Verifique a data ou altere os filtros de busca acima.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredOrders.map((ord) => {
                const timeStr = ord.closedAt || ord.createdAt
                  ? format(parseISO(ord.closedAt || ord.createdAt), 'dd/MM HH:mm')
                  : '--:--';
                const isCash = ord.paymentMethod === 'dinheiro';
                const isCard = ord.paymentMethod === 'cartao';
                const isPix = ord.paymentMethod === 'pix';
                const isMulti = ord.paymentMethod === 'multiplo';

                return (
                  <div
                    key={ord.id}
                    className="p-3 bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                        #{ord.password || ord.id.slice(-4)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-gray-900 truncate">
                            {ord.customerName || 'Cliente sem nome'}
                          </span>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" /> {timeStr}
                          </span>
                          {ord.status === 'open' && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                              Pendente / Em Aberto
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                          {ord.deliveryRegion && (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded text-[11px]">
                              <MapPin className="w-3 h-3 text-orange-600" />
                              {ord.deliveryRegion}
                            </span>
                          )}
                          <span className="truncate" title={ord.deliveryAddress}>
                            {ord.deliveryAddress || 'Endereço não informado'}
                          </span>
                          {ord.deliveryPhone && (
                            <span className="text-gray-400 text-[11px]">
                              • {ord.deliveryPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial Values & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      {/* Payment Method Badge */}
                      <span className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                        isCash
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isCard
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : isPix
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-teal-50 text-teal-800 border border-teal-200'
                      }`}>
                        {isCash && <Banknote className="w-3.5 h-3.5" />}
                        {isCard && <CreditCard className="w-3.5 h-3.5" />}
                        {isPix && <QrCode className="w-3.5 h-3.5" />}
                        {isMulti && <Wallet className="w-3.5 h-3.5" />}
                        <span>{(ord.paymentMethod || 'Outro').toUpperCase()}</span>
                      </span>

                      {/* Amounts */}
                      <div className="text-right">
                        <div className="text-xs text-gray-500 font-medium">
                          Pedido: <strong className="text-gray-800">R$ {Number(ord.total || 0).toFixed(2).replace('.', ',')}</strong>
                        </div>
                        <div className="text-sm font-black text-orange-600 flex items-center gap-1 justify-end">
                          <span>Taxa:</span>
                          <span className="bg-orange-100 text-orange-900 px-1.5 py-0.2 rounded font-extrabold">
                            R$ {Number(ord.deliveryFee || 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>

                      {/* Delete action button */}
                      <button
                        type="button"
                        onClick={() => setOrderToDelete(ord)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir este pedido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="text-xs text-gray-500 font-medium text-center sm:text-left">
            Total filtrado: <strong>{filteredOrders.length} entregas</strong> • Taxas: <strong>R$ {stats.totalFees.toFixed(2).replace('.', ',')}</strong>
          </div>

          <div className="flex items-center justify-end gap-2 flex-wrap">
            {/* Copy WhatsApp */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={filteredOrders.length === 0}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Copiar texto do fechamento"
            >
              {copiedWhatsapp ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              <span>{copiedWhatsapp ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            {/* Send to WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={filteredOrders.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Enviar extrato de taxas diretamente no WhatsApp do motoboy"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar no WhatsApp</span>
            </button>

            {/* Print Statement */}
            <button
              type="button"
              onClick={handlePrintMotoboyStatement}
              disabled={filteredOrders.length === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Imprimir extrato do motoboy em impressora térmica ou padrão"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Acerto</span>
            </button>
          </div>
        </div>

        {/* Confirmation Modal to Delete Order */}
        {orderToDelete && (
          <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-red-200 animate-scale-in">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-gray-900">Excluir Pedido Delivery?</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Deseja realmente excluir o pedido <strong>#{orderToDelete.password || orderToDelete.id.slice(-4)}</strong> de <strong>{orderToDelete.customerName || 'Cliente'}</strong>?
                </p>
                <div className="bg-red-50 p-2.5 rounded-lg text-xs font-semibold text-red-800 text-left mt-2 border border-red-100">
                  • Total: R$ {Number(orderToDelete.total || 0).toFixed(2).replace('.', ',')}<br/>
                  • Taxa: R$ {Number(orderToDelete.deliveryFee || 0).toFixed(2).replace('.', ',')}<br/>
                  • Esta ação não pode ser desfeita.
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteOrder}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
