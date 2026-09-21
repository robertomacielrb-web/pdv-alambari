import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  getDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Flame, 
  Users, 
  Calculator, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Printer, 
  ClipboardList, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Phone, 
  Copy, 
  X, 
  Search, 
  RotateCcw, 
  Sparkles, 
  Check, 
  Share2, 
  FileText,
  Percent,
  Beef,
  Lock,
  ShieldAlert,
  TrendingUp,
  AlertCircle,
  SlidersHorizontal,
  FileDown,
  CheckCircle2,
  XCircle,
  Send,
  Scale,
  MessageSquare,
  Clock,
  ArrowRight,
  History
} from 'lucide-react';
import { 
  MeatItem, 
  SideItem, 
  DrinkItem, 
  ServiceItem, 
  EventQuote 
} from '../types/churrasco';
import { 
  DEFAULT_MEATS, 
  DEFAULT_SIDES, 
  DEFAULT_DRINKS, 
  DEFAULT_SERVICES, 
  calculateRecommendedMeatKg, 
  distributeMeatsProportionally, 
  formatCurrency, 
  formatWhatsAppProposal,
  formatWhatsAppSummary,
  calculateGramsPerPerson,
  calculateTotalMeatWeight,
  calculateMeatPerPersonDetails,
  getAppetiteCategory,
  adjustMeatDistribution
} from '../data/churrascoDefaults';
import { printChurrascoProposal, printChurrasqueiroList } from '../lib/churrascoPrint';
import { exportChurrascoProposalPDF } from '../lib/churrascoPdf';
import { useStoreSettings } from '../contexts/StoreSettingsContext';

export default function Churrasco() {
  const { logoUrl: globalLogoUrl, storeName: globalStoreName } = useStoreSettings();
  const [activeTab, setActiveTab] = useState<'calculadora' | 'orcamentos'>('calculadora');
  
  // Store settings for proposals
  const [storeSettings, setStoreSettings] = useState<{ whatsappNumber?: string; storeName?: string; pixKey?: string; logoUrl?: string }>({
    storeName: 'PDV ALAMBARI DEFUMADOS',
    logoUrl: '/logo.png'
  });

  // Saved quotes list
  const [quotes, setQuotes] = useState<EventQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [quotesSearch, setQuotesSearch] = useState('');
  const [quotesStatusFilter, setQuotesStatusFilter] = useState<string>('todos');

  // Currently editing quote ID (null if new)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Form State - Client & Event
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('12:00');
  const [eventLocation, setEventLocation] = useState('');
  const [eventType, setEventType] = useState('Aniversário');
  const [durationHours, setDurationHours] = useState(5);

  // Guests & Grams (Unificado como pessoas)
  const [totalGuests, setTotalGuests] = useState(30);
  const [gramsPerPerson, setGramsPerPerson] = useState(400);

  // Modo de Cálculo Dinâmico: 'por_consumo' (g/pessoa) ou 'por_peso_total' (kg)
  const [calcInputMode, setCalcInputMode] = useState<'por_consumo' | 'por_peso_total'>('por_consumo');
  const [customTotalWeightKg, setCustomTotalWeightKg] = useState<number>(12);
  const [autoDistributeOnChange, setAutoDistributeOnChange] = useState<boolean>(true);

  // Preset mode
  const [presetMode, setPresetMode] = useState<'padrao' | 'leve' | 'festa'>('padrao');

  // Items State
  const [meats, setMeats] = useState<MeatItem[]>(() => {
    return DEFAULT_MEATS.map(m => ({ ...m, kg: 0, total: 0 }));
  });
  const [sides, setSides] = useState<SideItem[]>(DEFAULT_SIDES);
  const [drinks, setDrinks] = useState<DrinkItem[]>(DEFAULT_DRINKS);
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);

  // Financials & Pricing
  const [profit, setProfit] = useState<number>(0);
  const [targetPricePerPerson, setTargetPricePerPerson] = useState<number>(0);
  const [profitMode, setProfitMode] = useState<'price_per_person' | 'total' | 'percent'>('price_per_person');
  const [showAdvancedProfit, setShowAdvancedProfit] = useState<boolean>(false);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState('50% de sinal na confirmação da data e 50% até o início do evento.');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<EventQuote['status']>('pendente');

  // Products from inventory to import
  const [productsInventory, setProductsInventory] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');

  // Add Item Modal (meat, side, drink, service)
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalCategory, setItemModalCategory] = useState<'meat' | 'side' | 'drink' | 'service'>('meat');
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormMeatCategory, setItemFormMeatCategory] = useState<MeatItem['category']>('Bovina');
  const [itemFormQty, setItemFormQty] = useState<number>(1);
  const [itemFormUnit, setItemFormUnit] = useState('unidade');
  const [itemFormPrice, setItemFormPrice] = useState<number>(0);
  const [itemFormPercentage, setItemFormPercentage] = useState<number>(15);

  // Modals & Notifications
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load Settings and Quotes from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'store');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreSettings({
            storeName: data.storeName || 'PDV ALAMBARI DEFUMADOS',
            whatsappNumber: data.whatsappNumber || '',
            pixKey: data.pixKey || '',
            logoUrl: data.logoUrl || globalLogoUrl || '/logo.png'
          });
        }
      } catch (err) {
        console.error('Error loading store settings:', err);
      }
    };
    loadSettings();

    // Listen to saved quotes
    const unsubQuotes = onSnapshot(
      collection(db, 'event_quotes'),
      (snapshot) => {
        const list: EventQuote[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as EventQuote);
        });
        // Sort by eventDate or createdAt desc
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuotes(list);
        setLoadingQuotes(false);
      },
      (err) => {
        console.error('Error fetching quotes:', err);
        setLoadingQuotes(false);
      }
    );

    // Listen to inventory products
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const prods: any[] = [];
        snapshot.forEach((d) => prods.push({ id: d.id, ...d.data() }));
        setProductsInventory(prods);
      },
      (err) => console.error('Error fetching inventory:', err)
    );

    return () => {
      unsubQuotes();
      unsubProducts();
    };
  }, []);

  // Recommended Total Meat Kg
  const recommendedMeatKg = useMemo(() => {
    if (calcInputMode === 'por_peso_total' && customTotalWeightKg > 0) {
      return Number(customTotalWeightKg.toFixed(2));
    }
    return calculateTotalMeatWeight(
      Number(totalGuests) || 0,
      Number(gramsPerPerson) || 400,
      durationHours
    );
  }, [totalGuests, gramsPerPerson, durationHours, calcInputMode, customTotalWeightKg]);

  // Detalhes calculados em tempo real (gramas por pessoa, kg/pessoa, categoria de apetite)
  const meatCalcDetails = useMemo(() => {
    const targetWeight = calcInputMode === 'por_peso_total' ? customTotalWeightKg : recommendedMeatKg;
    return calculateMeatPerPersonDetails(targetWeight, Number(totalGuests) || 0, durationHours);
  }, [calcInputMode, customTotalWeightKg, recommendedMeatKg, totalGuests, durationHours]);

  // Estimated Charcoal & Ice
  const recommendedCharcoalKg = useMemo(() => {
    return Math.max(10, Math.ceil(recommendedMeatKg * 1.1));
  }, [recommendedMeatKg]);

  const recommendedIceBags = useMemo(() => {
    return Math.max(2, Math.ceil(totalGuests / 10));
  }, [totalGuests]);

  // Selected meats total weight
  const currentTotalMeatKg = useMemo(() => {
    return Number(
      meats
        .filter(m => m.selected)
        .reduce((sum, m) => sum + (Number(m.kg) || 0), 0)
        .toFixed(2)
    );
  }, [meats]);

  // Subtotals
  const meatsSubtotal = useMemo(() => {
    return meats
      .filter(m => m.selected)
      .reduce((sum, m) => sum + (Number(m.total) || 0), 0);
  }, [meats]);

  const sidesSubtotal = useMemo(() => {
    return sides
      .filter(s => s.selected)
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  }, [sides]);

  const drinksSubtotal = useMemo(() => {
    return drinks
      .filter(d => d.selected)
      .reduce((sum, d) => sum + (Number(d.total) || 0), 0);
  }, [drinks]);

  const servicesSubtotal = useMemo(() => {
    return services
      .filter(srv => srv.selected)
      .reduce((sum, srv) => sum + (Number(srv.total) || 0), 0);
  }, [services]);

  const overallSubtotal = useMemo(() => {
    return meatsSubtotal + sidesSubtotal + drinksSubtotal + servicesSubtotal;
  }, [meatsSubtotal, sidesSubtotal, drinksSubtotal, servicesSubtotal]);

  // Custo mínimo por pessoa para cobrir todos os gastos (carnes + guarnições + bebidas + serviços)
  const costPerPerson = useMemo(() => {
    return totalGuests > 0 ? Number((overallSubtotal / totalGuests).toFixed(2)) : 0;
  }, [overallSubtotal, totalGuests]);

  // Current profit % based on overallSubtotal (costs)
  const currentProfitPercent = useMemo(() => {
    if (overallSubtotal <= 0 || profit <= 0) return 0;
    return Number(((profit / overallSubtotal) * 100).toFixed(1));
  }, [overallSubtotal, profit]);

  // Current profit per person (lucro líquido que sobra por pessoa)
  const currentProfitPerPerson = useMemo(() => {
    if (totalGuests <= 0) return 0;
    return Number((profit / totalGuests).toFixed(2));
  }, [profit, totalGuests]);

  // Quando o modo for 'price_per_person' e o número de convidados ou os custos mudarem,
  // reajusta o lucro para que o valor total por pessoa permaneça fixo no que o usuário definiu
  useEffect(() => {
    if (profitMode === 'price_per_person' && targetPricePerPerson > 0 && totalGuests > 0) {
      const targetTotal = Math.round(targetPricePerPerson * totalGuests * 100) / 100;
      const calculatedProfit = Math.round((targetTotal - overallSubtotal + (Number(discount) || 0)) * 100) / 100;
      setProfit(calculatedProfit);
    }
  }, [totalGuests, overallSubtotal, discount, profitMode, targetPricePerPerson]);

  const handleTargetPricePerPersonChange = (val: number) => {
    const num = Math.max(0, val);
    setProfitMode('price_per_person');
    setTargetPricePerPerson(num);
    if (totalGuests > 0) {
      const targetTotal = Math.round(num * totalGuests * 100) / 100;
      const calculatedProfit = Math.round((targetTotal - overallSubtotal + (Number(discount) || 0)) * 100) / 100;
      setProfit(calculatedProfit);
    }
  };

  const handleProfitTotalChange = (val: number) => {
    const num = Math.max(0, val);
    setProfitMode('total');
    setProfit(num);
    if (totalGuests > 0) {
      const calculatedTotal = overallSubtotal + num - (Number(discount) || 0);
      setTargetPricePerPerson(Number((calculatedTotal / totalGuests).toFixed(2)));
    }
  };

  const handleApplyProfitPercent = (pct: number) => {
    setProfitMode('percent');
    const calculated = Math.round((overallSubtotal * (pct / 100)) * 100) / 100;
    setProfit(calculated);
    if (totalGuests > 0) {
      const calculatedTotal = overallSubtotal + calculated - (Number(discount) || 0);
      setTargetPricePerPerson(Number((calculatedTotal / totalGuests).toFixed(2)));
    }
  };

  const handleClearProfit = () => {
    setProfit(0);
    setProfitMode('price_per_person');
    setTargetPricePerPerson(costPerPerson);
  };

  const finalTotal = useMemo(() => {
    return Math.max(0, overallSubtotal + (Number(profit) || 0) - (Number(discount) || 0));
  }, [overallSubtotal, profit, discount]);

  const pricePerPerson = useMemo(() => {
    return totalGuests > 0 ? Number((finalTotal / totalGuests).toFixed(2)) : 0;
  }, [finalTotal, totalGuests]);

  // Handle Preset changes
  const applyPreset = (type: 'padrao' | 'leve' | 'festa') => {
    setPresetMode(type);
    if (type === 'padrao') {
      setGramsPerPerson(400);
    } else if (type === 'leve') {
      setGramsPerPerson(350);
    } else if (type === 'festa') {
      setGramsPerPerson(500);
    }
  };

  // Handlers para ajuste dinâmico de convidados, peso total e gramas/pessoa
  const handleUpdateGuests = (newGuests: number) => {
    const validGuests = Math.max(1, newGuests);
    setTotalGuests(validGuests);
    if (calcInputMode === 'por_peso_total') {
      const calculatedGrams = calculateGramsPerPerson(customTotalWeightKg, validGuests);
      setGramsPerPerson(calculatedGrams);
      if (autoDistributeOnChange) {
        setMeats(prev => adjustMeatDistribution(prev, customTotalWeightKg));
      }
    } else {
      const newWeight = calculateTotalMeatWeight(validGuests, gramsPerPerson, durationHours);
      setCustomTotalWeightKg(newWeight);
      if (autoDistributeOnChange) {
        setMeats(prev => adjustMeatDistribution(prev, newWeight));
      }
    }
  };

  const handleUpdateTotalWeight = (newWeightKg: number) => {
    const validWeight = Math.max(0, Number(newWeightKg.toFixed(2)));
    setCustomTotalWeightKg(validWeight);
    if (totalGuests > 0) {
      const calculatedGrams = calculateGramsPerPerson(validWeight, totalGuests);
      setGramsPerPerson(calculatedGrams);
    }
    if (autoDistributeOnChange) {
      setMeats(prev => adjustMeatDistribution(prev, validWeight));
    }
  };

  const handleUpdateGramsPerPerson = (newGrams: number) => {
    const validGrams = Math.max(50, newGrams);
    setGramsPerPerson(validGrams);
    const newWeight = calculateTotalMeatWeight(totalGuests, validGrams, durationHours);
    setCustomTotalWeightKg(newWeight);
    if (autoDistributeOnChange) {
      setMeats(prev => adjustMeatDistribution(prev, newWeight));
    }
  };

  const handleApplyWeightToMeats = (weightToApply?: number) => {
    const targetKg = weightToApply ?? (calcInputMode === 'por_peso_total' ? customTotalWeightKg : recommendedMeatKg);
    setMeats(prev => adjustMeatDistribution(prev, targetKg));
    setSuccessMessage(`${targetKg.toFixed(1)} kg distribuídos proporcionalmente entre os cortes selecionados!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Auto-distribute meats when user clicks button
  const handleDistributeMeats = () => {
    const targetKg = calcInputMode === 'por_peso_total' ? customTotalWeightKg : recommendedMeatKg;
    setMeats(prevMeats => adjustMeatDistribution(prevMeats, targetKg));
  };

  // Run initial distribution once if all meats are 0
  useEffect(() => {
    const hasAnyKg = meats.some(m => m.kg > 0);
    if (!hasAnyKg && recommendedMeatKg > 0) {
      setMeats(prev => distributeMeatsProportionally(prev, recommendedMeatKg));
    }
  }, [recommendedMeatKg]);

  // Meat item update handlers
  const handleToggleMeat = (id: string) => {
    setMeats(prev =>
      prev.map(m => {
        if (m.id === id) {
          const nextSelected = !m.selected;
          const nextKg = nextSelected ? (m.kg > 0 ? m.kg : 1) : 0;
          return {
            ...m,
            selected: nextSelected,
            kg: nextKg,
            total: Number((nextKg * m.pricePerKg).toFixed(2))
          };
        }
        return m;
      })
    );
  };

  const handleUpdateMeatKg = (id: string, newKg: number) => {
    const safeKg = Math.max(0, Number(newKg.toFixed(2)));
    setMeats(prev =>
      prev.map(m => {
        if (m.id === id) {
          return {
            ...m,
            kg: safeKg,
            total: Number((safeKg * m.pricePerKg).toFixed(2)),
            selected: safeKg > 0 ? true : m.selected
          };
        }
        return m;
      })
    );
  };

  const handleUpdateMeatPrice = (id: string, newPrice: number) => {
    const safePrice = Math.max(0, Number(newPrice.toFixed(2)));
    setMeats(prev =>
      prev.map(m => {
        if (m.id === id) {
          return {
            ...m,
            pricePerKg: safePrice,
            total: Number((m.kg * safePrice).toFixed(2))
          };
        }
        return m;
      })
    );
  };

  const handleRemoveMeat = (id: string) => {
    setMeats(prev => prev.filter(m => m.id !== id));
  };

  const handleRemoveSide = (id: string) => {
    setSides(prev => prev.filter(s => s.id !== id));
  };

  const handleRemoveDrink = (id: string) => {
    setDrinks(prev => prev.filter(d => d.id !== id));
  };

  const handleRemoveService = (id: string) => {
    setServices(prev => prev.filter(srv => srv.id !== id));
  };

  // Open Add Item Modal for any category
  const openAddItemModal = (cat: 'meat' | 'side' | 'drink' | 'service') => {
    setItemModalCategory(cat);
    setItemFormName('');
    setItemFormMeatCategory('Bovina');
    if (cat === 'meat') {
      setItemFormQty(2);
      setItemFormUnit('kg');
      setItemFormPrice(58);
      setItemFormPercentage(15);
    } else if (cat === 'side') {
      setItemFormQty(1);
      setItemFormUnit('kg');
      setItemFormPrice(30);
      setItemFormPercentage(0);
    } else if (cat === 'drink') {
      setItemFormQty(2);
      setItemFormUnit('unidade');
      setItemFormPrice(20);
      setItemFormPercentage(0);
    } else {
      setItemFormQty(1);
      setItemFormUnit('diária');
      setItemFormPrice(150);
      setItemFormPercentage(0);
    }
    setItemModalOpen(true);
  };

  // Save new item from modal
  const handleSaveNewItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemFormName.trim()) return;

    if (itemModalCategory === 'meat') {
      const qty = Number(itemFormQty) || 1;
      const price = Number(itemFormPrice) || 0;
      const newMeat: MeatItem = {
        id: 'custom_meat_' + Date.now(),
        name: itemFormName.trim(),
        category: itemFormMeatCategory,
        percentage: Number(itemFormPercentage) || 15,
        kg: qty,
        pricePerKg: price,
        total: Number((qty * price).toFixed(2)),
        selected: true,
        isCustom: true
      };
      setMeats(prev => [newMeat, ...prev]);
    } else if (itemModalCategory === 'side') {
      const qty = Number(itemFormQty) || 1;
      const price = Number(itemFormPrice) || 0;
      const newSide: SideItem = {
        id: 'custom_side_' + Date.now(),
        name: itemFormName.trim(),
        quantity: qty,
        unit: itemFormUnit || 'porção',
        price: price,
        total: Number((qty * price).toFixed(2)),
        selected: true,
        isCustom: true
      };
      setSides(prev => [...prev, newSide]);
    } else if (itemModalCategory === 'drink') {
      const qty = Number(itemFormQty) || 1;
      const price = Number(itemFormPrice) || 0;
      const newDrink: DrinkItem = {
        id: 'custom_drink_' + Date.now(),
        name: itemFormName.trim(),
        quantity: qty,
        unit: itemFormUnit || 'unidade',
        price: price,
        total: Number((qty * price).toFixed(2)),
        selected: true,
        isCustom: true
      };
      setDrinks(prev => [...prev, newDrink]);
    } else if (itemModalCategory === 'service') {
      const qty = Number(itemFormQty) || 1;
      const price = Number(itemFormPrice) || 0;
      const newService: ServiceItem = {
        id: 'custom_service_' + Date.now(),
        name: itemFormName.trim(),
        quantity: qty,
        unit: itemFormUnit || 'serviço',
        price: price,
        total: Number((qty * price).toFixed(2)),
        selected: true,
        isCustom: true
      };
      setServices(prev => [...prev, newService]);
    }

    setItemModalOpen(false);
  };

  // Import product from inventory
  const handleImportProduct = (prod: any) => {
    const price = prod.wholesalePrice || prod.price || 40;
    const newMeat: MeatItem = {
      id: 'prod_' + prod.id + '_' + Date.now(),
      name: prod.name,
      category: prod.category?.includes('Bov') ? 'Bovina' : prod.category?.includes('Suí') ? 'Suína' : prod.category?.includes('Fran') ? 'Frango' : 'Outros',
      percentage: 15,
      kg: 2,
      pricePerKg: price,
      total: Number((2 * price).toFixed(2)),
      selected: true,
      isCustom: true
    };
    setMeats(prev => [newMeat, ...prev]);
    setShowProductModal(false);
  };

  // Side/Drink/Service updates
  const handleToggleSide = (id: string) => {
    setSides(prev =>
      prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };
  const handleUpdateSideQty = (id: string, qty: number) => {
    const safeQty = Math.max(0, qty);
    setSides(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, quantity: safeQty, total: Number((safeQty * s.price).toFixed(2)) }
          : s
      )
    );
  };
  const handleUpdateSidePrice = (id: string, price: number) => {
    const safePrice = Math.max(0, price);
    setSides(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, price: safePrice, total: Number((s.quantity * safePrice).toFixed(2)) }
          : s
      )
    );
  };

  const handleToggleDrink = (id: string) => {
    setDrinks(prev =>
      prev.map(d => (d.id === id ? { ...d, selected: !d.selected } : d))
    );
  };
  const handleUpdateDrinkQty = (id: string, qty: number) => {
    const safeQty = Math.max(0, qty);
    setDrinks(prev =>
      prev.map(d =>
        d.id === id
          ? { ...d, quantity: safeQty, total: Number((safeQty * d.price).toFixed(2)) }
          : d
      )
    );
  };
  const handleUpdateDrinkPrice = (id: string, price: number) => {
    const safePrice = Math.max(0, price);
    setDrinks(prev =>
      prev.map(d =>
        d.id === id
          ? { ...d, price: safePrice, total: Number((d.quantity * safePrice).toFixed(2)) }
          : d
      )
    );
  };

  const handleToggleService = (id: string) => {
    setServices(prev =>
      prev.map(srv => (srv.id === id ? { ...srv, selected: !srv.selected } : srv))
    );
  };
  const handleUpdateServicePrice = (id: string, price: number) => {
    const safePrice = Math.max(0, price);
    setServices(prev =>
      prev.map(srv =>
        srv.id === id
          ? { ...srv, price: safePrice, total: Number((srv.quantity * safePrice).toFixed(2)) }
          : srv
      )
    );
  };

  // Build current quote object
  const buildCurrentQuote = (): EventQuote => {
    return {
      clientName: clientName.trim() || 'Cliente sem nome',
      clientPhone: clientPhone.trim(),
      eventDate: eventDate || new Date().toISOString().split('T')[0],
      eventTime,
      eventLocation,
      eventType,
      durationHours,
      totalGuests: Number(totalGuests) || 0,
      gramsPerPerson: Number(gramsPerPerson) || 400,
      totalMeatKg: currentTotalMeatKg,
      meats: meats.filter(m => m.selected && m.kg > 0),
      sides: sides.filter(s => s.selected),
      drinks: drinks.filter(d => d.selected),
      services: services.filter(srv => srv.selected),
      subtotal: overallSubtotal,
      profit: Number(profit) || 0,
      profitPercent: currentProfitPercent,
      profitPerPerson: currentProfitPerPerson,
      discount: Number(discount) || 0,
      total: finalTotal,
      pricePerPerson,
      paymentTerms,
      notes,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Save quote to Firestore
  const handleSaveQuote = async () => {
    if (!clientName.trim()) {
      alert('Por favor, informe o nome do cliente antes de salvar a proposta.');
      return;
    }
    setIsSaving(true);
    try {
      const quoteData = buildCurrentQuote();
      if (editingQuoteId) {
        await updateDoc(doc(db, 'event_quotes', editingQuoteId), {
          ...quoteData,
          updatedAt: new Date().toISOString()
        });
        setSuccessMessage('Proposta atualizada com sucesso!');
      } else {
        const ref = await addDoc(collection(db, 'event_quotes'), quoteData);
        setEditingQuoteId(ref.id);
        setSuccessMessage('Proposta salva com sucesso!');
      }
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      alert('Erro ao salvar proposta.');
      handleFirestoreError(err, editingQuoteId ? OperationType.UPDATE : OperationType.CREATE, 'event_quotes');
    } finally {
      setIsSaving(false);
    }
  };

  // Load quote to edit
  const handleLoadQuote = (quote: EventQuote) => {
    if (!quote.id) return;
    setEditingQuoteId(quote.id);
    setClientName(quote.clientName || '');
    setClientPhone(quote.clientPhone || '');
    setEventDate(quote.eventDate || '');
    setEventTime(quote.eventTime || '12:00');
    setEventLocation(quote.eventLocation || '');
    setEventType(quote.eventType || 'Churrasco');
    setDurationHours(quote.durationHours || 5);
    const loadedTotal = quote.totalGuests || ((quote.adultsMen || 0) + (quote.adultsWomen || 0) + (quote.children || 0)) || 30;
    setTotalGuests(loadedTotal);
    setGramsPerPerson(quote.gramsPerPerson || quote.gramsPerMan || 400);
    if (quote.totalMeatKg && quote.totalMeatKg > 0) {
      setCustomTotalWeightKg(quote.totalMeatKg);
    }
    setProfit(quote.profit || 0);
    if (quote.pricePerPerson) {
      setTargetPricePerPerson(quote.pricePerPerson);
      setProfitMode('price_per_person');
    } else if (loadedTotal > 0 && quote.total) {
      setTargetPricePerPerson(Number((quote.total / loadedTotal).toFixed(2)));
      setProfitMode('price_per_person');
    } else {
      setTargetPricePerPerson(0);
      setProfitMode('price_per_person');
    }
    setDiscount(quote.discount || 0);
    setPaymentTerms(quote.paymentTerms || '50% de sinal na confirmação da data e 50% até o início do evento.');
    setNotes(quote.notes || '');
    setStatus(quote.status || 'pendente');

    // Merge meats
    if (quote.meats && quote.meats.length > 0) {
      setMeats(quote.meats);
    }
    if (quote.sides && quote.sides.length > 0) {
      setSides(quote.sides);
    }
    if (quote.drinks && quote.drinks.length > 0) {
      setDrinks(quote.drinks);
    }
    if (quote.services && quote.services.length > 0) {
      setServices(quote.services);
    }

    setActiveTab('calculadora');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to clean form
  const handleResetForm = () => {
    if (confirm('Deseja criar uma nova proposta em branco? Os dados não salvos serão limpos.')) {
      setEditingQuoteId(null);
      setClientName('');
      setClientPhone('');
      setEventDate('');
      setEventTime('12:00');
      setEventLocation('');
      setEventType('Aniversário');
      setDurationHours(5);
      setTotalGuests(30);
      setGramsPerPerson(400);
      setPresetMode('padrao');
      setProfit(0);
      setTargetPricePerPerson(0);
      setProfitMode('price_per_person');
      setShowAdvancedProfit(false);
      setDiscount(0);
      setNotes('');
      setStatus('pendente');
      const resetMeats = DEFAULT_MEATS.map(m => ({ ...m, kg: 0, total: 0 }));
      setMeats(distributeMeatsProportionally(resetMeats, 13.0));
      setSides(DEFAULT_SIDES);
      setDrinks(DEFAULT_DRINKS);
      setServices(DEFAULT_SERVICES);
    }
  };

  // Delete quote
  const handleDeleteQuote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'event_quotes', id));
      if (editingQuoteId === id) {
        setEditingQuoteId(null);
      }
      setDeleteConfirmId(null);
    } catch (err) {
      alert('Erro ao excluir proposta.');
      handleFirestoreError(err, OperationType.DELETE, `event_quotes/${id}`);
    }
  };

  // Update status directly from list or quick buttons (aceito, recusado, etc.)
  const handleUpdateStatus = async (id: string, newStatus: EventQuote['status']) => {
    try {
      await updateDoc(doc(db, 'event_quotes', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      if (editingQuoteId === id) {
        setStatus(newStatus);
      }
      const label = newStatus === 'aceito' ? 'Aceito' : newStatus === 'recusado' ? 'Recusado' : newStatus;
      setSuccessMessage(`Status do orçamento atualizado para "${label}"!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `event_quotes/${id}`);
    }
  };

  // WhatsApp Sender (Proposta Completa)
  const handleSendWhatsApp = (targetQuote?: EventQuote | unknown) => {
    const isQuoteObject = targetQuote && typeof targetQuote === 'object' && 'clientName' in (targetQuote as Record<string, unknown>);
    const quote = (isQuoteObject ? targetQuote : null) as EventQuote || buildCurrentQuote();
    const msg = formatWhatsAppProposal(quote, storeSettings);
    const encoded = encodeURIComponent(msg);
    const phone = (isQuoteObject ? (targetQuote as EventQuote).clientPhone : clientPhone) || '';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');

    if (!isQuoteObject && editingQuoteId && status === 'pendente') {
      handleUpdateStatus(editingQuoteId, 'enviado');
    } else if (isQuoteObject && (targetQuote as EventQuote).id && (targetQuote as EventQuote).status === 'pendente') {
      handleUpdateStatus((targetQuote as EventQuote).id!, 'enviado');
    }
  };

  // WhatsApp Sender (Resumo Executivo Rápido)
  const handleSendWhatsAppSummary = (targetQuote?: EventQuote | unknown) => {
    const isQuoteObject = targetQuote && typeof targetQuote === 'object' && 'clientName' in (targetQuote as Record<string, unknown>);
    const quote = (isQuoteObject ? targetQuote : null) as EventQuote || buildCurrentQuote();
    const msg = formatWhatsAppSummary(quote, storeSettings);
    const encoded = encodeURIComponent(msg);
    const phone = (isQuoteObject ? (targetQuote as EventQuote).clientPhone : clientPhone) || '';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');

    if (!isQuoteObject && editingQuoteId && status === 'pendente') {
      handleUpdateStatus(editingQuoteId, 'enviado');
    } else if (isQuoteObject && (targetQuote as EventQuote).id && (targetQuote as EventQuote).status === 'pendente') {
      handleUpdateStatus((targetQuote as EventQuote).id!, 'enviado');
    }
  };

  // Copy proposal text
  const handleCopyProposal = () => {
    const quote = buildCurrentQuote();
    const msg = formatWhatsAppProposal(quote, storeSettings);
    navigator.clipboard.writeText(msg);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Print full proposal
  const handlePrintProposal = () => {
    const quote = buildCurrentQuote();
    printChurrascoProposal(quote, storeSettings);
  };

  // Export full proposal as PDF file
  const handleExportPDF = () => {
    const quote = buildCurrentQuote();
    exportChurrascoProposalPDF(quote, storeSettings);
    setSuccessMessage('Proposta em PDF gerada e baixada com sucesso!');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Print butcher/chef checklist
  const handlePrintChefList = () => {
    const quote = buildCurrentQuote();
    printChurrasqueiroList(quote, storeSettings);
  };

  // Meat weight diff from recommendation
  const meatDiff = Number((currentTotalMeatKg - recommendedMeatKg).toFixed(2));

  // Filtered quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchesSearch =
        (q.clientName || '').toLowerCase().includes(quotesSearch.toLowerCase()) ||
        (q.clientPhone || '').includes(quotesSearch);
      const matchesStatus = quotesStatusFilter === 'todos' || q.status === quotesStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotes, quotesSearch, quotesStatusFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold text-sm">{successMessage}</span>
        </div>
      )}

      {copiedNotification && (
        <div className="fixed top-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <Check className="w-5 h-5" />
          <span className="font-semibold text-sm">Proposta copiada para a área de transferência!</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <img
              src={globalLogoUrl || "/logo.png"}
              alt={globalStoreName || "Alambari Defumados"}
              className="w-12 h-12 rounded-full object-cover border-2 border-red-600 shadow-md shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Eventos & Orçamento de Churrasco
                </h1>
                <span className="text-[11px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {globalStoreName || "Alambari Defumados"}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Calculadora inteligente de carnes por pessoa, montagem de cardápio e envio de propostas
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-gray-200/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('calculadora')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'calculadora'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calculator className="w-4 h-4 text-red-600" />
            <span>Calculadora & Proposta</span>
            {editingQuoteId && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                Editando
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orcamentos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'orcamentos'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <span>Orçamentos Salvos</span>
            <span className="text-xs bg-gray-300/80 text-gray-800 px-2 py-0.5 rounded-full font-bold">
              {quotes.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'calculadora' ? (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Convidados Totais</div>
                <div className="text-2xl font-black text-gray-900">{totalGuests} <span className="text-xs font-normal text-gray-500">pessoas</span></div>
                <div className="text-xs text-gray-400">{gramsPerPerson}g de carne / pessoa</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Meta de Carne Calculada</div>
                <div className="text-2xl font-black text-red-600">
                  {recommendedMeatKg.toFixed(2).replace('.', ',')} <span className="text-xs font-normal text-gray-500">kg</span>
                </div>
                <div className="text-xs text-gray-500">
                  {totalGuests > 0 ? (recommendedMeatKg / totalGuests * 1000).toFixed(0) : 0}g média/pessoa
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Beef className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Carne Selecionada no Cardápio</div>
                <div className={`text-2xl font-black ${
                  Math.abs(meatDiff) <= 0.5 ? 'text-emerald-600' : meatDiff > 0.5 ? 'text-blue-600' : 'text-amber-600'
                }`}>
                  {currentTotalMeatKg.toFixed(2).replace('.', ',')} <span className="text-xs font-normal text-gray-500">kg</span>
                </div>
                <div className="text-xs text-gray-500">
                  {meatDiff === 0
                    ? '100% equilibrado'
                    : meatDiff > 0
                    ? `+${meatDiff.toFixed(2)}kg acima da meta`
                    : `${meatDiff.toFixed(2)}kg abaixo da meta`}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Valor Total da Proposta</div>
                <div className="text-2xl font-black text-emerald-600">
                  {formatCurrency(finalTotal)}
                </div>
                <div className="text-xs text-gray-500">
                  {totalGuests > 0 ? `${formatCurrency(pricePerPerson)}/pessoa (tudo incluso)` : '-'}
                  {profit > 0 ? ` • Lucro: ${formatCurrency(profit)} (${formatCurrency(currentProfitPerPerson)}/pes)` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL: Últimos Orçamentos */}
          {quotes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      Últimos Orçamentos
                      <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                        {quotes.length} total
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">
                      Recupere cálculos anteriores para editar, reenviar resumo pelo WhatsApp ou marcar status.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('orcamentos')}
                  className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 self-start sm:self-auto transition-colors"
                >
                  <span>Ver todos os {quotes.length} orçamentos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {quotes.slice(0, 4).map(q => {
                  const isCurrent = editingQuoteId === q.id;
                  const isAceito = q.status === 'aceito' || q.status === 'aprovado';
                  const isRecusado = q.status === 'recusado';
                  const isEnviado = q.status === 'enviado';
                  const badgeStyle = isAceito
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isRecusado
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : isEnviado
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200';

                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                        isCurrent
                          ? 'bg-red-50/50 border-red-300 ring-2 ring-red-500/20 shadow-xs'
                          : 'bg-slate-50/60 hover:bg-slate-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-xs text-gray-900 truncate max-w-[130px]" title={q.clientName}>
                            {q.clientName || 'Cliente sem nome'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase shrink-0 ${badgeStyle}`}>
                            {q.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">
                            {q.eventDate ? new Date(q.eventDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                          </span>
                          <span>•</span>
                          <span className="shrink-0">{q.totalGuests} pess.</span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <div>
                            <span className="text-[10px] text-gray-400 block font-medium">Total</span>
                            <span className="font-black text-sm text-gray-900">{formatCurrency(q.total)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block">Carnes</span>
                            <span className="text-xs font-bold text-red-600">
                              {q.totalMeatKg ? `${Number(q.totalMeatKg).toFixed(1)} kg` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ações Rápidas */}
                      <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => handleLoadQuote(q)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                            isCurrent
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                          }`}
                          title="Recuperar e editar este orçamento na calculadora"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{isCurrent ? 'Editando' : 'Editar'}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Botão Aceito */}
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(q.id!, 'aceito')}
                            className={`p-1 rounded-md text-[10px] font-bold flex items-center transition-colors ${
                              isAceito
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="Marcar como Aceito"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Recusado */}
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(q.id!, 'recusado')}
                            className={`p-1 rounded-md text-[10px] font-bold flex items-center transition-colors ${
                              isRecusado
                                ? 'bg-rose-600 text-white'
                                : 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-50'
                            }`}
                            title="Marcar como Recusado"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão WhatsApp Resumo */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppSummary(q)}
                            className="p-1 rounded-md bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Enviar Resumo Executivo pelo WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form & Calculator (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* SECTION 1: Dados do Cliente & Evento */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 text-gray-900 font-bold">
                    <Calendar className="w-5 h-5 text-red-600" />
                    <span>1. Dados do Cliente e Evento</span>
                  </div>
                  {editingQuoteId && (
                    <button
                      onClick={handleResetForm}
                      className="text-xs text-gray-500 hover:text-red-600 font-medium flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Criar nova em branco
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Nome do Cliente *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: João da Silva / Empresa XYZ"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      WhatsApp / Telefone (Para Envio da Proposta)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Data do Evento
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={e => setEventDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                        Horário de Início
                      </label>
                      <input
                        type="time"
                        value={eventTime}
                        onChange={e => setEventTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                        Duração (Horas)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="14"
                        value={durationHours}
                        onChange={e => setDurationHours(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Localização / Endereço do Evento
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Ex: Chácara Recanto Feliz, Bairro Alambari"
                        value={eventLocation}
                        onChange={e => setEventLocation(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Tipo de Evento
                    </label>
                    <select
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      <option value="Aniversário">Aniversário</option>
                      <option value="Confraternização de Empresa">Confraternização de Empresa</option>
                      <option value="Casamento / Noivado">Casamento / Noivado</option>
                      <option value="Almoço de Família">Almoço de Família</option>
                      <option value="Formatura">Formatura</option>
                      <option value="Festa de Fim de Ano">Festa de Fim de Ano</option>
                      <option value="Outro Evento">Outro Evento</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Quantidade de Convidados & Cálculo de Carne */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                      <Users className="w-5 h-5 text-red-600" />
                      <span>2. Cálculo Dinâmico de Carnes & Convidados</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ajuste dinamicamente pelo consumo por pessoa ou pelo peso total de carne desejado.
                    </p>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setCalcInputMode('por_consumo')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                        calcInputMode === 'por_consumo'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-red-600" />
                      <span>Por Consumo (g/pessoa)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalcInputMode('por_peso_total');
                        if (customTotalWeightKg <= 0 && recommendedMeatKg > 0) {
                          setCustomTotalWeightKg(recommendedMeatKg);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                        calcInputMode === 'por_peso_total'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Por Peso Total (kg)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  {/* Bloco 1: Total de Pessoas / Convidados */}
                  <div className="md:col-span-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-red-600" />
                        Total de Convidados
                      </span>
                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-bold">
                        {totalGuests} {totalGuests === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateGuests(totalGuests - 5)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 text-xs transition-colors"
                        title="Diminuir 5 convidados"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateGuests(totalGuests - 1)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 flex items-center justify-center text-xl shadow-2xs transition-colors"
                        title="Diminuir 1 convidado"
                      >
                        -
                      </button>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={totalGuests || ''}
                          onChange={e => handleUpdateGuests(parseInt(e.target.value) || 1)}
                          className="w-20 sm:w-24 text-center text-2xl sm:text-3xl font-black text-gray-900 bg-white border border-slate-300 rounded-lg py-1 shadow-inner outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <span className="block text-[10px] text-gray-400 text-center mt-0.5">digite convidados</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateGuests(totalGuests + 1)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 flex items-center justify-center text-xl shadow-2xs transition-colors"
                        title="Adicionar 1 convidado"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateGuests(totalGuests + 5)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 text-xs transition-colors"
                        title="Adicionar 5 convidados"
                      >
                        +5
                      </button>
                    </div>

                    {/* Atalhos rápidos de convidados */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1 flex-wrap text-xs">
                      <span className="text-[11px] text-slate-500 font-medium">Atalhos:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {[10, 15, 20, 25, 30, 40, 50, 80, 100].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleUpdateGuests(n)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                              totalGuests === n
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Controle Dinâmico (Por Consumo ou Por Peso Total) */}
                  <div className="md:col-span-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    {calcInputMode === 'por_consumo' ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-red-600" />
                            Consumo por Pessoa
                          </span>
                          <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                            {gramsPerPerson}g / pessoa
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateGramsPerPerson(gramsPerPerson - 50)}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 text-xs transition-colors"
                            title="Diminuir 50g"
                          >
                            -50
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateGramsPerPerson(gramsPerPerson - 25)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 flex items-center justify-center text-xl shadow-2xs transition-colors"
                            title="Diminuir 25g"
                          >
                            -
                          </button>
                          <div className="relative">
                            <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-red-500">
                              <input
                                type="number"
                                min="50"
                                max="2000"
                                step="25"
                                value={gramsPerPerson || ''}
                                onChange={e => handleUpdateGramsPerPerson(parseInt(e.target.value) || 400)}
                                className="w-16 sm:w-20 text-center text-2xl sm:text-3xl font-black text-gray-900 bg-transparent outline-none"
                              />
                              <span className="text-xs font-bold text-gray-400 ml-1">g</span>
                            </div>
                            <span className="block text-[10px] text-gray-400 text-center mt-0.5">gramas por pessoa</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateGramsPerPerson(gramsPerPerson + 25)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 flex items-center justify-center text-xl shadow-2xs transition-colors"
                            title="Adicionar 25g"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateGramsPerPerson(gramsPerPerson + 50)}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 text-xs transition-colors"
                            title="Adicionar 50g"
                          >
                            +50
                          </button>
                        </div>

                        {/* Presets de consumo */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1 flex-wrap text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">Padrões:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => { applyPreset('leve'); handleUpdateGramsPerPerson(350); }}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                gramsPerPerson === 350 ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              Leve (350g)
                            </button>
                            <button
                              type="button"
                              onClick={() => { applyPreset('padrao'); handleUpdateGramsPerPerson(400); }}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                gramsPerPerson === 400 ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              Padrão (400g)
                            </button>
                            <button
                              type="button"
                              onClick={() => { applyPreset('festa'); handleUpdateGramsPerPerson(500); }}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                gramsPerPerson === 500 ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              Farto (500g)
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Scale className="w-4 h-4 text-indigo-600" />
                            Peso Total de Carnes
                          </span>
                          <span className="text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full font-bold">
                            {customTotalWeightKg.toFixed(1)} kg total
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateTotalWeight(customTotalWeightKg - 5)}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 text-xs transition-colors"
                            title="Diminuir 5 kg"
                          >
                            -5k
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTotalWeight(customTotalWeightKg - 0.5)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 flex items-center justify-center text-xl shadow-2xs transition-colors"
                            title="Diminuir 0.5 kg"
                          >
                            -
                          </button>
                          <div className="relative">
                            <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500">
                              <input
                                type="number"
                                min="0.5"
                                max="500"
                                step="0.5"
                                value={customTotalWeightKg || ''}
                                onChange={e => handleUpdateTotalWeight(parseFloat(e.target.value) || 0)}
                                className="w-16 sm:w-20 text-center text-2xl sm:text-3xl font-black text-gray-900 bg-transparent outline-none"
                              />
                              <span className="text-xs font-bold text-gray-400 ml-1">kg</span>
                            </div>
                            <span className="block text-[10px] text-gray-400 text-center mt-0.5">peso total do churrasco</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateTotalWeight(customTotalWeightKg + 0.5)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 flex items-center justify-center text-xl shadow-2xs transition-colors"
                            title="Adicionar 0.5 kg"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTotalWeight(customTotalWeightKg + 5)}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 text-xs transition-colors"
                            title="Adicionar 5 kg"
                          >
                            +5k
                          </button>
                        </div>

                        {/* Atalhos rápidos de peso em kg */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1 flex-wrap text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">Atalhos kg:</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[5, 10, 12, 15, 20, 25, 30, 40, 50].map(k => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => handleUpdateTotalWeight(k)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                  Math.round(customTotalWeightKg) === k
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {k}k
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* PAINEL DINÂMICO: Resultado do Cálculo de Carne por Pessoa */}
                <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border border-red-200 rounded-xl p-4 shadow-2xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase text-red-900 tracking-wide">
                          Resultado do Cálculo:
                        </span>
                        <span className="bg-red-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                          {meatCalcDetails.gramsPerPerson}g por pessoa ({meatCalcDetails.kgPerPerson} kg)
                        </span>
                        <span className="bg-white/90 border border-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          Categoria: {meatCalcDetails.appetiteLabel}
                        </span>
                      </div>
                      <p className="text-xs text-red-950 font-medium leading-relaxed">
                        {totalGuests} pessoas × {meatCalcDetails.gramsPerPerson}g = <strong className="text-red-700 font-black">{recommendedMeatKg.toFixed(2).replace('.', ',')} kg de carne</strong> no total.
                        <span className="text-gray-600 ml-1">({meatCalcDetails.appetiteDescription})</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer select-none bg-white/80 px-2.5 py-1.5 rounded-lg border border-red-100 hover:bg-white transition-colors">
                        <input
                          type="checkbox"
                          checked={autoDistributeOnChange}
                          onChange={e => setAutoDistributeOnChange(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                        />
                        <span>Auto-distribuir cortes</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleDistributeMeats}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                        title="Distribuir peso proporcionalmente entre as carnes selecionadas"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Distribuir {recommendedMeatKg.toFixed(1)}kg nos Cortes
                      </button>
                    </div>
                  </div>

                  {/* Estimativas de Apoio (Carvão e Gelo) */}
                  <div className="mt-3 pt-2.5 border-t border-red-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span>🔥 Carvão / Lenha sugerido: <strong className="text-gray-900">~{recommendedCharcoalKg} kg</strong></span>
                      <span>•</span>
                      <span>🧊 Gelo: <strong className="text-gray-900">~{recommendedIceBags} sacos (5kg)</strong></span>
                      {durationHours > 4 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-800 font-semibold">
                            ⏱️ Duração: {durationHours}h (+{((durationHours - 4) * 5)}% no consumo)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Seleção e Distribuição das Carnes */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-gray-900 font-bold">
                      <Beef className="w-5 h-5 text-red-600" />
                      <span>3. Seleção das Carnes & Kilos de Cada Corte</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Defina os quilos exatos de cada carne para saber a lista de compras e custos
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openAddItemModal('meat')}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Carne
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Do Estoque
                    </button>
                    <button
                      type="button"
                      onClick={handleDistributeMeats}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Percent className="w-3.5 h-3.5" /> Ratear Proporcional
                    </button>
                  </div>
                </div>

                {/* Internal Churrasqueiro Financial Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950">Dados Internos do Churrasqueiro:</span> Os valores por KG e subtotais das carnes servem exclusivamente para você calcular seus custos e margem. <strong>Na proposta comercial enviada ao cliente (seja por WhatsApp ou Impressão), vão somente os nomes dos cortes e itens selecionados, junto com o valor final do evento.</strong>
                  </div>
                </div>

                {/* Weight Balance Meter */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-gray-700">
                      Total Selecionado: <strong className="text-gray-900">{currentTotalMeatKg.toFixed(2)} kg</strong>
                    </span>
                    <span className="text-gray-500">
                      Meta Recomendada: <strong>{recommendedMeatKg.toFixed(2)} kg</strong>
                    </span>
                  </div>

                  {/* Visual Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 transition-all ${
                        Math.abs(meatDiff) <= 0.5
                          ? 'bg-emerald-500'
                          : meatDiff > 0.5
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, recommendedMeatKg > 0 ? (currentTotalMeatKg / recommendedMeatKg) * 100 : 0)}%`
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>
                      {meatDiff === 0
                        ? '✅ Quantidade exata recomendada para o número de convidados.'
                        : meatDiff > 0
                        ? `ℹ️ Você adicionou +${meatDiff.toFixed(2)} kg além da meta sugerida (sobrará mais carne).`
                        : `⚠️ Faltam ${(Math.abs(meatDiff)).toFixed(2)} kg de carne para atingir a meta recomendada.`}
                    </span>
                    <span className="font-bold text-gray-700">Subtotal Carnes (Interno): {formatCurrency(meatsSubtotal)}</span>
                  </div>
                </div>

                {/* Meats Table / List */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                        <th className="pb-2 text-left w-8">Ativo</th>
                        <th className="pb-2 text-left">Corte de Carne</th>
                        <th className="pb-2 text-center w-28">Categoria</th>
                        <th className="pb-2 text-center w-36">Quantidade (KG)</th>
                        <th className="pb-2 text-right w-28">Preço/KG (Interno)</th>
                        <th className="pb-2 text-right w-28">Subtotal (Interno)</th>
                        <th className="pb-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {meats.map(meat => {
                        const categoryColor =
                          meat.category === 'Bovina'
                            ? 'bg-red-100 text-red-800'
                            : meat.category === 'Suína'
                            ? 'bg-orange-100 text-orange-800'
                            : meat.category === 'Frango'
                            ? 'bg-yellow-100 text-yellow-800'
                            : meat.category === 'Embutidos'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-gray-100 text-gray-700';

                        return (
                          <tr
                            key={meat.id}
                            className={`transition-colors ${
                              meat.selected ? 'hover:bg-red-50/40' : 'opacity-50 bg-gray-50/50'
                            }`}
                          >
                            <td className="py-2.5">
                              <input
                                type="checkbox"
                                checked={meat.selected}
                                onChange={() => handleToggleMeat(meat.id)}
                                className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 font-medium text-gray-900">
                              <div className="flex items-center gap-1.5">
                                <span>{meat.name}</span>
                                {meat.isCustom && (
                                  <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded">
                                    custom
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 text-center">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${categoryColor}`}>
                                {meat.category}
                              </span>
                            </td>
                            <td className="py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  disabled={!meat.selected}
                                  onClick={() => handleUpdateMeatKg(meat.id, Math.max(0, meat.kg - 0.5))}
                                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-xs disabled:opacity-30"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  disabled={!meat.selected}
                                  value={meat.kg}
                                  onChange={e => handleUpdateMeatKg(meat.id, parseFloat(e.target.value) || 0)}
                                  className="w-16 text-center font-bold py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 outline-none focus:ring-1 focus:ring-red-500"
                                />
                                <span className="text-xs text-gray-500 font-semibold">kg</span>
                                <button
                                  type="button"
                                  disabled={!meat.selected}
                                  onClick={() => handleUpdateMeatKg(meat.id, meat.kg + 0.5)}
                                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-xs disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-gray-400">R$</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  disabled={!meat.selected}
                                  value={meat.pricePerKg}
                                  onChange={e => handleUpdateMeatPrice(meat.id, parseFloat(e.target.value) || 0)}
                                  className="w-16 text-right font-medium py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100 outline-none focus:ring-1 focus:ring-red-500"
                                />
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-bold text-gray-900">
                              {meat.selected ? formatCurrency(meat.total) : '-'}
                            </td>
                            <td className="py-2.5 text-center">
                              {meat.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMeat(meat.id)}
                                  className="text-gray-400 hover:text-red-600 p-1"
                                  title="Remover corte"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 4: Acompanhamentos, Bebidas e Serviços */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
                <div className="border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 text-gray-900 font-bold">
                    <Sparkles className="w-5 h-5 text-red-600" />
                    <span>4. Acompanhamentos, Bebidas & Mão de Obra</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Selecione o que estará incluído na proposta comercial do cliente
                  </p>
                </div>

                {/* Sub-block A: Acompanhamentos */}
                <div className="space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-gray-700 uppercase">
                    <div className="flex items-center gap-2">
                      <span>🥗 Acompanhamentos & Guarnições</span>
                      <span className="text-[10px] font-normal text-gray-500 lowercase hidden sm:inline">
                        (personalize qtd e valor unitário)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-normal">Subtotal: {formatCurrency(sidesSubtotal)}</span>
                      <button
                        type="button"
                        onClick={() => openAddItemModal('side')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] shadow-2xs transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {sides.map(side => (
                      <div
                        key={side.id}
                        className={`p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between gap-2 ${
                          side.selected
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                            : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                            <input
                              type="checkbox"
                              checked={side.selected}
                              onChange={() => handleToggleSide(side.id)}
                              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                            />
                            <span className={`font-semibold ${side.selected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {side.name}
                            </span>
                            {side.isCustom && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold shrink-0">
                                custom
                              </span>
                            )}
                          </label>
                          {side.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSide(side.id)}
                              className="text-gray-400 hover:text-red-600 p-0.5 transition-colors shrink-0"
                              title="Excluir item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-emerald-100/70 text-xs">
                          {/* Quantidade */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-500 font-medium">Qtd:</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!side.selected}
                              value={side.quantity}
                              onChange={e => handleUpdateSideQty(side.id, parseFloat(e.target.value) || 0)}
                              className="w-12 text-center py-0.5 px-1 border border-gray-300 rounded font-semibold text-xs bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:ring-1 focus:ring-emerald-500 outline-none"
                              title="Quantidade"
                            />
                            <span className="text-gray-400 text-[11px]">{side.unit}</span>
                          </div>

                          {/* Preço Unitário */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-500 font-medium">Valor:</span>
                            <span className="text-gray-400 text-[11px]">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              disabled={!side.selected}
                              value={side.price}
                              onChange={e => handleUpdateSidePrice(side.id, parseFloat(e.target.value) || 0)}
                              className="w-16 text-right py-0.5 px-1 border border-gray-300 rounded font-bold text-xs bg-white text-emerald-900 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-1 focus:ring-emerald-500 outline-none"
                              title="Valor unitário do acompanhamento"
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="text-right ml-auto sm:ml-0">
                            <span className="font-extrabold text-gray-900 text-xs">
                              {formatCurrency(side.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-block B: Bebidas & Suprimentos */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-gray-700 uppercase">
                    <div className="flex items-center gap-2">
                      <span>🍻 Bebidas, Gelo & Carvão</span>
                      <span className="text-[10px] font-normal text-gray-500 lowercase hidden sm:inline">
                        (personalize qtd e valor unitário)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-normal">Subtotal: {formatCurrency(drinksSubtotal)}</span>
                      <button
                        type="button"
                        onClick={() => openAddItemModal('drink')}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] shadow-2xs transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {drinks.map(drink => (
                      <div
                        key={drink.id}
                        className={`p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between gap-2 ${
                          drink.selected
                            ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                            : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                            <input
                              type="checkbox"
                              checked={drink.selected}
                              onChange={() => handleToggleDrink(drink.id)}
                              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer shrink-0"
                            />
                            <span className={`font-semibold ${drink.selected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {drink.name}
                            </span>
                            {drink.isCustom && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold shrink-0">
                                custom
                              </span>
                            )}
                          </label>
                          {drink.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDrink(drink.id)}
                              className="text-gray-400 hover:text-red-600 p-0.5 transition-colors shrink-0"
                              title="Excluir item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-amber-100/70 text-xs">
                          {/* Quantidade */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-500 font-medium">Qtd:</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!drink.selected}
                              value={drink.quantity}
                              onChange={e => handleUpdateDrinkQty(drink.id, parseFloat(e.target.value) || 0)}
                              className="w-12 text-center py-0.5 px-1 border border-gray-300 rounded font-semibold text-xs bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:ring-1 focus:ring-amber-500 outline-none"
                              title="Quantidade"
                            />
                            <span className="text-gray-400 text-[11px]">{drink.unit}</span>
                          </div>

                          {/* Preço Unitário */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-500 font-medium">Valor:</span>
                            <span className="text-gray-400 text-[11px]">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              disabled={!drink.selected}
                              value={drink.price}
                              onChange={e => handleUpdateDrinkPrice(drink.id, parseFloat(e.target.value) || 0)}
                              className="w-16 text-right py-0.5 px-1 border border-gray-300 rounded font-bold text-xs bg-white text-amber-900 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-1 focus:ring-amber-500 outline-none"
                              title="Valor unitário da bebida/insumo"
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="text-right ml-auto sm:ml-0">
                            <span className="font-extrabold text-gray-900 text-xs">
                              {formatCurrency(drink.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-block C: Serviços & Mão de Obra */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-gray-700 uppercase">
                    <span>👨‍🍳 Serviços, Churrasqueiro & Equipe</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-normal">Subtotal: {formatCurrency(servicesSubtotal)}</span>
                      <button
                        type="button"
                        onClick={() => openAddItemModal('service')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] shadow-2xs transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {services.map(srv => (
                      <div
                        key={srv.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
                          srv.selected
                            ? 'bg-indigo-50/50 border-indigo-200'
                            : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={srv.selected}
                            onChange={() => handleToggleService(srv.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="font-medium text-gray-800">{srv.name}</span>
                          {srv.isCustom && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1 rounded font-semibold">custom</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">R$</span>
                          <input
                            type="number"
                            min="0"
                            disabled={!srv.selected}
                            value={srv.price}
                            onChange={e => handleUpdateServicePrice(srv.id, parseFloat(e.target.value) || 0)}
                            className="w-16 text-right py-0.5 border border-gray-300 rounded font-bold text-xs"
                          />
                          {srv.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveService(srv.id)}
                              className="text-gray-400 hover:text-red-600 p-0.5"
                              title="Excluir item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Financial Summary & Proposal Actions (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Proposal Summary Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5 sticky top-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-600" />
                    Resumo do Orçamento
                  </h3>
                  <p className="text-xs text-gray-500">Valores consolidados da proposta</p>
                </div>

                {/* Subtotals breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Carnes ({currentTotalMeatKg.toFixed(1)} kg):</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(meatsSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Acompanhamentos:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(sidesSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Bebidas & Suprimentos:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(drinksSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Serviços & Churrasqueiro:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(servicesSubtotal)}</span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex justify-between font-semibold text-gray-800">
                    <span>Subtotal de Gastos (Custos dos Itens):</span>
                    <span>{formatCurrency(overallSubtotal)}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 flex justify-between pb-1">
                    <span>Custo mínimo por pessoa (gastos):</span>
                    <span className="font-semibold text-gray-700">{formatCurrency(costPerPerson)} / pessoa</span>
                  </div>

                  {/* PRECIFICAÇÃO: VALOR TOTAL POR PESSOA (COM TUDO JÁ INCLUSO) */}
                  <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-50/80 border-2 border-emerald-300 rounded-xl p-4 space-y-3.5 mt-2 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-emerald-200/80 pb-2">
                      <div>
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                          <Users className="w-4 h-4 text-emerald-600" />
                          <span>Valor Fechado por Pessoa (Tudo Incluso)</span>
                        </span>
                        <p className="text-[11px] text-emerald-800/80 font-medium mt-0.5">
                          O valor digitado já inclui todos os gastos (carnes, acompanhamentos, bebidas, serviços) e o seu lucro.
                        </p>
                      </div>
                      {profit !== 0 && (
                        <button
                          type="button"
                          onClick={handleClearProfit}
                          className="text-[11px] text-emerald-700 hover:text-red-600 flex items-center gap-1 font-semibold transition-colors self-end sm:self-auto bg-white/80 border border-emerald-200 px-2 py-0.5 rounded-md"
                          title="Redefinir para preço de custo (lucro zero)"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Preço de Custo</span>
                        </button>
                      )}
                    </div>

                    {/* Campo Principal em Destaque */}
                    <div className="bg-white border-2 border-emerald-300 rounded-xl p-3 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-700">Quanto você vai cobrar por pessoa:</span>
                        <span className="text-emerald-800 bg-emerald-100/70 font-black px-2 py-0.5 rounded text-[11px]">
                          {totalGuests} {totalGuests === 1 ? 'convidado' : 'convidados'}
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-2 py-1">
                        {/* Botões de ajuste fino */}
                        <button
                          type="button"
                          onClick={() => handleTargetPricePerPersonChange(Math.max(1, (targetPricePerPerson > 0 ? targetPricePerPerson : (pricePerPerson || costPerPerson)) - 5))}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 transition-colors"
                          title="Diminuir R$ 5,00 por pessoa"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTargetPricePerPersonChange(Math.max(1, (targetPricePerPerson > 0 ? targetPricePerPerson : (pricePerPerson || costPerPerson)) - 1))}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 transition-colors"
                          title="Diminuir R$ 1,00 por pessoa"
                        >
                          -
                        </button>

                        {/* Input Central Grande */}
                        <div className="flex items-center gap-1.5 bg-emerald-50/40 border-2 border-emerald-400 rounded-xl px-3 py-1 shadow-inner focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition-all">
                          <span className="text-xl font-black text-emerald-700">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0,00"
                            value={targetPricePerPerson > 0 ? targetPricePerPerson : (pricePerPerson > 0 ? pricePerPerson : (costPerPerson > 0 ? costPerPerson : ''))}
                            onChange={e => handleTargetPricePerPersonChange(parseFloat(e.target.value) || 0)}
                            className="w-28 text-center text-2xl font-black text-emerald-950 bg-transparent outline-none"
                          />
                          <span className="text-xs font-bold text-gray-500">/ pessoa</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTargetPricePerPersonChange((targetPricePerPerson > 0 ? targetPricePerPerson : (pricePerPerson || costPerPerson)) + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 transition-colors"
                          title="Aumentar R$ 1,00 por pessoa"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTargetPricePerPersonChange((targetPricePerPerson > 0 ? targetPricePerPerson : (pricePerPerson || costPerPerson)) + 5)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 transition-colors"
                          title="Aumentar R$ 5,00 por pessoa"
                        >
                          +5
                        </button>
                      </div>

                      {/* Sugestões rápidas de valores */}
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Sugestões rápidas (com margem de lucro):</span>
                          <span className="text-gray-400">Custo base: {formatCurrency(costPerPerson)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { label: 'Custo', val: Math.round(costPerPerson) },
                            { label: '+20%', val: Math.round(costPerPerson * 1.20) },
                            { label: '+30%', val: Math.round(costPerPerson * 1.30) },
                            { label: '+40%', val: Math.round(costPerPerson * 1.40) },
                            { label: '+50%', val: Math.round(costPerPerson * 1.50) },
                          ].filter(s => s.val > 0).map(sug => (
                            <button
                              key={sug.label}
                              type="button"
                              onClick={() => handleTargetPricePerPersonChange(sug.val)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                Math.abs((pricePerPerson || 0) - sug.val) < 1
                                  ? 'bg-emerald-700 text-white shadow-xs'
                                  : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-900'
                              }`}
                            >
                              {sug.label} ({formatCurrency(sug.val)})
                            </button>
                          ))}
                          {/* Valores redondos comuns */}
                          {[60, 70, 80, 90, 100, 120].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleTargetPricePerPersonChange(val)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                Math.abs((pricePerPerson || 0) - val) < 0.5
                                  ? 'bg-emerald-700 text-white shadow-xs'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              R$ {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Quadro de Transparência: De onde vem esse valor */}
                    <div className="bg-white/90 border border-emerald-200 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-gray-800 border-b border-gray-100 pb-1.5">
                        <span>Detalhamento dos {formatCurrency(pricePerPerson)}/pessoa:</span>
                        <span className="text-[11px] text-gray-500">
                          Total da Proposta: {formatCurrency(finalTotal)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Gastos com Insumos</div>
                          <div className="text-sm font-black text-slate-800">
                            {formatCurrency(costPerPerson)} <span className="text-[10px] font-normal text-slate-500">/ pessoa</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Total gastos: {formatCurrency(overallSubtotal)}
                          </div>
                        </div>

                        <div className={`p-2 rounded border ${
                          profit > 0 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                            : profit < 0 
                              ? 'bg-red-50 border-red-200 text-red-900'
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}>
                          <div className="text-[10px] uppercase font-semibold flex items-center justify-between">
                            <span>Seu Lucro Líquido</span>
                            {currentProfitPercent > 0 && (
                              <span className="font-bold text-emerald-700">+{currentProfitPercent}%</span>
                            )}
                          </div>
                          <div className={`text-sm font-black ${profit < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                            {profit >= 0 ? '+' : ''}{formatCurrency(currentProfitPerPerson)} <span className="text-[10px] font-normal">/ pessoa</span>
                          </div>
                          <div className="text-[10px] mt-0.5 font-medium">
                            {profit > 0 ? (
                              <span>Lucro no evento: <strong>+{formatCurrency(profit)}</strong></span>
                            ) : profit < 0 ? (
                              <span className="text-red-600 font-bold">Prejuízo: {formatCurrency(profit)}</span>
                            ) : (
                              <span>Lucro zero (a preço de custo)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Alerta de prejuízo se valor por pessoa for menor que custo */}
                      {currentProfitPerPerson < 0 && (
                        <div className="bg-red-50 border border-red-300 rounded p-2 text-red-700 text-[11px] font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>
                            Atenção: O valor de {formatCurrency(pricePerPerson)}/pessoa está abaixo do custo mínimo dos itens ({formatCurrency(costPerPerson)}/pessoa).
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Opção Avançada: Ajustar pelo Lucro Total ou % */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedProfit(!showAdvancedProfit)}
                        className="text-[11px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{showAdvancedProfit ? 'Ocultar ajuste alternativo por Lucro/Margem' : 'Ou ajustar pelo Lucro Total em R$ ou Margem %'}</span>
                      </button>

                      {showAdvancedProfit && (
                        <div className="mt-2.5 p-2.5 bg-white border border-emerald-200 rounded-lg space-y-2 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                                Lucro Total Fixo (R$)
                              </label>
                              <div className="flex items-center gap-1">
                                <span className="text-emerald-700 font-bold">+ R$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={profit || ''}
                                  placeholder="0,00"
                                  onChange={e => handleProfitTotalChange(Math.max(0, parseFloat(e.target.value) || 0))}
                                  className="w-full text-right py-1 px-2 border border-gray-300 rounded text-xs font-bold text-emerald-900 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                                Margem Rápida sobre Custos (%)
                              </label>
                              <div className="flex items-center gap-1 pt-0.5">
                                {[10, 20, 30, 40, 50].map(pct => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => handleApplyProfitPercent(pct)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      Math.abs(currentProfitPercent - pct) < 0.5 && profit > 0
                                        ? 'bg-emerald-700 text-white shadow-xs'
                                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                    }`}
                                  >
                                    +{pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Discount input */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-600">Desconto Especial:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">- R$</span>
                      <input
                        type="number"
                        min="0"
                        value={discount || ''}
                        placeholder="0,00"
                        onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-20 text-right py-1 px-2 border border-gray-300 rounded text-xs text-red-600 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Final Total Display */}
                <div className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-xl p-4 space-y-1 shadow-md">
                  <div className="flex justify-between items-center text-xs text-red-100 uppercase tracking-wider font-semibold">
                    <span>Valor Total da Proposta</span>
                    {profit > 0 && (
                      <span className="bg-red-900/60 border border-red-400/40 text-[10px] px-2 py-0.5 rounded-full font-bold text-emerald-300 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        Lucro: +{formatCurrency(profit)} {currentProfitPerPerson > 0 ? `(${formatCurrency(currentProfitPerPerson)}/pes)` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-black tracking-tight">
                    {formatCurrency(finalTotal)}
                  </div>
                  {totalGuests > 0 && (
                    <div className="text-xs text-red-100 pt-1 border-t border-red-500/50 flex justify-between">
                      <span>Valor por Convidado ({totalGuests} pessoas):</span>
                      <strong className="text-white font-black">{formatCurrency(pricePerPerson)} / pessoa (tudo incluso)</strong>
                    </div>
                  )}
                  <div className="text-[11px] text-red-200 mt-2">
                    Sinal 50% para reserva: <strong>{formatCurrency(finalTotal * 0.5)}</strong>
                  </div>
                </div>

                {/* Commercial Terms & Notes */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                      Forma & Condições de Pagamento
                    </label>
                    <textarea
                      rows={2}
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                      Observações / Detalhes para o Cliente
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Incluso carvão, tábuas de corte, facas e grelhas profissionais."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                      Status da Proposta
                    </label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold outline-none"
                    >
                      <option value="pendente">⏳ Em Aberto / Rascunho</option>
                      <option value="enviado">📲 Proposta Enviada ao Cliente</option>
                      <option value="aprovado">✅ Aprovado / Confirmado</option>
                      <option value="realizado">🎉 Evento Realizado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {/* Primary Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveQuote}
                    disabled={isSaving}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isSaving ? 'Salvando...' : editingQuoteId ? 'Atualizar Orçamento Salvo' : 'Salvar Orçamento'}</span>
                  </button>

                  {/* Send to WhatsApp */}
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Enviar Proposta via WhatsApp</span>
                  </button>

                  {/* Export Proposta em PDF */}
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
                    title="Baixar proposta formal em PDF para enviar ao cliente"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Baixar Proposta em PDF</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Print A4 Proposal */}
                    <button
                      type="button"
                      onClick={handlePrintProposal}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-gray-600" />
                      <span>Imprimir Proposta</span>
                    </button>

                    {/* Copy text */}
                    <button
                      type="button"
                      onClick={handleCopyProposal}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                      <span>Copiar Mensagem</span>
                    </button>
                  </div>

                  {/* Butcher / Chef Shopping List */}
                  <button
                    type="button"
                    onClick={handlePrintChefList}
                    className="w-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ClipboardList className="w-4 h-4 text-amber-700" />
                    <span>Ficha do Churrasqueiro (Lista de Carnes em KG)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: Orçamentos Salvos (Saved Quotes) */
        <div className="space-y-6">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente ou telefone..."
                value={quotesSearch}
                onChange={e => setQuotesSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">Status:</span>
              {['todos', 'pendente', 'enviado', 'aprovado', 'realizado', 'cancelado'].map(st => (
                <button
                  key={st}
                  onClick={() => setQuotesStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap capitalize transition-colors ${
                    quotesStatusFilter === st
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Quotes List */}
          {loadingQuotes ? (
            <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-500">
              Carregando propostas de churrasco...
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-gray-200 text-center space-y-3">
              <Flame className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="text-base font-bold text-gray-700">Nenhum orçamento encontrado</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {quotesSearch || quotesStatusFilter !== 'todos'
                  ? 'Tente ajustar os filtros de busca para encontrar propostas.'
                  : 'Crie seu primeiro orçamento de evento usando a calculadora de carnes acima!'}
              </p>
              <button
                onClick={() => setActiveTab('calculadora')}
                className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Criar Novo Orçamento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredQuotes.map(quote => {
                const statusBadge =
                  quote.status === 'aprovado'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : quote.status === 'enviado'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : quote.status === 'realizado'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : quote.status === 'cancelado'
                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                    : 'bg-amber-100 text-amber-800 border-amber-200';

                return (
                  <div
                    key={quote.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative"
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h3 className="font-bold text-base text-gray-900">{quote.clientName}</h3>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {quote.clientPhone || 'Sem telefone'}
                          </div>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${statusBadge}`}>
                          {quote.status}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div className="bg-gray-50 rounded-lg p-2.5 space-y-1 my-3 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Data do Evento:</span>
                          <strong>
                            {quote.eventDate
                              ? new Date(quote.eventDate + 'T12:00:00').toLocaleDateString('pt-BR')
                              : 'A definir'}{' '}
                            {quote.eventTime ? `(${quote.eventTime})` : ''}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Convidados:</span>
                          <span>
                            <strong>{quote.totalGuests} pessoas</strong>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Carne Total:</span>
                          <span className="font-bold text-red-600">
                            {quote.totalMeatKg.toFixed(2).replace('.', ',')} kg
                          </span>
                        </div>
                        {quote.eventLocation && (
                          <div className="truncate text-gray-500" title={quote.eventLocation}>
                            📍 {quote.eventLocation}
                          </div>
                        )}
                      </div>

                      {/* Carnes Preview */}
                      <div className="text-xs text-gray-600 mb-4">
                        <span className="font-bold text-gray-700 block mb-1">Carnes Inclusas:</span>
                        <div className="flex flex-wrap gap-1">
                          {quote.meats.slice(0, 4).map((m, i) => (
                            <span key={i} className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
                              {m.name}: {m.kg.toFixed(1)}kg
                            </span>
                          ))}
                          {quote.meats.length > 4 && (
                            <span className="text-gray-400 text-[11px]">
                              +{quote.meats.length - 4} outros cortes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial & Actions */}
                    <div className="pt-3 border-t border-gray-100 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">Total da Proposta</div>
                          <div className="text-xl font-black text-gray-900">{formatCurrency(quote.total)}</div>
                          {quote.profit !== undefined && quote.profit > 0 && (
                            <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                              <TrendingUp className="w-3 h-3 text-emerald-600" />
                              <span>
                                Lucro: +{formatCurrency(quote.profit)}
                                {quote.profitPerPerson ? ` (${formatCurrency(quote.profitPerPerson)}/pes)` : ''}
                                {quote.profitPercent ? ` • ${quote.profitPercent}%` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        {quote.totalGuests > 0 && (
                          <div className="text-right text-xs text-gray-500">
                            {formatCurrency(quote.pricePerPerson)}/pessoa
                          </div>
                        )}
                      </div>

                      {/* Status Selector */}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 font-medium">Mudar:</span>
                        <select
                          value={quote.status}
                          onChange={e => handleUpdateStatus(quote.id!, e.target.value as any)}
                          className="text-xs bg-gray-50 border border-gray-200 rounded py-1 px-1.5 font-semibold text-gray-700"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="enviado">Enviado</option>
                          <option value="aprovado">Aprovado</option>
                          <option value="realizado">Realizado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>

                      {/* Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <button
                          onClick={() => handleLoadQuote(quote)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 p-2 rounded-lg font-bold text-xs flex items-center justify-center"
                          title="Abrir na Calculadora para Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const msg = formatWhatsAppProposal(quote, storeSettings);
                            const encoded = encodeURIComponent(msg);
                            let phone = quote.clientPhone.replace(/\D/g, '');
                            if (phone.length > 0 && !phone.startsWith('55')) phone = '55' + phone;
                            window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`, '_blank');
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-2 rounded-lg font-bold text-xs flex items-center justify-center"
                          title="Reenviar pelo WhatsApp"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            exportChurrascoProposalPDF(quote, storeSettings);
                            setSuccessMessage(`PDF de ${quote.clientName} baixado com sucesso!`);
                            setTimeout(() => setSuccessMessage(''), 4000);
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-700 p-2 rounded-lg font-bold text-xs flex items-center justify-center"
                          title="Baixar Proposta em PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => printChurrascoProposal(quote, storeSettings)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg font-bold text-xs flex items-center justify-center"
                          title="Imprimir Proposta A4"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(quote.id!)}
                          className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-700 p-2 rounded-lg font-bold text-xs flex items-center justify-center"
                          title="Excluir Orçamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Delete Confirmation Modal */}
                    {deleteConfirmId === quote.id && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl p-4 flex flex-col justify-center items-center text-center z-10 space-y-3">
                        <p className="text-sm font-bold text-gray-800">
                          Excluir orçamento de {quote.clientName}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 text-xs bg-gray-200 text-gray-800 rounded font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(quote.id!)}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded font-bold"
                          >
                            Sim, Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Adicionar Item Personalizado (Carne, Acompanhamento, Bebida, Serviço) */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                {itemModalCategory === 'meat' && <Beef className="w-5 h-5 text-red-600" />}
                {itemModalCategory === 'side' && <Sparkles className="w-5 h-5 text-emerald-600" />}
                {itemModalCategory === 'drink' && <Flame className="w-5 h-5 text-amber-600" />}
                {itemModalCategory === 'service' && <Users className="w-5 h-5 text-indigo-600" />}
                {itemModalCategory === 'meat' && 'Adicionar Novo Corte de Carne'}
                {itemModalCategory === 'side' && 'Adicionar Acompanhamento'}
                {itemModalCategory === 'drink' && 'Adicionar Bebida / Insumo'}
                {itemModalCategory === 'service' && 'Adicionar Serviço / Equipe'}
              </h3>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewItem} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nome do Item / Descrição:
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    itemModalCategory === 'meat'
                      ? 'Ex: Picanha Black Angus, Maminha na Manteiga...'
                      : itemModalCategory === 'side'
                      ? 'Ex: Vinagrete Especial da Casa, Farofa de Bacon...'
                      : itemModalCategory === 'drink'
                      ? 'Ex: Chopp Pilsen 50L, Refrigerante 2L...'
                      : 'Ex: Garçom Adicional, Churrasqueiro Master...'
                  }
                  value={itemFormName}
                  onChange={e => setItemFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
              </div>

              {itemModalCategory === 'meat' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Categoria:</label>
                    <select
                      value={itemFormMeatCategory}
                      onChange={e => setItemFormMeatCategory(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white outline-none"
                    >
                      <option value="Bovina">Bovina</option>
                      <option value="Suína">Suína</option>
                      <option value="Frango">Frango</option>
                      <option value="Embutidos">Embutidos</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Percentual no Rateio (%):</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={itemFormPercentage}
                      onChange={e => setItemFormPercentage(parseInt(e.target.value) || 15)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {itemModalCategory === 'meat' ? 'Quantidade Inicial (KG):' : 'Quantidade:'}
                  </label>
                  <input
                    type="number"
                    step={itemModalCategory === 'meat' ? '0.25' : '1'}
                    min="0.1"
                    value={itemFormQty}
                    onChange={e => setItemFormQty(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white outline-none"
                  />
                </div>

                {itemModalCategory !== 'meat' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Unidade de Medida:</label>
                    <input
                      type="text"
                      placeholder="Ex: kg, garrafa, fardo, diária, porção"
                      value={itemFormUnit}
                      onChange={e => setItemFormUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {itemModalCategory === 'meat' ? 'Preço por KG (R$):' : 'Preço Unitário / Valor (R$):'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={itemFormPrice}
                    onChange={e => setItemFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                  Dado interno do churrasqueiro (não aparece avulso para o cliente).
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar ao Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Puxar Carnes do Estoque de Produtos */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-600" />
                Adicionar Produto do Estoque / Catálogo
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome ou categoria..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none"
              />
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {productsInventory
                .filter(p => p.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                .map(prod => (
                  <div
                    key={prod.id}
                    className="py-3 flex justify-between items-center hover:bg-gray-50 px-2 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{prod.name}</div>
                      <div className="text-xs text-gray-500">
                        {prod.category} • Preço: {formatCurrency(prod.wholesalePrice || prod.price)}/kg
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportProduct(prod)}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>
                ))}
              {productsInventory.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Nenhum produto cadastrado no estoque.
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 flex justify-end">
              <button
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
