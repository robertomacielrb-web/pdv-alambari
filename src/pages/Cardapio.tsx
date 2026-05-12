import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ShoppingBag, ChevronRight, MapPin, Truck, Plus, Minus, Trash2, Smartphone, Banknote, CreditCard, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

export default function Cardapio() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [whatsappNumber, setWhatsappNumber] = useState<string>("");
  const [step, setStep] = useState<"catalog" | "checkout">("catalog");

  // Checkout Form
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao" | "pix">("dinheiro");
  const [troco, setTroco] = useState("");
  const [observations, setObservations] = useState("");

  useEffect(() => {
    // Load products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        prods.push({
          id: doc.id,
          ...data,
          category: data.category ? data.category.trim() : "",
        } as Product);
      });
      setProducts(prods);
    });

    // Load whatsapp settings
    const loadSettings = async () => {
      try {
        const docRef = doc(db, "settings", "store");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().whatsappNumber) {
          setWhatsappNumber(docSnap.data().whatsappNumber);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();

    return () => unsubProducts();
  }, []);

  const groupedProducts = React.useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return filtered.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [products, searchTerm, selectedCategory]);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: Number(item.quantity) + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, observation: "" }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQ = item.quantity + delta;
          return newQ > 0 ? { ...item, quantity: newQ } : item;
        }
        return item;
      })
    );
  };

  const updateObservation = (id: string, obs: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, observation: obs };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const parsedPrice = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[R$\s]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  const subtotal = cart.reduce((sum, item) => sum + parsedPrice(item.price) * item.quantity, 0);

  const handleSendOrder = () => {
    if (!customerName.trim() || !address.trim()) {
      alert("Por favor, preencha nome e endereço para a entrega.");
      return;
    }
    if (!whatsappNumber) {
      alert("O número de WhatsApp da loja não está configurado. Por favor, contate o restaurante.");
      return;
    }

    const itemsText = cart
      .map(
        (item) =>
          `*${item.quantity}x* ${item.name} - R$ ${(parsedPrice(item.price) * item.quantity).toFixed(2).replace(".", ",")}${
            item.observation ? `\n   _Obs: ${item.observation}_` : ""
          }`
      )
      .join("\n");

    let message = `*NOVO PEDIDO (DELIVERY)* 🛵\n\n`;
    message += `*Cliente:* ${customerName}\n`;
    message += `*Endereço:* ${address}\n\n`;
    message += `*ITENS DO PEDIDO:*\n${itemsText}\n\n`;
    const paymentLabels = {
      dinheiro: "Dinheiro",
      cartao: "Cartão",
      pix: "PIX",
    };

    message += `*Forma de Pagamento:* ${paymentLabels[paymentMethod]}\n`;
    if (paymentMethod === "dinheiro" && troco) {
      message += `*Troco para:* R$ ${troco}\n`;
    }
    if (observations) {
      message += `\n*Observações Gerais:*\n${observations}\n`;
    }
    message += `\n*TOTAL: R$ ${subtotal.toFixed(2).replace(".", ",")}*`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header Public */}
      <header className="bg-orange-600 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            <h1 className="text-xl font-black tracking-tight">ALAMBARI DEFUMADOS</h1>
          </div>
          {step === "checkout" && (
            <button
              onClick={() => setStep("catalog")}
              className="text-white font-bold bg-white/20 px-3 py-1.5 rounded-lg text-sm hover:bg-white/30"
            >
              Voltar ao Cardápio
            </button>
          )}
        </div>
      </header>

      {step === "catalog" && (
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-32">
          {/* Categorias e Busca */}
          <div className="mb-6 space-y-4">
            <input
              type="text"
              placeholder="🔍 Buscar no cardápio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
            />

            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
              {categories.map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-orange-600 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {cat === "all" ? "🔥 Todos" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Produtos */}
          <div>
            {Object.keys(groupedProducts).length === 0 ? (
              <div className="text-center py-12 text-gray-500">Nenhum produto encontrado.</div>
            ) : (
              Object.keys(groupedProducts).sort().map((category) => (
                <div key={category} className="mb-8">
                  <h2 className="text-lg font-black text-gray-800 mb-4 capitalize">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedProducts[category]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((product) => (
                        <div
                          key={product.id}
                          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col hover:border-orange-200 transition-colors"
                        >
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 leading-tight mb-1">
                              {product.name}
                            </h3>
                            <p className="text-orange-600 font-extrabold text-lg mt-2">
                              R$ {parsedPrice(product.price).toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                          <button
                            onClick={() => addToCart(product)}
                            className="mt-4 w-full bg-orange-50 text-orange-700 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors"
                          >
                            <Plus className="w-5 h-5" /> Adicionar
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {step === "checkout" && (
        <main className="flex-1 w-full max-w-xl mx-auto p-4 pb-32">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
            <h2 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              Seu Pedido
            </h2>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Seu carrinho está vazio.</p>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={item.id}
                      className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 leading-tight">{item.name}</h4>
                          <p className="text-orange-600 font-bold text-sm">
                            R$ {(parsedPrice(item.price) * item.quantity).toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Observação (Ex: sem cebola)"
                        value={item.observation || ""}
                        onChange={(e) => updateObservation(item.id, e.target.value)}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 outline-none focus:ring-1 focus:ring-orange-500"
                      />

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-700"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 flex justify-center font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-700"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 space-y-5">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 border-b pb-4">
              <MapPin className="w-6 h-6 text-orange-600" />
              Onde Entregar?
            </h2>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Seu Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-orange-500 focus:bg-white transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Endereço Completo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, Número, Bairro, Ponto de Referência..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 h-24 resize-none outline-none focus:border-orange-500 focus:bg-white transition-colors"
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 space-y-5">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 border-b pb-4">
              <Smartphone className="w-6 h-6 text-orange-600" />
              Pagamento na Entrega
            </h2>

            <div className="grid grid-cols-3 gap-2">
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
            </div>

            {paymentMethod === "dinheiro" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <label className="block text-sm font-bold text-gray-700 mb-1 mt-4">
                  Precisa de troco para quanto? (Opcional)
                </label>
                <input
                  type="number"
                  value={troco}
                  onChange={(e) => setTroco(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-orange-500 focus:bg-white"
                />
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 mt-4">
                Observações do Pedido (Opcional)
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Tocar o interfone..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 h-20 resize-none outline-none focus:border-orange-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </main>
      )}

      {/* Floating Action Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-4xl mx-auto">
            {step === "catalog" ? (
              <button
                onClick={() => setStep("checkout")}
                className="w-full bg-orange-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg hover:bg-orange-700 transition-colors flex items-center justify-between px-6"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-white text-orange-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                  Ver Pedido
                </div>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </button>
            ) : (
              <div className="max-w-xl mx-auto space-y-3">
                <div className="flex justify-between items-center px-2">
                  <span className="font-bold text-gray-600">Total do Pedido:</span>
                  <span className="font-black text-2xl text-orange-600">
                    R$ {subtotal.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                {/* Note about delivery fee */}
                 <p className="text-xs text-gray-500 text-center font-medium">
                  * A taxa de entrega será informada pelo restaurante via WhatsApp.
                </p>
                <button
                  onClick={handleSendOrder}
                  className="w-full bg-green-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Truck className="w-6 h-6" />
                  Enviar Pedido p/ WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
