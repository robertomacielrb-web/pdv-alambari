import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Printer,
  Banknote,
  CreditCard,
  QrCode,
  Search,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { executePrint } from "../lib/printHelper";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem extends Product {
  quantity: number;
  observation?: string;
}

interface CashierSession {
  id: string;
  status: string;
}

export default function Balcao() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(
    null,
  );
  const [lastPassword, setLastPassword] = useState<number | null>(null);
  const [lastOrder, setLastOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    "dinheiro" | "cartao" | "pix"
  >("dinheiro");
  const [customerName, setCustomerName] = useState("");
  const [observations, setObservations] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    // Get open cashier session
    const qSession = query(
      collection(db, "cashierSessions"),
      where("status", "==", "open"),
    );
    const unsubSession = onSnapshot(qSession, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentSession({ id: snapshot.docs[0].id, status: "open" });
      } else {
        setCurrentSession(null);
      }
    });

    // Get products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const normalizedCategory = data.category
          ? data.category.trim()
          : "";
        prods.push({
          id: doc.id,
          ...data,
          category: normalizedCategory,
        } as Product);
      });
      setProducts(prods);
    });

    return () => {
      unsubSession();
      unsubProducts();
    };
  }, []);

  const groupedProducts = React.useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return filtered.reduce(
      (acc, product) => {
        if (!acc[product.category]) {
          acc[product.category] = [];
        }
        acc[product.category].push(product);
        return acc;
      },
      {} as Record<string, Product[]>,
    );
  }, [products, searchTerm, selectedCategory]);

  const categories = [
    "all",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const [addedItemName, setAddedItemName] = useState<string | null>(null);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Number(item.quantity) + 1 }
            : item,
        );
      }
      return [...prev, { ...product, quantity: 1, observation: "" }];
    });

    setAddedItemName(product.name);
    setTimeout(() => {
      setAddedItemName(null);
    }, 1500);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQ = item.quantity + delta;
          return newQ > 0 ? { ...item, quantity: newQ } : item;
        }
        return item;
      }),
    );
  };

  const updateObservation = (id: string, obs: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, observation: obs };
        }
        return item;
      }),
    );
  };

  const parsedPrice = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      let cleaned = val.replace(/[^\d.,]/g, '');
      if (cleaned.includes('.') && cleaned.includes(',')) {
         cleaned = cleaned.replace(/\./g, '');
         cleaned = cleaned.replace(',', '.');
      } else if (cleaned.includes(',')) {
         cleaned = cleaned.replace(',', '.');
      }
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + parsedPrice(item.price) * (Number(item.quantity) || 1), 0);

  const handlePrint = (order: any) => {
    const itemsHtml = order.items
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 5px 0;">
          ${item.name} x${item.quantity}
          ${item.observation ? `<br><small style="font-size: 10px; font-style: italic;">Obs: ${item.observation}</small>` : ""}
        </td>
        <td style="text-align: right; padding: 5px 0;">R$ ${(parsedPrice(item.price) * item.quantity).toFixed(2).replace(".", ",")}</td>
      </tr>
    `,
      )
      .join("");

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
          <title>Pedido #${order.password}</title>
          <style>
            html, body { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 80mm; margin: 0 auto; padding: 10px; font-size: 12px; overflow-y: auto; overflow-x: hidden; min-height: 100vh; }
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
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt), "dd/MM/yyyy HH:mm")}</p>
            <h1 style="margin: 10px 0;">SENHA: ${order.password}</h1>
            ${order.customerName ? `<p style="margin: 5px 0; font-size: 14px;">CLIENTE: ${order.customerName}</p>` : ""}
            ${order.observations ? `<p style="margin: 5px 0; font-weight: bold;">OBS: ${order.observations}</p>` : ""}
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
            <span>R$ ${order.total.toFixed(2).replace(".", ",")}</span>
          </div>
          <p style="margin: 5px 0;">Pagamento: ${order.paymentMethod.toUpperCase()}</p>
          <div class="footer">
            <p>Obrigado pela preferência!</p>
          </div>

          <div class="cut-line page-break"><span>✂-----------------------</span></div>

          <!-- VIA DA PRODUÇÃO -->
          <div class="receipt-type">VIA DA PRODUÇÃO</div>
          <div class="header">
            <h1 style="margin: 10px 0; font-size: 32px;">SENHA: ${order.password}</h1>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt), "dd/MM/yyyy HH:mm")}</p>
            ${order.customerName ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold;">CLIENTE: ${order.customerName}</p>` : ""}
            ${order.observations ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 5px;">OBS GERAL: ${order.observations}</p>` : ""}
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
            // Dispara a impressão aguardando um pequeno tempo para carregar CSS
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
        type: "balcao",
        status: "closed",
        items: cart.map((item) => ({
          productId: item.id || "unknown",
          name: item.name || "Produto",
          price: parsedPrice(item.price),
          quantity: Number(item.quantity) || 1,
          observation: item.observation || "",
          productionStatus: "pending",
        })),
        total: Number(total) || 0,
        paymentMethod: paymentMethod || "dinheiro",
        customerName,
        observations,
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        password: password || 0,
        cashierId: currentSession.id || "unknown",
      };

      await addDoc(collection(db, "orders"), orderData);

      // Update cashier session total
      await updateDoc(doc(db, "cashierSessions", currentSession.id), {
        totalSales: increment(Number(total) || 0),
      });

      handlePrint(orderData);
      setLastOrder(orderData);
      setLastPassword(password);
      setCart([]);
      setCustomerName("");
      setObservations("");
      setStep(1);
    } catch (error: any) {
      alert(
        "Erro ao finalizar venda: " +
          (error.message || "Verifique os dados e tente novamente."),
      );
      handleFirestoreError(error, OperationType.CREATE, "orders");
    }
  };

  if (!currentSession) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Caixa Fechado</h2>
        <p className="text-gray-600">
          Você precisa abrir o caixa para realizar vendas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative">
      {/* Step 1: Products List */}
      {step === 1 && (
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-800">
              Selecione os Produtos
            </h2>

            <div className="flex flex-1 sm:max-w-md gap-3">
              <div className="relative flex-1">
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

            {cart.length > 0 && (
              <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-center">
                {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
              </span>
            )}
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

          <div className="p-4 overflow-y-auto flex-1 content-start pb-24">
            {Object.entries(groupedProducts).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Nenhum produto cadastrado ou encontrado.
              </div>
            ) : (
              Object.keys(groupedProducts)
                .sort()
                .map((category) => (
                  <div key={category} className="mb-6">
                    <h3 className="font-bold text-gray-700 mb-3 border-b-2 border-gray-100 pb-2 flex items-center">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm mr-2">
                        {category}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {groupedProducts[category]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((product, index) => {
                          const cartItem = cart.find(
                            (item) => item.id === product.id,
                          );
                          return (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={`prod-${product.id}-${index}`}
                              onClick={() => addToCart(product)}
                              className="relative border rounded-xl p-4 text-left hover:border-red-500 hover:shadow-lg transition-all bg-white flex flex-col h-full group overflow-hidden"
                            >
                              <div className="absolute top-0 left-0 w-full h-1 bg-red-100 group-hover:bg-red-500 transition-colors"></div>
                              <span className="font-bold text-gray-800 flex-1 text-lg leading-tight mb-2">
                                {product.name}
                              </span>
                              <div className="flex items-center justify-between mt-auto pt-3">
                                <span className="text-red-600 font-black text-lg">
                                  R${" "}
                                  {parsedPrice(product.price).toFixed(2).replace(".", ",")}
                                </span>
                                {cartItem && (
                                  <span className="bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
                                    {cartItem.quantity}
                                  </span>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                    </div>
                  </div>
                ))
            )}
          </div>

          <AnimatePresence>
            {addedItemName && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50 whitespace-nowrap"
              >
                {addedItemName} adicionado!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Next Step Button */}
          {cart.length > 0 && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setStep(2)}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-red-700 hover:shadow-2xl transition-all flex items-center justify-between px-6"
              >
                <div className="flex items-center">
                  <ShoppingCart className="w-6 h-6 mr-3" />
                  <span>Ver Carrinho</span>
                </div>
                <span>R$ {total.toFixed(2).replace(".", ",")}</span>
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Cart & Checkout */}
      {step === 2 && (
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col max-w-2xl mx-auto w-full">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setStep(1)}
                className="mr-4 text-gray-500 hover:text-gray-800"
              >
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
                  <button
                    onClick={() => setStep(1)}
                    className="block mx-auto mt-4 text-red-600 font-bold"
                  >
                    Adicionar Produtos
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Grid header (visible only on md/lg screens) */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 pb-2 border-b border-gray-200 px-2 font-bold text-gray-500 text-xs uppercase tracking-wider">
                    <div className="col-span-5 lg:col-span-6">Produto</div>
                    <div className="col-span-3 lg:col-span-2 text-center">Quant.</div>
                    <div className="col-span-2 text-right">Preço Un.</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {cart.map((item) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        key={item.id}
                        className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center bg-white border border-gray-200 md:border-b-gray-100 md:border-x-0 md:border-t-0 rounded-xl md:rounded-none p-4 md:p-2 shadow-sm md:shadow-none"
                      >
                      {/* Name and Observation */}
                      <div className="col-span-5 lg:col-span-6 w-full flex flex-col gap-2">
                        <div className="flex justify-between md:hidden w-full mb-1">
                           <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Produto</span>
                           <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-500 bg-red-50 hover:bg-red-100 p-1.5 px-3 rounded-lg flex items-center gap-1 text-xs font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remover
                            </button>
                        </div>
                        <p className="font-bold text-gray-800 text-base leading-tight flex items-center gap-2">
                          {item.name}
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="hidden md:flex text-red-400 hover:text-red-600 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100 hover:bg-red-50"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </p>
                        <input
                          type="text"
                          placeholder="Observação (opcional)"
                          value={item.observation || ""}
                          onChange={(e) =>
                            updateObservation(item.id, e.target.value)
                          }
                          className="w-full text-xs md:text-sm bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-red-500 transition-colors outline-none h-8 md:h-9"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-3 lg:col-span-2 w-full flex flex-col md:flex-row md:items-center md:justify-center">
                        <div className="md:hidden text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Quantidade</div>
                        <div className="flex items-center space-x-1 sm:space-x-2 bg-gray-100 p-1 md:p-1.5 rounded-lg border border-gray-200 w-auto self-start md:self-auto">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            <Minus className="w-4 h-4 sm:w-5 h-5" />
                          </button>
                          <span className="w-8 sm:w-10 text-center font-black text-gray-800 text-base md:text-lg">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            <Plus className="w-4 h-4 sm:w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 w-full md:text-right flex items-center justify-between md:block">
                        <span className="md:hidden text-gray-500 text-xs font-bold uppercase tracking-wider">Preço un.</span>
                        <p className="text-gray-600 font-medium whitespace-nowrap text-right">
                          <span className="hidden md:inline">R$ </span>{parsedPrice(item.price).toFixed(2).replace(".", ",")}
                        </p>
                      </div>

                      {/* Subtotal */}
                      <div className="col-span-2 w-full md:text-right flex items-center justify-between md:block pt-3 border-t border-gray-100 md:border-none md:pt-0">
                         <span className="md:hidden text-gray-500 text-xs font-bold uppercase tracking-wider">Subtotal</span>
                        <p className="font-black text-gray-800 text-lg whitespace-nowrap text-right">
                          R$ {(parsedPrice(item.price) * item.quantity).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Dados do Cliente e Observações */}
            <div className="mb-6 space-y-4 border-t pt-6 bg-white shrink-0">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Opcional"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-gray-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                  Observações no Pedido
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: sem cebola, ponto da carne, etc..."
                  className="w-full border-2 border-gray-200 rounded-xl p-3 h-20 focus:border-gray-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Forma de Pagamento - Moved inside scroll area */}
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">
                Escolha a Forma de Pagamento
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod("dinheiro")}
                  className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                    paymentMethod === "dinheiro"
                      ? "bg-green-50 border-green-500 text-green-700 shadow-md"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Banknote className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-base text-center">
                    Dinheiro
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod("cartao")}
                  className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                    paymentMethod === "cartao"
                      ? "bg-red-50 border-red-500 text-red-700 shadow-md"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <CreditCard className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-base text-center">
                    Cartão
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                    paymentMethod === "pix"
                      ? "bg-purple-50 border-purple-500 text-purple-700 shadow-md"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <QrCode className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-base text-center">PIX</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t bg-gray-50 flex-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] sm:shadow-none pb-safe">
            <div className="flex justify-between items-center mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
              <span className="text-gray-600 font-bold text-md sm:text-lg">
                Total a Pagar
              </span>
              <span className="text-2xl sm:text-3xl font-black text-gray-800">
                R$ {total.toFixed(2).replace(".", ",")}
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
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Venda Concluída!
            </h2>
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
