import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  BarChart2,
  PieChart as PieChartIcon,
  Download,
} from "lucide-react";
import {
  format,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  status: "open" | "closed";
  items: OrderItem[];
  total: number;
  paymentMethod?: "dinheiro" | "cartao" | "pix";
  createdAt: string;
  closedAt?: string;
  type: string;
}

interface CashierSession {
  id: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string;
  initialBalance: number;
  totalSales: number;
}

interface Product {
  id: string;
  category: string;
}

const COLORS = [
  "#dc2626",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
];

export default function Relatorios() {
  const [startDate, setStartDate] = useState<string>(
    format(
      new Date(new Date().setDate(new Date().getDate() - 7)),
      "yyyy-MM-dd",
    ),
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<CashierSession[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({}); // id -> category
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch products once to map categories
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const prodMap: Record<string, string> = {};
        snap.forEach((doc) => {
          const data = doc.data();
          prodMap[doc.id] = data.category
            ? data.category.trim()
            : "Sem Categoria";
        });
        setProducts(prodMap);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Orders Closed
        const qOrders = query(
          collection(db, "orders"),
          where("status", "==", "closed"),
        );
        const ordersSnap = await getDocs(qOrders);

        let fetchedOrders: Order[] = [];
        const start = startOfDay(new Date(startDate + "T00:00:00"));
        const end = endOfDay(new Date(endDate + "T00:00:00"));

        ordersSnap.forEach((doc) => {
          const data = doc.data() as any;
          if (data.closedAt) {
            const closedDate = new Date(data.closedAt);
            if (closedDate >= start && closedDate <= end) {
              fetchedOrders.push({
                id: doc.id,
                status: data.status,
                items: data.items,
                total: data.total,
                paymentMethod: data.paymentMethod,
                createdAt: data.createdAt,
                closedAt: data.closedAt,
                type: data.type,
              });
            }
          }
        });
        setOrders(fetchedOrders);

        // Fetch Cashier Sessions
        const qSessions = query(collection(db, "cashierSessions"));
        const sessSnap = await getDocs(qSessions);
        let fetchedSessions: CashierSession[] = [];

        sessSnap.forEach((doc) => {
          const data = doc.data() as any;
          const openDate = new Date(data.openedAt);
          if (openDate >= start && openDate <= end) {
            fetchedSessions.push({
              id: doc.id,
              status: data.status,
              openedAt: data.openedAt,
              closedAt: data.closedAt,
              initialBalance: data.initialBalance,
              totalSales: data.totalSales,
            });
          }
        });
        setSessions(
          fetchedSessions.sort(
            (a, b) =>
              new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
          ),
        );
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  // Aggregations

  // 1. Sales by Date (Detailed Report)
  const salesByDate = useMemo(() => {
    const map: Record<string, { total: number; count: number; dinheiro: number; cartao: number; pix: number; outros: number }> = {};
    orders.forEach((o) => {
      if (o.closedAt) {
        const d = format(new Date(o.closedAt), "dd/MM/yyyy");
        if (!map[d]) {
          map[d] = { total: 0, count: 0, dinheiro: 0, cartao: 0, pix: 0, outros: 0 };
        }
        map[d].total += o.total;
        map[d].count += 1;
        
        const pm = o.paymentMethod || "outros";
        if (pm === "dinheiro") map[d].dinheiro += o.total;
        else if (pm === "cartao") map[d].cartao += o.total;
        else if (pm === "pix") map[d].pix += o.total;
        else map[d].outros += o.total;
      }
    });
    return Object.entries(map)
      .map(([date, data]) => ({
        date,
        total: data.total,
        count: data.count,
        ticketMedio: data.count > 0 ? data.total / data.count : 0,
        dinheiro: data.dinheiro,
        cartao: data.cartao,
        pix: data.pix,
        outros: data.outros,
      }))
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split("/");
        const [dbX, mb, yb] = b.date.split("/");
        return (
          new Date(`${ya}-${ma}-${da}`).getTime() -
          new Date(`${yb}-${mb}-${dbX}`).getTime()
        );
      });
  }, [orders]);

  // 2. Sales by Category (Pie Chart)
  const salesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        const cat = products[item.productId] || "Desconhecida";
        map[cat] = (map[cat] || 0) + item.price * item.quantity;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders, products]);

  // 3. Sales by Payment Method (Bar Chart)
  const salesByPayment = useMemo(() => {
    const map: Record<string, number> = {
      dinheiro: 0,
      cartao: 0,
      pix: 0,
      outros: 0,
    };
    orders.forEach((o) => {
      const pm = o.paymentMethod || "outros";
      if (map[pm] !== undefined) {
        map[pm] += o.total;
      } else {
        map["outros"] += o.total;
      }
    });
    return [
      { name: "Dinheiro", value: map.dinheiro },
      { name: "Cartão", value: map.cartao },
      { name: "PIX", value: map.pix },
      { name: "Outros", value: map.outros },
    ].filter((x) => x.value > 0);
  }, [orders]);

  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);

  const handleExportCSV = () => {
    let csv = "Data,Pedidos,Valor Total,Dinheiro,Cartão,PIX,Outros,Ticket Medio\n";
    salesByDate.forEach(row => {
      csv += `${row.date},${row.count},${row.total.toFixed(2)},${row.dinheiro.toFixed(2)},${row.cartao.toFixed(2)},${row.pix.toFixed(2)},${row.outros.toFixed(2)},${row.ticketMedio.toFixed(2)}\n`;
    });
    
    // Add orders detail as well below
    csv += "\nDetalhe de Pedidos\nID,Data,Hora,Status,Total,Pagamento\n";
    orders.forEach(o => {
      const d = o.closedAt ? format(new Date(o.closedAt), "dd/MM/yyyy") : "";
      const t = o.closedAt ? format(new Date(o.closedAt), "HH:mm") : "";
      csv += `${o.id},${d},${t},${o.status},${o.total.toFixed(2)},${o.paymentMethod || ""}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_vendas_${startDate}_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <BarChart2 className="w-6 h-6 mr-2 text-red-600" />
          Relatórios e Análises
        </h1>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md px-4 py-1.5 shadow-sm transition-colors font-medium text-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
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
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Faturamento Total
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {totalRevenue.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Total de Pedidos
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {orders.length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Ticket Médio
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  R${" "}
                  {(orders.length > 0 ? totalRevenue / orders.length : 0)
                    .toFixed(2)
                    .replace(".", ",")}
                </p>
              </div>
            </div>
          </div>

          {/* Relatório Diário Detalhado */}
          <div className="bg-white rounded-lg shadow border-t-4 border-red-500 overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                Desempenho de Vendas Diárias
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Gráfico de Barras */}
              <div className="p-6 col-span-1 lg:col-span-2 border-r border-gray-100">
                <div className="h-72">
                  {salesByDate.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesByDate}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E5E7EB"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          stroke="#9CA3AF"
                        />
                        <YAxis
                          tickFormatter={(val) => `R$${val}`}
                          tick={{ fontSize: 12 }}
                          stroke="#9CA3AF"
                        />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => {
                            if (name === "total")
                              return [
                                `R$ ${value.toFixed(2).replace(".", ",")}`,
                                "Faturamento",
                              ];
                            if (name === "count") return [value, "Pedidos"];
                            if (name === "ticketMedio")
                              return [
                                `R$ ${value.toFixed(2).replace(".", ",")}`,
                                "Ticket Médio",
                              ];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          name="Faturamento (R$)"
                          dataKey="total"
                          fill="#dc2626"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      Sem dados para o período
                    </div>
                  )}
                </div>
              </div>

              {/* Tabela */}
              <div className="col-span-1 border-gray-100 overflow-auto bg-gray-50 h-72 lg:h-auto">
                <table className="min-w-full divide-y divide-gray-200 min-w-[600px]">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Data
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        Apurado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        <div className="flex flex-col gap-1">
                          <span>Dinheiro</span>
                          <span>Cartão</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        <div className="flex flex-col gap-1">
                          <span>PIX</span>
                          <span>Outros</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        Pedidos
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        Ticket M.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {salesByDate.length > 0 ? (
                      salesByDate.map((row) => (
                        <tr
                          key={row.date}
                          className="hover:bg-gray-200 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {row.date}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                            R$ {row.total.toFixed(2).replace(".", ",")}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 font-mono">
                            <div className="flex flex-col gap-1 items-end">
                              <span className="text-green-600" title="Dinheiro">R$ {row.dinheiro.toFixed(2).replace(".", ",")}</span>
                              <span className="text-blue-600" title="Cartão">R$ {row.cartao.toFixed(2).replace(".", ",")}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 font-mono">
                            <div className="flex flex-col gap-1 items-end">
                              <span className="text-purple-600" title="PIX">R$ {row.pix.toFixed(2).replace(".", ",")}</span>
                              <span className="text-gray-500" title="Outros">R$ {row.outros.toFixed(2).replace(".", ",")}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                            {row.count}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                            R$ {row.ticketMedio.toFixed(2).replace(".", ",")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-400 text-sm"
                        >
                          Sem dados para tabela
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vendas por Categora */}
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Vendas por Categoria
              </h2>
              <div className="h-64 relative">
                {salesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {salesByCategory.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => [
                          `R$ ${value.toFixed(2).replace(".", ",")}`,
                          "Total",
                        ]}
                      />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Sem dados para o período
                  </div>
                )}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-500">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Formas de Pagamento
              </h2>
              <div className="h-64 mt-8">
                {salesByPayment.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesByPayment}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="#E5E7EB"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(val) => `R$${val}`}
                        stroke="#9CA3AF"
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 12 }}
                        stroke="#9CA3AF"
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [
                          `R$ ${value.toFixed(2).replace(".", ",")}`,
                          "Total",
                        ]}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]}>
                        {salesByPayment.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[(index + 2) % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <PieChartIcon className="w-12 h-12 mb-2 text-gray-300" />
                    Sem dados para o período
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cashier Sessions Table */}
          <div className="bg-white rounded-lg shadow flex flex-col border-t-4 border-purple-500">
            <div className="p-6 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                Desempenho de Caixa
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-0">
              {sessions.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Abertura
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fechamento
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Apurado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {format(new Date(s.openedAt), "dd/MM/yyyy HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {s.closedAt ? (
                            format(new Date(s.closedAt), "dd/MM/yyyy HH:mm")
                          ) : (
                            <span className="text-green-600 font-bold">
                              Em aberto
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                          R$ {(s.totalSales || 0).toFixed(2).replace(".", ",")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-400">
                  Sem turnos de caixa para o período selecionado
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
