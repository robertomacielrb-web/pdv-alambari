import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Wallet,
  Activity,
  Calculator
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  total: number;
  createdAt: string;
  paymentMethod: string;
  items: OrderItem[];
}

interface Bill {
  id: string;
  amount: number;
  paymentDate?: string;
  dueDate: string;
  status: string;
  category?: string;
}

interface Product {
  id: string;
  name: string;
  costPrice?: number;
}

export default function FluxoCaixa() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Carregar produtos para calcular CMV
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prodList: Product[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        prodList.push({ id: doc.id, name: data.name, costPrice: data.costPrice });
      });
      setProducts(prodList);
    });

    // Carregar vendas (orders)
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        orderList.push({
          id: doc.id,
          total: Number(data.total) || 0,
          createdAt: data.createdAt || new Date().toISOString(),
          paymentMethod: data.paymentMethod || '',
          items: data.items || []
        });
      });
      setOrders(orderList);
    });

    // Carregar despesas (bills)
    const unsubscribeBills = onSnapshot(collection(db, 'bills'), (snapshot) => {
      const billList: Bill[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        billList.push({
          id: doc.id,
          amount: Number(data.amount) || 0,
          status: data.status,
          dueDate: data.dueDate,
          paymentDate: data.paymentDate,
          category: data.category
        });
      });
      setBills(billList);
      setIsLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeBills();
    };
  }, []);

  const metrics = useMemo(() => {
    let receitas = 0;
    let cmv = 0;
    let despesasPagas = 0;
    let despesasPendentes = 0;
    const expensesByCategory: Record<string, number> = {};
    const salesByPaymentMethod: Record<string, number> = {};
    const productSalesMap: Record<string, {name: string, quantity: number, total: number}> = {};
    let totalOrders = 0;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    const productCostMap = new Map<string, number>();
    products.forEach(p => {
      if (p.costPrice !== undefined) {
        productCostMap.set(p.id, p.costPrice);
      }
    });

    // Calcular Receitas e CMV no período
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= start && orderDate <= end) {
        receitas += order.total;
        totalOrders += 1;
        
        const method = order.paymentMethod || 'Outros';
        salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + order.total;
        
        // Calcular CMV para esta venda e agregar produtos
        order.items.forEach(item => {
          const cost = productCostMap.get(item.id) || 0;
          cmv += cost * item.quantity;

          if (!productSalesMap[item.id]) {
            productSalesMap[item.id] = { name: item.name, quantity: 0, total: 0 };
          }
          productSalesMap[item.id].quantity += item.quantity;
          productSalesMap[item.id].total += (item.price * item.quantity);
        });
      }
    });

    // Calcular Despesas pagas no período
    bills.forEach(bill => {
      const dueDate = new Date(bill.dueDate);
      const payDate = bill.paymentDate ? new Date(bill.paymentDate) : null;
      
      if (bill.status === 'paid' && payDate) {
        if (payDate >= start && payDate <= end) {
          despesasPagas += bill.amount;
          const cat = bill.category || 'Outros';
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + bill.amount;
        }
      } else {
        // Despesas a pagar que vencem neste periodo
        if (dueDate >= start && dueDate <= end) {
          despesasPendentes += bill.amount;
        }
      }
    });

    const lucroBruto = receitas - cmv;
    const lucroLiquido = lucroBruto - despesasPagas;
    const ticketMedio = totalOrders > 0 ? receitas / totalOrders : 0;
    
    const topProducts = Object.values(productSalesMap).sort((a, b) => b.total - a.total).slice(0, 5);

    return {
      receitas,
      cmv,
      despesasPagas,
      despesasPendentes,
      lucroBruto,
      lucroLiquido,
      margemBruta: receitas > 0 ? (lucroBruto / receitas) * 100 : 0,
      margemLiquida: receitas > 0 ? (lucroLiquido / receitas) * 100 : 0,
      expensesByCategory,
      salesByPaymentMethod,
      ticketMedio,
      topProducts
    };
  }, [orders, bills, products, startDate, endDate]);

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-500" /> Fluxo de Caixa
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Análise financeira completa: receitas, despesas, CMV e lucro.
          </p>
        </div>
      </div>

      {/* Filtro de Período */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Calendar className="h-5 w-5" />
          <span className="text-sm font-bold">Período de Análise:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm font-bold text-gray-600 outline-none focus:border-blue-500 h-10"
          />
          <span className="text-sm text-gray-400 font-bold">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm font-bold text-gray-600 outline-none focus:border-blue-500 h-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando dados financeiros...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Receitas */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-emerald-50 rounded-lg text-emerald-500">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">Receitas Totais</h3>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {formatCurrency(metrics.receitas)}
            </p>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-400 font-medium">Vendas concluídas</p>
              <span className="text-xs font-bold text-gray-500">
                Ticket: {formatCurrency(metrics.ticketMedio)}
              </span>
            </div>
          </div>

          {/* CMV */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-50 rounded-lg text-amber-500">
                <Calculator className="h-6 w-6" />
              </div>
              <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">CMV (Custo Mercadoria)</h3>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {formatCurrency(metrics.cmv)}
            </p>
            <p className="text-xs text-gray-400 mt-2 font-medium">Custo dos produtos vendidos</p>
          </div>

          {/* Lucro Bruto */}
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-6 shadow-sm border border-blue-100 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="text-blue-700 font-bold text-sm uppercase tracking-wider">Lucro Bruto</h3>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {formatCurrency(metrics.lucroBruto)}
            </p>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-blue-600 font-medium">Receitas - CMV</p>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                Margem: {metrics.margemBruta.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Despesas Pagas */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-rose-50 rounded-lg text-rose-500">
                <TrendingDown className="h-6 w-6" />
              </div>
              <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">Despesas Pagas</h3>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {formatCurrency(metrics.despesasPagas)}
            </p>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-400 font-medium">Contas pagas</p>
              {metrics.despesasPendentes > 0 && (
                <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full border border-rose-100">
                  +{formatCurrency(metrics.despesasPendentes)} pendentes
                </span>
              )}
            </div>
          </div>

          {/* Lucro Líquido */}
          <div className={`rounded-xl p-6 shadow-sm border flex flex-col md:col-span-2 lg:col-span-3 ${metrics.lucroLiquido >= 0 ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100' : 'bg-gradient-to-br from-rose-50 to-white border-rose-100'}`}>
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-3 rounded-lg ${metrics.lucroLiquido >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className={`font-bold text-sm uppercase tracking-wider ${metrics.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                Lucro Líquido
              </h3>
            </div>
            <p className={`text-4xl font-black ${metrics.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(metrics.lucroLiquido)}
            </p>
            <div className="flex justify-between items-center mt-2">
              <p className={`text-xs font-medium ${metrics.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                Lucro Bruto - Despesas Pagas
              </p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${metrics.lucroLiquido >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                Margem: {metrics.margemLiquida.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {!isLoading && Object.keys(metrics.expensesByCategory).length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Detalhamento de Custos (Despesas Pagas)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(metrics.expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-semibold text-gray-600 text-sm truncate pr-2">{cat}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(amount)}</span>
                </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Receitas por Método de Pagamento */}
          {Object.keys(metrics.salesByPaymentMethod).length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Receitas por Pagamento</h3>
              <div className="space-y-3">
                {Object.entries(metrics.salesByPaymentMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-semibold text-gray-600 text-sm capitalize">{method}</span>
                      <span className="font-bold text-gray-900">{formatCurrency(amount)}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Produtos Vendidos */}
          {metrics.topProducts.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Top 5 Produtos Vendidos</h3>
              <div className="space-y-3">
                {metrics.topProducts.map((prod, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800 text-sm">{prod.name}</span>
                      <span className="text-xs text-gray-500">{prod.quantity} unidades</span>
                    </div>
                    <span className="font-bold text-gray-900">{formatCurrency(prod.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
