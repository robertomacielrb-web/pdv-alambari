import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { EventQuote } from '../types/churrasco';
import { formatCurrency } from '../data/churrascoDefaults';
import {
  Flame,
  X,
  ClipboardList,
  Search,
  CheckCircle,
  FileText,
  AlertCircle,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
  ClipboardPaste,
} from 'lucide-react';

export interface ImportedCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: 'unidade' | 'kg';
  category: string;
  observation?: string;
}

interface ImportChurrascoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ImportedCartItem[], clientName?: string, discount?: number) => void;
}

export default function ImportChurrascoModal({
  isOpen,
  onClose,
  onImport,
}: ImportChurrascoModalProps) {
  const [activeTab, setActiveTab] = useState<'saved' | 'paste'>('saved');
  const [quotes, setQuotes] = useState<EventQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<EventQuote | null>(null);

  // Paste Tab State
  const [pastedText, setPastedText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    clientName?: string;
    items: ImportedCartItem[];
    total?: number;
    discount?: number;
  } | null>(null);

  // Load quotes from Firestore
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const q = query(collection(db, 'eventQuotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: EventQuote[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as EventQuote);
        });
        setQuotes(loaded);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching event quotes:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredQuotes = quotes.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      q.clientName?.toLowerCase().includes(term) ||
      q.clientPhone?.toLowerCase().includes(term) ||
      q.eventType?.toLowerCase().includes(term)
    );
  });

  // Convert an EventQuote object into cart items
  const convertQuoteToCartItems = (quote: EventQuote): ImportedCartItem[] => {
    const items: ImportedCartItem[] = [];

    // 1. Meats
    if (quote.meats && quote.meats.length > 0) {
      quote.meats
        .filter((m) => m.selected && m.kg > 0)
        .forEach((m, idx) => {
          items.push({
            id: m.id || `churrasco_meat_${idx}_${Date.now()}`,
            name: m.name,
            price: m.pricePerKg || 50,
            quantity: m.kg,
            unit: 'kg',
            category: 'Carnes / Churrasco',
            observation: `Evento: ${quote.clientName || 'Churrasco'} (${quote.totalGuests || 0} convidados)`,
          });
        });
    }

    // 2. Sides
    if (quote.sides && quote.sides.length > 0) {
      quote.sides
        .filter((s) => s.selected && s.quantity > 0)
        .forEach((s, idx) => {
          const isKg = s.unit?.toLowerCase().includes('kg');
          items.push({
            id: s.id || `churrasco_side_${idx}_${Date.now()}`,
            name: s.name,
            price: s.price || 30,
            quantity: s.quantity,
            unit: isKg ? 'kg' : 'unidade',
            category: 'Acompanhamentos',
          });
        });
    }

    // 3. Drinks
    if (quote.drinks && quote.drinks.length > 0) {
      quote.drinks
        .filter((d) => d.selected && d.quantity > 0)
        .forEach((d, idx) => {
          items.push({
            id: d.id || `churrasco_drink_${idx}_${Date.now()}`,
            name: d.name,
            price: d.price || 15,
            quantity: d.quantity,
            unit: 'unidade',
            category: 'Bebidas',
          });
        });
    }

    // 4. Services
    if (quote.services && quote.services.length > 0) {
      quote.services
        .filter((srv) => srv.selected && srv.quantity > 0)
        .forEach((srv, idx) => {
          items.push({
            id: srv.id || `churrasco_service_${idx}_${Date.now()}`,
            name: srv.name,
            price: srv.price || 200,
            quantity: srv.quantity,
            unit: 'unidade',
            category: 'Serviços',
          });
        });
    }

    // Fallback: If no breakdown items, create single quote item
    if (items.length === 0 && quote.total > 0) {
      items.push({
        id: `churrasco_package_${Date.now()}`,
        name: `Buffet / Evento de Churrasco (${quote.clientName || 'Cliente'})`,
        price: quote.total,
        quantity: 1,
        unit: 'unidade',
        category: 'Eventos / Churrasco',
        observation: `${quote.totalGuests || 0} pessoas - ${quote.eventDate || ''}`,
      });
    }

    return items;
  };

  const handleSelectQuoteToImport = (quote: EventQuote) => {
    const items = convertQuoteToCartItems(quote);
    onImport(items, quote.clientName, quote.discount || 0);
    onClose();
  };

  // Parser for pasted text
  const handleParsePastedText = (text: string) => {
    setPastedText(text);
    setParseError(null);
    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }

    try {
      // 1. Check if user pasted JSON
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        const json = JSON.parse(text);
        if (json.meats || json.clientName || json.items) {
          const items = json.items || convertQuoteToCartItems(json);
          setParsedPreview({
            clientName: json.clientName,
            items,
            total: json.total,
            discount: json.discount,
          });
          return;
        }
      }

      // 2. Parse WhatsApp / Proposta Text
      const lines = text.split('\n');
      let clientName = '';
      let total = 0;
      let discount = 0;
      const items: ImportedCartItem[] = [];

      let currentSection = 'Carnes / Churrasco';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Detect Client Name
        const nameMatch = line.match(/(?:olá|cliente|para):\s*\*?([a-zA-ZÀ-ÿ\s]+)\*?/i);
        if (nameMatch && !clientName) {
          clientName = nameMatch[1].trim();
        }

        // Detect Sections
        if (/carnes/i.test(line)) currentSection = 'Carnes / Churrasco';
        else if (/acompanhamentos/i.test(line)) currentSection = 'Acompanhamentos';
        else if (/bebidas/i.test(line)) currentSection = 'Bebidas';
        else if (/serviços/i.test(line)) currentSection = 'Serviços';

        // Detect Total
        if (/investimento total|total:|valor final/i.test(line)) {
          const priceClean = line.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
          const p = parseFloat(priceClean);
          if (!isNaN(p) && p > 0) total = p;
        }

        // Detect Discount
        if (/desconto/i.test(line)) {
          const discClean = line.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
          const d = parseFloat(discClean);
          if (!isNaN(d) && d > 0) discount = d;
        }

        // Detect Bullet items (• or - or *)
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          const cleanItem = line.replace(/^[•\-*]\s*/, '').replace(/\*/g, '').trim();
          if (cleanItem && !/investimento|dados do|cardápio|valor|condições|chave/i.test(cleanItem)) {
            // Check if line contains kg or price: e.g. "Picanha - 3 kg (R$ 98/kg)" or "Picanha"
            const kgMatch = cleanItem.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
            const priceMatch = cleanItem.match(/R\$\s*(\d+(?:[.,]\d+)?)/i);
            const parsedKg = kgMatch ? parseFloat(kgMatch[1].replace(',', '.')) : 1;
            const parsedPrice = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 50;
            const itemName = cleanItem.replace(/-\s*\d+.*$/, '').replace(/\(.*\)/, '').trim();

            items.push({
              id: `pasted_item_${items.length}_${Date.now()}`,
              name: itemName || cleanItem,
              price: parsedPrice,
              quantity: parsedKg,
              unit: parsedKg !== 1 || kgMatch ? 'kg' : 'unidade',
              category: currentSection,
            });
          }
        }
      }

      if (items.length === 0) {
        // If no bullet points were found, treat non-empty lines as potential items
        const rawItems = lines
          .map((l) => l.trim())
          .filter((l) => l.length > 2 && !l.startsWith('http') && !l.includes('www.'));
        if (rawItems.length > 0) {
          rawItems.slice(0, 15).forEach((line, idx) => {
            items.push({
              id: `pasted_raw_${idx}_${Date.now()}`,
              name: line,
              price: 35,
              quantity: 1,
              unit: 'unidade',
              category: 'Churrasco',
            });
          });
        }
      }

      if (items.length === 0) {
        setParseError('Não foi possível identificar itens no texto colado. Verifique o conteúdo e tente novamente.');
        setParsedPreview(null);
      } else {
        setParsedPreview({
          clientName: clientName || 'Cliente Churrasco',
          items,
          total,
          discount,
        });
      }
    } catch (err: any) {
      setParseError('Erro ao interpretar o texto colado: ' + err.message);
      setParsedPreview(null);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleParsePastedText(text);
          return;
        }
      }
      alert('Não foi possível ler a área de transferência automaticamente. Por favor, cole com Ctrl+V na caixa de texto abaixo.');
    } catch (err) {
      alert('Permissão de leitura negada pelo navegador. Cole com Ctrl+V na caixa de texto abaixo.');
    }
  };

  const handleConfirmPastedImport = () => {
    if (!parsedPreview || parsedPreview.items.length === 0) return;
    onImport(parsedPreview.items, parsedPreview.clientName, parsedPreview.discount || 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-amber-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs shadow-inner">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">
                Integração Churrasco ➔ Balcão PDV
              </span>
              <h3 className="font-black text-lg sm:text-xl leading-tight mt-0.5 text-white">
                Lançar Orçamento de Churrasco no Caixa
              </h3>
              <p className="text-white/80 text-xs">
                Importe os cortes com seus quilos (kg), acompanhamentos e total diretamente no carrinho do Balcão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 bg-gray-50 border-b flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Orçamentos Salvos no Sistema ({quotes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Colar Texto de Proposta / WhatsApp</span>
          </button>
        </div>

        {/* Tab 1: Saved Quotes */}
        {activeTab === 'saved' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, telefone ou tipo de evento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
                <p>Carregando orçamentos de churrasco...</p>
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <Flame className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="font-bold text-gray-700">Nenhum orçamento encontrado.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Crie propostas em <strong>Eventos / Churrasco</strong> ou use a aba &quot;Colar Texto&quot; ao lado.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredQuotes.map((quote) => {
                  const selectedMeats = quote.meats?.filter((m) => m.selected && m.kg > 0) || [];
                  const isSelected = selectedQuote?.id === quote.id;

                  return (
                    <div
                      key={quote.id}
                      onClick={() => setSelectedQuote(isSelected ? null : quote)}
                      className={`border rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-red-500 bg-red-50/40 ring-2 ring-red-400 shadow-sm'
                          : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                              {quote.eventType || 'Churrasco'}
                            </span>
                            <h4 className="font-bold text-gray-900 text-base mt-1">
                              {quote.clientName || 'Cliente sem nome'}
                            </h4>
                          </div>
                          <span className="text-sm font-black text-red-600 bg-white border border-red-200 px-2 py-1 rounded-xl">
                            {formatCurrency(quote.total)}
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 space-y-1 mb-3">
                          {quote.eventDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>{quote.eventDate}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <span>{quote.totalGuests} convidados ({selectedMeats.length} cortes de carne)</span>
                          </div>
                        </div>

                        {/* Meats snippet */}
                        {selectedMeats.length > 0 && (
                          <div className="bg-white/80 p-2 rounded-xl border border-gray-200/80 mb-3 text-[11px] text-gray-700">
                            <strong className="text-gray-900 block mb-0.5">Cortes:</strong>
                            <div className="line-clamp-2">
                              {selectedMeats.map((m) => `${m.name} (${m.kg}kg)`).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-500">
                          {quote.status?.toUpperCase() || 'PENDENTE'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectQuoteToImport(quote);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Lançar no Caixa</span>
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

        {/* Tab 2: Paste Text */}
        {activeTab === 'paste' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <FileText className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Como funciona o Colar do Churrasco:</strong>
                <p className="mt-0.5">
                  Copie a proposta enviada no WhatsApp ou o resumo do churrasco, cole na caixa abaixo e o sistema
                  vai extrair os cortes de carne, quilos (kg), acompanhamentos e valores diretamente para o carrinho do Balcão!
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Cole o Texto da Proposta / Orçamento Aqui:
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" /> Colar da Área de Transferência
                </button>
              </div>

              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => handleParsePastedText(e.target.value)}
                placeholder="Exemplo:&#10;Olá, *Carlos Alberto*! Segue orçamento:&#10;• Picanha Bovina Especial (2,5 kg)&#10;• Costela Defumada (3 kg)&#10;• Arroz Carreteiro&#10;Investimento Total: R$ 450,00"
                className="w-full text-xs sm:text-sm font-mono border-2 border-gray-200 rounded-2xl p-3 focus:border-red-500 focus:outline-none bg-gray-50/70"
              />
            </div>

            {parseError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Parsed Preview */}
            {parsedPreview && (
              <div className="bg-gray-50 border-2 border-green-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-black text-gray-900 text-sm">
                      {parsedPreview.items.length} itens identificados com sucesso!
                    </span>
                  </div>
                  {parsedPreview.clientName && (
                    <span className="text-xs font-bold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
                      Cliente: {parsedPreview.clientName}
                    </span>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-gray-200 text-xs">
                  {parsedPreview.items.map((item, idx) => (
                    <div key={idx} className="pt-1.5 flex justify-between items-center text-gray-800">
                      <div>
                        <span className="font-bold">{item.name}</span>
                        <span className="text-gray-500 ml-2">
                          ({item.quantity} {item.unit === 'kg' ? 'kg' : 'un'})
                        </span>
                      </div>
                      <span className="font-semibold text-gray-700">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleConfirmPastedImport}
                  className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirmar e Lançar no Carrinho do Balcão
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-t flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 text-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
