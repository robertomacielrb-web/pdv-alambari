import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  Lock,
  Unlock,
  DollarSign,
  Search,
  Filter,
  TrendingUp,
  Package,
  Clock,
} from "lucide-react";

interface CashierSession {
  id: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string;
  initialBalance: number;
  finalBalance?: number;
  totalSales: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
}

export default function Caixa() {
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [initialBalanceInput, setInitialBalanceInput] = useState("");

  // Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Sales state
  const [todaySales, setTodaySales] = useState(0);

  useEffect(() => {
    // Session query
    const qSession = query(
      collection(db, "cashierSessions"),
      where("status", "==", "open"),
    );
    const unsubscribeSession = onSnapshot(
      qSession,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setCurrentSession({ id: doc.id, ...doc.data() } as CashierSession);
        } else {
          setCurrentSession(null);
        }
        setLoading(false);
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "cashierSessions"),
    );

    // Products query
    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((doc) => {
          if (Object.keys(doc.data()).length > 0) {
            const data = doc.data();
            const normalizedCategory = data.category
              ? data.category
                  .trim()
                  .split(/\s+/)
                  .map(
                    (w: string) =>
                      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
                  )
                  .join(" ")
              : "";
            prods.push({
              id: doc.id,
              ...data,
              category: normalizedCategory,
            } as Product);
          }
        });
        setProducts(prods.sort((a, b) => a.name.localeCompare(b.name)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, "products"),
    );

    // Today's summary query
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.toISOString();

    const qOrders = query(
      collection(db, "orders"),
      where("createdAt", ">=", startOfToday),
    );

    const unsubscribeOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        let dailyTotal = 0;
        snapshot.forEach((doc) => {
          const data = doc.data() as Order;
          if (data.status === "closed") {
            dailyTotal += data.total || 0;
          }
        });
        setTodaySales(dailyTotal);
      },
      (error) => handleFirestoreError(error, OperationType.GET, "orders"),
    );

    return () => {
      unsubscribeSession();
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, []);

  const handleOpenCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialBalance = parseFloat(initialBalanceInput.replace(",", "."));
    if (isNaN(initialBalance) || initialBalance < 0) {
      alert("Valor inicial inválido");
      return;
    }

    try {
      await addDoc(collection(db, "cashierSessions"), {
        status: "open",
        openedAt: new Date().toISOString(),
        initialBalance,
        totalSales: 0,
      });
      setInitialBalanceInput("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "cashierSessions");
    }
  };

  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  const handleCloseCashier = async () => {
    if (!currentSession) return;

    setIsConfirmingClose(true);
  };

  const confirmCloseCashier = async () => {
    if (!currentSession) return;

    try {
      const q = query(
        collection(db, "orders"),
        where("status", "==", "closed"),
        where("cashierId", "==", currentSession.id),
      );
      const snapshot = await getDocs(q);
      let totalSales = 0;
      snapshot.forEach((doc) => {
        totalSales += Number(doc.data().total) || 0;
      });

      const finalBalance = currentSession.initialBalance + totalSales;

      await updateDoc(doc(db, "cashierSessions", currentSession.id), {
        status: "closed",
        closedAt: new Date().toISOString(),
        totalSales,
        finalBalance,
      });
      setIsConfirmingClose(false);
    } catch (error: any) {
      console.error(error);
      alert("Erro ao fechar caixa: " + (error.message || ""));
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `cashierSessions/${currentSession.id}`,
      );
      setIsConfirmingClose(false);
    }
  };

  const categories = [
    "all",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 relative">
      {/* Header com Resumo de Vendas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">
              Painel do Caixa
            </h1>
            <p className="font-medium text-red-100 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="bg-white/20 px-6 py-4 rounded-xl shadow-inner backdrop-blur-sm border border-white/30 text-right">
            <p className="text-red-100 font-bold uppercase tracking-wider text-xs mb-1">
              Vendas de Hoje (Geral)
            </p>
            <div className="flex items-center justify-end">
              <TrendingUp className="w-6 h-6 mr-3 text-red-100" />
              <span className="text-3xl font-black">
                R$ {todaySales.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>
        </div>

        {/* Status do Caixa */}
        <div className="p-6 bg-white">
          {currentSession ? (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center text-green-600 bg-green-50 px-4 py-3 rounded-xl border border-green-100">
                <Unlock className="w-8 h-8 mr-3" />
                <div>
                  <h2 className="text-xl font-bold">Caixa Aberto</h2>
                  <p className="text-sm text-green-700 font-medium">
                    Aberto às:{" "}
                    {new Date(currentSession.openedAt).toLocaleTimeString(
                      "pt-BR",
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 flex-1 md:justify-center">
                <div className="px-6 py-2 border-r border-gray-200">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                    Fundo de Caixa
                  </p>
                  <p className="text-xl font-black text-gray-800">
                    R${" "}
                    {currentSession.initialBalance.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="px-6 py-2">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                    Entradas da Sessão
                  </p>
                  <p className="text-xl font-black text-red-600">
                    R$ {currentSession.totalSales.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>

              {isConfirmingClose ? (
                <div className="flex flex-col items-center shrink-0 bg-red-50 p-3 rounded-xl border border-red-200">
                  <p className="text-sm font-bold tracking-tight text-red-800 mb-2">
                    Deseja mesmo fechar?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmCloseCashier}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-all text-sm"
                    >
                      Sim, fechar
                    </button>
                    <button
                      onClick={() => setIsConfirmingClose(false)}
                      className="bg-white text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 border border-gray-300 transition-all text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleCloseCashier}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 hover:shadow-lg transition-all flex items-center shrink-0"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  Fechar Caixa
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex items-center text-gray-600 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 flex-1 w-full md:w-auto">
                <Lock className="w-8 h-8 mr-3 text-gray-400" />
                <div>
                  <h2 className="text-xl font-bold">Caixa Fechado</h2>
                  <p className="text-sm text-gray-500 font-medium whitespace-nowrap">
                    Abra o caixa para operar
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleOpenCashier}
                className="flex-1 w-full flex gap-3"
              >
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(e.target.value)}
                    placeholder="Valor Inicial (Troco)"
                    className="pl-10 w-full rounded-xl border-gray-300 border-2 shadow-sm focus:border-red-500 focus:ring-0 p-3 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 hover:shadow-lg transition-all flex items-center shrink-0"
                >
                  <Unlock className="w-5 h-5 mr-2" />
                  Abrir Caixa
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Catálogo de Produtos e Busca */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[400px]">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2 text-gray-800">
            <Package className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold">Catálogo de Produtos</h2>
          </div>

          <div className="flex w-full md:w-auto gap-3">
            <div className="relative flex-1 md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full rounded-lg border-2 border-gray-200 p-2 text-sm focus:border-red-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border-b overflow-x-auto scrollbar-thin flex p-3 gap-2 whitespace-nowrap shrink-0">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 ${
                selectedCategory === cat
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat === "all" ? "Todas Categorias" : cat}
            </button>
          ))}
        </div>

        <div className="p-6 bg-gray-50 flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max rounded-b-xl overflow-y-auto max-h-[500px]">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white p-4 justify-between border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="bg-red-50 p-3 rounded-lg text-red-600 shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-sm truncate">
                    {product.name}
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                    {product.category}
                  </span>
                </div>
                <div className="font-black text-gray-900 border-l pl-3 py-1">
                  R$ {product.price.toFixed(2).replace(".", ",")}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 flex flex-col items-center text-gray-400">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
