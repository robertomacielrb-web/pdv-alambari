import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  increment,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  Coffee,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  X,
  Printer,
  Banknote,
  CreditCard,
  QrCode,
  ShoppingCart,
  Search,
  Filter,
  NotebookText,
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
  productionStatus?: "pending" | "ready";
}

interface Order {
  id: string;
  type: string;
  status: string;
  tableNumber: number;
  items: CartItem[];
  total: number;
  createdAt?: string;
  closedAt?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  observations?: string;
}

interface CashierSession {
  id: string;
  status: string;
}

interface Table {
  id: string;
  number: number;
  createdAt?: string;
}

export default function Mesas() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openTables, setOpenTables] = useState<Order[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(
    null,
  );
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "dinheiro" | "cartao" | "pix" | "fiado"
  >("dinheiro");
  const [step, setStep] = useState<1 | 2>(1);

  const [tables, setTables] = useState<Table[]>([]);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");

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
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "cashierSessions");
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
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "products");
    });

    // Get open tables
    const qTables = query(
      collection(db, "orders"),
      where("type", "==", "mesa"),
      where("status", "==", "open"),
    );
    const unsubTables = onSnapshot(qTables, (snapshot) => {
      const tables: Order[] = [];
      snapshot.forEach((doc) =>
        tables.push({ id: doc.id, ...doc.data() } as Order),
      );
      setOpenTables(tables);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "orders");
    });

    // Get customized tables
    const unsubTablesList = onSnapshot(collection(db, "tables"), async (snapshot) => {
      if (snapshot.empty) {
        const initialList: Table[] = [];
        for (let i = 1; i <= 20; i++) {
          initialList.push({ id: `mesa-${i}`, number: i });
        }
        setTables(initialList);
        
        // Seeding the initial 1-20 tables in firestore safely
        for (let i = 1; i <= 20; i++) {
          try {
            await setDoc(doc(db, "tables", `mesa-${i}`), {
              number: i,
              createdAt: new Date().toISOString()
            });
          } catch (err: any) {
            console.error(`Erro ao semear mesa-${i}: `, err);
            handleFirestoreError(err, OperationType.CREATE, `tables/mesa-${i}`);
          }
        }
      } else {
        const list: Table[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, number: Number(data.number) });
        });
        setTables(list.sort((a, b) => a.number - b.number));
      }
    }, (err) => {
      console.error("Erro ao ouvir mesas: ", err);
      handleFirestoreError(err, OperationType.GET, "tables");
    });

    return () => {
      unsubSession();
      unsubProducts();
      unsubTables();
      unsubTablesList();
    };
  }, []);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [observations, setObservations] = useState("");

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

  const openTableModal = (tableNumber: number) => {
    setSelectedTable(tableNumber);
    const existingOrder = openTables.find((t) => t.tableNumber === tableNumber);
    if (existingOrder) {
      setCart((existingOrder.items || []).map((item: any) => ({
        ...item,
        id: item.id || item.productId || "unknown",
      })));
      setCustomerName(existingOrder.customerName || "");
      setCustomerPhone(existingOrder.customerPhone || "");
      setObservations(existingOrder.observations || "");
    } else {
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setObservations("");
    }
    setStep(1);
  };

  const closeTableModal = () => {
    setSelectedTable(null);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setObservations("");
  };

  const handleUpdateCustomerName = async (newName: string) => {
    setCustomerName(newName);

    if (selectedTable) {
      const existingOrder = openTables.find(
        (t) => t.tableNumber === selectedTable,
      );
      if (existingOrder) {
        // Optimistic update for customer name
        setOpenTables(prev => prev.map(t => 
           t.id === existingOrder.id ? { ...t, customerName: newName } : t
        ));
        
        try {
          await updateDoc(doc(db, "orders", existingOrder.id), {
            customerName: newName,
            createdAt: existingOrder.createdAt || new Date().toISOString()
          });
        } catch (error: any) {
          console.error(error);
          alert("Erro ao salvar nome na mesa: " + (error.message || ""));
        }
      }
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

  const handleSaveTable = async (isAutoSave = false) => {
    if (!selectedTable) return;

    // Capture state to save before we potentially clear it
    const currentTableNumber = selectedTable;
    const currentCart = [...cart];
    const currentObservations = observations || "";
    const currentCustomerName = customerName || "";
    const currentCustomerPhone = customerPhone || "";
    const currentTotal = Number(total) || 0;

    if (!isAutoSave) {
      // Optimistic update
      setOpenTables(prev => {
        const index = prev.findIndex(t => t.tableNumber === currentTableNumber);
        if (index >= 0) {
          if (currentCart.length === 0) {
             return prev.filter(t => t.tableNumber !== currentTableNumber);
          }
          const updated = [...prev];
          updated[index] = {
             ...updated[index],
             items: currentCart,
             total: currentTotal,
             customerName: currentCustomerName,
             customerPhone: currentCustomerPhone,
             observations: currentObservations
          };
          return updated;
        } else {
          return [...prev, {
             id: 'temp-' + Date.now(),
             type: "mesa",
             status: "open",
             tableNumber: currentTableNumber,
             items: currentCart,
             total: currentTotal,
             customerName: currentCustomerName,
             customerPhone: currentCustomerPhone,
             observations: currentObservations,
             createdAt: new Date().toISOString()
          }];
        }
      });
      closeTableModal();
    }

    try {
      const existingOrder = openTables.find(
        (t) => t.tableNumber === currentTableNumber,
      );

      const orderData: any = {
        type: "mesa",
        status: "open",
        tableNumber: currentTableNumber,
        customerName: currentCustomerName,
        customerPhone: currentCustomerPhone,
        observations: currentObservations,
        items: currentCart.map((item) => ({
          productId: item.id || "unknown",
          name: item.name || "Produto",
          price: parsedPrice(item.price),
          quantity: Number(item.quantity) || 1,
          observation: item.observation || "",
          productionStatus: item.productionStatus || "pending",
        })),
        total: currentTotal,
        createdAt:
          typeof existingOrder?.createdAt === "string" &&
          existingOrder.createdAt.includes("T")
            ? existingOrder.createdAt
            : new Date().toISOString(),
      };

      if (existingOrder) {
        if (currentCart.length === 0) {
          // If cart is empty, close it with 0 total
          await updateDoc(doc(db, "orders", existingOrder.id), {
            status: "closed",
            total: 0,
            items: [],
          });
        } else {
          await updateDoc(doc(db, "orders", existingOrder.id), {
            items: orderData.items,
            total: orderData.total,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            observations: orderData.observations,
          });
        }
      } else {
        if (currentCart.length > 0) {
          await addDoc(collection(db, "orders"), orderData);
        }
      }
    } catch (error: any) {
      if (!isAutoSave) {
        alert(
          "Erro ao salvar mesa: " +
            (error.message || "Verifique os dados e tente novamente."),
        );
      }
      handleFirestoreError(error, OperationType.WRITE, "orders");
    }
  };

  React.useEffect(() => {
    if (selectedTable === null) return;
    
    // Auto save whenever cart, customer name, customer phone or observations change
    const debounceSave = setTimeout(() => {
      handleSaveTable(true);
    }, 500);

    return () => clearTimeout(debounceSave);
  }, [cart, customerName, customerPhone, observations, selectedTable]);

  const openAddTableModal = () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 21;
    setNewTableNumber(String(nextNum));
    setIsAddTableModalOpen(true);
  };

  const handleAddTableSubmit = async () => {
    const num = parseInt(newTableNumber.trim(), 10);
    if (isNaN(num) || num <= 0) {
      alert("Por favor, insira um número de mesa válido e maior que zero.");
      return;
    }

    const exists = tables.some((t) => t.number === num);
    if (exists) {
      alert(`A Mesa ${num} já existe no sistema!`);
      return;
    }

    try {
      await setDoc(doc(db, "tables", `mesa-${num}`), {
        number: num,
        createdAt: new Date().toISOString(),
      });
      setIsAddTableModalOpen(false);
      setNewTableNumber("");
    } catch (err: any) {
      console.error("Erro ao adicionar mesa: ", err);
      handleFirestoreError(err, OperationType.CREATE, `tables/mesa-${num}`);
    }
  };

  const handleDeleteTable = async (tableToDelete: Table, e: React.MouseEvent) => {
    e.stopPropagation();

    const isOpen = openTables.some((t) => t.tableNumber === tableToDelete.number);
    if (isOpen) {
      alert("Não é possível excluir esta mesa porque ela tem um atendimento em aberto!");
      return;
    }

    if (confirm(`Deseja mesmo remover a Mesa ${tableToDelete.number}?`)) {
      try {
        await deleteDoc(doc(db, "tables", tableToDelete.id));
      } catch (err: any) {
        console.error("Erro ao deletar mesa: ", err);
        handleFirestoreError(err, OperationType.DELETE, `tables/${tableToDelete.id}`);
      }
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedTable || cart.length === 0) return;

    let msg = `*PDV ALAMBARI DEFUMADOS*\n`;
    msg += `*CONFERÊNCIA DE CONTA - MESA ${selectedTable}*\n`;
    if (customerName) {
      msg += `*Cliente:* ${customerName}\n`;
    }
    msg += `----------------------------------\n`;

    cart.forEach((item) => {
      const itemPrice = parsedPrice(item.price);
      const subtotal = itemPrice * item.quantity;
      msg += `• *${item.quantity}x* ${item.name} - R$ ${subtotal.toFixed(2).replace(".", ",")}\n`;
      if (item.observation) {
        msg += `  _(Obs: ${item.observation})_\n`;
      }
    });

    msg += `----------------------------------\n`;
    msg += `*TOTAL: R$ ${total.toFixed(2).replace(".", ",")}*\n\n`;
    msg += `Agradecemos a preferência! 🙏`;

    const encodedText = encodeURIComponent(msg);
    let whatsappUrl = "";

    // Limpa o número de telefone removendo tudo que não for dígito
    const cleanedPhone = customerPhone.replace(/\D/g, "");
    if (cleanedPhone) {
      // Se não possui DDI (geralmente <= 11 dígitos para celular BR), adiciona o 55 do Brasil
      const phoneWithCountry = cleanedPhone.length <= 11 ? `55${cleanedPhone}` : cleanedPhone;
      whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodedText}`;
    } else {
      whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(whatsappUrl, "_blank");
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
        <td style="text-align: right; padding: 5px 0;">R$ ${(parsedPrice(item.price) * item.quantity).toFixed(2).replace('.', ',')}</td>
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
          <title>Mesa ${order.tableNumber}</title>
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
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), "dd/MM/yyyy HH:mm")}</p>
            <h1 style="margin: 10px 0;">MESA: ${order.tableNumber}</h1>
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
          ${order.status === "closed" ? `<p style="margin: 5px 0;">Pagamento: ${order.paymentMethod ? order.paymentMethod.toUpperCase() : ""}</p>` : '<p style="margin: 5px 0; font-weight: bold;">CONFERÊNCIA DE CONTA</p>'}
          <div class="footer">
            <p>Obrigado pela preferência!</p>
          </div>

          ${order.status === "closed" ? "" : `
          <div class="cut-line page-break"><span>✂-----------------------</span></div>

          <!-- VIA DA PRODUÇÃO -->
          <div class="receipt-type">VIA DA PRODUÇÃO</div>
          <div class="header">
            <h1 style="margin: 10px 0; font-size: 32px;">MESA: ${order.tableNumber}</h1>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt || order.createdAt), "dd/MM/yyyy HH:mm")}</p>
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
          `}

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
    if (!selectedTable || cart.length === 0) return;

    if (paymentMethod === "fiado" && !customerName.trim()) {
      alert("O nome do cliente é obrigatório para transferir para Fiado!");
      return;
    }

    try {
      const existingOrder = openTables.find(
        (t) => t.tableNumber === selectedTable,
      );

      const isFiado = paymentMethod === "fiado";

      const orderUpdatePayload: any = {
        type: isFiado ? "fiado" : "mesa",
        status: isFiado ? "open" : "closed",
        tableNumber: selectedTable,
        observations: observations || "",
        items: cart.map((item) => ({
          productId: item.id || "unknown",
          name: item.name || "Produto",
          price: parsedPrice(item.price),
          quantity: Number(item.quantity) || 1,
          observation: item.observation || "",
          productionStatus: item.productionStatus || "pending",
        })),
        total: Number(total) || 0,
        createdAt:
          typeof existingOrder?.createdAt === "string" &&
          existingOrder.createdAt.includes("T")
            ? existingOrder.createdAt
            : new Date().toISOString(),
        cashierId: currentSession.id || "unknown",
      };

      if (customerName || isFiado) {
        orderUpdatePayload.customerName = customerName || "Cliente Fiado";
      }

      if (customerPhone) {
        orderUpdatePayload.customerPhone = customerPhone;
      }

      if (!isFiado) {
        orderUpdatePayload.paymentMethod = paymentMethod;
        orderUpdatePayload.closedAt = new Date().toISOString();
      }

      const orderData = orderUpdatePayload;

      if (existingOrder) {
        await updateDoc(doc(db, "orders", existingOrder.id), orderData);
      } else {
        await addDoc(collection(db, "orders"), {
          ...orderData,
          createdAt: new Date().toISOString(),
        });
      }

      closeTableModal();

      // Update cashier session total only if not fiado
      if (!isFiado) {
        await updateDoc(doc(db, "cashierSessions", currentSession.id), {
          totalSales: increment(Number(total) || 0),
        });
        handlePrint(orderData);
        navigate("/");
      } else {
        navigate("/fiados");
      }
    } catch (error: any) {
      alert(
        "Erro ao fechar conta: " +
          (error.message || "Verifique os dados e tente novamente."),
      );
      handleFirestoreError(error, OperationType.WRITE, "orders");
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mesas</h1>
          <p className="text-gray-500 text-sm">Gerencie o consumo das mesas e adicione novas conforme necessário</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="add-new-table-btn"
            onClick={openAddTableModal}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-lg shadow transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Mesa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((table, index) => {
          const isOpen = openTables.some(
            (t) => t.tableNumber === table.number,
          );
          const order = openTables.find((t) => t.tableNumber === table.number);

          return (
            <div 
              key={`table-wrapper-${table.number}-${index}`}
              className="relative group animate-[fadeIn_0.3s_ease-out]"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                id={`table-card-${table.number}`}
                onClick={() => openTableModal(table.number)}
                className={`w-full p-6 rounded-lg shadow flex flex-col items-center justify-center transition-transform hover:scale-105 min-h-[140px] ${
                  isOpen
                    ? "bg-red-600 text-white"
                    : "bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Coffee
                  className={`w-8 h-8 mb-2 ${isOpen ? "text-white" : "text-gray-400"}`}
                />
                <span className="font-bold text-lg">Mesa {table.number}</span>
                {isOpen && order && (
                  <div className="flex flex-col items-center w-full">
                    {order.customerName && (
                      <span className="text-xs font-medium text-red-100 truncate w-full px-2 text-center block max-w-full">
                        {order.customerName}
                      </span>
                    )}
                    <span className="text-xs mt-1 bg-red-700 px-2 py-1 rounded text-white shadow-sm font-bold">
                      R$ {order.total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                )}
              </motion.button>

              {/* Delete Table Button - only available if the table is closed */}
              {!isOpen && (
                <button
                  id={`delete-table-btn-${table.number}`}
                  onClick={(e) => handleDeleteTable(table, e)}
                  title={`Excluir Mesa ${table.number}`}
                  className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 shadow-sm border border-red-200 z-10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[95vh] sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">
                  Mesa {selectedTable}
                </h2>
                {customerName ? (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-gray-600 bg-gray-200 px-3 py-1 flex items-center rounded-full text-sm font-medium">
                      Cliente:
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        onBlur={(e) => handleUpdateCustomerName(e.target.value)}
                        className="ml-2 bg-transparent border-b border-dashed border-gray-400 focus:border-red-500 outline-none text-sm font-bold text-gray-800 w-auto min-w-[120px]"
                      />
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpdateCustomerName("Novo Cliente")}
                    className="ml-4 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-full font-medium transition-colors"
                  >
                    + Adicionar Cliente
                  </button>
                )}
              </div>
              <button
                onClick={closeTableModal}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Step 1: Products List */}
              {step === 1 && (
                <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-white border-b">
                    <h3 className="font-bold text-gray-700 text-lg">
                      Adicionar Produtos
                    </h3>

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

                  <div className="p-4 pb-28 flex-1 overflow-y-auto">
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                                      <span className="font-bold text-gray-800 flex-1 text-md leading-tight mb-2">
                                        {product.name}
                                      </span>
                                      <div className="flex justify-between items-end w-full mt-auto pt-3">
                                        <span className="text-red-600 font-black">
                                          R${" "}
                                          {parsedPrice(product.price)
                                            .toFixed(2)
                                            .replace(".", ",")}
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

                  {/* Floating Next Step Button */}
                  <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none">
                    <div className="w-full max-w-md flex gap-2 pointer-events-auto">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSaveTable()}
                        className="flex-1 bg-white text-red-600 border-2 border-red-600 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-red-50 transition-all"
                      >
                        Salvar Mesa
                      </motion.button>
                      {cart.length > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setStep(2)}
                          className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all flex items-center justify-center"
                        >
                          <ShoppingCart className="w-5 h-5 mr-2" />
                          Ver Carrinho
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Cart & Checkout */}
              {step === 2 && (
                <div className="flex-1 flex flex-col bg-white max-w-2xl mx-auto w-full overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center">
                      <button
                        onClick={() => setStep(1)}
                        className="mr-4 text-gray-500 hover:text-gray-800 font-bold p-1"
                      >
                        ← Voltar
                      </button>
                      <h3 className="font-bold text-gray-700 text-lg">
                        Revisar Pedido
                      </h3>
                    </div>
                    <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full">
                      {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-4 mb-8">
                      {cart.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          Mesa vazia
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {cart.map((item) => (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              key={item.id}
                              className="flex flex-col bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative gap-3"
                            >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 pr-4">
                                <p className="font-bold text-gray-800 text-lg leading-tight">
                                  {item.name}
                                </p>
                                <p className="text-gray-500 text-xs font-medium mt-1">
                                  R$ {parsedPrice(item.price).toFixed(2).replace(".", ",")} /
                                  un
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-gray-800 text-lg">
                                  R${" "}
                                  {(parsedPrice(item.price) * item.quantity)
                                    .toFixed(2)
                                    .replace(".", ",")}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-gray-100 pt-3 mt-1 gap-3 sm:gap-4">
                              <div className="flex-1 w-full">
                                <input
                                  type="text"
                                  placeholder="Observação (ex: com gelo, sem cebola)"
                                  value={item.observation || ""}
                                  onChange={(e) =>
                                    updateObservation(item.id, e.target.value)
                                  }
                                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors outline-none"
                                />
                              </div>
                              <div className="flex items-center shrink-0 space-x-1 sm:space-x-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
                                >
                                  <Minus className="w-4 h-4 sm:w-5 h-5" />
                                </button>
                                <span className="w-8 sm:w-10 text-center font-black text-gray-800 text-lg">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
                                >
                                  <Plus className="w-4 h-4 sm:w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="p-2 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg ml-1 sm:ml-2 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 sm:w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>

                    {/* Dados do Cliente e Observações */}
                    <div className="mb-6 space-y-4 border-t pt-6 bg-white shrink-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                            Nome do Cliente
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Opcional"
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-gray-500 outline-none pb-3 pt-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                            WhatsApp do Cliente
                          </label>
                          <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Ex: 11999999999 (DDD + Número)"
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-gray-500 outline-none pb-3 pt-3 text-sm"
                          />
                        </div>
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

                    {/* Forma de Pagamento - Moved semi-inside scroll area */}
                    <div className="mb-6">
                      <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">
                        Escolha a Forma de Pagamento
                      </p>
                      <div className="grid grid-cols-4 gap-2">
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
                          <span className="text-xs sm:text-base text-center">
                            PIX
                          </span>
                        </button>
                        <button
                          onClick={() => setPaymentMethod("fiado")}
                          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 font-bold transition-all ${
                            paymentMethod === "fiado"
                              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-md"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <NotebookText className="w-6 h-6 sm:w-8 h-8 mb-1 sm:mb-2" />
                          <span className="text-xs sm:text-base text-center">
                            Fiado
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 border-t bg-gray-50 flex-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] sm:shadow-none pb-safe">
                    <button
                      onClick={handleSendWhatsApp}
                      disabled={cart.length === 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 sm:py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 mb-4 shrink-0 cursor-pointer"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.004 2c-5.51 0-9.993 4.483-9.993 9.993 0 1.763.457 3.49 1.332 5.013l-1.343 4.905 5.022-1.317c1.464.798 3.107 1.219 4.815 1.22 5.51 0 9.993-4.483 9.993-9.993C21.99 6.483 17.514 2 12.004 2zm6.182 14.126c-.255.725-1.025.1-1.3.1-2.31-1.764-2.22-.387-2.67-1.127.1-.258.261-.518.57-.86.919-.341.353-.618.396-1.127.143-.51-.254-2.148-.792-4.094-2.528-1.513-1.35-2.536-3.017-2.833-3.526-.297-.51-.031-.785.224-1.039.231-.228.51-.594.765-.89h.1c.17 0 .255.085.34.254.17.34.595 1.442.637 1.528.043.085.085.17.022.296-.064.128-.106.213-.213.34-.106.127-.223.212-.318.339-.096.126-.181.254-.085.424.096.17.425.702.914 1.139.63.565 1.162.934 1.714 1.189.51.254.786.19 1.062-.085.277-.275 1.211-1.4 1.53-1.887.085-.127.213-.17.34-.127.128.042.829.39 1.573.763.51.254.851.382.957.551.106.17.106.977-.149 1.702z"/>
                      </svg>
                      Enviar Conta por WhatsApp
                    </button>
                    <div className="flex justify-between items-center mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
                      <span className="text-gray-600 font-bold text-md sm:text-lg">
                        Total a Pagar
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-gray-800">
                        R$ {total.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        onClick={() => handleSaveTable()}
                        className="bg-red-100 text-red-700 py-3 sm:py-4 rounded-xl font-bold text-md sm:text-lg hover:bg-red-200 transition-all border border-red-200"
                      >
                        Salvar Mesa
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !currentSession}
                        className="bg-green-600 text-white py-3 sm:py-4 rounded-xl font-bold text-md sm:text-lg shadow-lg hover:bg-green-700 hover:shadow-xl disabled:opacity-50 flex items-center justify-center transition-all"
                      >
                        <CheckCircle className="w-5 h-5 sm:w-6 h-6 mr-2" />
                        {paymentMethod === "fiado"
                          ? "Transferir para Fiado"
                          : "Fechar Conta"}
                      </button>
                    </div>

                    {!currentSession && (
                      <p className="text-red-500 text-xs sm:text-sm text-center mt-3 font-bold bg-red-50 py-1 rounded">
                        Abra o caixa para fechar a conta.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Table Dialog Modal */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">Criar Nova Mesa</h3>
              <button
                onClick={() => {
                  setIsAddTableModalOpen(false);
                  setNewTableNumber("");
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Defina o número da nova mesa. O sistema sugere o próximo disponível automaticamente.
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Número da Mesa
              </label>
              <input
                id="new-table-number-input"
                type="number"
                min="1"
                step="1"
                placeholder="Ex: 21"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none text-lg font-bold"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                id="cancel-add-table-btn"
                onClick={() => {
                  setIsAddTableModalOpen(false);
                  setNewTableNumber("");
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                id="confirm-add-table-btn"
                onClick={handleAddTableSubmit}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow transition-colors text-sm"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
