import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Calendar, 
  Phone, 
  Send, 
  Download, 
  Printer, 
  Copy, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Truck, 
  DollarSign, 
  Package, 
  Check, 
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  User,
  MapPin,
  ListChecks,
  Layers,
  ChevronRight,
  ArrowLeft,
  Flame,
  Wine,
  Box,
  Share2,
  FileCheck
} from 'lucide-react';
import { ShoppingList, ShoppingListItem, ShoppingListStatus } from '../types/purchases';
import { 
  exportShoppingListPDF, 
  formatShoppingListWhatsApp, 
  formatShoppingListThermal, 
  formatCurrencyBRL 
} from '../lib/purchaseOrderPdf';
import { thermalPrinter } from '../lib/printer';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { copyToClipboard } from '../lib/clipboard';

// Category presets with matching icons & styling
const CATEGORIES = [
  { id: 'Carnes & Açougue', label: 'Carnes & Açougue', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'Bebidas', label: 'Bebidas & Bar', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Carvão & Acessórios', label: 'Carvão & Lenha', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'Embalagens & Descartáveis', label: 'Embalagens', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Mercearia & Temperos', label: 'Temperos & Sal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Limpeza & Higiene', label: 'Limpeza', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'Hortifruti', label: 'Hortifruti', color: 'bg-lime-50 text-lime-800 border-lime-200' },
  { id: 'Outros', label: 'Outros Insumos', color: 'bg-gray-50 text-gray-700 border-gray-200' }
];

const COMMON_UNITS = [
  { id: 'kg', label: 'kg (quilo)' },
  { id: 'un', label: 'un (unidade)' },
  { id: 'cx', label: 'cx (caixa)' },
  { id: 'pct', label: 'pct (pacote)' },
  { id: 'fd', label: 'fd (fardo)' },
  { id: 'saco', label: 'saco' },
  { id: 'lata', label: 'lata' },
  { id: 'l', label: 'litro' },
];

export default function Compras() {
  const { storeName, whatsappNumber } = useStoreSettings();
  
  // Navigation tabs: 'listas' | 'montador' | 'conferencia'
  const [activeTab, setActiveTab] = useState<'listas' | 'montador' | 'conferencia'>('listas');
  
  // Lists state
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Available products for autocomplete / quick add
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ShoppingListStatus>('todos');
  
  // Active/Editing list
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [activeListForConference, setActiveListForConference] = useState<ShoppingList | null>(null);
  const [listToDelete, setListToDelete] = useState<ShoppingList | null>(null);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Form State for "Montar Lista"
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ShoppingListStatus>('aberta');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  
  // New item inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Carnes & Açougue');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState<string>('kg');
  const [newItemEstimatedPrice, setNewItemEstimatedPrice] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [productCatalogSearch, setProductCatalogSearch] = useState('');
  
  // Conference mode filter
  const [conferenceFilter, setConferenceFilter] = useState<'todos' | 'pendentes' | 'comprados'>('todos');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Shopping Lists from Firestore ('shopping_lists' and fallbacks from 'purchase_orders')
  useEffect(() => {
    const listsRef = collection(db, 'shopping_lists');
    const q = query(listsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ShoppingList[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setShoppingLists(loaded);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching shopping lists:', error);
        handleFirestoreError(error, OperationType.LIST, 'shopping_lists');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Fetch products to allow 1-click import into shopping list
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        const prods: any[] = [];
        snap.forEach((d) => prods.push({ id: d.id, ...d.data() }));
        setAvailableProducts(prods);
      } catch (err) {
        console.warn('Could not load products for quick add:', err);
      }
    };
    fetchProducts();
  }, []);

  // Quick low stock products calculation
  const lowStockProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      if (p.stock === undefined || p.minStock === undefined) return false;
      return Number(p.stock) <= Number(p.minStock);
    });
  }, [availableProducts]);

  // Catalog filtered items for quick pick
  const filteredCatalog = useMemo(() => {
    if (!productCatalogSearch.trim()) return availableProducts.slice(0, 16);
    const term = productCatalogSearch.toLowerCase();
    return availableProducts.filter(
      (p) => (p.name && p.name.toLowerCase().includes(term)) || (p.category && p.category.toLowerCase().includes(term))
    ).slice(0, 20);
  }, [availableProducts, productCatalogSearch]);

  // Reset Builder Form
  const resetBuilderForm = () => {
    setEditingListId(null);
    setTitle('');
    setDestination('');
    setSupplierPhone('');
    setBuyerName('');
    setTargetDate(new Date().toISOString().split('T')[0]);
    setStatus('aberta');
    setNotes('');
    setItems([]);
    setNewItemName('');
    setNewItemCategory('Carnes & Açougue');
    setNewItemQty('1');
    setNewItemUnit('kg');
    setNewItemEstimatedPrice('');
    setNewItemNotes('');
    setProductCatalogSearch('');
  };

  // Open Builder for a brand new list
  const handleOpenNewList = () => {
    resetBuilderForm();
    setTitle(`Compras da Semana - ${new Date().toLocaleDateString('pt-BR')}`);
    setActiveTab('montador');
  };

  // Edit existing list in builder
  const handleEditList = (list: ShoppingList) => {
    setEditingListId(list.id || null);
    setTitle(list.title || '');
    setDestination(list.destination || list.supplierName || '');
    setSupplierPhone(list.supplierPhone || '');
    setBuyerName(list.buyerName || '');
    setTargetDate(list.targetDate || new Date().toISOString().split('T')[0]);
    setStatus(list.status || 'aberta');
    setNotes(list.notes || '');
    setItems(list.items || []);
    setActiveTab('montador');
  };

  // Duplicate an existing list (e.g. repeat last week's shopping list)
  const handleDuplicateList = (list: ShoppingList) => {
    resetBuilderForm();
    setTitle(`${list.title || 'Lista'} (Nova)`);
    setDestination(list.destination || list.supplierName || '');
    setSupplierPhone(list.supplierPhone || '');
    setBuyerName(list.buyerName || '');
    setTargetDate(new Date().toISOString().split('T')[0]);
    setStatus('aberta');
    setNotes(list.notes || '');
    // Reset all checked states to false for the new shopping trip
    const clonedItems = (list.items || []).map((it) => ({
      ...it,
      id: `item_${Date.now()}_${Math.random()}`,
      checked: false,
    }));
    setItems(clonedItems);
    setActiveTab('montador');
    showToast('Lista duplicada! Itens carregados com caixas desmarcadas.');
  };

  // Open Conference / Checklist Mode
  const handleOpenConference = (list: ShoppingList) => {
    setActiveListForConference(list);
    setConferenceFilter('todos');
    setActiveTab('conferencia');
  };

  // Add Item to Builder
  const handleAddItemToBuilder = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) {
      alert('Informe o nome ou descrição do item.');
      return;
    }

    const qty = parseFloat(newItemQty.replace(',', '.')) || 1;
    if (qty <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }

    const estPrice = newItemEstimatedPrice ? parseFloat(newItemEstimatedPrice.replace(',', '.')) || 0 : undefined;
    const totalEst = estPrice ? Number((qty * estPrice).toFixed(2)) : undefined;

    const newItem: ShoppingListItem = {
      id: `item_${Date.now()}_${Math.random()}`,
      name: trimmed,
      category: newItemCategory,
      quantity: newItemUnit === 'kg' ? Number(qty.toFixed(3)) : Math.round(qty),
      unit: newItemUnit,
      estimatedPrice: estPrice,
      totalEstimated: totalEst,
      checked: false,
      notes: newItemNotes.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemQty('1');
    setNewItemEstimatedPrice('');
    setNewItemNotes('');
  };

  // Quick add from Store Catalog chip
  const handleAddFromCatalog = (product: any) => {
    const unit = product.unit === 'kg' ? 'kg' : 'un';
    setNewItemName(product.name);
    setNewItemCategory(product.category || 'Carnes & Açougue');
    setNewItemUnit(unit);
    if (product.costPrice && product.costPrice > 0) {
      setNewItemEstimatedPrice(String(product.costPrice));
    } else if (product.price && product.price > 0) {
      setNewItemEstimatedPrice(String(product.price));
    }
  };

  // Quick Auto-Import all products with low stock
  const handleImportAllLowStock = () => {
    if (lowStockProducts.length === 0) {
      alert('Nenhum produto cadastrado com estoque no limite ou zerado no momento.');
      return;
    }

    const importedItems: ShoppingListItem[] = lowStockProducts.map((p) => {
      const currentStock = Number(p.stock) || 0;
      const minStock = Number(p.minStock) || 5;
      const suggestedQty = Math.max(1, (minStock * 2) - currentStock);
      const unit = p.unit === 'kg' ? 'kg' : 'un';
      const estPrice = p.costPrice || p.price || undefined;
      const totalEst = estPrice ? Number((suggestedQty * estPrice).toFixed(2)) : undefined;

      return {
        id: `item_low_${p.id}_${Date.now()}`,
        productId: p.id,
        name: p.name,
        category: p.category || 'Carnes & Açougue',
        quantity: unit === 'kg' ? Number(suggestedQty.toFixed(3)) : Math.round(suggestedQty),
        unit,
        estimatedPrice: estPrice,
        totalEstimated: totalEst,
        checked: false,
        notes: `Estoque atual: ${currentStock} (Mín: ${minStock})`,
      };
    });

    setItems((prev) => [...prev, ...importedItems]);
    showToast(`${importedItems.length} produtos com estoque baixo foram adicionados à lista!`);
  };

  // Remove Item from builder
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Adjust item quantity in builder
  const handleAdjustItemQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = Math.max(it.unit === 'kg' ? 0.1 : 1, it.quantity + delta);
        const totalEst = it.estimatedPrice ? Number((newQty * it.estimatedPrice).toFixed(2)) : undefined;
        return {
          ...it,
          quantity: it.unit === 'kg' ? Number(newQty.toFixed(3)) : Math.round(newQty),
          totalEstimated: totalEst,
        };
      })
    );
  };

  // Calculate total estimated of current builder items
  const currentTotalEstimated = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.totalEstimated || 0), 0);
  }, [items]);

  // Save Shopping List to Firestore
  const handleSaveList = async (targetStatus?: ShoppingListStatus, andOpenWhatsApp: boolean = false) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      alert('Por favor, informe um título para a Lista de Compras.');
      return;
    }

    if (items.length === 0) {
      alert('Adicione pelo menos um item à lista de compras antes de salvar.');
      return;
    }

    const finalStatus: ShoppingListStatus = targetStatus || status;

    const listData: Omit<ShoppingList, 'id'> = {
      title: trimmedTitle,
      destination: destination.trim() || undefined,
      supplierName: destination.trim() || undefined,
      supplierPhone: supplierPhone.trim() || undefined,
      buyerName: buyerName.trim() || undefined,
      targetDate: targetDate || new Date().toISOString().split('T')[0],
      status: finalStatus,
      items,
      totalEstimated: currentTotalEstimated,
      notes: notes.trim() || undefined,
      createdAt: editingListId ? (shoppingLists.find((l) => l.id === editingListId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      let savedId = editingListId;
      if (editingListId) {
        await updateDoc(doc(db, 'shopping_lists', editingListId), listData);
        showToast('Lista de compras atualizada com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'shopping_lists'), listData);
        savedId = docRef.id;
        showToast('Lista de compras criada com sucesso!');
      }

      const completeList: ShoppingList = { id: savedId || undefined, ...listData };

      if (andOpenWhatsApp) {
        handleSendWhatsApp(completeList);
      }

      setActiveTab('listas');
      resetBuilderForm();
    } catch (err: any) {
      console.error('Error saving shopping list:', err);
      handleFirestoreError(err, OperationType.WRITE, 'shopping_lists');
      alert('Erro ao salvar lista de compras: ' + (err.message || 'Tente novamente.'));
    }
  };

  // Toggle item check in conference mode (realtime sync with Firestore)
  const handleToggleItemCheckInConference = async (itemId: string) => {
    if (!activeListForConference || !activeListForConference.id) return;

    const updatedItems = (activeListForConference.items || []).map((it) => {
      if (it.id === itemId) {
        return { ...it, checked: !it.checked };
      }
      return it;
    });

    const allChecked = updatedItems.length > 0 && updatedItems.every((it) => it.checked);
    const newStatus: ShoppingListStatus = allChecked ? 'concluida' : 'em_compras';

    const updatedList: ShoppingList = {
      ...activeListForConference,
      items: updatedItems,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      completedAt: allChecked ? new Date().toISOString() : undefined,
    };

    setActiveListForConference(updatedList);

    try {
      await updateDoc(doc(db, 'shopping_lists', activeListForConference.id), {
        items: updatedItems,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(allChecked ? { completedAt: new Date().toISOString() } : {}),
      });
    } catch (err) {
      console.error('Error toggling shopping item:', err);
    }
  };

  // Mark all items as checked or unchecked
  const handleToggleAllConference = async (checkAll: boolean) => {
    if (!activeListForConference || !activeListForConference.id) return;

    const updatedItems = (activeListForConference.items || []).map((it) => ({
      ...it,
      checked: checkAll,
    }));

    const newStatus: ShoppingListStatus = checkAll ? 'concluida' : 'em_compras';

    const updatedList: ShoppingList = {
      ...activeListForConference,
      items: updatedItems,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(checkAll ? { completedAt: new Date().toISOString() } : {}),
    };

    setActiveListForConference(updatedList);

    try {
      await updateDoc(doc(db, 'shopping_lists', activeListForConference.id), {
        items: updatedItems,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(checkAll ? { completedAt: new Date().toISOString() } : {}),
      });
      showToast(checkAll ? 'Todos os itens marcados como conferidos!' : 'Itens desmarcados.');
    } catch (err) {
      console.error('Error bulk updating shopping items:', err);
    }
  };

  // Send WhatsApp with PDF Download & Text
  const handleSendWhatsApp = (list: ShoppingList) => {
    // 1. Download PDF automatically for the user to attach
    exportShoppingListPDF(list, { storeName, whatsappNumber });

    // 2. Open WhatsApp with formatted text
    const text = formatShoppingListWhatsApp(list, { storeName, whatsappNumber });
    const encoded = encodeURIComponent(text);
    const cleanPhone = (list.supplierPhone || '').replace(/\D/g, '');

    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

    window.open(url, '_blank');

    showToast('PDF da Lista baixado e WhatsApp aberto! Basta anexar o arquivo na conversa.');
  };

  // Export PDF directly
  const handleExportPDF = (list: ShoppingList) => {
    exportShoppingListPDF(list, { storeName, whatsappNumber });
    showToast('Download do PDF da lista de compras iniciado!');
  };

  // Copy WhatsApp message text to clipboard
  const handleCopyMessage = async (list: ShoppingList) => {
    const text = formatShoppingListWhatsApp(list, { storeName, whatsappNumber });
    const success = await copyToClipboard(text);
    if (success) {
      showToast('Lista copiada para a área de transferência! Pronta para colar no WhatsApp.');
    } else {
      alert('Não foi possível copiar automaticamente.');
    }
  };

  // Print Thermal 80mm
  const handlePrintThermal = async (list: ShoppingList) => {
    const text = formatShoppingListThermal(list, { storeName, whatsappNumber });
    try {
      await thermalPrinter.print(text);
      showToast('Lista impressa na impressora térmica Bluetooth!');
    } catch (e: any) {
      console.warn('Bluetooth print failed, opening standard print preview fallback:', e);
      // Fallback: open clean print slip window
      const printWindow = window.open('', '_blank', 'width=380,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Lista de Compras - ${list.title}</title>
              <style>
                body { font-family: monospace; font-size: 12px; margin: 10px; white-space: pre-wrap; line-height: 1.4; color: black; }
                @media print { body { margin: 0; } }
              </style>
            </head>
            <body>${text}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        alert('Impressão térmica via Bluetooth não conectada. Conecte nas Configurações ou utilize o PDF para impressão.');
      }
    }
  };

  // Delete List
  const handleDeleteList = async () => {
    if (!listToDelete || !listToDelete.id) return;
    try {
      await deleteDoc(doc(db, 'shopping_lists', listToDelete.id));
      showToast(`Lista "${listToDelete.title}" excluída com sucesso.`);
      setListToDelete(null);
      if (activeListForConference?.id === listToDelete.id) {
        setActiveTab('listas');
        setActiveListForConference(null);
      }
    } catch (err: any) {
      console.error('Error deleting list:', err);
      alert('Erro ao excluir lista: ' + (err.message || ''));
    }
  };

  // Filtered lists for main tab
  const filteredLists = useMemo(() => {
    return shoppingLists.filter((l) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (l.title || '').toLowerCase().includes(term) ||
        (l.destination || '').toLowerCase().includes(term) ||
        (l.supplierName || '').toLowerCase().includes(term) ||
        (l.items || []).some((it) => it.name.toLowerCase().includes(term));

      const matchStatus = statusFilter === 'todos' || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [shoppingLists, searchTerm, statusFilter]);

  // Status Badge Helper
  const getStatusBadge = (st: ShoppingListStatus) => {
    switch (st) {
      case 'aberta':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Aberta / Planejada
          </span>
        );
      case 'em_compras':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <ShoppingBag className="w-3 h-3 text-blue-600" /> Em Compras
          </span>
        );
      case 'concluida':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Compras Concluídas
          </span>
        );
      case 'arquivada':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            <Layers className="w-3 h-3 text-gray-500" /> Arquivada
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 select-none sm:select-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-[fadeIn_0.2s_ease-out]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-50 text-red-700 rounded-2xl border border-red-100 shrink-0 shadow-xs">
            <ListChecks className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Gestão de Suprimentos
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 font-medium">WhatsApp & PDF Imprimível</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Lista de Compras
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Monte listas de compras de carnes, bebidas e embalagens com facilidade, confira itens no carrinho e envie o PDF oficial no WhatsApp.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab !== 'listas' && (
            <button
              onClick={() => setActiveTab('listas')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-2 text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ver Minhas Listas</span>
            </button>
          )}

          {activeTab === 'listas' && (
            <>
              {lowStockProducts.length > 0 && (
                <button
                  onClick={() => {
                    handleOpenNewList();
                    setTimeout(() => handleImportAllLowStock(), 100);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                  title="Cria lista com produtos abaixo do estoque mínimo"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Repor Estoque Baixo ({lowStockProducts.length})</span>
                </button>
              )}

              <button
                onClick={handleOpenNewList}
                className="bg-red-600 hover:bg-red-700 text-white font-black py-3 px-5 sm:px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-5 h-5" />
                <span>Montar Nova Lista</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LISTAS DE COMPRAS (Overview & Saved Lists)                          */}
      {/* ========================================================================= */}
      {activeTab === 'listas' && (
        <div className="space-y-6">
          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Listas Salvas
                </p>
                <p className="text-2xl font-black text-gray-900 leading-none">
                  {shoppingLists.length}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Registros totais</p>
              </div>
              <div className="p-3 bg-gray-50 text-gray-700 rounded-xl">
                <ListChecks className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                  Abertas / A Fazer
                </p>
                <p className="text-2xl font-black text-amber-700 leading-none">
                  {shoppingLists.filter((l) => l.status === 'aberta').length}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Planejadas para compra</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                  Em Compras
                </p>
                <p className="text-2xl font-black text-blue-700 leading-none">
                  {shoppingLists.filter((l) => l.status === 'em_compras').length}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Comprador no mercado</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                  Concluídas
                </p>
                <p className="text-2xl font-black text-emerald-700 leading-none">
                  {shoppingLists.filter((l) => l.status === 'concluida').length}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Itens comprados</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filters & Search Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar lista por nome, local (Atacadão, Ceasa, Frigorífico) ou item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {(
                [
                  { id: 'todos', label: 'Todas' },
                  { id: 'aberta', label: 'Abertas' },
                  { id: 'em_compras', label: 'Em Compras' },
                  { id: 'concluida', label: 'Concluídas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lists Grid / Cards */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-red-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Carregando listas de compras...</p>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center max-w-xl mx-auto">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ListChecks className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {searchTerm || statusFilter !== 'todos' ? 'Nenhuma lista encontrada com estes filtros' : 'Nenhuma lista de compras cadastrada'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Crie sua primeira lista de compras para organizar o que precisa comprar no Atacadão, Frigorífico, Ceasa ou mercado local.
              </p>
              <button
                onClick={handleOpenNewList}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all inline-flex items-center gap-2 text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Montar Primeira Lista</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLists.map((list) => {
                const totalItems = list.items?.length || 0;
                const checkedItems = (list.items || []).filter((it) => it.checked).length;
                const progressPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

                return (
                  <div
                    key={list.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header: Title & Status */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex-1">
                          <h3 className="text-base font-black text-gray-900 leading-snug line-clamp-1">
                            {list.title}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="font-semibold text-gray-700 truncate">
                              {list.destination || list.supplierName || 'Mercado Geral'}
                            </span>
                          </div>
                        </div>
                        <div>{getStatusBadge(list.status)}</div>
                      </div>

                      {/* Date & Meta */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium mb-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {list.targetDate
                            ? new Date(list.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')
                            : new Date(list.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        {list.buyerName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            {list.buyerName}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar (Conferência) */}
                      <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-gray-600">Progresso da Compra:</span>
                          <span className={progressPct === 100 ? 'text-emerald-700' : 'text-gray-900'}>
                            {checkedItems} de {totalItems} itens ({progressPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progressPct === 100 ? 'bg-emerald-500' : 'bg-red-600'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Top Preview Items */}
                      <div className="space-y-1 mb-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Principais Itens:
                        </p>
                        <div className="space-y-1">
                          {(list.items || []).slice(0, 3).map((it) => (
                            <div key={it.id} className="text-xs text-gray-600 flex items-center justify-between">
                              <span className="truncate pr-2">• {it.name}</span>
                              <span className="font-bold text-gray-700 shrink-0">
                                {it.quantity} {it.unit}
                              </span>
                            </div>
                          ))}
                          {totalItems > 3 && (
                            <p className="text-[11px] text-gray-400 italic">
                              + {totalItems - 3} outros itens na lista
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      {/* Primary Actions Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenConference(list)}
                          className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                          title="Abrir checklist para ticar no mercado"
                        >
                          <CheckSquare className="w-4 h-4" />
                          <span>Checklist</span>
                        </button>

                        <button
                          onClick={() => handleSendWhatsApp(list)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                          title="Baixa o PDF e abre no WhatsApp"
                        >
                          <Send className="w-4 h-4" />
                          <span>WhatsApp</span>
                        </button>
                      </div>

                      {/* Secondary Utility Row */}
                      <div className="flex items-center justify-between text-gray-500 pt-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleExportPDF(list)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-900 transition-colors"
                            title="Baixar PDF para impressão"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintThermal(list)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-900 transition-colors"
                            title="Imprimir cupom na impressora térmica"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyMessage(list)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-900 transition-colors"
                            title="Copiar texto da lista"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateList(list)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-900 transition-colors"
                            title="Duplicar para uma nova compra semanal"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditList(list)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-blue-600 transition-colors"
                            title="Editar lista"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setListToDelete(list)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-red-600 transition-colors"
                            title="Excluir lista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTADOR DE LISTA DE COMPRAS (Interactive Builder)                  */}
      {/* ========================================================================= */}
      {activeTab === 'montador' && (
        <div className="space-y-6">
          {/* Top Bar for Builder */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('listas')}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
                title="Voltar para as listas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-black text-gray-900">
                  {editingListId ? 'Editar Lista de Compras' : 'Montar Lista de Compras'}
                </h2>
                <p className="text-xs text-gray-500">
                  Preencha os itens necessários e salve para gerar o PDF ou enviar no WhatsApp.
                </p>
              </div>
            </div>

            {/* Quick Auto-Import Low Stock Button */}
            {lowStockProducts.length > 0 && (
              <button
                onClick={handleImportAllLowStock}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>+ Adicionar {lowStockProducts.length} Itens em Falta no Estoque</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form & Item Adder (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Card 1: Informações Gerais da Lista */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-red-600" />
                  1. Dados da Lista
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Título da Lista de Compras *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Compras Atacadão, Reposição Semanal Açougue, Feira de Quarta"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Destino / Local / Fornecedor
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Atacadão, Ceasa, Frigorífico Silva..."
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Data Prevista da Compra
                    </label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      WhatsApp para Envio (Opcional)
                    </label>
                    <input
                      type="tel"
                      placeholder="Ex: 11999999999"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Comprador / Responsável (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Roberto, Gerente, Churrasqueiro..."
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Adicionar Itens à Lista */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-red-600" />
                    2. Inserir Item na Lista
                  </h3>
                  <span className="text-xs text-gray-400">Preço é opcional</span>
                </div>

                {/* Quick Catalog Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Clique para preencher rápido do catálogo:
                    </span>
                    <input
                      type="text"
                      placeholder="Filtrar catálogo..."
                      value={productCatalogSearch}
                      onChange={(e) => setProductCatalogSearch(e.target.value)}
                      className="text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg w-36 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {filteredCatalog.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddFromCatalog(prod)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-gray-200 text-gray-700 whitespace-nowrap transition-all cursor-pointer font-medium active:scale-95 shrink-0"
                      >
                        + {prod.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Item Input Area */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nome do Item / Insumo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Costela bovina, Picanha, Bobina 80mm, Saco de Carvão 10kg, Sal Grosso..."
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItemToBuilder();
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Category & Unit Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Categoria
                      </label>
                      <select
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Unidade
                      </label>
                      <div className="flex items-center gap-1">
                        {COMMON_UNITS.slice(0, 5).map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setNewItemUnit(u.id)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              newItemUnit === u.id
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {u.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quantity with quick buttons & Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Quantidade
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newItemQty}
                          onChange={(e) => setNewItemQty(e.target.value)}
                          placeholder="1"
                          className="w-24 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <div className="flex items-center gap-1">
                          {['5', '10', '20', '50'].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setNewItemQty(val)}
                              className="px-2 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
                            >
                              +{val}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Preço Estimado Unitário (Opcional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                          R$
                        </span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={newItemEstimatedPrice}
                          onChange={(e) => setNewItemEstimatedPrice(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Observação do Item (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: preferir ripa grossa, caixa fechada, marca tal..."
                      value={newItemNotes}
                      onChange={(e) => setNewItemNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItemToBuilder();
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={handleAddItemToBuilder}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-98"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Adicionar à Lista de Compras</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Observações Gerais */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Observações Gerais / Instruções para as Compras
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Pedir nota fiscal no CNPJ, conferir validade das carnes, levar troco..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Right Column: Live Shopping List View (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm sticky top-4 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      Itens na Lista ({items.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                      Revise os itens antes de salvar ou enviar
                    </p>
                  </div>
                  {currentTotalEstimated > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">
                        Estimativa
                      </span>
                      <span className="text-sm font-black text-red-600">
                        {formatCurrencyBRL(currentTotalEstimated)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items List */}
                {items.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold">Nenhum item adicionado ainda.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Utilize o formulário ao lado para incluir produtos na lista.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start justify-between gap-2 hover:bg-gray-100/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-black text-gray-400">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-900 truncate">
                              {item.name}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                            <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700 font-black">
                              {item.quantity} {item.unit}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600 font-medium">
                              {item.category}
                            </span>
                            {item.totalEstimated && item.totalEstimated > 0 ? (
                              <>
                                <span className="text-gray-400">•</span>
                                <span className="text-emerald-700 font-bold">
                                  {formatCurrencyBRL(item.totalEstimated)}
                                </span>
                              </>
                            ) : null}
                          </div>

                          {item.notes && (
                            <p className="text-[11px] text-gray-500 italic mt-1">
                              Obs: {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Adjust qty & Remove */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustItemQty(item.id, -1)}
                            className="w-6 h-6 rounded bg-white hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-black flex items-center justify-center cursor-pointer"
                            title="Diminuir"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustItemQty(item.id, 1)}
                            className="w-6 h-6 rounded bg-white hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-black flex items-center justify-center cursor-pointer"
                            title="Aumentar"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-6 h-6 rounded bg-white hover:bg-red-50 border border-gray-200 text-red-600 text-xs flex items-center justify-center cursor-pointer ml-1"
                            title="Remover item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Actions of Builder */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleSaveList(undefined, false)}
                    className="w-full bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Lista de Compras</span>
                  </button>

                  <button
                    onClick={() => handleSaveList('em_compras', true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-98"
                  >
                    <Send className="w-4 h-4" />
                    <span>Salvar e Enviar no WhatsApp (PDF + Texto)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MODO CONFERÊNCIA / CHECKLIST (Touch Friendly for Market / Tablet)    */}
      {/* ========================================================================= */}
      {activeTab === 'conferencia' && activeListForConference && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('listas')}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
                title="Voltar para as listas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Modo Conferência / Mercado
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500 font-semibold">
                    {activeListForConference.destination || 'Mercado Geral'}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-gray-900">
                  {activeListForConference.title}
                </h2>
              </div>
            </div>

            {/* Quick Share / Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleSendWhatsApp(activeListForConference)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>WhatsApp (PDF)</span>
              </button>

              <button
                onClick={() => handleExportPDF(activeListForConference)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
                title="Baixar PDF"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>

              <button
                onClick={() => handlePrintThermal(activeListForConference)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
                title="Imprimir Cupom"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Progress Banner */}
          {(() => {
            const itemsList = activeListForConference.items || [];
            const total = itemsList.length;
            const checked = itemsList.filter((i) => i.checked).length;
            const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

            const visibleItems = itemsList.filter((item) => {
              if (conferenceFilter === 'pendentes') return !item.checked;
              if (conferenceFilter === 'comprados') return item.checked;
              return true;
            });

            return (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Progresso de Conferência
                      </p>
                      <h3 className="text-xl font-black text-gray-900 mt-0.5">
                        {checked} de {total} itens no carrinho ({pct}%)
                      </h3>
                    </div>

                    {/* Bulk Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAllConference(true)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      >
                        Marcar Todos
                      </button>
                      <button
                        onClick={() => handleToggleAllConference(false)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                  </div>

                  {/* Big Progress Bar */}
                  <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct === 100 ? 'bg-emerald-500' : 'bg-red-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-500 mr-1">Filtrar:</span>
                    <button
                      onClick={() => setConferenceFilter('todos')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        conferenceFilter === 'todos'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Todos ({total})
                    </button>
                    <button
                      onClick={() => setConferenceFilter('pendentes')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        conferenceFilter === 'pendentes'
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Faltando ({total - checked})
                    </button>
                    <button
                      onClick={() => setConferenceFilter('comprados')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        conferenceFilter === 'comprados'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Já Comprados ({checked})
                    </button>
                  </div>
                </div>

                {/* Big Touch-Friendly Checklist Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleItems.map((item) => {
                    const isChecked = Boolean(item.checked);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleItemCheckInConference(item.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer active:scale-98 select-none ${
                          isChecked
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                            : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                        }`}
                      >
                        {/* Checkbox Icon */}
                        <div className="pt-0.5 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <Square className="w-6 h-6 text-gray-300" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-base font-black truncate ${
                                isChecked ? 'line-through text-gray-400' : 'text-gray-900'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-200/80 text-emerald-900'
                                  : 'bg-gray-900 text-white'
                              }`}
                            >
                              {item.quantity} {item.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-semibold text-gray-600">
                              {item.category}
                            </span>
                            {item.estimatedPrice && item.estimatedPrice > 0 ? (
                              <>
                                <span>•</span>
                                <span className="text-gray-500">
                                  Est: {formatCurrencyBRL(item.estimatedPrice)}/{item.unit}
                                </span>
                              </>
                            ) : null}
                          </div>

                          {item.notes && (
                            <p className="text-xs text-gray-500 italic mt-1 bg-white/70 p-1.5 rounded-lg border border-gray-100">
                              Obs: {item.notes}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Complete Button Footer */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    {pct === 100 ? (
                      <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Todos os itens foram comprados e conferidos!
                      </span>
                    ) : (
                      <span>
                        Faltam <strong className="text-gray-900">{total - checked} itens</strong> para concluir suas compras.
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      showToast('Conferência finalizada com sucesso!');
                      setActiveTab('listas');
                    }}
                    className="bg-gray-900 hover:bg-black text-white font-bold py-3 px-6 rounded-xl transition-all text-sm cursor-pointer"
                  >
                    Salvar e Voltar para Listas
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {listToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Excluir Lista de Compras?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Tem certeza que deseja excluir a lista <strong>{listToDelete.title}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setListToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteList}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Excluir Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
