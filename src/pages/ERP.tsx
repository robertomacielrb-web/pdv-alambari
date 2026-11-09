import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  increment,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, getNextPassword } from "../firebase";
import {
  PackageOpen,
  ShoppingCart,
  List,
  Users,
  Search,
  Plus,
  Minus,
  Trash2,
  Edit2,
  CheckCircle,
  Printer,
  Banknote,
  CreditCard,
  QrCode,
  Wallet,
  Scale,
  ArrowLeft,
  UserPlus,
  X,
  Tag,
  FileText,
  Clock,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { executePrint } from "../lib/printHelper";
import WeightModal, { formatKg, parseItemQuantity, parsePrice } from "../components/WeightModal";
import { useStoreSettings } from "../contexts/StoreSettingsContext";
import { sendFiadoWhatsApp } from "../lib/fiadoWhatsApp";

interface Product {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  category: string;
  unit?: 'unidade' | 'kg';
  stock?: number;
  erpOnly?: boolean;
}

interface Customer {
  id: string;
  name: string;
  document: string;
  phone: string;
  address: string;
  createdAt: string;
}

interface CartItem extends Product {
  quantity: number;
  unit?: 'unidade' | 'kg';
  observation?: string;
  isWholesale: boolean;
}

interface CashierSession {
  id: string;
  status: string;
}

export default function ERP() {
  const [activeTab, setActiveTab] = useState<'nova_venda' | 'vendas_aberto' | 'clientes'>('nova_venda');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  const [openOrdersCount, setOpenOrdersCount] = useState<number>(0);

  // Cart state shared or preserved across tabs
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    // Products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || "Sem Nome",
          price: parsePrice(data.price),
          wholesalePrice: data.wholesalePrice !== undefined && data.wholesalePrice !== null ? parsePrice(data.wholesalePrice) : undefined,
          category: data.category ? String(data.category).trim() : "Geral",
          unit: data.unit || 'unidade',
          stock: data.stock !== undefined ? Number(data.stock) : undefined,
          erpOnly: data.erpOnly,
        });
      });
      setProducts(list);
    });

    // Customers
    const unsubCustomers = onSnapshot(collection(db, "erp_customers"), (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || "",
          document: data.document || "",
          phone: data.phone || "",
          address: data.address || "",
          createdAt: data.createdAt || "",
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(list);
    });

    // Cashier Session
    const unsubSession = onSnapshot(
      query(collection(db, "cashierSessions"), where("status", "==", "open")),
      (snapshot) => {
        if (!snapshot.empty) {
          setCurrentSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CashierSession);
        } else {
          setCurrentSession(null);
        }
      }
    );

    // Open Orders Count
    const unsubOpenOrders = onSnapshot(
      query(collection(db, "orders"), where("type", "==", "atacado"), where("status", "==", "open")),
      (snapshot) => {
        setOpenOrdersCount(snapshot.size);
      }
    );

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubSession();
      unsubOpenOrders();
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative bg-gray-50 overflow-hidden select-none">
      {/* Top Header with navigation tabs */}
      <div className="bg-white border-b shadow-2xs px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <PackageOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">Módulo ERP • Atacado</h1>
            <p className="text-xs text-gray-500 font-medium">Vendas corporativas, atacado e faturamento a prazo</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('nova_venda')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'nova_venda'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Nova Venda</span>
            {cart.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
                activeTab === 'nova_venda' ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
              }`}>
                {cart.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vendas_aberto')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'vendas_aberto'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Vendas em Aberto</span>
            {openOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-black bg-amber-500 text-white animate-pulse">
                {openOrdersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clientes')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'clientes'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes</span>
            <span className="text-[11px] font-extrabold px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full">
              {customers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        {activeTab === 'nova_venda' && (
          <ERPNovaVenda
            products={products}
            customers={customers}
            currentSession={currentSession}
            cart={cart}
            setCart={setCart}
          />
        )}
        {activeTab === 'vendas_aberto' && (
          <ERPVendasAberto currentSession={currentSession} />
        )}
        {activeTab === 'clientes' && (
          <ERPClientes customers={customers} />
        )}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: NOVA VENDA (Idêntico ao Balcão)
// ==========================================
function ERPNovaVenda({
  products,
  customers,
  currentSession,
  cart,
  setCart,
}: {
  products: Product[];
  customers: Customer[];
  currentSession: CashierSession | null;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  // Settings for wholesale pricing
  const [useWholesalePrice, setUseWholesalePrice] = useState(true);

  // Customer & Checkout info
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao" | "pix" | "multiplo" | "fiado">("dinheiro");
  const [splitPayments, setSplitPayments] = useState({ dinheiro: "", cartao: "", pix: "" });
  const [discount, setDiscount] = useState<number | "">("");
  const [observations, setObservations] = useState("");

  // Weight modal state (for kg items)
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighingCartItem, setWeighingCartItem] = useState<CartItem | null>(null);

  // Quick Customer Creation Modal in Checkout
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: "", document: "", phone: "", address: "" });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Completion Password Modal
  const [lastPassword, setLastPassword] = useState<number | null>(null);
  const [lastOrder, setLastOrder] = useState<any | null>(null);

  // Toast for item added
  const [addedItemName, setAddedItemName] = useState<string | null>(null);

  // Barcode scanner integration (Toledo/Elgin starts with 2)
  const handleBarcodeOrSearchChange = (val: string) => {
    setSearchTerm(val);
    const clean = val.trim();
    if (clean.length === 12 || clean.length === 13) {
      if (clean.startsWith('2')) {
        const prodCode = clean.substring(1, 6);
        const valuePart = parseInt(clean.substring(6, 11), 10);
        const matched = products.find(p => p.id === prodCode || p.id.endsWith(prodCode) || (p as any).barcode === clean || (p as any).code === prodCode);
        if (matched) {
          const isWeight = matched.unit === 'kg';
          const qty = isWeight ? valuePart / 1000 : 1;
          addToCart(matched, qty);
          setSearchTerm('');
        }
      }
    }
  };

  // Group products by category
  const groupedProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
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
      {} as Record<string, Product[]>
    );
  }, [products, searchTerm, selectedCategory]);

  const categories = useMemo(() => ["all", ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  // Price calculation helper
  const getEffectivePrice = (prod: Product, isWholesale: boolean) => {
    if (isWholesale && prod.wholesalePrice !== undefined && prod.wholesalePrice > 0) {
      return prod.wholesalePrice;
    }
    return prod.price;
  };

  // Add to cart function - Instant for units, opens WeightModal for kg
  const addToCart = (product: Product, customQty?: number, customObs?: string) => {
    if (product.unit === 'kg' && customQty === undefined) {
      const existing = cart.find((item) => item.id === product.id);
      setWeighingProduct(product);
      setWeighingCartItem(existing || null);
      setIsWeighModalOpen(true);
      return;
    }

    const qtyToAdd = customQty !== undefined ? customQty : 1;
    const isWholesale = useWholesalePrice && product.wholesalePrice !== undefined && product.wholesalePrice > 0;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: product.unit === 'kg' && customQty !== undefined ? customQty : Number(item.quantity) + qtyToAdd,
                observation: customObs !== undefined ? customObs : (item.observation || ''),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          ...product,
          unit: product.unit || 'unidade',
          quantity: qtyToAdd,
          observation: customObs || "",
          isWholesale,
        },
      ];
    });

    const label = `${product.name} ${product.unit === 'kg' ? `(${formatKg(qtyToAdd)})` : `(${qtyToAdd} un)`}`;
    setAddedItemName(label);
    setTimeout(() => setAddedItemName(null), 1500);
  };

  const handleConfirmWeight = (weightKg: number, obs: string) => {
    if (!weighingProduct) return;
    const isWholesale = useWholesalePrice && weighingProduct.wholesalePrice !== undefined && weighingProduct.wholesalePrice > 0;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === weighingProduct.id);
      if (existing) {
        return prev.map((item) =>
          item.id === weighingProduct.id
            ? {
                ...item,
                quantity: weightKg,
                unit: 'kg',
                observation: obs !== undefined && obs !== '' ? obs : item.observation,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          ...weighingProduct,
          quantity: weightKg,
          unit: 'kg',
          observation: obs || '',
          isWholesale,
        },
      ];
    });

    setIsWeighModalOpen(false);
    setWeighingProduct(null);
    setWeighingCartItem(null);
    setAddedItemName(`${weighingProduct.name} (${formatKg(weightKg)})`);
    setTimeout(() => setAddedItemName(null), 1500);
  };

  const openWeighModalForCartItem = (item: CartItem) => {
    const prod = products.find(p => p.id === item.id) || {
      id: item.id,
      name: item.name,
      price: item.price,
      wholesalePrice: item.wholesalePrice,
      category: item.category || 'Carnes / Defumados',
      unit: 'kg',
    };
    setWeighingProduct(prod);
    setWeighingCartItem(item);
    setIsWeighModalOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const isKg = item.unit === 'kg';
            const stepVal = isKg ? (delta > 0 ? 0.05 : -0.05) : delta;
            const newQ = Math.round((Number(item.quantity) + stepVal) * 1000) / 1000;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateObservation = (id: string, obs: string) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, observation: obs } : item))
    );
  };

  const toggleItemWholesale = (id: string) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isWholesale: !item.isWholesale } : item))
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => {
    const itemPrice = item.isWholesale && item.wholesalePrice !== undefined && item.wholesalePrice > 0
      ? item.wholesalePrice
      : item.price;
    return sum + itemPrice * parseItemQuantity(item.quantity);
  }, 0);

  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const totalKg = cart
    .filter((item) => item.unit === "kg")
    .reduce((sum, item) => sum + parseItemQuantity(item.quantity), 0);

  // Quick save new customer from inside Checkout
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerForm.name.trim()) {
      alert("Informe o nome do cliente");
      return;
    }
    setIsSavingCustomer(true);
    try {
      const docRef = await addDoc(collection(db, "erp_customers"), {
        ...quickCustomerForm,
        name: quickCustomerForm.name.trim(),
        createdAt: new Date().toISOString(),
      });
      setSelectedCustomerId(docRef.id);
      setIsQuickCustomerOpen(false);
      setQuickCustomerForm({ name: "", document: "", phone: "", address: "" });
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar cliente.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Print helper for ERP receipts
  const handlePrint = (order: any) => {
    const itemsHtml = (order.items || [])
      .map((item: any) => {
        const isKg = item.unit === 'kg';
        const qtyText = isKg ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`;
        const subTotalText = (Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2).replace('.', ',');
        return `
          <tr>
            <td style="padding: 5px 0;">
              ${item.name} (${qtyText})
              ${isKg ? `<br><small style="font-size: 10px; color: #555;">R$ ${Number(item.price || 0).toFixed(2).replace('.', ',')}/kg</small>` : ''}
              ${item.observation ? `<br><small style="font-size: 10px; font-style: italic;">Obs: ${item.observation}</small>` : ""}
            </td>
            <td style="text-align: right; padding: 5px 0;">R$ ${subTotalText}</td>
          </tr>
        `;
      })
      .join("");

    const isFiado = order.paymentMethod === 'fiado' || order.status === 'open';
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pedido ERP #${order.password || ""}</title>
          <style>
            html, body { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 80mm; margin: 0 auto; padding: 10px; font-size: 13px; font-weight: bold; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .total { font-weight: bold; font-size: 14px; margin-top: 8px; display: flex; justify-content: space-between; }
            .status-badge { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px; padding: 5px; border: 1px solid #000; }
            .no-print { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 8px; }
            .btn { flex: 1; padding: 10px; margin: 0 4px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; text-align: center; }
            .btn-print { background: #10b981; color: white; }
            .btn-close { background: #ef4444; color: white; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn btn-close" onclick="window.close()">Fechar</button>
            <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir</button>
          </div>
          <div class="status-badge">${isFiado ? "ATACADO - A PRAZO / FATURADO" : "COMPROVANTE ATACADO"}</div>
          <div class="header">
            <h2 style="margin: 0;">ALAMBARI DEFUMADOS</h2>
            <p style="margin: 3px 0;">MÓDULO ERP • ATACADO</p>
            <p style="margin: 4px 0;">Data: ${format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</p>
            ${order.password ? `<h1 style="margin: 8px 0;">SENHA: ${order.password}</h1>` : ""}
            <p style="margin: 4px 0; font-size: 14px;">CLIENTE: ${order.customerName || "Consumidor"}</p>
            ${order.observations ? `<p style="margin: 4px 0; font-style: italic;">Obs: ${order.observations}</p>` : ""}
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
          ${order.discount && order.discount > 0 ? `
          <div class="total" style="font-weight: normal;">
            <span>Subtotal:</span>
            <span>R$ ${(order.total + order.discount).toFixed(2).replace(".", ",")}</span>
          </div>
          <div class="total" style="font-weight: normal; color: red;">
            <span>Desconto:</span>
            <span>- R$ ${order.discount.toFixed(2).replace(".", ",")}</span>
          </div>
          ` : ""}
          <div class="total" style="font-size: 16px; border-top: 1px solid #000; padding-top: 5px;">
            <span>TOTAL:</span>
            <span>R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}</span>
          </div>
          <p style="margin: 10px 0 0 0; text-transform: uppercase;">FORMA DE PAGAMENTO: ${order.paymentMethod || "DINHEIRO"}</p>
          <div class="footer">
            <p style="margin: 0;">Obrigado pela preferência!</p>
          </div>
        </body>
      </html>
    `;
    executePrint(order, content);
  };

  // Finalizar Venda Atacado
  const handleCheckout = async () => {
    if (!currentSession) {
      alert("O caixa está fechado! Abra o caixa para realizar vendas.");
      return;
    }
    if (cart.length === 0 || isProcessing || isProcessingRef.current) return;

    // Resolve customer name
    const foundCustomer = customers.find((c) => c.id === selectedCustomerId);
    const finalCustomerName = (foundCustomer?.name || manualCustomerName.trim()) || "Cliente Balcão / Avulso";

    // Split payments check if multiplo
    let finalSplitPayments: any = undefined;
    if (paymentMethod === "multiplo") {
      const dinheiroVal = Number(splitPayments.dinheiro) || 0;
      const cartaoVal = Number(splitPayments.cartao) || 0;
      const pixVal = Number(splitPayments.pix) || 0;
      const totalSplit = dinheiroVal + cartaoVal + pixVal;
      if (Math.abs(totalSplit - total) > 0.01) {
        alert(
          `A soma dos pagamentos (R$ ${totalSplit.toFixed(2).replace('.', ',')}) não confere com o total (R$ ${total.toFixed(2).replace('.', ',')}).`
        );
        return;
      }
      finalSplitPayments = [];
      if (dinheiroVal > 0) finalSplitPayments.push({ method: "dinheiro", amount: dinheiroVal });
      if (cartaoVal > 0) finalSplitPayments.push({ method: "cartao", amount: cartaoVal });
      if (pixVal > 0) finalSplitPayments.push({ method: "pix", amount: pixVal });
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      const password = await getNextPassword(currentSession.id);
      const isFiado = paymentMethod === "fiado";
      const nowIso = new Date().toISOString();

      const orderData = {
        type: "atacado",
        status: isFiado ? "open" : "closed",
        items: cart.map((item) => {
          const itemPrice = item.isWholesale && item.wholesalePrice !== undefined && item.wholesalePrice > 0
            ? item.wholesalePrice
            : item.price;
          return {
            productId: item.id || "unknown",
            name: item.name || "Produto",
            price: Number(itemPrice) || 0,
            quantity: Number(item.quantity) || 1,
            unit: item.unit || "unidade",
            observation: item.observation || "",
            isWholesale: item.isWholesale,
            productionStatus: "pending",
          };
        }),
        total: Number(total) || 0,
        discount: Number(discount) || 0,
        paymentMethod,
        splitPayments: finalSplitPayments || [],
        customerName: finalCustomerName,
        customerId: selectedCustomerId || null,
        observations: observations.trim(),
        createdAt: nowIso,
        closedAt: !isFiado ? nowIso : null,
        password: password || 0,
        cashierId: currentSession.id,
        sessionId: currentSession.id,
      };

      const docRef = await addDoc(collection(db, "orders"), orderData);

      // Only update cashier total if sale was closed (paid on spot)
      if (!isFiado) {
        await updateDoc(doc(db, "cashierSessions", currentSession.id), {
          totalSales: increment(Number(total) || 0),
        });
      }

      const fullOrder = { id: docRef.id, ...orderData };
      handlePrint(fullOrder);
      setLastOrder(fullOrder);
      setLastPassword(password);

      // Reset form
      setCart([]);
      setSelectedCustomerId("");
      setManualCustomerName("");
      setDiscount("");
      setObservations("");
      setPaymentMethod("dinheiro");
      setSplitPayments({ dinheiro: "", cartao: "", pix: "" });
      setStep(1);
    } catch (error: any) {
      alert("Erro ao finalizar venda: " + (error.message || "Tente novamente."));
      handleFirestoreError(error, OperationType.CREATE, "orders");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  // If cashier is closed, inform the user
  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Caixa Fechado</h2>
          <p className="text-gray-600 text-sm mb-6">
            Você precisa abrir o caixa para realizar vendas e movimentações no PDV ERP Atacado.
          </p>
          <a
            href="#/caixa"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all"
          >
            Ir para Controle de Caixa
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden min-h-0">
      {/* ================= STEP 1: CATALOGO DE PRODUTOS ================= */}
      {step === 1 && (
        <div className="flex-1 flex flex-col h-full bg-white rounded-none sm:rounded-lg shadow-none sm:shadow overflow-hidden min-h-0">
          {/* Search bar & Pricing toggle */}
          <div className="p-3 sm:p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <PackageOpen className="w-5 h-5 text-indigo-600" />
                <span>Produtos (Atacado & Varejo)</span>
              </h2>
            </div>

            <div className="flex flex-1 sm:max-w-xl gap-2 items-center">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar produto ou bipar etiqueta da balança..."
                  value={searchTerm}
                  onChange={(e) => handleBarcodeOrSearchChange(e.target.value)}
                  className="pl-9 w-full rounded-xl border-2 border-gray-200 p-2 text-sm focus:border-indigo-500 outline-none transition-all bg-white"
                />
              </div>

              {/* Wholesale / Retail Table Toggle */}
              <button
                type="button"
                onClick={() => setUseWholesalePrice(!useWholesalePrice)}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  useWholesalePrice
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
                title="Alternar entre preço de tabela de atacado ou tabela de varejo"
              >
                <Tag className={`w-3.5 h-3.5 ${useWholesalePrice ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span>{useWholesalePrice ? "Tabela Atacado" : "Tabela Varejo"}</span>
              </button>
            </div>

            {cart.length > 0 && (
              <span className="bg-indigo-100 text-indigo-900 text-xs sm:text-sm font-black px-3 py-1.5 rounded-full whitespace-nowrap self-start sm:self-center">
                {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                {totalKg > 0 && ` (${totalKg.toFixed(3).replace(".", ",")} kg)`}
              </span>
            )}
          </div>

          {/* Categories horizontal scroll pills */}
          <div className="bg-white border-b overflow-x-auto scrollbar-thin scrollbar-indigo flex p-2.5 gap-2 whitespace-nowrap shrink-0">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat === "all" ? "Todas Categorias" : cat}
              </button>
            ))}
          </div>

          {/* Scrollable Products Grid with extra bottom padding for floating button */}
          <div className="p-4 overflow-y-auto flex-1 content-start pb-28 scrollbar-thin scrollbar-indigo min-h-0">
            {Object.entries(groupedProducts).length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <PackageOpen className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="font-bold">Nenhum produto cadastrado ou encontrado.</p>
                <p className="text-xs text-gray-400 mt-1">Verifique a busca ou cadastre produtos na aba Produtos.</p>
              </div>
            ) : (
              Object.keys(groupedProducts)
                .sort()
                .map((category) => (
                  <div key={category} className="mb-6">
                    <h3 className="font-bold text-gray-700 mb-3 border-b-2 border-gray-100 pb-2 flex items-center">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-black mr-2">
                        {category}
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                      {groupedProducts[category]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((product, index) => {
                          const cartItem = cart.find((item) => item.id === product.id);
                          const isKg = product.unit === 'kg';
                          const hasWholesale = product.wholesalePrice !== undefined && product.wholesalePrice > 0;
                          const effectivePrice = getEffectivePrice(product, useWholesalePrice);

                          return (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={`erp-prod-${product.id}-${index}`}
                              type="button"
                              onClick={() => addToCart(product)}
                              className={`relative border rounded-2xl p-3.5 text-left transition-all bg-white flex flex-col h-full group overflow-hidden shadow-2xs cursor-pointer ${
                                isKg ? "hover:border-amber-500 hover:shadow-md" : "hover:border-indigo-500 hover:shadow-md"
                              }`}
                            >
                              <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${
                                isKg ? "bg-amber-300 group-hover:bg-amber-500" : "bg-indigo-200 group-hover:bg-indigo-600"
                              }`} />

                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isKg
                                    ? "bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                                    : "bg-gray-100 text-gray-700"
                                }`}>
                                  {isKg ? "⚖️ Cobrança por Kg" : "Unidade"}
                                </span>

                                {cartItem && (
                                  <span className={`text-white text-xs font-black px-2 py-0.5 rounded-full shadow-xs ${
                                    isKg ? "bg-amber-600" : "bg-indigo-600"
                                  }`}>
                                    {isKg
                                      ? `${Number(cartItem.quantity).toFixed(3).replace(".", ",")} kg`
                                      : `${cartItem.quantity} un`}
                                  </span>
                                )}
                              </div>

                              <span className="font-bold text-gray-900 flex-1 text-sm sm:text-base leading-snug mb-2">
                                {product.name}
                              </span>

                              <div className="mt-auto pt-2 border-t border-gray-100 space-y-1">
                                <div className="flex items-baseline justify-between">
                                  <div>
                                    <span className="text-xs font-bold text-gray-400 mr-1">
                                      {useWholesalePrice && hasWholesale ? "Atacado:" : "Preço:"}
                                    </span>
                                    <span className="text-indigo-700 font-black text-base sm:text-lg">
                                      R$ {effectivePrice.toFixed(2).replace(".", ",")}
                                      <span className="text-xs text-gray-500 font-bold ml-1">
                                        {isKg ? "/ kg" : "/ un"}
                                      </span>
                                    </span>
                                  </div>

                                  {isKg && (
                                    <span className="text-[11px] text-amber-800 font-black flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                      <Scale className="w-3 h-3" />
                                      Pesar
                                    </span>
                                  )}
                                </div>

                                {hasWholesale && !useWholesalePrice && (
                                  <div className="text-[10px] text-gray-500 font-semibold">
                                    Atacado: R$ {product.wholesalePrice!.toFixed(2).replace(".", ",")}
                                  </div>
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

          {/* Toast feedback when item is added */}
          <AnimatePresence>
            {addedItemName && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-indigo-700 text-white px-5 py-2.5 rounded-full font-bold shadow-xl z-50 text-xs sm:text-sm whitespace-nowrap flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>{addedItemName} adicionado!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Action Button (Idêntico ao Balcão) */}
          {cart.length > 0 && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4 z-40">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-indigo-600 text-white py-3.5 sm:py-4 rounded-2xl font-black text-base sm:text-lg shadow-xl hover:bg-indigo-700 hover:shadow-2xl transition-all flex items-center justify-between px-6 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Ver Carrinho ({cart.length})</span>
                </div>
                <span>R$ {total.toFixed(2).replace(".", ",")}</span>
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 2: REVISÃO DO CARRINHO E CHECKOUT ================= */}
      {step === 2 && (
        <div className="flex-1 bg-white rounded-none sm:rounded-lg shadow flex flex-col max-w-2xl mx-auto w-full h-full overflow-hidden min-h-0">
          {/* Header */}
          <div className="p-3 sm:p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mr-3 p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors cursor-pointer flex items-center gap-1 text-sm font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <span>Revisar Venda Atacado</span>
              </h2>
            </div>
            <span className="bg-indigo-100 text-indigo-900 text-xs sm:text-sm font-black px-3 py-1 rounded-full">
              {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
            </span>
          </div>

          {/* Scrollable Cart Items & Checkout Form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-indigo min-h-0">
            {/* Cart Items List */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Itens no Pedido</h3>
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <p>O carrinho está vazio.</p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-3 text-indigo-600 font-bold hover:underline"
                  >
                    Adicionar Produtos
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {cart.map((item) => {
                      const itemPrice = item.isWholesale && item.wholesalePrice !== undefined && item.wholesalePrice > 0
                        ? item.wholesalePrice
                        : item.price;
                      const itemSubtotal = itemPrice * parseItemQuantity(item.quantity);

                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={item.id}
                          className="bg-white border border-gray-200 rounded-2xl p-3.5 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-sm sm:text-base leading-snug">
                                  {item.name}
                                </span>
                                {item.unit === 'kg' && (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                    ⚖️ Por Quilo
                                  </span>
                                )}
                                {item.wholesalePrice !== undefined && item.wholesalePrice > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleItemWholesale(item.id)}
                                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer transition-all ${
                                      item.isWholesale
                                        ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title="Alternar entre preço de atacado e varejo"
                                  >
                                    {item.isWholesale ? "Preço Atacado" : "Preço Varejo"}
                                  </button>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 font-medium">
                                R$ {itemPrice.toFixed(2).replace(".", ",")} {item.unit === 'kg' ? '/ kg' : '/ un'}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="font-black text-gray-900 text-base sm:text-lg block">
                                R$ {itemSubtotal.toFixed(2).replace(".", ",")}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remover</span>
                              </button>
                            </div>
                          </div>

                          {/* Quantity control & weight modal button */}
                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="p-1.5 bg-white rounded-lg shadow-2xs hover:bg-gray-50 text-gray-700 cursor-pointer"
                                  title={item.unit === 'kg' ? "Diminuir 50g" : "Diminuir 1 un"}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="min-w-[70px] text-center font-black text-gray-800 text-xs sm:text-sm">
                                  {item.unit === 'kg'
                                    ? `${Number(item.quantity).toFixed(3).replace(".", ",")} kg`
                                    : item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="p-1.5 bg-white rounded-lg shadow-2xs hover:bg-gray-50 text-gray-700 cursor-pointer"
                                  title={item.unit === 'kg' ? "Aumentar 50g" : "Aumentar 1 un"}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {item.unit === 'kg' && (
                                <button
                                  type="button"
                                  onClick={() => openWeighModalForCartItem(item)}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Scale className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Alterar Peso</span>
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              placeholder="Obs: corte, embalagem..."
                              value={item.observation || ""}
                              onChange={(e) => updateObservation(item.id, e.target.value)}
                              className="flex-1 max-w-xs text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Customer Identification */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Cliente do Atacado</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerOpen(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Novo Cliente</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      if (e.target.value) setManualCustomerName("");
                    }}
                    className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm font-medium focus:border-indigo-500 outline-none bg-white cursor-pointer"
                  >
                    <option value="">Selecione da lista de clientes cadastrados...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.document ? `(${c.document})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    value={manualCustomerName}
                    onChange={(e) => {
                      setManualCustomerName(e.target.value);
                      if (e.target.value) setSelectedCustomerId("");
                    }}
                    placeholder="Ou digite o nome avulso do cliente..."
                    className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm font-medium focus:border-indigo-500 outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Order Observations */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
                Observações Gerais da Venda
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Entrega na quarta-feira, notas para transportadora, etc..."
                className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none resize-none h-18"
              />
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Forma de Pagamento
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("dinheiro")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                    paymentMethod === "dinheiro"
                      ? "bg-green-50 border-green-500 text-green-700 shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Banknote className="w-5 h-5 mb-1" />
                  <span className="text-xs">Dinheiro</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("cartao")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                    paymentMethod === "cartao"
                      ? "bg-red-50 border-red-500 text-red-700 shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <CreditCard className="w-5 h-5 mb-1" />
                  <span className="text-xs">Cartão</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                    paymentMethod === "pix"
                      ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <QrCode className="w-5 h-5 mb-1" />
                  <span className="text-xs">PIX</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("multiplo")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                    paymentMethod === "multiplo"
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Wallet className="w-5 h-5 mb-1" />
                  <span className="text-xs">Múltiplo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("fiado")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                    paymentMethod === "fiado"
                      ? "bg-amber-50 border-amber-500 text-amber-800 shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Clock className="w-5 h-5 mb-1" />
                  <span className="text-xs">A Prazo</span>
                </button>
              </div>

              {/* Múltiplo split payments editor */}
              {paymentMethod === "multiplo" && (
                <div className="p-3.5 border border-blue-200 bg-blue-50 rounded-2xl space-y-2.5 text-xs">
                  <h4 className="font-bold text-blue-900">Distribuir Valores por Forma:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-blue-200">
                      <span className="font-bold text-gray-700">Dinheiro:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitPayments.dinheiro}
                        onChange={(e) => setSplitPayments({ ...splitPayments, dinheiro: e.target.value })}
                        className="w-20 text-right font-black outline-none border-b border-blue-300"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-blue-200">
                      <span className="font-bold text-gray-700">Cartão:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitPayments.cartao}
                        onChange={(e) => setSplitPayments({ ...splitPayments, cartao: e.target.value })}
                        className="w-20 text-right font-black outline-none border-b border-blue-300"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-blue-200">
                      <span className="font-bold text-gray-700">PIX:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitPayments.pix}
                        onChange={(e) => setSplitPayments({ ...splitPayments, pix: e.target.value })}
                        className="w-20 text-right font-black outline-none border-b border-blue-300"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span>Soma: R$ {((Number(splitPayments.dinheiro) || 0) + (Number(splitPayments.cartao) || 0) + (Number(splitPayments.pix) || 0)).toFixed(2).replace('.', ',')}</span>
                    <span className={Math.abs((Number(splitPayments.dinheiro) || 0) + (Number(splitPayments.cartao) || 0) + (Number(splitPayments.pix) || 0) - total) > 0.01 ? 'text-red-600' : 'text-emerald-700'}>
                      Total Necessário: R$ {total.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Summary & Finalize Button */}
          <div className="p-4 sm:p-5 border-t bg-gray-50 shrink-0 flex-none space-y-4">
            <div className="bg-white p-3.5 rounded-2xl border shadow-2xs space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Subtotal dos Itens:</span>
                <span className="font-bold text-gray-800">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                <span className="text-gray-500 font-medium">Desconto (R$):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value ? Number(e.target.value) : "")}
                  className="w-24 border-2 border-gray-200 rounded-lg p-1 text-right font-bold focus:border-indigo-500 outline-none text-sm"
                  placeholder="0,00"
                />
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-base font-black text-gray-800">Total a Pagar:</span>
                <span className="text-2xl font-black text-indigo-700">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full bg-green-600 text-white py-3.5 sm:py-4 rounded-2xl font-black text-base sm:text-lg shadow-lg hover:bg-green-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>{isProcessing ? "Gravando Venda..." : (paymentMethod === "fiado" ? "Gravar Venda a Prazo" : "Finalizar e Emitir Pedido")}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL DE PESAGEM (KG) ================= */}
      <WeightModal
        isOpen={isWeighModalOpen}
        product={weighingProduct}
        initialWeight={weighingCartItem ? weighingCartItem.quantity : undefined}
        initialObservation={weighingCartItem ? weighingCartItem.observation : undefined}
        onClose={() => {
          setIsWeighModalOpen(false);
          setWeighingProduct(null);
          setWeighingCartItem(null);
        }}
        onConfirm={handleConfirmWeight}
      />

      {/* ================= MODAL RAPIDO CADASTRO CLIENTE ================= */}
      {isQuickCustomerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveQuickCustomer}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Cadastrar Cliente Rápido</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickCustomerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nome Completo / Razão *</label>
                <input
                  type="text"
                  required
                  value={quickCustomerForm.name}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                  placeholder="Nome do cliente ou empresa"
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CPF ou CNPJ</label>
                <input
                  type="text"
                  value={quickCustomerForm.document}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, document: e.target.value })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={quickCustomerForm.phone}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Endereço de Entrega / Cobrança</label>
                <textarea
                  value={quickCustomerForm.address}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade..."
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none resize-none h-18"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickCustomerOpen(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingCustomer}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md cursor-pointer"
              >
                {isSavingCustomer ? "Salvando..." : "Salvar e Selecionar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL SENHA / SUCESSO ================= */}
      {lastPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">Venda Concluída!</h3>
            <p className="text-gray-500 text-xs mb-4">Número sequencial da comanda atacado:</p>
            <div className="text-6xl font-black text-indigo-600 mb-6 tracking-widest">
              {lastPassword}
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (lastOrder) handlePrint(lastOrder);
                }}
                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 rounded-xl border border-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Reimprimir Comanda</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLastPassword(null);
                  setLastOrder(null);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-md cursor-pointer transition-colors text-sm"
              >
                Próxima Venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: VENDAS EM ABERTO & HISTORICO
// ==========================================
function ERPVendasAberto({ currentSession }: { currentSession: CashierSession | null }) {
  const { storeName, pixKey } = useStoreSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'open' | 'closed'>('open');
  const [closingOrder, setClosingOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix' | 'multiplo'>('dinheiro');
  const [splitPayments, setSplitPayments] = useState({ dinheiro: "", cartao: "", pix: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const handleSendWhatsApp = (order: any) => {
    sendFiadoWhatsApp(
      {
        customerName: order.customerName || "Cliente",
        customerPhone: order.customerPhone || order.phone || "",
        items: order.items || [],
        total: Number(order.total) || 0,
        discount: Number(order.discount) || 0,
        createdAt: order.createdAt,
        password: order.password,
      },
      { storeName, pixKey }
    );
  };

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "orders"), where("type", "==", "atacado"), where("status", "==", viewMode)),
      (snapshot) => {
        const sorted = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(sorted);
      }
    );
    return () => unsub();
  }, [viewMode]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (o) =>
        (o.customerName || "").toLowerCase().includes(term) ||
        String(o.password || "").includes(term)
    );
  }, [orders, searchTerm]);

  const handlePrint = (order: any) => {
    const itemsHtml = (order.items || [])
      .map((item: any) => {
        const isKg = item.unit === 'kg';
        const qtyText = isKg ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`;
        const subTotalText = (Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2).replace('.', ',');
        return `
          <tr>
            <td style="padding: 4px 0;">${item.name} (${qtyText})</td>
            <td style="text-align: right; padding: 4px 0;">R$ ${subTotalText}</td>
          </tr>
        `;
      })
      .join("");

    const isFiado = order.status === 'open';
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pedido ERP #${order.password || ""}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 80mm; margin: 0 auto; padding: 10px; font-size: 13px; font-weight: bold; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; }
            .total { font-weight: bold; font-size: 14px; margin-top: 8px; display: flex; justify-content: space-between; }
            .no-print { display: flex; justify-content: space-between; margin-bottom: 15px; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">ALAMBARI DEFUMADOS</h2>
            <p style="margin: 2px 0;">ATACADO - ${isFiado ? "EM ABERTO" : "FINALIZADO"}</p>
            <p style="margin: 4px 0;">Data: ${format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</p>
            ${order.password ? `<h1 style="margin: 6px 0;">SENHA: ${order.password}</h1>` : ""}
            <p style="margin: 4px 0;">CLIENTE: ${order.customerName || "Consumidor"}</p>
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
          <div class="total" style="border-top: 1px solid #000; padding-top: 5px;">
            <span>TOTAL:</span>
            <span>R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}</span>
          </div>
        </body>
      </html>
    `;
    executePrint(order, content);
  };

  const confirmCloseOrder = async () => {
    if (!currentSession) {
      alert("Caixa fechado. Abra o caixa primeiro para receber pagamentos.");
      return;
    }
    if (!closingOrder) return;

    let finalSplitPayments: any = undefined;
    if (paymentMethod === "multiplo") {
      const d = Number(splitPayments.dinheiro) || 0;
      const c = Number(splitPayments.cartao) || 0;
      const p = Number(splitPayments.pix) || 0;
      if (Math.abs(d + c + p - Number(closingOrder.total || 0)) > 0.01) {
        alert("A soma dos pagamentos não confere com o total da venda!");
        return;
      }
      finalSplitPayments = [];
      if (d > 0) finalSplitPayments.push({ method: "dinheiro", amount: d });
      if (c > 0) finalSplitPayments.push({ method: "cartao", amount: c });
      if (p > 0) finalSplitPayments.push({ method: "pix", amount: p });
    }

    try {
      await updateDoc(doc(db, "orders", closingOrder.id), {
        status: "closed",
        closedAt: new Date().toISOString(),
        paymentMethod: paymentMethod,
        splitPayments: finalSplitPayments || [],
        cashierId: currentSession.id,
        sessionId: currentSession.id,
      });

      // Update cashier sales total
      await updateDoc(doc(db, "cashierSessions", currentSession.id), {
        totalSales: increment(Number(closingOrder.total || 0)),
      });

      setClosingOrder(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao receber pedido.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm("Deseja realmente cancelar e excluir este pedido de atacado?")) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir pedido.");
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white rounded-none sm:rounded-lg shadow overflow-hidden min-h-0">
      {/* View Switcher & Search */}
      <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('open')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                viewMode === 'open'
                  ? 'bg-white shadow-sm text-indigo-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Em Aberto (A Prazo / Fiado)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('closed')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                viewMode === 'closed'
                  ? 'bg-white shadow-sm text-indigo-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Histórico (Finalizadas)
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente ou senha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border-2 border-gray-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-indigo min-h-0">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="font-bold">Nenhuma venda encontrada {viewMode === 'open' ? 'em aberto' : 'no histórico'}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-2xl p-4 shadow-2xs bg-white flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {order.password && (
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                            #{order.password}
                          </span>
                        )}
                        <h4 className="font-black text-gray-900 text-base">{order.customerName || "Consumidor"}</h4>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        {format(new Date(order.createdAt), "dd/MM/yyyy • HH:mm")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(order)}
                        className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                        title="Enviar Conta no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrint(order)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                        title="Imprimir Comanda"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Excluir Venda"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-2.5 max-h-36 overflow-y-auto scrollbar-thin scrollbar-indigo space-y-1 text-xs">
                    {(order.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-gray-700">
                        <span className="truncate pr-2">
                          <strong>{it.quantity} {it.unit === 'kg' ? 'kg' : 'un'}</strong> {it.name}
                        </span>
                        <span className="font-bold shrink-0">
                          R$ {(Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.observations && (
                    <p className="text-[11px] text-gray-500 italic mt-2">
                      Obs: {order.observations}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-gray-500 text-xs">Total:</span>
                    <span className="text-lg font-black text-indigo-700">
                      R$ {Number(order.total || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {viewMode === 'open' ? (
                    <button
                      type="button"
                      onClick={() => setClosingOrder(order)}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Receber e Baixar</span>
                    </button>
                  ) : (
                    <div className="text-[11px] font-bold text-gray-500 text-center uppercase tracking-wider bg-gray-100 py-1.5 rounded-lg">
                      Pago via {order.paymentMethod || "Dinheiro"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Receber e Fechar */}
      {closingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-fadeIn">
            <h3 className="font-black text-lg text-gray-900">Receber Pagamento</h3>
            <p className="text-xs text-gray-500">
              Venda de <strong>{closingOrder.customerName}</strong> no valor de:
            </p>
            <div className="text-2xl font-black text-green-700 text-center py-2 bg-green-50 rounded-xl border border-green-200">
              R$ {Number(closingOrder.total || 0).toFixed(2).replace('.', ',')}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase block">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("dinheiro")}
                  className={`p-2.5 rounded-xl border-2 font-bold text-xs flex flex-col items-center cursor-pointer ${
                    paymentMethod === "dinheiro" ? "bg-green-50 border-green-500 text-green-700" : "bg-white border-gray-200"
                  }`}
                >
                  <Banknote className="w-4 h-4 mb-1" /> Dinheiro
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cartao")}
                  className={`p-2.5 rounded-xl border-2 font-bold text-xs flex flex-col items-center cursor-pointer ${
                    paymentMethod === "cartao" ? "bg-red-50 border-red-500 text-red-700" : "bg-white border-gray-200"
                  }`}
                >
                  <CreditCard className="w-4 h-4 mb-1" /> Cartão
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`p-2.5 rounded-xl border-2 font-bold text-xs flex flex-col items-center cursor-pointer ${
                    paymentMethod === "pix" ? "bg-purple-50 border-purple-500 text-purple-700" : "bg-white border-gray-200"
                  }`}
                >
                  <QrCode className="w-4 h-4 mb-1" /> PIX
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosingOrder(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl font-bold text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCloseOrder}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer"
              >
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: CADASTRO DE CLIENTES ERP
// ==========================================
function ERPClientes({ customers }: { customers: Customer[] }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({ name: "", document: "", phone: "", address: "" });

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.document.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  const openModal = (c?: Customer) => {
    if (c) {
      setEditingId(c.id);
      setFormData({ name: c.name, document: c.document, phone: c.phone, address: c.address });
    } else {
      setEditingId(null);
      setFormData({ name: "", document: "", phone: "", address: "" });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Nome é obrigatório");

    try {
      if (editingId) {
        await updateDoc(doc(db, "erp_customers", editingId), {
          ...formData,
          name: formData.name.trim(),
        });
      } else {
        await addDoc(collection(db, "erp_customers"), {
          ...formData,
          name: formData.name.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar cliente.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir este cliente?")) {
      try {
        await deleteDoc(doc(db, "erp_customers", id));
      } catch (e) {
        console.error(e);
        alert("Erro ao excluir cliente.");
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white rounded-none sm:rounded-lg shadow overflow-hidden min-h-0">
      {/* Search & Actions */}
      <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Base de Clientes (Atacado)</span>
          </h2>
          <p className="text-xs text-gray-500 font-medium">Controle de empresas, compradores e faturados</p>
        </div>

        <div className="flex items-center w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-xl bg-white text-xs sm:text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Customers Table with clean scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-indigo min-h-0">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs sm:text-sm">
          <thead className="bg-gray-50 font-bold text-gray-500 uppercase tracking-wider text-[11px] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Nome / Razão</th>
              <th className="px-4 py-3">CPF / CNPJ</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Endereço</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-4 py-3 font-bold text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.document || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{c.address || "—"}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => openModal(c)}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                    title="Editar Cliente"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Excluir Cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  Nenhum cliente cadastrado ou encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Novo / Editar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-lg text-gray-900">
                {editingId ? "Editar Cliente" : "Novo Cliente Atacado"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nome Completo / Razão *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do cliente ou empresa"
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CPF ou CNPJ</label>
                <input
                  type="text"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Endereço Completo</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade, CEP..."
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-indigo-500 outline-none resize-none h-18"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md cursor-pointer"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
