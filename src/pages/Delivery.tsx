import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, getNextPassword } from "../firebase";
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
  Truck,
  MessageCircle,
  Wallet,
  Bell,
  Scale,
  MapPin,
  Bike,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { executePrint } from "../lib/printHelper";
import WeightModal, { formatKg, parseItemQuantity } from "../components/WeightModal";
import MotoboyReportModal from "../components/MotoboyReportModal";
import { useStoreSettings } from "../contexts/StoreSettingsContext";
import { DEFAULT_DELIVERY_REGIONS, DeliveryRegion } from "../data/deliveryRegions";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  unit?: 'unidade' | 'kg';
  stock?: number;
  showInDelivery?: boolean;
}

interface CartItem extends Product {
  quantity: number;
  unit?: 'unidade' | 'kg';
  observation?: string;
}

interface CashierSession {
  id: string;
  status: string;
}

export default function Delivery() {
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
    "dinheiro" | "cartao" | "pix" | "multiplo"
  >("dinheiro");
  const [splitPayments, setSplitPayments] = useState({ dinheiro: "", cartao: "", pix: "" });
  const [discount, setDiscount] = useState<number | "">("");
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [observations, setObservations] = useState("");
  const { deliveryRegions: contextRegions } = useStoreSettings();
  const availableRegions: DeliveryRegion[] = (contextRegions && contextRegions.length > 0) ? contextRegions : DEFAULT_DELIVERY_REGIONS;
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedRegionName, setSelectedRegionName] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingOnlineOrders, setPendingOnlineOrders] = useState<any[]>([]);
  const [activePendingOrderId, setActivePendingOrderId] = useState<string | null>(null);

  // Motoboy Report and Delete states
  const [isMotoboyModalOpen, setIsMotoboyModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Weight / Kilo modal state
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighingCartItem, setWeighingCartItem] = useState<CartItem | null>(null);

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

    // Listen for open/pending delivery orders (e.g. from online menu)
    const qPending = query(
      collection(db, "orders"),
      where("type", "==", "delivery"),
      where("status", "==", "open")
    );
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPendingOnlineOrders(list);
    });

    // Get products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.erpOnly) return; // Do not show ERP-only products here
        if (data.showInDelivery === false) return; // Do not show products hidden from delivery menu
        const normalizedCategory = data.category
          ? data.category.trim()
          : "";
        prods.push({
          id: doc.id,
          ...data,
          category: normalizedCategory,
          unit: data.unit || 'unidade',
          showInDelivery: data.showInDelivery,
        } as Product);
      });
      setProducts(prods);
    });

    return () => {
      unsubSession();
      unsubPending();
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

  const categories = React.useMemo(() => ["all", ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const [addedItemName, setAddedItemName] = useState<string | null>(null);

  const openWeighModalForCartItem = (item: CartItem) => {
    const prod = products.find((p) => p.id === item.id) || {
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category || 'Carnes / Defumados',
      unit: 'kg'
    };
    setWeighingProduct(prod);
    setWeighingCartItem(item);
    setIsWeighModalOpen(true);
  };

  const handleConfirmWeight = (weightKg: number, obs: string) => {
    if (!weighingProduct) return;
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
        },
      ];
    });
    setIsWeighModalOpen(false);
    setWeighingProduct(null);
    setWeighingCartItem(null);
  };

  const addToCart = (product: Product, customQty?: number, customObs?: string) => {
    if (product.unit === 'kg' && customQty === undefined) {
      const existing = cart.find((item) => item.id === product.id);
      setWeighingProduct(product);
      setWeighingCartItem(existing || null);
      setIsWeighModalOpen(true);
      return;
    }

    const qtyToAdd = customQty !== undefined ? customQty : 1;
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
            : item,
        );
      }
      return [
        ...prev, 
        { 
          ...product, 
          unit: product.unit || 'unidade',
          quantity: qtyToAdd, 
          observation: customObs || "" 
        }
      ];
    });
    
    setAddedItemName(product.name);
    setTimeout(() => {
      setAddedItemName(null);
    }, 1500);
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

  const subtotal = cart.reduce((sum, item) => sum + parsedPrice(item.price) * parseItemQuantity(item.quantity), 0);
  const total = Math.max(0, subtotal + (Number(deliveryFee) || 0) - (Number(discount) || 0));

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
          <title>Delivery #${order.password}</title>
          <style>
            html, body { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 80mm; margin: 0 auto; padding: 10px; font-size: 13px; font-weight: bold; overflow-y: auto; overflow-x: hidden; min-height: 100vh; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .total { font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; margin-bottom: 5px; }
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

          <!-- VIA DO MOTOBOY / CLIENTE -->
          <div class="receipt-type">VIA DO MOTOBOY</div>
          <div class="header">
            <h2 style="margin: 0;">PDV ALAMBARI DEFUMADOS</h2>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt), "dd/MM/yyyy HH:mm")}</p>
            <h1 style="margin: 10px 0; font-size: 20px;">DELIVERY #${order.password}</h1>
            ${order.customerName ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold;">CLIENTE: ${order.customerName}</p>` : ""}
            ${order.deliveryPhone ? `<p style="margin: 5px 0; font-size: 14px;">TEL: ${order.deliveryPhone}</p>` : ""}
            ${order.deliveryAddress ? `<p style="margin: 5px 0; font-size: 14px; border: 1px dotted #000; padding: 5px;">ENDEREÇO:<br>${order.deliveryAddress}${order.deliveryRegion ? `<br><span style="display:block;margin-top:4px;font-weight:bold;color:#000;">REGIÃO: ${order.deliveryRegion}</span>` : ""}</p>` : ""}
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
          <hr style="border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">
          <div class="total" style="font-weight: normal;">
            <span>Subtotal:</span>
            <span>R$ ${(order.total - (order.deliveryFee || 0) + (order.discount || 0)).toFixed(2).replace(".", ",")}</span>
          </div>
          <div class="total" style="font-weight: normal;">
            <span>Taxa Entrega:</span>
            <span>R$ ${(order.deliveryFee || 0).toFixed(2).replace(".", ",")}</span>
          </div>
          ${order.discount && order.discount > 0 ? `
          <div class="total" style="font-weight: normal;">
            <span>Desconto:</span>
            <span>- R$ ${order.discount.toFixed(2).replace(".", ",")}</span>
          </div>
          ` : ""}
          <div class="total" style="font-size: 16px; margin-top: 10px;">
            <span>TOTAL:</span>
            <span>R$ ${order.total.toFixed(2).replace(".", ",")}</span>
          </div>
          <p style="margin: 10px 0; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 5px; text-align: center;">Pagamento: ${order.paymentMethod.toUpperCase()}</p>
          <div class="footer">
            <p>Obrigado pela preferência!</p>
          </div>

          <div class="cut-line page-break"><span>✂-----------------------</span></div>

          <!-- VIA DA PRODUÇÃO -->
          <div class="receipt-type">VIA DA PRODUÇÃO</div>
          <div class="header">
            <h1 style="margin: 10px 0; font-size: 26px;">DELIVERY #${order.password}</h1>
            <p style="margin: 5px 0;">Data: ${format(new Date(order.closedAt), "dd/MM/yyyy HH:mm")}</p>
            ${order.customerName ? `<p style="margin: 5px 0; font-size: 16px; font-weight: bold;">CLIENTE: ${order.customerName}</p>` : ""}
            ${order.deliveryAddress ? `<p style="margin: 5px 0; font-size: 14px; border: 1px dotted #000; padding: 5px;">ENDEREÇO: ${order.deliveryAddress}${order.deliveryRegion ? ` (${order.deliveryRegion})` : ""}</p>` : ""}
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

  const handleLoadPendingOrder = (order: any) => {
    setActivePendingOrderId(order.id);
    setCustomerName(order.customerName || "");
    setAddress(order.deliveryAddress || "");
    setPhoneNumber(order.deliveryPhone || "");
    setObservations(order.observations || "");
    if (order.deliveryFee !== undefined && order.deliveryFee !== null) {
      setDeliveryFee(Number(order.deliveryFee));
    }
    if (order.deliveryRegion) {
      setSelectedRegionName(order.deliveryRegion);
      const matched = availableRegions.find(
        (r) => r.name.toLowerCase() === String(order.deliveryRegion).toLowerCase() || r.id === order.deliveryRegion
      );
      if (matched) {
        setSelectedRegionId(matched.id);
      } else {
        setSelectedRegionId("custom");
      }
    } else {
      setSelectedRegionId("");
      setSelectedRegionName("");
    }
    if (order.paymentMethod && ["dinheiro", "cartao", "pix"].includes(order.paymentMethod)) {
      setPaymentMethod(order.paymentMethod);
    }
    if (Array.isArray(order.items)) {
      setCart(
        order.items.map((it: any) => ({
          id: it.productId || it.id || Math.random().toString(),
          name: it.name,
          price: it.price,
          category: it.category || "Geral",
          quantity: it.quantity || 1,
          observation: it.observation || "",
        }))
      );
    }
  };

  const handleDiscardActiveOrder = () => {
    setActivePendingOrderId(null);
    setCart([]);
    setCustomerName("");
    setAddress("");
    setPhoneNumber("");
    setObservations("");
    setDeliveryFee(0);
    setSelectedRegionId("");
    setSelectedRegionName("");
    setDiscount("");
    setStep(1);
  };

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      await deleteDoc(doc(db, "orders", orderToDelete.id));
      if (activePendingOrderId === orderToDelete.id) {
        handleDiscardActiveOrder();
      }
      setOrderToDelete(null);
    } catch (err: any) {
      console.error("Erro ao excluir pedido:", err);
      alert("Não foi possível excluir o pedido: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const handleCheckout = async () => {
    if (!currentSession) {
      alert("Abra o caixa primeiro!");
      return;
    }
    if (cart.length === 0 || isProcessing) return;
    if (!customerName.trim()) {
      alert("O nome do cliente é obrigatório para entrega!");
      return;
    }
    if (!address.trim()) {
      alert("O endereço é obrigatório para entrega!");
      return;
    }

    let finalSplitPayments = undefined;
    if (paymentMethod === "multiplo") {
      const dinheiroVal = Number(splitPayments.dinheiro) || 0;
      const cartaoVal = Number(splitPayments.cartao) || 0;
      const pixVal = Number(splitPayments.pix) || 0;
      const totalSplit = dinheiroVal + cartaoVal + pixVal;
      if (Math.abs(totalSplit - Number(total)) > 0.01) {
         alert(`A soma dos pagamentos (R$ ${totalSplit.toFixed(2).replace('.', ',')}) não confere com o total (R$ ${Number(total).toFixed(2).replace('.', ',')}).`);
         return;
      }
      finalSplitPayments = [];
      if (dinheiroVal > 0) finalSplitPayments.push({ method: "dinheiro", amount: dinheiroVal });
      if (cartaoVal > 0) finalSplitPayments.push({ method: "cartao", amount: cartaoVal });
      if (pixVal > 0) finalSplitPayments.push({ method: "pix", amount: pixVal });
    }

    setIsProcessing(true);
    try {
      const password = await getNextPassword(currentSession.id);

      const orderData = {
        type: "delivery",
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
        discount: Number(discount) || 0,
        paymentMethod: paymentMethod || "dinheiro",
        splitPayments: finalSplitPayments || [],
        customerName,
        deliveryPhone: phoneNumber,
        deliveryAddress: address,
        deliveryFee: Number(deliveryFee) || 0,
        deliveryRegion: selectedRegionName || "",
        observations,
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        password: password || 0,
        cashierId: currentSession.id || "unknown",
      };

      if (activePendingOrderId) {
        await updateDoc(doc(db, "orders", activePendingOrderId), orderData);
      } else {
        await addDoc(collection(db, "orders"), orderData);
      }

      // Update cashier session total
      await updateDoc(doc(db, "cashierSessions", currentSession.id), {
        totalSales: increment(Number(total) || 0),
      });

      handlePrint(orderData);
      setLastOrder(orderData);
      setLastPassword(password);
      setCart([]);
      setActivePendingOrderId(null);
      setCustomerName("");
      setAddress("");
      setPhoneNumber("");
      setDeliveryFee(0);
      setSelectedRegionId("");
      setSelectedRegionName("");
      setObservations("");
      setDiscount("");
      setSplitPayments({ dinheiro: "", cartao: "", pix: "" });
      setStep(1);
    } catch (error: any) {
      alert(
        "Erro ao finalizar venda: " +
          (error.message || "Verifique os dados e tente novamente."),
      );
      handleFirestoreError(error, OperationType.CREATE, "orders");
    } finally {
      setIsProcessing(false);
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
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Truck className="w-6 h-6 text-orange-500" /> Nova Entrega
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
                  className="pl-9 w-full rounded-lg border-2 border-gray-200 p-2 text-sm focus:border-orange-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsMotoboyModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                title="Abrir Relatório de Taxas de Entrega do Motoboy"
              >
                <Bike className="w-4 h-4" />
                <span>Taxas Motoboy</span>
              </button>

              {cart.length > 0 && (
                <span className="bg-orange-100 text-orange-800 text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-center">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
                </span>
              )}
            </div>
          </div>

          {/* Pending Incoming Orders Alert Banner */}
          {pendingOnlineOrders.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-amber-900 text-xs sm:text-sm font-bold">
                <Bell className="w-4 h-4 text-amber-600 animate-bounce shrink-0" />
                <span>
                  {pendingOnlineOrders.length} pedido(s) delivery recebido(s) aguardando atendimento:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendingOnlineOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className={`inline-flex items-center rounded-lg border shadow-xs text-xs font-bold transition-all overflow-hidden ${
                      activePendingOrderId === ord.id
                        ? 'bg-amber-700 text-white border-amber-800 ring-2 ring-amber-400'
                        : 'bg-white text-amber-900 border-amber-300 hover:border-amber-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPendingOrder(ord)}
                      className="px-3 py-1.5 flex items-center gap-1.5 hover:bg-amber-600/20 cursor-pointer"
                    >
                      <span>{ord.customerName || 'Cliente Online'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold ${
                        activePendingOrderId === ord.id ? 'bg-amber-900 text-amber-200' : 'bg-amber-100 text-amber-800'
                      }`}>
                        R$ {Number(ord.total || 0).toFixed(2).replace('.', ',')}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded font-black ${
                        activePendingOrderId === ord.id ? 'bg-amber-900 text-white' : 'bg-amber-600 text-white'
                      }`}>
                        {activePendingOrderId === ord.id ? 'Carregado' : 'Abrir'}
                      </span>
                    </button>
                    {/* Botão para excluir pedido que entra no delivery */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrderToDelete(ord);
                      }}
                      className="px-2 py-1.5 text-red-500 hover:text-white hover:bg-red-600 border-l border-amber-200 hover:border-red-600 transition-colors cursor-pointer"
                      title="Excluir este pedido do delivery"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner de Pedido em Atendimento Ativo */}
          {activePendingOrderId && (
            <div className="bg-orange-100/90 border-b border-orange-200 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-orange-950 font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse"></span>
                <span>
                  Atendendo Pedido Recebido Online de: <strong className="underline text-orange-900">{customerName || 'Cliente'}</strong>
                  {deliveryFee > 0 && (
                    <span className="ml-1.5 bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-black">
                      Taxa: R$ {Number(deliveryFee).toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleDiscardActiveOrder}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Descartar Edição
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentOrd = pendingOnlineOrders.find(o => o.id === activePendingOrderId) || { id: activePendingOrderId, customerName, total };
                    setOrderToDelete(currentOrd);
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                  title="Excluir permanentemente este pedido do delivery"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Pedido</span>
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border-b overflow-x-auto scrollbar-thin flex p-3 gap-2 whitespace-nowrap shrink-0">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
                  selectedCategory === cat
                    ? "bg-orange-600 text-white shadow-md"
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
                          const isKg = product.unit === 'kg';
                          return (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={`prod-${product.id}-${index}`}
                              onClick={() => {
                                if (isKg) {
                                  setWeighingProduct(product);
                                  setWeighingCartItem(cartItem || null);
                                  setIsWeighModalOpen(true);
                                } else {
                                  addToCart(product);
                                }
                              }}
                              className={`relative border-2 rounded-xl p-4 text-left hover:shadow-lg transition-all bg-white flex flex-col h-full group overflow-hidden cursor-pointer ${
                                cartItem
                                  ? isKg ? "border-amber-500 bg-amber-50/20" : "border-orange-500 bg-orange-50/20"
                                  : "border-gray-200 hover:border-orange-400"
                              }`}
                            >
                              <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${
                                isKg ? "bg-amber-500" : "bg-orange-500"
                              }`}></div>

                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isKg 
                                    ? "bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                                    : "bg-gray-100 text-gray-700"
                                }`}>
                                  {isKg ? "⚖️ Cobrança por Kg" : "Unidade"}
                                </span>
                                {cartItem && (
                                  <span className={`text-white text-xs font-black px-2 py-0.5 rounded-full shadow-xs ${
                                    isKg ? "bg-amber-600" : "bg-orange-600"
                                  }`}>
                                    {isKg
                                      ? `${Number(cartItem.quantity).toFixed(3).replace(".", ",")} kg`
                                      : `${cartItem.quantity} un`}
                                  </span>
                                )}
                              </div>

                              <span className="font-bold text-gray-800 flex-1 text-base sm:text-lg leading-tight mb-2">
                                {product.name}
                              </span>

                              <div className="flex items-baseline justify-between mt-auto pt-2 border-t border-gray-100">
                                <span className="text-orange-600 font-black text-lg">
                                  R${" "}
                                  {parsedPrice(product.price).toFixed(2).replace(".", ",")}
                                  <span className="text-xs text-gray-500 font-bold ml-1">
                                    {isKg ? "/ kg" : "/ un"}
                                  </span>
                                </span>
                                {isKg && (
                                  <span className="text-[11px] text-amber-700 font-extrabold flex items-center gap-0.5">
                                    <Scale className="w-3.5 h-3.5" />
                                    Pesar
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
                className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-orange-700 hover:shadow-2xl transition-all flex items-center justify-between px-6"
              >
                <div className="flex items-center">
                  <ShoppingCart className="w-6 h-6 mr-3" />
                  <span>Configurar Entrega</span>
                </div>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Cart & Checkout */}
      {step === 2 && (
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col max-w-4xl mx-auto w-full md:flex-row relative">
          <div className="flex-1 overflow-y-auto w-full md:w-[60%] border-r pb-32 md:pb-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center">
                <button
                  onClick={() => setStep(1)}
                  className="mr-4 text-gray-500 hover:text-gray-800 font-bold"
                >
                  ← Voltar
                </button>
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <ShoppingCart className="w-6 h-6 mr-2 text-orange-600" />
                  Pedido
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {activePendingOrderId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentOrd = pendingOnlineOrders.find(o => o.id === activePendingOrderId) || { id: activePendingOrderId, customerName, total };
                      setOrderToDelete(currentOrd);
                    }}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Excluir este pedido permanentemente do delivery"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Pedido</span>
                  </button>
                )}
                <span className="bg-orange-100 text-orange-800 text-sm font-bold px-3 py-1 rounded-full">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-4 mb-8">
                {cart.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    O carrinho está vazio.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <AnimatePresence mode="popLayout">
                      {cart.map((item) => {
                        const isKg = item.unit === "kg";
                        return (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            key={item.id}
                            className="flex flex-col gap-3 items-start bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                          >
                              <div className="w-full flex justify-between items-start gap-2">
                                <div className="flex-1 flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                      isKg ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-slate-100 text-slate-700"
                                    }`}>
                                      {isKg ? "⚖️ Cobrança por Kg" : "Unidade"}
                                    </span>
                                  </div>
                                  <p className="font-bold text-gray-800 text-lg leading-tight flex items-center gap-2">
                                    {item.name}
                                  </p>
                                  <p className="text-gray-600 font-medium">
                                    R$ {parsedPrice(item.price).toFixed(2).replace(".", ",")}
                                    <span className="text-xs text-gray-500 font-bold ml-1">
                                      {isKg ? "/ kg" : "/ un"}
                                    </span>
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-red-400 hover:text-red-600 p-2 rounded-lg transition-colors border border-transparent hover:bg-red-50 cursor-pointer"
                                  title="Remover"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="Observação (Ex: sem cebola)"
                                value={item.observation || ""}
                                onChange={(e) =>
                                  updateObservation(item.id, e.target.value)
                                }
                                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none"
                              />
                              <div className="w-full flex justify-between items-center mt-2 border-t pt-3 border-gray-100 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center space-x-2 bg-gray-100 p-1.5 rounded-lg border border-gray-200">
                                    <button
                                      onClick={() => updateQuantity(item.id, -1)}
                                      className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 text-gray-700 cursor-pointer"
                                      title={isKg ? "Diminuir 50g" : "Diminuir 1 un"}
                                    >
                                      <Minus className="w-5 h-5" />
                                    </button>
                                    <span className="min-w-[65px] text-center font-black text-gray-800 text-base">
                                      {isKg
                                        ? `${Number(item.quantity).toFixed(3).replace(".", ",")} kg`
                                        : item.quantity}
                                    </span>
                                    <button
                                      onClick={() => updateQuantity(item.id, 1)}
                                      className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 text-gray-700 cursor-pointer"
                                      title={isKg ? "Aumentar 50g" : "Aumentar 1 un"}
                                    >
                                      <Plus className="w-5 h-5" />
                                    </button>
                                  </div>
                                  {isKg && (
                                    <button
                                      type="button"
                                      onClick={() => openWeighModalForCartItem(item)}
                                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Digitar peso exato ou valor em R$"
                                    >
                                      <Scale className="w-3.5 h-3.5 text-amber-700" />
                                      Alterar Peso
                                    </button>
                                  )}
                                </div>
                                <p className="font-black text-gray-800 text-lg">
                                  R$ {(parsedPrice(item.price) * item.quantity).toFixed(2).replace(".", ",")}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-[40%] bg-gray-50 flex flex-col border-t md:border-t-0 md:h-full relative overflow-y-auto">
             <div className="p-4 border-b sticky top-0 bg-gray-50 z-10 flex items-center gap-2">
                 <Truck className="w-5 h-5 text-gray-600" />
                 <h2 className="text-lg font-bold text-gray-800">Dados da Entrega</h2>
             </div>
             
            {/* Dados do Cliente e Observações */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                  Nome do Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome completo ou Apelido"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                  Telefone (Wpp)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                  Endereço Completo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Referência..."
                  className="w-full border-2 border-gray-200 rounded-xl p-3 h-20 focus:border-orange-500 outline-none resize-none"
                />
              </div>
              {/* Região e Taxa de Entrega Pré-definidas com Edição Livre */}
              <div className="space-y-3 bg-white p-3.5 rounded-2xl border-2 border-orange-100 shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      Região de Entrega
                    </label>
                    {selectedRegionName && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRegionId("");
                          setSelectedRegionName("");
                        }}
                        className="text-[11px] text-gray-500 hover:text-red-600 underline font-semibold cursor-pointer"
                      >
                        Limpar seleção
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedRegionId}
                    onChange={(e) => {
                      const regionId = e.target.value;
                      setSelectedRegionId(regionId);
                      if (!regionId) {
                        setSelectedRegionName("");
                        return;
                      }
                      if (regionId === "custom") {
                        setSelectedRegionName("Personalizado / Outro");
                        return;
                      }
                      const found = availableRegions.find((r) => r.id === regionId);
                      if (found) {
                        setSelectedRegionName(found.name);
                        setDeliveryFee(found.fee);
                      }
                    }}
                    className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm font-bold text-gray-800 bg-white focus:border-orange-500 outline-none"
                  >
                    <option value="">Selecione a região pré-definida...</option>
                    {availableRegions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name} — R$ {region.fee.toFixed(2).replace('.', ',')}
                      </option>
                    ))}
                    <option value="custom">Outro local / Taxa personalizada</option>
                  </select>

                  {/* Atalhos rápidos das regiões para clique direto */}
                  <div className="mt-2.5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Toque rápido na região:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
                      {availableRegions.map((region) => {
                        const isSelected = selectedRegionId === region.id;
                        return (
                          <button
                            key={region.id}
                            type="button"
                            onClick={() => {
                              setSelectedRegionId(region.id);
                              setSelectedRegionName(region.name);
                              setDeliveryFee(region.fee);
                            }}
                            className={`p-2 rounded-lg text-left text-xs font-bold transition-all flex items-center justify-between gap-1 border cursor-pointer ${
                              isSelected
                                ? "bg-orange-600 text-white border-orange-600 shadow-sm ring-2 ring-orange-300"
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
                            }`}
                          >
                            <span className="truncate" title={region.name}>{region.name}</span>
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-black ${
                                isSelected ? "bg-orange-800 text-white" : "bg-orange-100 text-orange-900"
                              }`}
                            >
                              R$ {region.fee}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Campo de valor da taxa (sempre livre para editar) */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest">
                      Taxa de Entrega (R$)
                    </label>
                    <span className="text-[11px] text-gray-500 font-semibold">
                      (Valor editável a qualquer momento)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.50"
                        value={deliveryFee === 0 ? "" : deliveryFee}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          setDeliveryFee(isNaN(val) ? 0 : val);
                        }}
                        placeholder="0,00"
                        className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:border-orange-500 outline-none font-black text-lg text-gray-800 bg-white"
                      />
                    </div>
                    {deliveryFee > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryFee(0);
                          setSelectedRegionId("");
                          setSelectedRegionName("");
                        }}
                        className="px-3 py-2.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Zerar Taxa
                      </button>
                    )}
                  </div>

                  {selectedRegionName && (
                    <div className="mt-2 text-xs bg-orange-50 border border-orange-200 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-orange-900">
                      <div>
                        <span>Região: <strong>{selectedRegionName}</strong></span>
                        {(() => {
                          const matched = availableRegions.find((r) => r.id === selectedRegionId);
                          if (matched && matched.fee !== Number(deliveryFee)) {
                            return (
                              <span className="block text-[11px] text-amber-800 font-medium mt-0.5">
                                • Valor alterado manualmente (taxa padrão era R$ {matched.fee.toFixed(2).replace('.', ',')})
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      {!address.includes(selectedRegionName) && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddress((prev) => (prev ? `${prev} - ${selectedRegionName}` : selectedRegionName));
                          }}
                          className="text-orange-700 hover:text-orange-900 underline font-bold text-left sm:text-right shrink-0 cursor-pointer"
                        >
                          + Adicionar ao Endereço
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                  Observações Gerais
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: Levar troco, deixar na portaria..."
                  className="w-full border-2 border-gray-200 rounded-xl p-3 h-16 focus:border-orange-500 outline-none resize-none"
                />
              </div>

              {/* Forma de Pagamento */}
              <div className="pt-2">
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">
                  Forma de Pagamento
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setPaymentMethod("dinheiro")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all ${
                      paymentMethod === "dinheiro"
                        ? "bg-green-50 border-green-500 text-green-700 shadow-md"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Banknote className="w-5 h-5 mb-1" />
                    <span className="text-xs text-center">Dinheiro</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("cartao")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all ${
                      paymentMethod === "cartao"
                        ? "bg-red-50 border-red-500 text-red-700 shadow-md"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mb-1" />
                    <span className="text-xs text-center">Cartão</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all ${
                      paymentMethod === "pix"
                        ? "bg-purple-50 border-purple-500 text-purple-700 shadow-md"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <QrCode className="w-5 h-5 mb-1" />
                    <span className="text-xs text-center">PIX</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("multiplo")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all ${
                      paymentMethod === "multiplo"
                        ? "bg-teal-50 border-teal-500 text-teal-700 shadow-md"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Wallet className="w-5 h-5 mb-1" />
                    <span className="text-xs text-center">Múltiplo</span>
                  </button>
                </div>

                {paymentMethod === "multiplo" && (
                  <div className="mt-4 p-4 border border-teal-200 bg-teal-50 rounded-xl space-y-3">
                    <h4 className="font-bold text-teal-800 text-sm">Valores por método:</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Dinheiro:</span>
                      <input type="number" step="0.01" min="0" value={splitPayments.dinheiro} onChange={e => setSplitPayments({...splitPayments, dinheiro: e.target.value})} className="w-24 border border-teal-200 rounded p-1 text-right outline-none focus:border-teal-500" placeholder="0,00" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Cartão:</span>
                      <input type="number" step="0.01" min="0" value={splitPayments.cartao} onChange={e => setSplitPayments({...splitPayments, cartao: e.target.value})} className="w-24 border border-teal-200 rounded p-1 text-right outline-none focus:border-teal-500" placeholder="0,00" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">PIX:</span>
                      <input type="number" step="0.01" min="0" value={splitPayments.pix} onChange={e => setSplitPayments({...splitPayments, pix: e.target.value})} className="w-24 border border-teal-200 rounded p-1 text-right outline-none focus:border-teal-500" placeholder="0,00" />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-teal-200">
                      <span className="text-sm font-bold text-teal-800">Soma / Total:</span>
                      <span className={`text-sm font-bold ${Math.abs((Number(splitPayments.dinheiro) || 0) + (Number(splitPayments.cartao) || 0) + (Number(splitPayments.pix) || 0) - total) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                        R$ {((Number(splitPayments.dinheiro) || 0) + (Number(splitPayments.cartao) || 0) + (Number(splitPayments.pix) || 0)).toFixed(2).replace('.', ',')} / R$ {total.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-white mt-auto sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <div className="flex justify-between items-center mb-2 text-gray-500 text-sm font-bold">
                 <span>Subtotal</span>
                 <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between items-center mb-2 text-gray-500 text-sm font-bold">
                 <span>Taxa Entrega</span>
                 <span>R$ {(deliveryFee || 0).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-gray-500 text-sm font-bold pb-2 border-b border-gray-100">
                 <span>Desconto (R$)</span>
                 <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value ? Number(e.target.value) : "")}
                  className="w-24 border-2 border-gray-200 rounded-lg p-1 text-right focus:border-gray-500 outline-none"
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-between items-center mb-6 bg-gray-50 p-3 rounded-xl border shadow-sm">
                <span className="text-gray-800 font-bold text-lg">
                  Total
                </span>
                <span className="text-3xl font-black text-orange-600">
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isProcessing}
                className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-xl shadow-lg hover:bg-orange-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
              >
                <CheckCircle className="w-6 h-6 mr-2" />
                {isProcessing ? "Lançando..." : "Lançar Entrega"}
              </button>

              {activePendingOrderId && (
                <button
                  type="button"
                  onClick={() => {
                    const found = pendingOnlineOrders.find((o) => o.id === activePendingOrderId) || { id: activePendingOrderId, customerName: customerName || "Pedido Atual" };
                    setOrderToDelete(found);
                  }}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Recusar / Excluir Este Pedido
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {lastPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Delivery Lançado!
            </h2>
            <p className="text-gray-600 mb-6">ID Pedido / Senha:</p>
            <div className="text-6xl font-black text-orange-600 mb-8 tracking-widest">
              {lastPassword}
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (lastOrder) {
                    const itemsText = lastOrder.items
                      .map((item: any) => {
                        const isKg = item.unit === 'kg';
                        const qtyStr = isKg ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`;
                        return `*${qtyStr}* ${item.name} - R$ ${(parsedPrice(item.price) * item.quantity).toFixed(2).replace('.', ',')}`;
                      })
                      .join('\n');
                    
                    let message = `*Olá, ${lastOrder.customerName}!* Aqui é do Alambari Defumados 🍖\n\nSeu pedido foi confirmado!\n\n`;
                    message += `*RESUMO DO PEDIDO:*\n${itemsText}\n\n`;
                    message += `*Subtotal:* R$ ${(Number(lastOrder.total || 0) - Number(lastOrder.deliveryFee || 0)).toFixed(2).replace('.', ',')}\n`;
                    if (lastOrder.deliveryRegion) {
                      message += `*Região:* ${lastOrder.deliveryRegion}\n`;
                    }
                    message += `*Taxa de Entrega:* R$ ${Number(lastOrder.deliveryFee || 0).toFixed(2).replace('.', ',')}\n`;
                    message += `*TOTAL:* R$ ${Number(lastOrder.total || 0).toFixed(2).replace('.', ',')}\n\n`;
                    message += `*Previsão de entrega:* 40 à 60 minutos dependendo da sua localidade.\n`;
                    message += `Obrigado pela preferência!`;

                    const phoneObj = lastOrder.deliveryPhone ? lastOrder.deliveryPhone.replace(/\D/g, '') : '';
                    const phoneUrl = phoneObj.length >= 10 ? `https://wa.me/55${phoneObj}` : 'https://wa.me/';
                    
                    window.open(`${phoneUrl}?text=${encodeURIComponent(message)}`, '_blank');
                  }
                }}
                className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 flex items-center justify-center transition-colors"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Enviar Recibo (WhatsApp)
              </button>
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
                className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700"
              >
                Nova Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pesagem / Cobrança por Kilo */}
      <WeightModal
        isOpen={isWeighModalOpen}
        product={weighingProduct}
        initialWeight={weighingCartItem ? parseItemQuantity(weighingCartItem.quantity) : 0.5}
        initialObservation={weighingCartItem?.observation || ""}
        onClose={() => {
          setIsWeighModalOpen(false);
          setWeighingProduct(null);
          setWeighingCartItem(null);
        }}
        onConfirm={handleConfirmWeight}
      />

      {/* Modal de Confirmação para Excluir Pedido */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">
              Excluir Pedido de Delivery?
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Tem certeza que deseja excluir permanentemente o pedido de{" "}
              <strong className="text-gray-900">
                {orderToDelete.customerName || "Cliente"}
              </strong>
              {orderToDelete.password ? ` (#${orderToDelete.password})` : ""}?
              Essa ação não pode ser desfeita.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                O pedido será removido do banco de dados e sumirá das pendências e relatórios.
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={handleConfirmDeleteOrder}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingOrder ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Relatório de Taxas do Motoboy */}
      <MotoboyReportModal
        isOpen={isMotoboyModalOpen}
        onClose={() => setIsMotoboyModalOpen(false)}
        currentSessionId={currentSession?.id}
        onOrderDeleted={(deletedId) => {
          if (activePendingOrderId === deletedId) {
            handleDiscardActiveOrder();
          }
        }}
      />
    </div>
  );
}

