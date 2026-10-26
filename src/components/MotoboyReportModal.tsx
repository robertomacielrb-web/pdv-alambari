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
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Phone,
  RefreshCw,
  Copy,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Coins,
  Receipt
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
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
  const { storeName } = useStoreSettings();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'caixa_atual' | 'ontem' | '7dias' | 'custom'>('hoje');
  const [customDate, setCustomDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [motoboyName, setMotoboyName] = useState('');
  const [motoboyPhone, setMotoboyPhone] = useState('');

  // Exclusion set: Deliveries deselected from this report before sending
  const [excludedOrderIds, setExcludedOrderIds] = useState<Set<string>>(new Set());
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

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

  // Reset exclusions when the user changes main date
  useEffect(() => {
    setExcludedOrderIds(new Set());
  }, [periodFilter, customDate]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  // Filter orders by period and search
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

      // 2. Search filter
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
  }, [orders, periodFilter, customDate, currentSessionId, searchTerm]);

  // Active orders selected to be included in the fee report / WhatsApp / Print
  const activeOrders = useMemo(() => {
    return filteredOrders.filter((ord) => !excludedOrderIds.has(ord.id));
  }, [filteredOrders, excludedOrderIds]);

  // Toggle single order inclusion in report
  const toggleOrderInclusion = (id: string) => {
    setExcludedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllOrders = () => {
    setExcludedOrderIds(new Set());
  };

  const deselectAllOrders = () => {
    setExcludedOrderIds(new Set(filteredOrders.map((o) => o.id)));
  };

  // Calculations for Motoboy Delivery Fees (EXCLUSIVELY fees, no product sales values)
  const stats = useMemo(() => {
    let totalFees = 0;
    let maxFee = 0;

    activeOrders.forEach((ord) => {
      const fee = Number(ord.deliveryFee) || 0;
      totalFees += fee;
      if (fee > maxFee) maxFee = fee;
    });

    const count = activeOrders.length;
    const avgFee = count > 0 ? totalFees / count : 0;

    return {
      count,
      totalFees,
      avgFee,
      maxFee,
    };
  }, [activeOrders]);

  // Delete an order permanently from Firestore
  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete.id));
      showNotification(`Pedido #${orderToDelete.password || ''} de ${orderToDelete.customerName || 'Cliente'} excluído permanentemente.`);
      onOrderDeleted?.(orderToDelete.id);
      setOrderToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err);
      alert('Não foi possível excluir o pedido: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate WhatsApp text for motoboy - ONLY DELIVERY FEES
  const generateWhatsAppMessage = () => {
    const displayDate = periodFilter === 'hoje'
      ? format(new Date(), 'dd/MM/yyyy')
      : periodFilter === 'ontem'
      ? format(subDays(new Date(), 1), 'dd/MM/yyyy')
      : periodFilter === 'custom'
      ? format(parseISO(customDate), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy');

    let msg = `🛵 *${(storeName || 'ALAMBARI DEFUMADOS').toUpperCase()} - RELATÓRIO DE TAXAS DO MOTOBOY* 🛵\n`;
    if (motoboyName.trim()) {
      msg += `👤 *Motoboy:* ${motoboyName.trim()}\n`;
    }
    msg += `📅 *Data:* ${displayDate}\n`;
    msg += `📦 *Total de Corridas:* ${activeOrders.length}\n`;
    if (excludedOrderIds.size > 0) {
      msg += `ℹ️ _(${excludedOrderIds.size} entrega(s) desmarcada(s) deste fechamento)_\n`;
    }
    msg += `\n📋 *TAXAS POR ENTREGA:*\n`;

    activeOrders.forEach((ord, index) => {
      const timeStr = ord.closedAt || ord.createdAt ? format(parseISO(ord.closedAt || ord.createdAt), 'HH:mm') : '--:--';
      const fee = Number(ord.deliveryFee || 0).toFixed(2).replace('.', ',');
      const reg = ord.deliveryRegion || ord.deliveryAddress || 'Entrega';
      const client = ord.customerName ? ` (${ord.customerName})` : '';

      msg += `${index + 1}. *#${ord.password || ord.id.slice(-4)}* [${timeStr}] - ${reg}${client}\n`;
      msg += `   💵 *Taxa: R$ ${fee}*\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *TOTAL DE TAXAS A RECEBER: R$ ${stats.totalFees.toFixed(2).replace('.', ',')}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `\nObrigado pelo excelente trabalho! 🤝`;

    return msg;
  };

  const handleSendWhatsApp = () => {
    if (activeOrders.length === 0) {
      alert('Selecione pelo menos uma entrega para enviar.');
      return;
    }
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
    if (activeOrders.length === 0) {
      alert('Selecione pelo menos uma entrega para copiar.');
      return;
    }
    const text = generateWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2500);
    } catch {
      alert('Não foi possível copiar automaticamente.');
    }
  };

  // Print Motoboy Statement (Thermal 80mm or standard) - ONLY DELIVERY FEES
  const handlePrintMotoboyStatement = () => {
    if (activeOrders.length === 0) {
      alert('Selecione pelo menos uma entrega para imprimir o fechamento.');
      return;
    }

    const displayDate = periodFilter === 'hoje'
      ? format(new Date(), 'dd/MM/yyyy')
      : periodFilter === 'ontem'
      ? format(subDays(new Date(), 1), 'dd/MM/yyyy')
      : periodFilter === 'custom'
      ? format(parseISO(customDate), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy');

    const deliveriesRows = activeOrders.map((ord, idx) => {
      const timeStr = ord.closedAt || ord.createdAt ? format(parseISO(ord.closedAt || ord.createdAt), 'HH:mm') : '';
      const fee = Number(ord.deliveryFee || 0).toFixed(2).replace('.', ',');

      return `
        <tr>
          <td style="padding: 5px 0; border-bottom: 1px dotted #ccc;">
            <strong>${idx + 1}. #${ord.password || ord.id.slice(-4)}</strong> [${timeStr}]<br/>
            ${ord.customerName ? `<span>${ord.customerName}</span><br/>` : ''}
            <small style="color: #444;">${ord.deliveryRegion || ord.deliveryAddress || 'Local'}</small>
          </td>
          <td style="text-align: right; padding: 5px 0; border-bottom: 1px dotted #ccc; font-size: 13px; font-weight: bold; vertical-align: middle;">
            R$ ${fee}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Taxas Motoboy - ${motoboyName || 'Extrato'}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px;
            font-size: 12px;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .section-title { font-size: 13px; font-weight: bold; margin: 10px 0 4px 0; border-bottom: 1px solid #000; padding-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; }
          .totals-box { border: 1.5px solid #000; padding: 8px; margin: 12px 0; font-size: 12px; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .final-fee-box { border: 2px solid #000; background-color: #f9f9f9; padding: 8px; margin-top: 10px; text-align: center; font-size: 14px; font-weight: bold; }
          .signatures { margin-top: 25px; padding-top: 10px; display: flex; flex-direction: column; gap: 20px; text-align: center; font-size: 11px; }
          .sign-line { border-top: 1px dashed #000; padding-top: 4px; width: 85%; margin: 0 auto; }
          @media print {
            body { max-width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header center">
          <h2 style="margin: 0; font-size: 16px;">${(storeName || 'ALAMBARI DEFUMADOS').toUpperCase()}</h2>
          <div style="font-size: 13px; font-weight: bold; margin: 4px 0;">RELATÓRIO DE TAXAS DO MOTOBOY</div>
          <div>Data: ${displayDate}</div>
          ${motoboyName ? `<div style="font-size: 13px; font-weight: bold; margin-top: 3px;">MOTOBOY: ${motoboyName.toUpperCase()}</div>` : ''}
        </div>

        <div class="section-title">ENTREGAS E TAXAS (${activeOrders.length})</div>
        <table>
          <thead>
            <tr>
              <th>Entrega / Local</th>
              <th style="text-align: right;">Taxa</th>
            </tr>
          </thead>
          <tbody>
            ${deliveriesRows}
          </tbody>
        </table>

        <div class="totals-box">
          <div class="row">
            <span>Total de Corridas Realizadas:</span>
            <strong>${activeOrders.length} entregas</strong>
          </div>
          <div class="row" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #000; font-size: 14px;">
            <span>TOTAL DAS TAXAS:</span>
            <strong style="font-size: 16px;">R$ ${stats.totalFees.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>

        <div class="final-fee-box">
          <div style="font-size: 11px; font-weight: normal; margin-bottom: 2px;">VALOR TOTAL A PAGAR AO MOTOBOY:</div>
          <div style="font-size: 20px; font-weight: 900;">R$ ${stats.totalFees.toFixed(2).replace('.', ',')}</div>
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* High-contrast tactile scrollbar style */}
      <style>{`
        .motoboy-scroll {
          scrollbar-width: thin;
          scrollbar-color: #ea580c #f1f5f9;
        }
        .motoboy-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .motoboy-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .motoboy-scroll::-webkit-scrollbar-thumb {
          background: #ea580c;
          border-radius: 8px;
          border: 2px solid #f1f5f9;
        }
        .motoboy-scroll::-webkit-scrollbar-thumb:hover {
          background: #c2410c;
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-4xl w-full h-[92vh] max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 min-h-0 overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="shrink-0 p-3.5 sm:p-4 border-b bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight leading-tight flex items-center gap-2">
                Relatório de Taxas do Motoboy
              </h2>
              <p className="text-xs text-orange-100 font-medium">
                Controle exclusivo das taxas de entrega a pagar ao entregador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toast feedback */}
        {successToast && (
          <div className="shrink-0 bg-emerald-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 shadow-inner">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="shrink-0 p-3 sm:p-3.5 bg-gray-50 border-b border-gray-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                Data
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-0.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente, endereço, região ou senha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white outline-none focus:border-orange-500 font-medium"
              />
            </div>

            {/* Toggle summary button */}
            <button
              type="button"
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-1 cursor-pointer shrink-0"
              title={isSummaryExpanded ? "Recolher cards de resumo" : "Expandir cards de resumo"}
            >
              {isSummaryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{isSummaryExpanded ? 'Recolher Resumo' : 'Ver Resumo'}</span>
            </button>
          </div>
        </div>

        {/* Exclusive Delivery Fees KPI Cards */}
        {isSummaryExpanded ? (
          <div className="shrink-0 p-3 sm:p-3.5 bg-orange-50/50 border-b border-orange-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Card 1: Entregas Selecionadas */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Total de Entregas</span>
                <div className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">
                  {stats.count} <span className="text-xs font-semibold text-gray-500">corridas</span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {excludedOrderIds.size > 0 ? `${excludedOrderIds.size} desmarcada(s)` : 'Todas selecionadas'}
                </span>
              </div>

              {/* Card 2: Total Taxas Motoboy (Destaque Principal) */}
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white p-3 rounded-xl shadow-md sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-black tracking-wider text-orange-100 block flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-orange-200" />
                    Total de Taxas a Pagar ao Motoboy
                  </span>
                  <Receipt className="w-5 h-5 text-orange-200 opacity-60" />
                </div>
                <div className="text-2xl sm:text-3xl font-black mt-1">
                  R$ {stats.totalFees.toFixed(2).replace('.', ',')}
                </div>
                <span className="text-[11px] text-orange-100 font-medium">
                  Valor líquido das {stats.count} taxas de corrida selecionadas
                </span>
              </div>

              {/* Card 3: Média por Corrida */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Média por Entrega</span>
                <div className="text-xl sm:text-2xl font-black text-orange-600 mt-0.5">
                  R$ {stats.avgFee.toFixed(2).replace('.', ',')}
                </div>
                <span className="text-[10px] text-gray-400">Maior taxa: R$ {stats.maxFee.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="shrink-0 px-4 py-2.5 bg-orange-50/80 border-b border-orange-200 flex items-center justify-between text-xs font-bold text-gray-800 flex-wrap gap-2">
            <div>
              <span>Entregas Selecionadas: <strong>{stats.count} corridas</strong></span>
              <span className="mx-2 text-gray-300">•</span>
              <span>Média: <strong>R$ {stats.avgFee.toFixed(2).replace('.', ',')}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Total a Pagar ao Motoboy:</span>
              <span className="text-base font-black text-orange-600 bg-white px-2 py-0.5 rounded-lg border border-orange-300">
                R$ {stats.totalFees.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        )}

        {/* Deliveries List / Table - Flexible Scrollable Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 motoboy-scroll">
          {loading ? (
            <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
              <span className="font-medium text-sm">Carregando taxas de entregas...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-500 space-y-2">
              <Truck className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="font-bold text-gray-700 text-base">Nenhuma entrega encontrada para o filtro selecionado.</p>
              <p className="text-xs text-gray-400">Verifique a data ou altere os filtros de busca acima.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Batch selection and count helper */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100 bg-white sticky top-0 z-10 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-orange-600" />
                    Entregas no Relatório de Taxas:
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200">
                    {activeOrders.length} de {filteredOrders.length} selecionadas
                  </span>
                  {excludedOrderIds.size > 0 && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      ({excludedOrderIds.size} excluída{excludedOrderIds.size > 1 ? 's' : ''} do envio)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllOrders}
                    disabled={excludedOrderIds.size === 0}
                    className="font-bold text-orange-600 hover:text-orange-800 disabled:opacity-40 disabled:hover:text-orange-600 cursor-pointer transition-colors"
                  >
                    Marcar Todas
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllOrders}
                    disabled={activeOrders.length === 0}
                    className="font-bold text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:hover:text-gray-500 cursor-pointer transition-colors"
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>

              {/* Order Cards List - Showing ONLY delivery fees */}
              <div className="space-y-2.5">
                {filteredOrders.map((ord) => {
                  const isIncluded = !excludedOrderIds.has(ord.id);
                  const timeStr = ord.closedAt || ord.createdAt
                    ? format(parseISO(ord.closedAt || ord.createdAt), 'dd/MM HH:mm')
                    : '--:--';

                  return (
                    <div
                      key={ord.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isIncluded
                          ? 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-xs'
                          : 'bg-gray-50/80 border-dashed border-gray-300 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Checkbox button to toggle inclusion */}
                        <button
                          type="button"
                          onClick={() => toggleOrderInclusion(ord.id)}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 mt-1 ${
                            isIncluded
                              ? 'bg-orange-600 border-orange-600 text-white shadow-2xs'
                              : 'bg-white border-gray-300 text-transparent hover:border-orange-400'
                          }`}
                          title={isIncluded ? 'Clique para excluir do relatório de taxas' : 'Clique para incluir no relatório'}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        {/* Order identifier */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                          isIncluded ? 'bg-orange-100 text-orange-800' : 'bg-gray-200 text-gray-500'
                        }`}>
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
                            {!isIncluded && (
                              <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <EyeOff className="w-3 h-3" /> Desmarcado deste relatório
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

                      {/* Financial Value (ONLY DELIVERY FEE) & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                        {/* Only Delivery Fee Amount */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">
                            Taxa da Corrida
                          </span>
                          <span className="text-base sm:text-lg font-black text-orange-600 bg-orange-50 border border-orange-200 px-3 py-0.5 rounded-lg inline-block">
                            R$ {Number(ord.deliveryFee || 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        {/* Action: Excluir/Reincluir do Relatório de Taxas antes de enviar */}
                        <button
                          type="button"
                          onClick={() => toggleOrderInclusion(ord.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            isIncluded
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                          title={isIncluded ? 'Excluir esta taxa do relatório antes de enviar' : 'Reincluir taxa no relatório'}
                        >
                          {isIncluded ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Excluir do Envio</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Reincluir</span>
                            </>
                          )}
                        </button>

                        {/* Action: Excluir Pedido Definitivamente do Sistema */}
                        <button
                          type="button"
                          onClick={() => setOrderToDelete(ord)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir pedido definitivamente do banco de dados"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Actions - Strictly Focused on Delivery Fees */}
        <div className="shrink-0 p-3 sm:p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-inner">
          <div className="text-xs text-gray-700 font-medium text-center sm:text-left flex items-center gap-2 justify-center sm:justify-start">
            <span>
              Total a Pagar ao Motoboy:{" "}
              <strong className="text-orange-600 text-sm font-black">
                R$ {stats.totalFees.toFixed(2).replace('.', ',')}
              </strong>
            </span>
            <span className="text-gray-300">•</span>
            <span>
              <strong>{activeOrders.length}</strong> de {filteredOrders.length} corridas
            </span>
            {excludedOrderIds.size > 0 && (
              <span className="text-amber-700 font-bold">
                ({excludedOrderIds.size} desmarcada{excludedOrderIds.size > 1 ? 's' : ''})
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 flex-wrap">
            {/* Copy WhatsApp */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={activeOrders.length === 0}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Copiar texto com apenas as taxas do motoboy"
            >
              {copiedWhatsapp ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              <span>{copiedWhatsapp ? 'Copiado!' : 'Copiar Taxas'}</span>
            </button>

            {/* Send to WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={activeOrders.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Enviar lista de taxas das corridas selecionadas no WhatsApp do motoboy"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar Taxas no WhatsApp</span>
            </button>

            {/* Print Statement */}
            <button
              type="button"
              onClick={handlePrintMotoboyStatement}
              disabled={activeOrders.length === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Imprimir relatório exclusivo de taxas para o motoboy"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Taxas</span>
            </button>
          </div>
        </div>

        {/* Confirmation Modal to Delete Order Permanently */}
        {orderToDelete && (
          <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-red-200">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-gray-900">Excluir Pedido Delivery?</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Deseja realmente excluir o pedido <strong>#{orderToDelete.password || orderToDelete.id.slice(-4)}</strong> de <strong>{orderToDelete.customerName || 'Cliente'}</strong>?
                </p>
                <p className="text-[11px] text-red-600 font-semibold bg-red-50 p-2 rounded-lg mt-2">
                  Esta ação não pode ser desfeita. O pedido será removido permanentemente do banco de dados.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setOrderToDelete(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteOrder}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
