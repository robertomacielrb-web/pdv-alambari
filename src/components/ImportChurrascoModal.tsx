import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  X, 
  Search, 
  Calendar, 
  User, 
  DollarSign, 
  Check, 
  ArrowRight, 
  ClipboardPaste, 
  FileText, 
  Clock, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { EventQuote } from '../types/churrasco';

export interface ImportedCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: 'unidade' | 'kg';
  category: string;
  observation?: string;
}

interface ImportChurrascoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ImportedCartItem[], clientNameFromQuote?: string, discountFromQuote?: number) => void;
}

export default function ImportChurrascoModal({
  isOpen,
  onClose,
  onImport,
}: ImportChurrascoModalProps) {
  const [activeTab, setActiveTab] = useState<'saved' | 'paste'>('saved');
  const [quotes, setQuotes] = useState<EventQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Paste text tab states
  const [pastedText, setPastedText] = useState('');
  const [pastedClientName, setPastedClientName] = useState('');
  const [parsedItems, setParsedItems] = useState<ImportedCartItem[]>([]);

  // Load quotes from Firestore
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const quotesRef = collection(db, 'event_quotes');
    const q = query(quotesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: EventQuote[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setQuotes(loaded);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading event quotes for import:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtered quotes
  const filteredQuotes = quotes.filter((q) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = (q.clientName || '').toLowerCase().includes(term);
    const phoneMatch = (q.clientPhone || '').includes(term);
    const dateMatch = (q.eventDate || '').includes(term);
    return nameMatch || phoneMatch || dateMatch;
  });

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);

  // Convert quote to items
  const handleImportQuote = (quote: EventQuote) => {
    const items: ImportedCartItem[] = [];

    // Meats
    (quote.meats || [])
      .filter((m) => m.selected && m.kg > 0)
      .forEach((m) => {
        items.push({
          id: m.id || `meat_${Date.now()}_${Math.random()}`,
          name: m.name,
          price: m.pricePerKg,
          quantity: m.kg,
          unit: 'kg',
          category: 'Carnes / Churrasco',
          observation: `Evento: ${quote.clientName || 'Churrasco'} (${quote.totalGuests || 0} pessoas)`,
        });
      });

    // Sides
    (quote.sides || [])
      .filter((s) => s.selected && s.quantity > 0)
      .forEach((s) => {
        items.push({
          id: s.id || `side_${Date.now()}_${Math.random()}`,
          name: s.name,
          price: s.price,
          quantity: s.quantity,
          unit: s.unit?.toLowerCase().includes('kg') ? 'kg' : 'unidade',
          category: 'Acompanhamentos',
        });
      });

    // Drinks
    (quote.drinks || [])
      .filter((d) => d.selected && d.quantity > 0)
      .forEach((d) => {
        items.push({
          id: d.id || `drink_${Date.now()}_${Math.random()}`,
          name: d.name,
          price: d.price,
          quantity: d.quantity,
          unit: 'unidade',
          category: 'Bebidas',
        });
      });

    // Services
    (quote.services || [])
      .filter((srv) => srv.selected && srv.quantity > 0)
      .forEach((srv) => {
        items.push({
          id: srv.id || `srv_${Date.now()}_${Math.random()}`,
          name: srv.name,
          price: srv.price,
          quantity: srv.quantity,
          unit: 'unidade',
          category: 'Serviços',
        });
      });

    if (items.length === 0) {
      alert('Este orçamento não possui itens ou carnes selecionadas com quantidade maior que zero.');
      return;
    }

    onImport(items, quote.clientName, quote.discount || 0);
    onClose();
  };

  // Parser for pasted proposal text
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      alert('Por favor, cole o texto da proposta de orçamento no campo.');
      return;
    }

    const lines = pastedText.split('\n');
    const items: ImportedCartItem[] = [];
    let detectedClient = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Detect client name
      if (!detectedClient) {
        const clientMatch = line.match(/(?:cliente|proposta para|orçamento para|olá|ola)[:\s]+([^\n\r,•-]+)/i);
        if (clientMatch && clientMatch[1]) {
          detectedClient = clientMatch[1].trim();
        }
      }

      // Check lines with quantity and price
      // Format examples:
      // - Picanha: 5,00 kg (R$ 89,90/kg) - R$ 449,50
      // • Farofa Especial: 2 un - R$ 30,00
      // Alcatra 3.5kg R$ 150
      const weightMatch = line.match(/[-•*]?\s*([^:\d(]+)(?::)?\s*([\d.,]+)\s*(kg|g|un|unidade|pacote|garrafa|fardo)?.*?(?:R\$\s*([\d.,]+))?/i);
      
      if (weightMatch) {
        const rawName = weightMatch[1].replace(/[-•*]/g, '').trim();
        const rawQty = weightMatch[2].replace(',', '.');
        const unitType = (weightMatch[3] || 'un').toLowerCase();
        let qty = parseFloat(rawQty);

        if (!isNaN(qty) && qty > 0 && rawName.length > 2) {
          if (unitType === 'g') {
            qty = qty / 1000;
          }
          const isKg = unitType === 'kg' || unitType === 'g' || rawName.toLowerCase().includes('carne') || rawName.toLowerCase().includes('picanha');
          
          let price = 0;
          if (weightMatch[4]) {
            const rawPrice = weightMatch[4].replace(/\./g, '').replace(',', '.');
            const parsedPrice = parseFloat(rawPrice);
            if (!isNaN(parsedPrice)) {
              price = isKg ? parsedPrice / qty : parsedPrice / qty;
            }
          }

          items.push({
            id: `pasted_${Date.now()}_${items.length}`,
            name: rawName,
            price: Math.max(0, Number(price.toFixed(2))),
            quantity: isKg ? Number(qty.toFixed(3)) : Math.round(qty),
            unit: isKg ? 'kg' : 'unidade',
            category: isKg ? 'Carnes / Churrasco' : 'Acompanhamentos / Itens',
            observation: 'Importado de texto colado'
          });
        }
      }
    }

    if (items.length === 0) {
      alert('Não foi possível identificar itens no texto colado. Tente selecionar diretamente da aba "Orçamentos Salvos".');
      return;
    }

    setParsedItems(items);
    if (detectedClient && !pastedClientName) {
      setPastedClientName(detectedClient);
    }
  };

  const handleConfirmPastedImport = () => {
    if (parsedItems.length === 0) return;
    onImport(parsedItems, pastedClientName.trim() || undefined, 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-red-700 to-amber-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs shadow-inner">
              <Flame className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 block">
                Integração Churrasco → Balcão PDV
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Importar Orçamento de Churrasco
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-3 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-bold text-sm rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-white text-red-700 border-t-2 border-red-600 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Orçamentos Salvos ({quotes.length})
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-4 py-2 font-bold text-sm rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white text-red-700 border-t-2 border-red-600 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            Colar Texto da Proposta
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'saved' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar orçamento por nome do cliente, telefone ou data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all"
                />
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Carregando orçamentos de churrasco...
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
                  <Flame className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="font-bold text-sm">Nenhum orçamento encontrado.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Crie propostas na aba "Eventos / Churrasco" ou use a aba "Colar Texto da Proposta".
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {filteredQuotes.map((q) => {
                    const isSelected = selectedQuoteId === q.id;
                    const meatsCount = (q.meats || []).filter((m) => m.selected && m.kg > 0).length;
                    const sidesCount = (q.sides || []).filter((s) => s.selected && s.quantity > 0).length;

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuoteId(q.id || null)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-red-600 bg-red-50/40 shadow-sm ring-2 ring-red-100'
                            : 'border-gray-200 hover:border-red-200 bg-white hover:bg-gray-50/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-black text-gray-800 text-sm truncate flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              {q.clientName || 'Cliente sem nome'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-800 shrink-0">
                              {q.status || 'pendente'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
                            {q.eventDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                {q.eventDate}
                              </span>
                            )}
                            <span className="font-medium text-gray-600">
                              {q.totalGuests || 0} convidados
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">
                              {meatsCount} carnes, {sidesCount} acomp.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                          <span className="font-black text-base text-red-600">
                            R$ {(q.total || 0).toFixed(2).replace('.', ',')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImportQuote(q);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                          >
                            <span>Importar</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Cole o texto da proposta copiada do WhatsApp / Proposta:
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Exemplo:&#10;PROPOSTA DE CHURRASCO - ALAMBARI DEFUMADOS&#10;Cliente: Marcos Silva&#10;• Picanha Bovina: 4,00 kg (R$ 89,90/kg)&#10;• Linguiça Artesanal: 2,50 kg (R$ 38,00/kg)&#10;• Pão de Alho: 4 un (R$ 12,00)"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:w-auto flex-1">
                  <input
                    type="text"
                    value={pastedClientName}
                    onChange={(e) => setPastedClientName(e.target.value)}
                    placeholder="Nome do Cliente (opcional)"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:border-red-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="w-full sm:w-auto bg-gray-800 hover:bg-gray-900 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Identificar Itens do Texto
                </button>
              </div>

              {parsedItems.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {parsedItems.length} itens identificados com sucesso:
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmPastedImport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Adicionar Todos ao Balcão
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {parsedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2 rounded-lg border border-amber-100 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-gray-800 truncate mr-2">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-700">
                            {item.quantity} {item.unit}
                          </span>
                          {item.price > 0 && (
                            <span className="font-black text-gray-900">
                              R$ {item.price.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            Os itens importados entram direto no carrinho do Balcão prontos para pagamento.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
