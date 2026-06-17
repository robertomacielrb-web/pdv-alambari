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
  deleteDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  Users,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  X,
  Printer,
  Banknote,
  CreditCard,
  QrCode,
  Search,
  Filter,
} from "lucide-react";
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
  productionStatus?: "pending" | "ready";
}

interface Order {
  id: string;
  type: string;
  status: string;
  customerName: string;
  items: CartItem[];
  total: number;
  createdAt?: string;
  closedAt?: string;
  paymentMethod?: string;
}

interface CashierSession {
  id: string;
  status: string;
}

export default function Fiados() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openFiados, setOpenFiados] = useState<Order[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(
    null,
  );

  const [selectedFiado, setSelectedFiado] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "dinheiro" | "cartao" | "pix"
  >("dinheiro");

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");

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

    // Get open fiados
    const qFiados = query(
      collection(db, "orders"),
      where("type", "==", "fiado"),
      where("status", "==", "open"),
    );
    const unsubFiados = onSnapshot(qFiados, (snapshot) => {
      const fiados: Order[] = [];
      snapshot.forEach((doc) =>
        fiados.push({ id: doc.id, ...doc.data() } as Order),
      );
      setOpenFiados(fiados);
    });

    return () => {
      unsubSession();
      unsubProducts();
      unsubFiados();
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

  const categories = React.useMemo(() => ["all", ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const openFiadoModal = (fiado: Order) => {
    setSelectedFiado(fiado);
    setCart((fiado.items || []).map((item: any) => ({
      ...item,
      id: item.id || item.productId || "unknown",
    })));
  };

  const closeFiadoModal = () => {
    setSelectedFiado(null);
    setCart([]);
  };

  const [isCreatingFiado, setIsCreatingFiado] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const confirmDeleteFiado = async () => {
    if (!selectedFiado) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "orders", selectedFiado.id));
      closeFiadoModal();
    } catch (error: any) {
      alert("Erro ao excluir fiado: " + (error.message || ""));
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleDeleteFiado = () => {
    setIsConfirmingDelete(true);
  };

  const handleCreateFiado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || isCreatingFiado) return;

    setIsCreatingFiado(true);
    try {
      const orderRef = await addDoc(collection(db, "orders"), {
        type: "fiado",
        status: "open",
        customerName: newCustomerName,
        items: [],
        total: 0,
        createdAt: new Date().toISOString(),
      });
      setIsNewModalOpen(false);
      setNewCustomerName("");

      // Auto open modal right after creating
      setSelectedFiado({
        id: orderRef.id,
        type: "fiado",
        status: "open",
        customerName: newCustomerName,
        items: [],
        total: 0,
      });
      setCart([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orders");
    } finally {
      setIsCreatingFiado(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Number(item.quantity) + 1,
                productionStatus: "pending",
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          ...product,
          quantity: 1,
          observation: "",
          productionStatus: "pending",
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQ = Number(item.quantity) + delta;
          return newQ > 0
            ? {
                ...item,
                quantity: newQ,
                productionStatus: delta > 0 ? "pending" : item.productionStatus,
              }
            : item;
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

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSaveFiado = async () => {
    if (!selectedFiado) return;

    try {
      await updateDoc(doc(db, "orders", selectedFiado.id), {
        items: cart.map((item) => ({
          productId: item.id || "unknown",
          name: item.name || "Produto",
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          observation: item.observation || "",
          productionStatus: item.productionStatus || "pending",
        })),
        total: Number(total) || 0,
        createdAt:
          typeof selectedFiado.createdAt === "string" &&
          selectedFiado.createdAt.includes("T")
            ? selectedFiado.createdAt
            : new Date().toISOString(),
      });
      closeFiadoModal();
    } catch (error: any) {
      alert(
        "Erro ao salvar fiado: " +
          (error.message || "Verifique os dados e tente novamente."),
      );
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `orders/${selectedFiado.id}`,
      );
    }
  };

  const handlePrint = (order: any) => {
    const itemsHtml = order.items
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 5px 0;">
          ${item.name} x${item.quantity}
           ${item.observation ? `<br><small style="font-size: 10px; font-style: italic;">Obs: ${item.observation}</small>` : ""}
        </td>
        <td style="text-align: right; padding: 5px 0;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
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
          <title>Fiado - ${order.customerName}</title>
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
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), "dd/MM/yyyy HH:mm")}</p>
            <h1 style="margin: 10px 0;">FIADO: ${order.customerName}</h1>
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
          ${order.status === "closed" ? `<p style="margin: 5px 0;">Pagamento: ${order.paymentMethod ? order.paymentMethod.toUpperCase() : ""}</p>` : '<p style="margin: 5px 0;">CONFERÊNCIA DE CONTA</p>'}
          <div class="footer">
            <p>Obrigado pela preferência!</p>
          </div>

          <div class="cut-line page-break"><span>✂-----------------------</span></div>

          <!-- VIA DA PRODUÇÃO -->
          <div class="receipt-type">VIA DA PRODUÇÃO</div>
          <div class="header">
            <h1 style="margin: 10px 0; font-size: 32px;">FIADO: ${order.customerName}</h1>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), "dd/MM/yyyy HH:mm")}</p>
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
      alert("Abra o caixa primeiro para receber o pagamento!");
      return;
    }
    if (!selectedFiado) return;

    try {
      const orderData = {
        status: "closed",
        closedAt: new Date().toISOString(),
        cashierId: currentSession.id || "unknown",
        items: cart.map((item) => ({
          productId: item.id || "unknown",
          name: item.name || "Produto",
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
        })),
        total: Number(total) || 0,
        paymentMethod: paymentMethod || "dinheiro",
        createdAt:
          typeof selectedFiado.createdAt === "string" &&
          selectedFiado.createdAt.includes("T")
            ? selectedFiado.createdAt
            : new Date().toISOString(),
      };

      await updateDoc(doc(db, "orders", selectedFiado.id), orderData);

      // Update cashier session total
      await updateDoc(doc(db, "cashierSessions", currentSession.id), {
        totalSales: increment(Number(total) || 0),
      });

      handlePrint({ ...selectedFiado, ...orderData });
      closeFiadoModal();
    } catch (error: any) {
      alert(
        "Erro ao finalizar pagamento: " +
          (error.message || "Verifique os dados e tente novamente."),
      );
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `orders/${selectedFiado.id}`,
      );
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Fiados</h1>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-red-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {openFiados.map((fiado) => (
          <button
            key={fiado.id}
            onClick={() => openFiadoModal(fiado)}
            className="bg-white p-6 rounded-lg shadow flex flex-col items-center justify-center transition-transform hover:scale-105 hover:shadow-md border border-gray-100"
          >
            <Users className="w-8 h-8 mb-3 text-red-600" />
            <span className="font-bold text-lg text-gray-800 truncate w-full text-center">
              {fiado.customerName}
            </span>
            <span className="text-sm mt-2 text-gray-500">
              Dívida:{" "}
              <span className="font-bold text-red-600">
                R$ {fiado.total.toFixed(2).replace(".", ",")}
              </span>
            </span>
          </button>
        ))}
        {openFiados.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            Nenhum fiado em aberto.
          </div>
        )}
      </div>

      {/* New Fiado Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Novo Fiado</h2>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateFiado}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fiado Modal */}
      {selectedFiado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  Conta:
                  <input
                    type="text"
                    value={selectedFiado.customerName}
                    onChange={(e) =>
                      setSelectedFiado({
                        ...selectedFiado,
                        customerName: e.target.value,
                      })
                    }
                    onBlur={async (e) => {
                      const newName = e.target.value;
                      if (newName) {
                        try {
                          await updateDoc(doc(db, "orders", selectedFiado.id), {
                            customerName: newName,
                          });
                          setSelectedFiado({
                            ...selectedFiado,
                            customerName: newName,
                          });
                        } catch (error: any) {
                          console.error(error);
                          alert(
                            "Erro ao atualizar nome: " + (error.message || ""),
                          );
                        }
                      }
                    }}
                    className="ml-2 bg-transparent border-b border-dashed border-gray-400 focus:border-red-500 outline-none text-xl font-bold text-gray-800 w-auto min-w-[200px]"
                  />
                </h2>
              </div>
              <button
                onClick={closeFiadoModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Products List */}
              <div className="flex-1 border-r flex flex-col bg-gray-50 overflow-hidden">
                <div className="p-4 flex flex-col gap-3 shrink-0 bg-white border-b">
                  <h3 className="font-bold text-gray-700">
                    Adicionar Produtos
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-full rounded-md border-gray-300 p-2 text-sm focus:border-red-500 border outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border-b overflow-x-auto scrollbar-thin flex p-3 gap-2 whitespace-nowrap shrink-0">
                  {categories.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 ${
                        selectedCategory === cat
                          ? "bg-red-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat === "all" ? "Todas Categorias" : cat}
                    </button>
                  ))}
                </div>

                <div className="p-4 pb-8 flex-1 overflow-y-auto">
                  {Object.entries(groupedProducts).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Nenhum produto cadastrado ou encontrado.
                    </div>
                  ) : (
                    Object.keys(groupedProducts)
                      .sort()
                      .map((category) => (
                        <div key={category} className="mb-5">
                          <h4 className="font-bold text-gray-600 text-sm mb-2 pb-1 border-b uppercase tracking-wider">
                            {category}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {groupedProducts[category]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((product, index) => {
                                const cartItem = cart.find(
                                  (item) => item.id === product.id,
                                );
                                return (
                                  <button
                                    key={`prod-${product.id}-${index}`}
                                    onClick={() => addToCart(product)}
                                    className="relative border rounded p-3 text-left hover:border-red-500 bg-white transition-colors group overflow-hidden"
                                  >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-100 group-hover:bg-red-500 transition-colors"></div>
                                    <div className="font-medium text-sm text-gray-800 ml-2">
                                      {product.name}
                                    </div>
                                    <div className="flex justify-between items-center mt-1 ml-2">
                                      <div className="text-red-600 font-bold text-sm">
                                        R${" "}
                                        {product.price
                                          .toFixed(2)
                                          .replace(".", ",")}
                                      </div>
                                      {cartItem && (
                                        <span className="bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                          {cartItem.quantity}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Cart */}
              <div className="w-full md:w-96 flex flex-col bg-white">
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-bold text-gray-700">Itens na Conta</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      Conta vazia
                    </div>
                  ) : (
                    cart.map((item, index) => (
                      <div
                        key={`cart-item-${item.id}-${index}`}
                        className="flex flex-col bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative gap-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-2">
                            <p className="font-bold text-gray-800 text-sm leading-tight">
                              {item.name}
                            </p>
                            <p className="text-gray-500 text-[10px] font-medium mt-0.5">
                              R$ {item.price.toFixed(2).replace(".", ",")} / un
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-800 text-sm">
                              R${" "}
                              {(item.price * item.quantity)
                                .toFixed(2)
                                .replace(".", ",")}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col border-t border-gray-100 pt-2 mt-1 gap-2">
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              placeholder="Observação (ex: com gelo, sem cebola)"
                              value={item.observation || ""}
                              onChange={(e) =>
                                updateObservation(item.id, e.target.value)
                              }
                              className="w-full text-xs bg-gray-50 border border-gray-200 rounded p-1.5 focus:ring-1 focus:ring-red-500 focus:bg-white transition-colors outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-end space-x-1 bg-gray-50 p-1 rounded border border-gray-200">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 bg-white rounded shadow-sm hover:bg-gray-100 text-gray-700 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-black text-gray-800 text-xs">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-1 bg-white rounded shadow-sm hover:bg-gray-100 text-gray-700 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded ml-1 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t bg-gray-50">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Forma de Pagamento
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod("dinheiro")}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition ${
                          paymentMethod === "dinheiro"
                            ? "bg-green-50 border-green-500 text-green-700"
                            : "bg-white border-gray-200 text-gray-600"
                        }`}
                      >
                        <Banknote className="w-5 h-5 mb-1" />
                        Dinheiro
                      </button>
                      <button
                        onClick={() => setPaymentMethod("cartao")}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition ${
                          paymentMethod === "cartao"
                            ? "bg-red-50 border-red-500 text-red-700"
                            : "bg-white border-gray-200 text-gray-600"
                        }`}
                      >
                        <CreditCard className="w-5 h-5 mb-1" />
                        Cartão
                      </button>
                      <button
                        onClick={() => setPaymentMethod("pix")}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs font-medium transition ${
                          paymentMethod === "pix"
                            ? "bg-purple-50 border-purple-500 text-purple-700"
                            : "bg-white border-gray-200 text-gray-600"
                        }`}
                      >
                        <QrCode className="w-5 h-5 mb-1" />
                        PIX
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600 font-medium">
                      Total da Dívida
                    </span>
                    <span className="text-2xl font-bold text-red-600">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSaveFiado}
                      className="bg-red-100 text-red-700 py-2 rounded-lg font-bold hover:bg-red-200"
                    >
                      Salvar Conta
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || !currentSession}
                      className="bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <CheckCircle className="w-5 h-5 mr-1" />
                      Receber
                    </button>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="flex flex-col items-center shrink-0 bg-red-50 p-3 rounded-xl border border-red-200 mt-4">
                      <p className="text-sm font-bold tracking-tight text-red-800 mb-2">Deseja mesmo apagar a dívida?</p>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={confirmDeleteFiado}
                          disabled={isDeleting}
                          className="flex-1 bg-red-600 text-white px-2 py-2 rounded-lg font-bold hover:bg-red-700 transition-all text-xs"
                        >
                          Sim, Apagar
                        </button>
                        <button
                          onClick={() => setIsConfirmingDelete(false)}
                          disabled={isDeleting}
                          className="flex-1 bg-white text-gray-700 px-2 py-2 rounded-lg font-bold hover:bg-gray-100 border border-gray-300 transition-all text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleDeleteFiado}
                      disabled={isDeleting}
                      className="w-full mt-3 bg-white border border-red-200 text-red-500 py-2 rounded-lg font-bold hover:bg-red-50 text-sm flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Apagar Dívida (Sem Pagamento)
                    </button>
                  )}

                  {!currentSession && (
                    <p className="text-red-500 text-xs text-center mt-2">
                      Abra o caixa para receber o pagamento.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
