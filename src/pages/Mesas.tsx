import React, { useState, useEffect, useRef } from "react";
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
  getDocs,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, getNextPassword } from "../firebase";
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
  Wallet,
  Scale,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { executePrint } from "../lib/printHelper";
import WeightModal, { formatKg } from "../components/WeightModal";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  unit?: 'unidade' | 'kg';
  stock?: number;
}

interface CartItem extends Product {
  quantity: number;
  unit?: 'unidade' | 'kg';
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
  password?: number;
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
    "dinheiro" | "cartao" | "pix" | "fiado" | "multiplo"
  >("dinheiro");
  const [splitPayments, setSplitPayments] = useState({ dinheiro: "", cartao: "", pix: "" });
  const [discount, setDiscount] = useState<number | "">("");
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Weight / Kilo modal state
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighingCartItem, setWeighingCartItem] = useState<CartItem | null>(null);

  const [tables, setTables] = useState<Table[]>([]);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const isSavingRef = useRef(false);

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
        if (data.erpOnly) return; // Do not show ERP-only products here
        const normalizedCategory = data.category
          ? data.category.trim()
          : "";
        prods.push({
          id: doc.id,
          ...data,
          category: normalizedCategory,
          unit: data.unit || 'unidade',
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
        unit: item.unit || (item.name?.toLowerCase().includes('/kg') || item.name?.toLowerCase().includes(' kg') ? 'kg' : 'unidade'),
        quantity: Number(item.quantity) || 1,
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
    setDiscount("");
    setSplitPayments({ dinheiro: "", cartao: "", pix: "" });
    setIsWeighModalOpen(false);
    setWeighingProduct(null);
    setWeighingCartItem(null);
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

  const openWeighModalForCartItem = (item: CartItem) => {
    const prod = products.find(p => p.id === item.id) || {
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
                productionStatus: 'pending',
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
          productionStatus: 'pending',
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
                productionStatus: "pending",
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
          observation: customObs || "",
          productionStatus: "pending",
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const isKg = item.unit === 'kg';
            // For kg, if delta is +1 or -1, use 0.050kg (50g) step
            const stepVal = isKg ? (delta > 0 ? 0.05 : -0.05) : delta;
            const newQ = Math.round((Number(item.quantity) + stepVal) * 1000) / 1000;
            return newQ > 0
              ? {
                  ...item,
                  quantity: newQ,
                  productionStatus: delta > 0 ? "pending" : item.productionStatus,
                }
              : null;
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

  const subtotal = cart.reduce((sum, item) => sum + parsedPrice(item.price) * (Number(item.quantity) || 1), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const totalKg = cart
    .filter((item) => item.unit === "kg")
    .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const totalUnits = cart
    .filter((item) => item.unit !== "kg")
    .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

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

    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const tableQuery = query(
        collection(db, "orders"),
        where("type", "==", "mesa"),
        where("status", "==", "open"),
        where("tableNumber", "==", currentTableNumber)
      );
      const querySnapshot = await getDocs(tableQuery);
      const existingOrder = !querySnapshot.empty ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Order : null;

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
          unit: item.unit || "unidade",
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
    } finally {
      isSavingRef.current = false;
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
      const subtotalItem = itemPrice * item.quantity;
      const isKg = item.unit === 'kg';
      const qtyStr = isKg ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`;
      msg += `• *${qtyStr}* ${item.name} - R$ ${subtotalItem.toFixed(2).replace(".", ",")}\n`;
      if (isKg) {
        msg += `   _(${Number(item.quantity).toFixed(3).replace('.', ',')} kg a R$ ${itemPrice.toFixed(2).replace('.', ',')}/kg)_\n`;
      }
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
        (item: any) => {
          const isKg = item.unit === 'kg';
          const qtyText = isKg ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`;
          const subTotalText = (parsedPrice(item.price) * item.quantity).toFixed(2).replace('.', ',');
          return `
      <tr>
        <td style="padding: 5px 0;">
          ${item.name} (${qtyText})
          ${isKg ? `<br><small style="font-size: 10px; color: #555;">R$ ${parsedPrice(item.price).toFixed(2).replace('.', ',')}/kg</small>` : ''}
          ${item.observation ? `<br><small style="font-size: 10px; font-style: italic;">Obs: ${item.observation}</small>` : ""}
        </td>
        <td style="text-align: right; padding: 5px 0;">R$ ${subTotalText}</td>
      </tr>
    `;
        }
      )
      .join("");

    const productionItemsHtml = order.items
      .map(
        (item: any) => {
          const isKg = item.unit === 'kg';
          const qtyText = isKg ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`;
          return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px dotted #000;">
          <strong>${qtyText}</strong> ${item.name}
          ${item.observation ? `<br><span style="font-size: 14px; font-weight: bold; display: block; margin-top: 5px; padding: 3px; border: 1px solid #000;">Obs: ${item.observation}</span>` : ""}
        </td>
      </tr>
    `;
        }
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
          ${order.discount && order.discount > 0 ? `
          <div class="total" style="font-weight: normal;">
            <span>Subtotal:</span>
            <span>R$ ${(order.total + order.discount).toFixed(2).replace(".", ",")}</span>
          </div>
          <div class="total" style="font-weight: normal;">
            <span>Desconto:</span>
            <span>- R$ ${order.discount.toFixed(2).replace(".", ",")}</span>
          </div>
          ` : ""}
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
    if (!selectedTable || cart.length === 0 || isProcessing) return;

    if (paymentMethod === "fiado" && !customerName.trim()) {
      alert("O nome do cliente é obrigatório para transferir para Fiado!");
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
      const tableQuery = query(
        collection(db, "orders"),
        where("type", "==", "mesa"),
        where("status", "==", "open"),
        where("tableNumber", "==", selectedTable)
      );
      const querySnapshot = await getDocs(tableQuery);
      const existingOrder = !querySnapshot.empty ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Order : null;

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
          unit: item.unit || "unidade",
          observation: item.observation || "",
          productionStatus: item.productionStatus || "pending",
        })),
        total: Number(total) || 0,
        discount: Number(discount) || 0,
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
        orderUpdatePayload.splitPayments = finalSplitPayments || [];
        orderUpdatePayload.closedAt = new Date().toISOString();
        orderUpdatePayload.password = existingOrder?.password || await getNextPassword(currentSession.id);
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
    } finally {
      setIsProcessing(false);
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
                                  const isKg = product.unit === 'kg';

                                  return (
                                    <div
                                      key={`prod-${product.id}-${index}`}
                                      className={`relative border-2 rounded-2xl p-3.5 sm:p-4 text-left transition-all bg-white flex flex-col justify-between shadow-xs hover:shadow-md ${
                                        cartItem
                                          ? "border-red-500 bg-red-50/20 shadow-sm"
                                          : "border-gray-200 hover:border-red-300"
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                          <span
                                            className={`text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                              isKg
                                                ? "bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                                                : "bg-gray-100 text-gray-700"
                                            }`}
                                          >
                                            {isKg ? "⚖️ Cobrança por Kg" : "Unidade"}
                                          </span>
                                          {cartItem && (
                                            <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-xs">
                                              {isKg
                                                ? `${Number(cartItem.quantity).toFixed(3).replace(".", ",")} kg`
                                                : `${cartItem.quantity} un`}
                                            </span>
                                          )}
                                        </div>

                                        <h4 className="font-black text-gray-800 text-sm sm:text-base leading-snug line-clamp-2 mt-1">
                                          {product.name}
                                        </h4>

                                        <p className="text-red-600 font-black text-base sm:text-lg mt-1.5">
                                          R$ {parsedPrice(product.price).toFixed(2).replace(".", ",")}{" "}
                                          <span className="text-xs font-bold text-gray-500">
                                            {isKg ? "/ kg" : "/ un"}
                                          </span>
                                        </p>
                                      </div>

                                      {/* Interactive Action Area: Stepper (+ / -) or Add Button */}
                                      <div className="mt-3 pt-2.5 border-t border-gray-100">
                                        {cartItem ? (
                                          <div className="flex items-center justify-between bg-white rounded-xl border border-red-200 p-1 shadow-xs">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateQuantity(product.id, -1);
                                              }}
                                              className="w-8 h-8 sm:w-9 sm:h-9 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 font-bold rounded-lg flex items-center justify-center transition-colors active:scale-95"
                                              title={isKg ? "Diminuir 50g" : "Diminuir 1 un"}
                                            >
                                              <Minus className="w-4 h-4" />
                                            </button>

                                            {isKg ? (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openWeighModalForCartItem(cartItem);
                                                }}
                                                className="flex-1 px-1 py-1 text-center hover:bg-amber-50 rounded transition-colors"
                                                title="Clique para digitar ou alterar peso exato"
                                              >
                                                <span className="block text-xs sm:text-sm font-black text-red-600 leading-tight">
                                                  {Number(cartItem.quantity).toFixed(3).replace(".", ",")} kg
                                                </span>
                                                <span className="block text-[10px] text-gray-500 font-bold">
                                                  ⚖️ Alterar Peso
                                                </span>
                                              </button>
                                            ) : (
                                              <span className="flex-1 text-center font-black text-gray-800 text-sm sm:text-base">
                                                {cartItem.quantity}
                                              </span>
                                            )}

                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isKg) {
                                                  openWeighModalForCartItem(cartItem);
                                                } else {
                                                  updateQuantity(product.id, 1);
                                                }
                                              }}
                                              className="w-8 h-8 sm:w-9 sm:h-9 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center transition-colors active:scale-95"
                                              title={isKg ? "Pesar / Ajustar" : "Aumentar 1 un"}
                                            >
                                              <Plus className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (isKg) {
                                                setWeighingProduct(product);
                                                setWeighingCartItem(null);
                                                setIsWeighModalOpen(true);
                                              } else {
                                                addToCart(product);
                                              }
                                            }}
                                            className={`w-full py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer ${
                                              isKg
                                                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                                                : "bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 hover:border-red-600"
                                            }`}
                                          >
                                            {isKg ? (
                                              <>
                                                <Scale className="w-4 h-4" />
                                                Pesar & Adicionar
                                              </>
                                            ) : (
                                              <>
                                                <Plus className="w-4 h-4" />
                                                Adicionar (+ / -)
                                              </>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    </div>
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

              {/* Step 2: Cart & Checkout (Revisão Melhorada do Carrinho) */}
              {step === 2 && (
                <div className="flex-1 flex flex-col bg-slate-50/70 max-w-3xl mx-auto w-full overflow-hidden">
                  {/* Top Bar with Clear Header & Badges */}
                  <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setStep(1)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors cursor-pointer"
                        title="Voltar ao catálogo de produtos"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        + Adicionar Mais Itens
                      </button>
                      <h3 className="font-black text-gray-900 text-lg sm:text-xl">
                        Revisar Carrinho
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalKg > 0 && (
                        <span className="bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-amber-700" />
                          {formatKg(totalKg)}
                        </span>
                      )}
                      <span className="bg-red-100 border border-red-200 text-red-800 text-xs font-black px-3 py-1 rounded-full">
                        {cart.length} {cart.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Review Content */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
                    {/* Items List */}
                    <div className="space-y-3">
                      {cart.length === 0 ? (
                        <div className="text-center py-16 px-4 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ShoppingCart className="w-8 h-8" />
                          </div>
                          <p className="font-black text-gray-800 text-lg">Mesa sem itens adicionados</p>
                          <p className="text-gray-500 text-sm mt-1 mb-5">
                            Selecione os produtos ou porções por quilo para incluir no pedido.
                          </p>
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm text-sm"
                          >
                            Ir ao Cardápio de Produtos
                          </button>
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {cart.map((item) => {
                            const isKg = item.unit === "kg";
                            const itemPrice = parsedPrice(item.price);
                            const itemTotal = itemPrice * item.quantity;

                            return (
                              <motion.div
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={item.id}
                                className="bg-white border-2 border-gray-200 hover:border-gray-300 rounded-2xl p-4 shadow-xs transition-all relative space-y-3"
                              >
                                {/* Top Item Row: Title & Subtotal */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      <span
                                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                          isKg
                                            ? "bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                                            : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {isKg ? "⚖️ Cobrança por Kg" : "Unidade"}
                                      </span>
                                      <span className="text-xs text-gray-500 font-semibold">
                                        R$ {itemPrice.toFixed(2).replace(".", ",")} {isKg ? "/ kg" : "/ un"}
                                      </span>
                                    </div>
                                    <h4 className="font-black text-gray-900 text-base sm:text-lg leading-snug">
                                      {item.name}
                                    </h4>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="block text-xl sm:text-2xl font-black text-red-600 leading-tight">
                                      R$ {itemTotal.toFixed(2).replace(".", ",")}
                                    </span>
                                    {isKg && (
                                      <span className="text-[11px] text-gray-400 font-bold block">
                                        {(item.quantity * 1000).toFixed(0)}g x R$ {itemPrice.toFixed(2).replace(".", ",")}/kg
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Controls Row: Stepper (+ / -), Weight Button, and Delete */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                                  <div className="flex items-center gap-2">
                                    {/* Stepper */}
                                    <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(item.id, -1)}
                                        className="w-8 h-8 sm:w-9 sm:h-9 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-lg shadow-xs flex items-center justify-center transition-all active:scale-95"
                                        title={isKg ? "Diminuir 50g" : "Diminuir 1 un"}
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      
                                      <div className="px-3 min-w-[70px] sm:min-w-[80px] text-center font-black text-gray-900 text-sm sm:text-base">
                                        {isKg
                                          ? `${Number(item.quantity).toFixed(3).replace(".", ",")} kg`
                                          : `${item.quantity} un`}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(item.id, 1)}
                                        className="w-8 h-8 sm:w-9 sm:h-9 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-lg shadow-xs flex items-center justify-center transition-all active:scale-95"
                                        title={isKg ? "Aumentar 50g" : "Aumentar 1 un"}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {/* Dedicated Weight Button for KG items */}
                                    {isKg && (
                                      <button
                                        type="button"
                                        onClick={() => openWeighModalForCartItem(item)}
                                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                        title="Alterar peso, escolher atalho ou digitar valor em R$"
                                      >
                                        <Scale className="w-3.5 h-3.5 text-amber-700" />
                                        Alterar Peso
                                      </button>
                                    )}
                                  </div>

                                  {/* Delete Item */}
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(item.id)}
                                    className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                                    title="Remover do carrinho"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">Remover</span>
                                  </button>
                                </div>

                                {/* Item Note / Observation */}
                                <div className="pt-1">
                                  <input
                                    type="text"
                                    placeholder="Observação (ex: bem passada, sem gelo, etc.)"
                                    value={item.observation || ""}
                                    onChange={(e) => updateObservation(item.id, e.target.value)}
                                    className="w-full text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 focus:bg-white focus:border-red-500 focus:outline-none transition-all placeholder:text-gray-400"
                                  />
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>

                    {/* Financial Summary Card (Resumo Financeiro em Destaque) */}
                    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 sm:p-5 shadow-xs space-y-3">
                      <h4 className="font-black text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                        <Receipt className="w-4 h-4 text-red-600" />
                        Resumo da Mesa {selectedTable}
                      </h4>

                      <div className="flex justify-between items-center text-sm sm:text-base text-gray-600">
                        <span className="font-medium">
                          Subtotal ({cart.length} itens {totalKg > 0 ? `• ${formatKg(totalKg)}` : ""})
                        </span>
                        <span className="font-bold text-gray-900 text-base">
                          R$ {subtotal.toFixed(2).replace(".", ",")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-sm sm:text-base border-y border-gray-100 py-2.5">
                        <span className="font-medium text-gray-600">
                          Desconto Concedido (R$)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 font-bold text-sm">- R$</span>
                          <input
                            type="number"
                            value={discount}
                            onChange={(e) =>
                              setDiscount(e.target.value ? Number(e.target.value) : "")
                            }
                            className="w-24 border-2 border-gray-200 rounded-lg p-1.5 text-right font-bold text-gray-900 focus:border-red-500 outline-none text-sm"
                            placeholder="0,00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-baseline pt-1">
                        <span className="font-black text-gray-900 text-base sm:text-lg">
                          TOTAL A PAGAR:
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-red-600">
                          R$ {total.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>

                    {/* Customer Info & General Notes */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Nome do Cliente (Opcional)
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex: Roberto"
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:border-red-500 outline-none font-semibold text-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                            WhatsApp do Cliente (Opcional)
                          </label>
                          <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Ex: 11999999999"
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:border-red-500 outline-none font-semibold text-gray-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                          Observações Gerais do Pedido
                        </label>
                        <textarea
                          value={observations}
                          onChange={(e) => setObservations(e.target.value)}
                          placeholder="Ex: Cliente vai pagar metade em dinheiro, levar gelo extra..."
                          className="w-full border border-gray-300 rounded-xl p-2.5 h-16 text-sm focus:border-red-500 outline-none resize-none font-medium text-gray-800"
                        />
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                      <p className="text-xs font-black text-gray-600 uppercase tracking-wider">
                        Forma de Pagamento para Fechamento
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("dinheiro")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                            paymentMethod === "dinheiro"
                              ? "bg-green-50 border-green-500 text-green-700 shadow-sm"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <Banknote className="w-6 h-6 mb-1 text-green-600" />
                          <span className="text-xs sm:text-sm">Dinheiro</span>
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
                          <CreditCard className="w-6 h-6 mb-1 text-red-600" />
                          <span className="text-xs sm:text-sm">Cartão</span>
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
                          <QrCode className="w-6 h-6 mb-1 text-purple-600" />
                          <span className="text-xs sm:text-sm">PIX</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("fiado")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                            paymentMethod === "fiado"
                              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <NotebookText className="w-6 h-6 mb-1 text-blue-600" />
                          <span className="text-xs sm:text-sm">Fiado</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("multiplo")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                            paymentMethod === "multiplo"
                              ? "bg-teal-50 border-teal-500 text-teal-700 shadow-sm"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <Wallet className="w-6 h-6 mb-1 text-teal-600" />
                          <span className="text-xs sm:text-sm">Múltiplo</span>
                        </button>
                      </div>

                      {paymentMethod === "multiplo" && (
                        <div className="mt-3 p-3.5 border border-teal-200 bg-teal-50/70 rounded-xl space-y-2.5">
                          <h5 className="font-bold text-teal-900 text-xs uppercase tracking-wider">
                            Dividir Valores por Forma:
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="flex items-center justify-between sm:flex-col sm:items-start bg-white p-2 rounded-lg border border-teal-200">
                              <span className="text-xs font-semibold text-gray-700">Dinheiro:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={splitPayments.dinheiro}
                                onChange={(e) =>
                                  setSplitPayments({ ...splitPayments, dinheiro: e.target.value })
                                }
                                className="w-24 sm:w-full border border-gray-300 rounded p-1 text-right sm:text-left text-sm font-bold text-gray-900 outline-none focus:border-teal-500"
                                placeholder="0,00"
                              />
                            </div>
                            <div className="flex items-center justify-between sm:flex-col sm:items-start bg-white p-2 rounded-lg border border-teal-200">
                              <span className="text-xs font-semibold text-gray-700">Cartão:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={splitPayments.cartao}
                                onChange={(e) =>
                                  setSplitPayments({ ...splitPayments, cartao: e.target.value })
                                }
                                className="w-24 sm:w-full border border-gray-300 rounded p-1 text-right sm:text-left text-sm font-bold text-gray-900 outline-none focus:border-teal-500"
                                placeholder="0,00"
                              />
                            </div>
                            <div className="flex items-center justify-between sm:flex-col sm:items-start bg-white p-2 rounded-lg border border-teal-200">
                              <span className="text-xs font-semibold text-gray-700">PIX:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={splitPayments.pix}
                                onChange={(e) =>
                                  setSplitPayments({ ...splitPayments, pix: e.target.value })
                                }
                                className="w-24 sm:w-full border border-gray-300 rounded p-1 text-right sm:text-left text-sm font-bold text-gray-900 outline-none focus:border-teal-500"
                                placeholder="0,00"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-teal-200 text-xs sm:text-sm">
                            <span className="font-bold text-teal-900">Soma dos pagamentos:</span>
                            <span
                              className={`font-black ${
                                Math.abs(
                                  (Number(splitPayments.dinheiro) || 0) +
                                    (Number(splitPayments.cartao) || 0) +
                                    (Number(splitPayments.pix) || 0) -
                                    total,
                                ) > 0.01
                                  ? "text-red-600"
                                  : "text-green-700"
                              }`}
                            >
                              R${" "}
                              {(
                                (Number(splitPayments.dinheiro) || 0) +
                                (Number(splitPayments.cartao) || 0) +
                                (Number(splitPayments.pix) || 0)
                              )
                                .toFixed(2)
                                .replace(".", ",")}{" "}
                              de R$ {total.toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2 Bottom Sticky Action Bar */}
                  <div className="p-4 bg-white border-t border-gray-200 shrink-0 shadow-lg space-y-3">
                    <button
                      onClick={handleSendWhatsApp}
                      disabled={cart.length === 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.004 2c-5.51 0-9.993 4.483-9.993 9.993 0 1.763.457 3.49 1.332 5.013l-1.343 4.905 5.022-1.317c1.464.798 3.107 1.219 4.815 1.22 5.51 0 9.993-4.483 9.993-9.993C21.99 6.483 17.514 2 12.004 2zm6.182 14.126c-.255.725-1.025.1-1.3.1-2.31-1.764-2.22-.387-2.67-1.127.1-.258.261-.518.57-.86.919-.341.353-.618.396-1.127.143-.51-.254-2.148-.792-4.094-2.528-1.513-1.35-2.536-3.017-2.833-3.526-.297-.51-.031-.785.224-1.039.231-.228.51-.594.765-.89h.1c.17 0 .255.085.34.254.17.34.595 1.442.637 1.528.043.085.085.17.022.296-.064.128-.106.213-.213.34-.106.127-.223.212-.318.339-.096.126-.181.254-.085.424.096.17.425.702.914 1.139.63.565 1.162.934 1.714 1.189.51.254.786.19 1.062-.085.277-.275 1.211-1.4 1.53-1.887.085-.127.213-.17.34-.127.128.042.829.39 1.573.763.51.254.851.382.957.551.106.17.106.977-.149 1.702z" />
                      </svg>
                      Enviar Conferência da Mesa por WhatsApp
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleSaveTable()}
                        className="bg-red-50 hover:bg-red-100 text-red-700 py-3.5 rounded-xl font-black text-sm sm:text-base transition-all border-2 border-red-200 cursor-pointer"
                      >
                        Salvar Mesa (Aberta)
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !currentSession || isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-black text-sm sm:text-base shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {isProcessing
                          ? "Processando..."
                          : paymentMethod === "fiado"
                          ? "Transferir p/ Fiado"
                          : "Fechar Conta & Receber"}
                      </button>
                    </div>

                    {!currentSession && (
                      <p className="text-red-600 text-xs text-center font-bold bg-red-50 py-1.5 rounded-lg border border-red-200">
                        ⚠️ Abra o caixa para registrar e fechar a conta.
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

      {/* Weight Modal for Kilo Charge / Pesagem de Produtos */}
      <WeightModal
        isOpen={isWeighModalOpen}
        product={weighingProduct}
        initialWeight={weighingCartItem ? Number(weighingCartItem.quantity) : 0.5}
        initialObservation={weighingCartItem?.observation || ""}
        onClose={() => {
          setIsWeighModalOpen(false);
          setWeighingProduct(null);
          setWeighingCartItem(null);
        }}
        onConfirm={handleConfirmWeight}
      />
    </div>
  );
}
