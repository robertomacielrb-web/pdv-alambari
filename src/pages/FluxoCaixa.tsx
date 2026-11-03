import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Wallet,
  Activity,
  Calculator,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Table as TableIcon,
  Filter
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  subMonths, 
  subDays,
  startOfYear,
  endOfYear
} from 'date-fns';

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

  const handleSetPreset = (preset: 'hoje' | '7dias' | 'esteMes' | 'mesPassado' | 'ano') => {
    const today = new Date();
    if (preset === 'hoje') {
      const dStr = format(today, 'yyyy-MM-dd');
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (preset === '7dias') {
      setStartDate(format(subDays(today, 6), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'esteMes') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else if (preset === 'mesPassado') {
      const prev = subMonths(today, 1);
      setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
    } else if (preset === 'ano') {
      setStartDate(format(startOfYear(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(today), 'yyyy-MM-dd'));
    }
  };

  const metrics = useMemo(() => {
    let receitas = 0;
    let cmv = 0;
    let despesasPagas = 0;
    let despesasPendentes = 0;
    let totalOrders = 0;
    let totalBillsPaidCount = 0;
    let totalBillsPendingCount = 0;

    const expensesByCategory: Record<string, number> = {};
    const salesByPaymentMethod: Record<string, number> = {};
    const productSalesMap: Record<string, { name: string; quantity: number; total: number }> = {};
    const dailyMap: Record<string, { date: string; entradas: number; saidas: number; pedidosCount: number; despesasCount: number }> = {};

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    const productCostMap = new Map<string, number>();
    products.forEach(p => {
      if (p.costPrice !== undefined) {
        productCostMap.set(p.id, p.costPrice);
      }
    });

    // Calcular Receitas, CMV e Fluxo Diário no período
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= start && orderDate <= end) {
        receitas += order.total;
        totalOrders += 1;
        
        const method = order.paymentMethod || 'Outros';
        salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + order.total;

        const dStr = format(orderDate, 'yyyy-MM-dd');
        if (!dailyMap[dStr]) {
          dailyMap[dStr] = { date: dStr, entradas: 0, saidas: 0, pedidosCount: 0, despesasCount: 0 };
        }
        dailyMap[dStr].entradas += order.total;
        dailyMap[dStr].pedidosCount += 1;
        
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

    // Calcular Despesas pagas e pendentes no período
    bills.forEach(bill => {
      const dueDate = new Date(bill.dueDate);
      const payDate = bill.paymentDate ? new Date(bill.paymentDate) : null;
      
      if (bill.status === 'paid' && payDate) {
        if (payDate >= start && payDate <= end) {
          despesasPagas += bill.amount;
          totalBillsPaidCount += 1;
          const cat = bill.category || 'Outros';
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + bill.amount;

          const dStr = format(payDate, 'yyyy-MM-dd');
          if (!dailyMap[dStr]) {
            dailyMap[dStr] = { date: dStr, entradas: 0, saidas: 0, pedidosCount: 0, despesasCount: 0 };
          }
          dailyMap[dStr].saidas += bill.amount;
          dailyMap[dStr].despesasCount += 1;
        }
      } else {
        // Despesas a pagar que vencem neste período
        if (dueDate >= start && dueDate <= end) {
          despesasPendentes += bill.amount;
          totalBillsPendingCount += 1;
        }
      }
    });

    const lucroBruto = receitas - cmv;
    const lucroLiquido = lucroBruto - despesasPagas;
    const ticketMedio = totalOrders > 0 ? receitas / totalOrders : 0;
    
    const topProducts = Object.values(productSalesMap).sort((a, b) => b.total - a.total).slice(0, 5);

    // Calcular saldo diário acumulado
    let runningAccum = 0;
    const dailyFlow = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => {
        const saldo = item.entradas - item.saidas;
        runningAccum += saldo;
        return {
          ...item,
          saldo,
          saldoAcumulado: runningAccum
        };
      });

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
      topProducts,
      totalOrders,
      totalBillsPaidCount,
      totalBillsPendingCount,
      dailyFlow
    };
  }, [orders, bills, products, startDate, endDate]);

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Exportar Relatório Completo em PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      doc.setProperties({
        title: `Relatório de Fluxo de Caixa - Alambari Defumados (${startDate} a ${endDate})`,
        subject: 'Fluxo de Caixa e DRE Consolidado',
        author: 'Alambari Defumados',
        creator: 'Sistema Alambari Defumados'
      });

      // Top banner
      doc.setFillColor(15, 23, 42); // Slate-900
      doc.rect(0, 0, 210, 36, 'F');

      // Marca
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('ALAMBARI DEFUMADOS', 14, 16);

      // Subtítulo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(226, 232, 240);
      doc.text('Relatório Consolidado de Fluxo de Caixa & DRE', 14, 24);

      // Timestamp
      const todayFormatted = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Gerado em: ${todayFormatted}`, 14, 31);

      // Parâmetros do Relatório
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Parâmetros do Período Analisado', 14, 46);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      const startFormatted = startDate ? format(parseISO(startDate), 'dd/MM/yyyy') : '-';
      const endFormatted = endDate ? format(parseISO(endDate), 'dd/MM/yyyy') : '-';
      doc.text(`Período de Análise: ${startFormatted} até ${endFormatted}`, 14, 53);
      doc.text(`Vendas Concluídas: ${metrics.totalOrders} pedidos  |  Ticket Médio: ${formatCurrency(metrics.ticketMedio)}`, 14, 59);
      doc.text(`Despesas Quitadas: ${metrics.totalBillsPaidCount} contas pagas  |  Previsão a Pagar: ${formatCurrency(metrics.despesasPendentes)}`, 14, 65);

      // Cards de Resumo Executivo
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 71, 182, 26, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, 71, 182, 26, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('RECEITAS TOTAIS', 18, 77);
      doc.text('CMV (CUSTOS)', 64, 77);
      doc.text('DESPESAS PAGAS', 110, 77);
      doc.text('LUCRO LÍQUIDO', 154, 77);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(formatCurrency(metrics.receitas), 18, 86);

      doc.setTextColor(217, 119, 6); // Amber
      doc.text(formatCurrency(metrics.cmv), 64, 86);

      doc.setTextColor(225, 29, 72); // Rose
      doc.text(formatCurrency(metrics.despesasPagas), 110, 86);

      if (metrics.lucroLiquido >= 0) {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.text(formatCurrency(metrics.lucroLiquido), 154, 86);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Margem: ${metrics.margemLiquida.toFixed(1)}%`, 154, 92);
      doc.text(`Margem: ${metrics.margemBruta.toFixed(1)}%`, 18, 92);

      // Tabela 1: Demonstrativo de Resultado (DRE)
      const dreRows = [
        ['(+) Receita Bruta de Vendas', formatCurrency(metrics.receitas), '100,0%'],
        ['(-) Custo das Mercadorias Vendidas (CMV)', formatCurrency(metrics.cmv), metrics.receitas > 0 ? `${((metrics.cmv / metrics.receitas) * 100).toFixed(1)}%` : '0,0%'],
        ['(=) LUCRO BRUTO OPERACIONAL', formatCurrency(metrics.lucroBruto), `${metrics.margemBruta.toFixed(1)}%`],
        ['(-) Despesas Operacionais Pagas', formatCurrency(metrics.despesasPagas), metrics.receitas > 0 ? `${((metrics.despesasPagas / metrics.receitas) * 100).toFixed(1)}%` : '0,0%'],
        ['(=) RESULTADO LÍQUIDO DO PERÍODO', formatCurrency(metrics.lucroLiquido), `${metrics.margemLiquida.toFixed(1)}%`]
      ];

      autoTable(doc, {
        head: [['Demonstrativo do Resultado (DRE Simplificado)', 'Valor (R$)', '% Receita']],
        body: dreRows,
        startY: 102,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 58, 138], // Blue-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        columnStyles: {
          0: { cellWidth: 'auto', fontStyle: 'bold' },
          1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
          2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        didParseCell: (data) => {
          if (data.row.index === 2) {
            data.cell.styles.fillColor = [239, 246, 255];
            data.cell.styles.textColor = [29, 78, 216];
          }
          if (data.row.index === 4) {
            if (metrics.lucroLiquido >= 0) {
              data.cell.styles.fillColor = [236, 253, 245];
              data.cell.styles.textColor = [5, 150, 105];
            } else {
              data.cell.styles.fillColor = [255, 241, 242];
              data.cell.styles.textColor = [225, 29, 72];
            }
          }
        }
      });

      // Tabela 2: Fluxo Diário de Caixa
      if (metrics.dailyFlow.length > 0) {
        const lastY = (doc as any).lastAutoTable?.finalY || 145;
        
        const dailyRows = metrics.dailyFlow.map((d) => {
          const parts = d.date.split('-');
          const formattedD = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d.date;

          return [
            formattedD,
            formatCurrency(d.entradas) + ` (${d.pedidosCount}v)`,
            formatCurrency(d.saidas) + (d.despesasCount > 0 ? ` (${d.despesasCount}d)` : ''),
            formatCurrency(d.saldo),
            formatCurrency(d.saldoAcumulado)
          ];
        });

        autoTable(doc, {
          head: [['Data', 'Entradas (Vendas)', 'Saídas (Despesas)', 'Saldo do Dia', 'Saldo Acumulado']],
          body: dailyRows,
          startY: lastY + 8,
          theme: 'striped',
          headStyles: {
            fillColor: [51, 65, 85], // Slate-700
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 26, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'right' },
            2: { cellWidth: 'auto', halign: 'right' },
            3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
            4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85]
          },
          didParseCell: (data) => {
            if (data.column.index === 3) {
              const valText = data.cell.text[0] || '';
              if (valText.includes('-')) {
                data.cell.styles.textColor = [225, 29, 72];
              } else {
                data.cell.styles.textColor = [5, 150, 105];
              }
            }
          }
        });
      }

      // Tabela 3: Receitas por Meio de Pagamento
      const lastY2 = (doc as any).lastAutoTable?.finalY || 190;
      
      const paymentRows = Object.entries(metrics.salesByPaymentMethod)
        .sort(([, a], [, b]) => b - a)
        .map(([m, val]) => [
          m.toUpperCase(),
          formatCurrency(val),
          metrics.receitas > 0 ? `${((val / metrics.receitas) * 100).toFixed(1)}%` : '0%'
        ]);

      if (paymentRows.length > 0) {
        autoTable(doc, {
          head: [['Receitas por Meio de Pagamento', 'Total Faturado (R$)', '% Part.']],
          body: paymentRows,
          startY: lastY2 + 8,
          theme: 'striped',
          headStyles: {
            fillColor: [16, 185, 129], // Emerald-600
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
            2: { cellWidth: 24, halign: 'center' }
          },
          bodyStyles: { fontSize: 7.5 }
        });
      }

      // Tabela 4: Despesas por Categoria
      const expenseRows = Object.entries(metrics.expensesByCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, val]) => [
          cat,
          formatCurrency(val),
          metrics.despesasPagas > 0 ? `${((val / metrics.despesasPagas) * 100).toFixed(1)}%` : '0%'
        ]);

      if (expenseRows.length > 0) {
        const lastY3 = (doc as any).lastAutoTable?.finalY || 230;
        autoTable(doc, {
          head: [['Despesas Pagas por Categoria', 'Total Pago (R$)', '% Part.']],
          body: expenseRows,
          startY: lastY3 + 8,
          theme: 'striped',
          headStyles: {
            fillColor: [225, 29, 72], // Rose-600
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
            2: { cellWidth: 24, halign: 'center' }
          },
          bodyStyles: { fontSize: 7.5 }
        });
      }

      // Tabela 5: Top 5 Produtos Faturados
      if (metrics.topProducts.length > 0) {
        const lastY4 = (doc as any).lastAutoTable?.finalY || 260;
        const topProdRows = metrics.topProducts.map((p, idx) => [
          `${idx + 1}º`,
          p.name,
          `${p.quantity} un`,
          formatCurrency(p.total)
        ]);

        autoTable(doc, {
          head: [['#', 'Top Produtos Mais Vendidos', 'Quantidade', 'Total (R$)']],
          body: topProdRows,
          startY: lastY4 + 8,
          theme: 'striped',
          headStyles: {
            fillColor: [79, 70, 229], // Indigo-600
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 14, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 28, halign: 'center' },
            3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }
          },
          bodyStyles: { fontSize: 7.5 }
        });
      }

      // Rodapé em todas as páginas
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${pageCount}`, 14, 287);
        doc.text('Alambari Defumados © - Sistema de Gestão Financeira', 130, 287);
      }

      const fileDate = format(new Date(), 'yyyy-MM-dd_HH-mm');
      doc.save(`relatorio_fluxo_caixa_${startDate}_a_${endDate}_${fileDate}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar relatório PDF do fluxo de caixa:', err);
      alert('Ocorreu um erro ao exportar o relatório PDF.');
    }
  };

  // Exportar dados completos em CSV para Excel
  const exportToCSV = () => {
    try {
      let csv = '\uFEFF'; // UTF-8 BOM para garantir acentos perfeitos no Excel
      csv += 'ALAMBARI DEFUMADOS - RELATÓRIO DE FLUXO DE CAIXA\n';
      csv += `Período Analisado:;${startDate} até ${endDate}\n`;
      csv += `Data de Emissão:;${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}\n`;
      csv += `Vendas Concluídas:;${metrics.totalOrders} pedidos\n`;
      csv += `Ticket Médio:;R$ ${metrics.ticketMedio.toFixed(2).replace('.', ',')}\n\n`;

      csv += '--- DEMONSTRATIVO DO RESULTADO (DRE) ---\n';
      csv += 'Componente;Valor (R$);Participação (%)\n';
      csv += `Receita Bruta com Vendas;${metrics.receitas.toFixed(2).replace('.', ',')};100,0%\n`;
      csv += `CMV (Custo Mercadorias Vendidas);${metrics.cmv.toFixed(2).replace('.', ',')};${metrics.receitas > 0 ? ((metrics.cmv / metrics.receitas) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
      csv += `Lucro Bruto Operacional;${metrics.lucroBruto.toFixed(2).replace('.', ',')};${metrics.margemBruta.toFixed(1).replace('.', ',')}%\n`;
      csv += `Despesas Operacionais Pagas;${metrics.despesasPagas.toFixed(2).replace('.', ',')};${metrics.receitas > 0 ? ((metrics.despesasPagas / metrics.receitas) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
      csv += `Resultado Líquido do Período;${metrics.lucroLiquido.toFixed(2).replace('.', ',')};${metrics.margemLiquida.toFixed(1).replace('.', ',')}%\n`;
      csv += `Despesas Previstas Pendentes;${metrics.despesasPendentes.toFixed(2).replace('.', ',')};-\n\n`;

      if (metrics.dailyFlow.length > 0) {
        csv += '--- FLUXO DIÁRIO (ENTRADAS X SAÍDAS) ---\n';
        csv += 'Data;Entradas (R$);Pedidos;Saídas (R$);Contas Pagas;Saldo do Dia (R$);Saldo Acumulado (R$)\n';
        metrics.dailyFlow.forEach(d => {
          const dStr = d.date.split('-').reverse().join('/');
          csv += `${dStr};${d.entradas.toFixed(2).replace('.', ',')};${d.pedidosCount};${d.saidas.toFixed(2).replace('.', ',')};${d.despesasCount};${d.saldo.toFixed(2).replace('.', ',')};${d.saldoAcumulado.toFixed(2).replace('.', ',')}\n`;
        });
        csv += '\n';
      }

      if (Object.keys(metrics.salesByPaymentMethod).length > 0) {
        csv += '--- RECEITAS POR FORMA DE PAGAMENTO ---\n';
        csv += 'Forma de Pagamento;Total Faturado (R$);Participação (%)\n';
        Object.entries(metrics.salesByPaymentMethod).forEach(([m, val]) => {
          const pct = metrics.receitas > 0 ? ((val / metrics.receitas) * 100).toFixed(1).replace('.', ',') : '0';
          csv += `${m.toUpperCase()};${val.toFixed(2).replace('.', ',')};${pct}%\n`;
        });
        csv += '\n';
      }

      if (Object.keys(metrics.expensesByCategory).length > 0) {
        csv += '--- DESPESAS PAGAS POR CATEGORIA ---\n';
        csv += 'Categoria de Despesa;Total Pago (R$);Participação (%)\n';
        Object.entries(metrics.expensesByCategory).forEach(([c, val]) => {
          const pct = metrics.despesasPagas > 0 ? ((val / metrics.despesasPagas) * 100).toFixed(1).replace('.', ',') : '0';
          csv += `${c};${val.toFixed(2).replace('.', ',')};${pct}%\n`;
        });
        csv += '\n';
      }

      if (metrics.topProducts.length > 0) {
        csv += '--- TOP PRODUTOS MAIS VENDIDOS ---\n';
        csv += 'Posição;Produto;Quantidade;Total Faturado (R$)\n';
        metrics.topProducts.forEach((p, idx) => {
          csv += `${idx + 1}º;${p.name};${p.quantity};${p.total.toFixed(2).replace('.', ',')}\n`;
        });
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `fluxo_de_caixa_${startDate}_a_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Erro ao gerar planilha CSV do fluxo de caixa:', err);
      alert('Ocorreu um erro ao exportar a planilha CSV.');
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header section com botões de exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-500" /> Fluxo de Caixa
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Análise financeira completa: receitas, despesas, CMV, lucro e fluxo diário.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={exportToCSV}
            disabled={isLoading}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2.5 px-3.5 rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            title="Exportar dados para Excel / Planilha CSV"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Planilha (CSV)</span>
          </button>
          
          <button
            onClick={exportToPDF}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            title="Exportar Relatório Completo em PDF"
          >
            <FileText className="h-4 w-4" />
            <span>Exportar Relatório PDF</span>
          </button>
        </div>
      </div>

      {/* Filtro de Período e Atalhos Rápidos */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Quick Date Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Atalhos:
          </span>
          <button
            type="button"
            onClick={() => handleSetPreset('hoje')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('7dias')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('esteMes')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            Este Mês
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('mesPassado')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            Mês Anterior
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('ano')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            Ano Atual
          </button>
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-gray-500 mr-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-bold">Data:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 h-9"
          />
          <span className="text-xs text-gray-400 font-bold">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-bold">Carregando dados financeiros...</div>
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
              <p className="text-xs text-gray-400 font-medium">{metrics.totalOrders} vendas concluídas</p>
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
              <p className="text-xs text-gray-400 font-medium">{metrics.totalBillsPaidCount} contas quitadas</p>
              {metrics.despesasPendentes > 0 && (
                <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full border border-rose-100">
                  +{formatCurrency(metrics.despesasPendentes)} pendentes
                </span>
              )}
            </div>
          </div>

          {/* Lucro Líquido */}
          <div className={`rounded-xl p-6 shadow-sm border flex flex-col md:col-span-2 lg:col-span-2 ${metrics.lucroLiquido >= 0 ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100' : 'bg-gradient-to-br from-rose-50 to-white border-rose-100'}`}>
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-3 rounded-lg ${metrics.lucroLiquido >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className={`font-bold text-sm uppercase tracking-wider ${metrics.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                Lucro Líquido Realizado
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

      {/* Tabela de Fluxo de Caixa Diário (Entradas x Saídas) */}
      {!isLoading && metrics.dailyFlow.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b pb-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-blue-600" />
              Movimentação Diária de Caixa
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              {metrics.dailyFlow.length} {metrics.dailyFlow.length === 1 ? 'dia com movimentação' : 'dias com movimentação'} no período
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Entradas (Vendas)</th>
                  <th className="px-4 py-3 text-right">Saídas (Despesas)</th>
                  <th className="px-4 py-3 text-right">Resultado do Dia</th>
                  <th className="px-4 py-3 text-right">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {metrics.dailyFlow.map((item) => {
                  const parts = item.date.split('-');
                  const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.date;
                  const isPositive = item.saldo >= 0;

                  return (
                    <tr key={item.date} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-700">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(item.entradas)}
                        <span className="text-[10px] text-gray-400 ml-1">({item.pedidosCount}v)</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {item.saidas > 0 ? (
                          <>
                            {formatCurrency(item.saidas)}
                            <span className="text-[10px] text-gray-400 ml-1">({item.despesasCount}d)</span>
                          </>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          {formatCurrency(item.saldo)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-black ${item.saldoAcumulado >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>
                        {formatCurrency(item.saldoAcumulado)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalhamento de Custos por Categoria */}
      {!isLoading && Object.keys(metrics.expensesByCategory).length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Detalhamento de Custos (Despesas Pagas)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(metrics.expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => {
                const pct = metrics.despesasPagas > 0 ? ((amount / metrics.despesasPagas) * 100).toFixed(1) : '0';
                return (
                  <div key={cat} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl">
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-bold text-gray-700 text-sm truncate">{cat}</span>
                      <span className="text-[11px] text-gray-400 font-medium">{pct}% do total pago</span>
                    </div>
                    <span className="font-black text-gray-900">{formatCurrency(amount)}</span>
                  </div>
                );
            })}
          </div>
        </div>
      )}

      {/* Receitas por Meio de Pagamento & Top Produtos */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receitas por Método de Pagamento */}
          {Object.keys(metrics.salesByPaymentMethod).length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Receitas por Forma de Pagamento</h3>
              <div className="space-y-3">
                {Object.entries(metrics.salesByPaymentMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => {
                    const pct = metrics.receitas > 0 ? ((amount / metrics.receitas) * 100).toFixed(1) : '0';
                    return (
                      <div key={method} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-700 text-sm capitalize">{method}</span>
                          <span className="text-[11px] text-gray-400 font-medium">{pct}% do faturamento</span>
                        </div>
                        <span className="font-black text-gray-900">{formatCurrency(amount)}</span>
                      </div>
                    );
                })}
              </div>
            </div>
          )}

          {/* Top Produtos Vendidos */}
          {metrics.topProducts.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Top 5 Produtos Mais Vendidos</h3>
              <div className="space-y-3">
                {metrics.topProducts.map((prod, index) => (
                  <div key={index} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">{prod.name}</span>
                        <span className="text-xs text-gray-500 font-medium">{prod.quantity} unidades vendidas</span>
                      </div>
                    </div>
                    <span className="font-black text-gray-900">{formatCurrency(prod.total)}</span>
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
