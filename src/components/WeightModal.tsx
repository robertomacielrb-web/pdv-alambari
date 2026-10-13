import React, { useState, useEffect } from 'react';
import { Scale, X, Plus, Minus, DollarSign, Check, AlertCircle, Calculator, Delete } from 'lucide-react';

export interface WeighableProduct {
  id: string;
  name: string;
  price: number | string;
  category?: string;
  unit?: 'unidade' | 'kg';
}

interface WeightModalProps {
  isOpen: boolean;
  product: WeighableProduct | null;
  initialWeight?: number;
  initialObservation?: string;
  onClose: () => void;
  onConfirm: (weightKg: number, observation: string) => void;
}

export const PRESET_GRAMS = [
  { label: '100g', grams: 100 },
  { label: '150g', grams: 150 },
  { label: '200g', grams: 200 },
  { label: '250g', grams: 250 },
  { label: '300g', grams: 300 },
  { label: '350g', grams: 350 },
  { label: '400g', grams: 400 },
  { label: '500g (½ kg)', grams: 500 },
  { label: '600g', grams: 600 },
  { label: '750g', grams: 750 },
  { label: '1,0 kg', grams: 1000 },
  { label: '1,2 kg', grams: 1200 },
  { label: '1,5 kg', grams: 1500 },
  { label: '2,0 kg', grams: 2000 },
  { label: '2,5 kg', grams: 2500 },
  { label: '3,0 kg', grams: 3000 },
];

export const formatKg = (kg: number): string => {
  const val = Number(kg || 0);
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }) + ' kg';
};

export const parsePrice = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  let cleaned = str.replace(/[^\d.,]/g, '');
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const parseItemQuantity = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) || val < 0 ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? 0 : num;
};

export const parseKgValue = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) || val < 0 ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  str = str.replace(/[^\d.,]/g, '');
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) || num < 0 ? 0 : num;
};

export default function WeightModal({
  isOpen,
  product,
  initialWeight = 0.5,
  initialObservation = '',
  onClose,
  onConfirm,
}: WeightModalProps) {
  // Input mode: 'grams' (ex: 350), 'kg' (ex: 0,350), or 'value' (ex: R$ 25,00)
  const [inputMode, setInputMode] = useState<'grams' | 'kg' | 'value'>('grams');
  const [weightKg, setWeightKg] = useState<number>(0.5);
  const [gramsInputStr, setGramsInputStr] = useState<string>('500');
  const [kgInputStr, setKgInputStr] = useState<string>('0,500');
  const [targetValueStr, setTargetValueStr] = useState<string>('');
  const [observation, setObservation] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const pricePerKg = product ? parsePrice(product.price) : 0;
  const totalPrice = Math.round(weightKg * pricePerKg * 100) / 100;

  useEffect(() => {
    if (isOpen && product) {
      const startingKg = initialWeight > 0 ? initialWeight : 0.5;
      const initialGrams = Math.round(startingKg * 1000);
      setWeightKg(startingKg);
      setGramsInputStr(String(initialGrams));
      setKgInputStr(startingKg.toFixed(3).replace('.', ','));
      setTargetValueStr((startingKg * pricePerKg).toFixed(2).replace('.', ','));
      setObservation(initialObservation || '');
      setWarningMessage(null);
      // Default to 'grams' mode as it's the most natural for Brazilian delis/steakhouses
      setInputMode('grams');
    }
  }, [isOpen, product, initialWeight, initialObservation]);

  if (!isOpen || !product) return null;

  // Sync from grams
  const applyGrams = (grams: number) => {
    const safeGrams = Math.max(0, Math.round(grams));
    const calculatedKg = Math.round(safeGrams) / 1000;
    setWeightKg(calculatedKg);
    setGramsInputStr(String(safeGrams));
    setKgInputStr(calculatedKg.toFixed(3).replace('.', ','));
    if (pricePerKg > 0) {
      setTargetValueStr((calculatedKg * pricePerKg).toFixed(2).replace('.', ','));
    }
    setWarningMessage(null);
  };

  // Sync from kg
  const applyKg = (kg: number) => {
    const safeKg = Math.max(0, Math.round(kg * 1000) / 1000);
    const calculatedGrams = Math.round(safeKg * 1000);
    setWeightKg(safeKg);
    setGramsInputStr(String(calculatedGrams));
    setKgInputStr(safeKg.toFixed(3).replace('.', ','));
    if (pricePerKg > 0) {
      setTargetValueStr((safeKg * pricePerKg).toFixed(2).replace('.', ','));
    }
    setWarningMessage(null);
  };

  const handleGramsChange = (text: string) => {
    setGramsInputStr(text);
    if (!text.trim()) {
      setWeightKg(0);
      setKgInputStr('0,000');
      setTargetValueStr('0,00');
      return;
    }
    // Normalize comma to dot for parsing
    const normalized = text.trim().replace(',', '.');
    const parsedNum = parseFloat(normalized);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      // Smart detection: If user typed e.g. "1.5" or "0.8" or "2,3" in Grams mode (contains dot/comma or small float <= 15),
      // they definitely meant Kilograms! E.g. 1.5 kg = 1500g
      if ((normalized.includes('.') || text.includes(',')) && parsedNum <= 15) {
        const asKg = Math.round(parsedNum * 1000) / 1000;
        setWeightKg(asKg);
        setKgInputStr(asKg.toFixed(3).replace('.', ','));
        if (pricePerKg > 0) {
          setTargetValueStr((asKg * pricePerKg).toFixed(2).replace('.', ','));
        }
        setWarningMessage(`Interpretado como ${asKg.toFixed(3).replace('.', ',')} kg (${Math.round(asKg * 1000)}g).`);
        return;
      }

      const calculatedKg = Math.round(parsedNum) / 1000;
      setWeightKg(calculatedKg);
      setKgInputStr(calculatedKg.toFixed(3).replace('.', ','));
      if (pricePerKg > 0) {
        setTargetValueStr((calculatedKg * pricePerKg).toFixed(2).replace('.', ','));
      }
      setWarningMessage(null);
    }
  };

  const handleKgChange = (text: string) => {
    setKgInputStr(text);
    if (!text.trim()) {
      setWeightKg(0);
      setGramsInputStr('0');
      setTargetValueStr('0,00');
      return;
    }

    // Allow typing trailing comma or dot without prematurely evaluating to 0
    if (text.endsWith(',') || text.endsWith('.')) {
      return;
    }

    const parsed = parseKgValue(text);
    // Smart protection: if user types an integer >= 20 without decimal separator (like 250, 350, 500),
    // they meant grams in the kg input!
    if (!text.includes(',') && !text.includes('.') && parsed >= 20) {
      const convertedKg = parsed / 1000;
      setWeightKg(convertedKg);
      setGramsInputStr(String(Math.round(parsed)));
      setTargetValueStr((convertedKg * pricePerKg).toFixed(2).replace('.', ','));
      setWarningMessage(`Você digitou ${parsed}. Foi interpretado como ${parsed}g (${convertedKg.toFixed(3).replace('.', ',')} kg).`);
      return;
    }

    if (!isNaN(parsed) && parsed >= 0) {
      setWeightKg(parsed);
      setGramsInputStr(String(Math.round(parsed * 1000)));
      if (pricePerKg > 0) {
        setTargetValueStr((parsed * pricePerKg).toFixed(2).replace('.', ','));
      }
      setWarningMessage(null);
    }
  };

  const handleTargetValueChange = (text: string) => {
    setTargetValueStr(text);
    if (!text.trim()) {
      setWeightKg(0);
      setGramsInputStr('0');
      setKgInputStr('0,000');
      return;
    }

    if (text.endsWith(',') || text.endsWith('.')) {
      return;
    }

    const parsedVal = parsePrice(text);
    if (!isNaN(parsedVal) && parsedVal >= 0 && pricePerKg > 0) {
      const calculatedKg = Math.round((parsedVal / pricePerKg) * 1000) / 1000;
      setWeightKg(calculatedKg);
      setGramsInputStr(String(Math.round(calculatedKg * 1000)));
      setKgInputStr(calculatedKg.toFixed(3).replace('.', ','));
      setWarningMessage(null);
    }
  };

  const adjustGrams = (deltaGrams: number) => {
    const currentGrams = Math.round(weightKg * 1000);
    const newGrams = Math.max(10, currentGrams + deltaGrams);
    applyGrams(newGrams);
  };

  const handleNumpadPress = (digit: string) => {
    if (inputMode === 'grams') {
      if (digit === ',') {
        // If user presses comma while in grams, switch to KG mode so they can type decimals
        setInputMode('kg');
        const nextStr = (weightKg > 0 ? weightKg.toFixed(1).replace('.', ',') : '0') + ',';
        setKgInputStr(nextStr);
        return;
      }
      const nextStr = gramsInputStr === '0' ? digit : gramsInputStr + digit;
      handleGramsChange(nextStr);
    } else if (inputMode === 'kg') {
      if (digit === ',' && kgInputStr.includes(',')) return;
      const nextStr = kgInputStr === '0' && digit !== ',' ? digit : kgInputStr + digit;
      handleKgChange(nextStr);
    } else {
      if (digit === ',' && targetValueStr.includes(',')) return;
      const nextStr = targetValueStr === '0' && digit !== ',' ? digit : targetValueStr + digit;
      handleTargetValueChange(nextStr);
    }
  };

  const handleNumpadBackspace = () => {
    if (inputMode === 'grams') {
      const nextStr = gramsInputStr.slice(0, -1);
      handleGramsChange(nextStr);
    } else if (inputMode === 'kg') {
      const nextStr = kgInputStr.slice(0, -1);
      handleKgChange(nextStr);
    } else {
      const nextStr = targetValueStr.slice(0, -1);
      handleTargetValueChange(nextStr);
    }
  };

  const handleNumpadClear = () => {
    if (inputMode === 'grams') {
      handleGramsChange('');
    } else if (inputMode === 'kg') {
      handleKgChange('');
    } else {
      handleTargetValueChange('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weightKg <= 0) {
      alert('Por favor, informe um peso maior que zero para o produto.');
      return;
    }
    if (pricePerKg <= 0) {
      if (!confirm('Atenção: O preço deste produto está zerado (R$ 0,00/kg). Deseja adicionar assim mesmo?')) {
        return;
      }
    }
    onConfirm(weightKg, observation.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-amber-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs shadow-inner">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">
                  Balança / Cobrança por Kg
                </span>
              </div>
              <h3 className="font-black text-lg sm:text-xl leading-tight mt-0.5 text-white">
                {product.name}
              </h3>
              <p className="text-white/90 text-xs sm:text-sm font-semibold flex items-center gap-1">
                Preço cadastrado:
                <strong className="text-white bg-black/20 px-1.5 py-0.5 rounded text-sm font-extrabold">
                  R$ {pricePerKg.toFixed(2).replace('.', ',')} / kg
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white p-2 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Mode Switcher Tabs */}
          <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setInputMode('grams')}
              className={`flex-1 py-2 px-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                inputMode === 'grams'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Em Gramas (g)</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('kg')}
              className={`flex-1 py-2 px-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                inputMode === 'kg'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span>Em Quilos (kg)</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('value')}
              className={`flex-1 py-2 px-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                inputMode === 'value'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Por Valor (R$)</span>
            </button>
          </div>

          {/* Warning Message if any */}
          {warningMessage && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}

          {/* Active Input Box */}
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3.5 space-y-2">
            {inputMode === 'grams' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    Digite a Quantidade em Gramas
                  </label>
                  <span className="text-xs text-red-600 font-bold">
                    Ex: 350 para 350g
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={gramsInputStr}
                    onChange={(e) => handleGramsChange(e.target.value)}
                    placeholder="Ex: 350"
                    autoFocus
                    className="w-full text-center text-3xl sm:text-4xl font-black text-gray-900 bg-white border-2 border-red-500 rounded-2xl py-3 px-12 focus:outline-none focus:ring-4 focus:ring-red-100 shadow-inner"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg pointer-events-none">
                    gramas
                  </span>
                </div>
              </div>
            )}

            {inputMode === 'kg' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    Digite o Peso em Quilos
                  </label>
                  <span className="text-xs text-amber-700 font-bold">
                    Ex: 0,350 ou 1,200
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={kgInputStr}
                    onChange={(e) => handleKgChange(e.target.value)}
                    placeholder="0,000"
                    autoFocus
                    className="w-full text-center text-3xl sm:text-4xl font-black text-gray-900 bg-white border-2 border-amber-500 rounded-2xl py-3 px-12 focus:outline-none focus:ring-4 focus:ring-amber-100 shadow-inner"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg pointer-events-none">
                    kg
                  </span>
                </div>
              </div>
            )}

            {inputMode === 'value' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    Quanto o cliente quer pagar?
                  </label>
                  <span className="text-xs text-emerald-700 font-bold">
                    Calcula peso automático
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-2xl">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={targetValueStr}
                    onChange={(e) => handleTargetValueChange(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                    className="w-full text-center text-3xl sm:text-4xl font-black text-emerald-700 bg-white border-2 border-emerald-500 rounded-2xl py-3 px-12 focus:outline-none focus:ring-4 focus:ring-emerald-100 shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Steppers (+ / -) */}
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-[11px] font-bold text-gray-500">Ajuste fino:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustGrams(-100)}
                  className="px-2 py-1 bg-white hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200 font-bold rounded-lg text-xs"
                >
                  -100g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(-50)}
                  className="px-2 py-1 bg-white hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200 font-bold rounded-lg text-xs"
                >
                  -50g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(-10)}
                  className="px-2 py-1 bg-white hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200 font-bold rounded-lg text-xs"
                >
                  -10g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(10)}
                  className="px-2 py-1 bg-white hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200 font-bold rounded-lg text-xs"
                >
                  +10g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(50)}
                  className="px-2 py-1 bg-white hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200 font-bold rounded-lg text-xs"
                >
                  +50g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(100)}
                  className="px-2 py-1 bg-white hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200 font-bold rounded-lg text-xs"
                >
                  +100g
                </button>
              </div>
            </div>
          </div>

          {/* Quick Preset Gram Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                Atalhos Rápidos de Porção
              </span>
              <span className="text-[11px] text-red-600 font-bold">
                {Math.round(weightKg * 1000)}g selecionados
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {PRESET_GRAMS.map((item) => {
                const isSelected = Math.abs(weightKg - item.grams / 1000) < 0.005;
                return (
                  <button
                    key={item.grams}
                    type="button"
                    onClick={() => applyGrams(item.grams)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-sm font-black scale-102 ring-2 ring-red-400'
                        : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick On-Screen Touch Numpad */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5">
            <div className="flex justify-between items-center mb-1.5 px-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-slate-400" />
                Teclado Numérico Rápido (Touch)
              </span>
              <button
                type="button"
                onClick={handleNumpadClear}
                className="text-[11px] text-red-600 hover:text-red-700 font-bold"
              >
                Limpar Campo
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
              {['7', '8', '9', 'C'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => (key === 'C' ? handleNumpadClear() : handleNumpadPress(key))}
                  className={`py-2 rounded-xl font-black text-sm sm:text-base border shadow-2xs transition-all active:scale-95 cursor-pointer ${
                    key === 'C'
                      ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {key}
                </button>
              ))}
              {['4', '5', '6', '⌫'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => (key === '⌫' ? handleNumpadBackspace() : handleNumpadPress(key))}
                  className={`py-2 rounded-xl font-black text-sm sm:text-base border shadow-2xs transition-all active:scale-95 cursor-pointer ${
                    key === '⌫'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {key}
                </button>
              ))}
              {['1', '2', '3', ','].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNumpadPress(key)}
                  className="py-2 rounded-xl font-black text-sm sm:text-base bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  {key}
                </button>
              ))}
              <div className="col-span-4 grid grid-cols-2 gap-1.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => handleNumpadPress('0')}
                  className="py-2 rounded-xl font-black text-sm sm:text-base bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpadPress('00')}
                  className="py-2 rounded-xl font-black text-sm sm:text-base bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  00
                </button>
              </div>
            </div>
          </div>

          {/* Live Calculation Card */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/70 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs sm:text-sm text-amber-950 pb-2 border-b border-amber-200/80">
              <span className="font-bold flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-700" />
                Peso a Registrar:
              </span>
              <span className="font-black text-base sm:text-lg text-gray-900">
                {weightKg.toFixed(3).replace('.', ',')} kg{' '}
                <span className="text-xs text-amber-900 font-extrabold bg-amber-200 px-1.5 py-0.5 rounded ml-1">
                  {Math.round(weightKg * 1000)}g
                </span>
              </span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm text-amber-900 py-1 border-b border-amber-200/80">
              <span className="font-semibold">Cálculo de Preço:</span>
              <span className="font-bold text-gray-700 text-xs sm:text-sm">
                {weightKg.toFixed(3).replace('.', ',')} kg × R$ {pricePerKg.toFixed(2).replace('.', ',')}/kg
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="font-black text-gray-800 text-sm sm:text-base">
                VALOR TOTAL:
              </span>
              <span className="text-2xl sm:text-3xl font-black text-red-600">
                R$ {totalPrice.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Observation */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Fatiada bem fina, mal passada, sem osso..."
              className="w-full text-sm border border-gray-300 rounded-xl p-2.5 focus:border-red-500 focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-t flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 border border-gray-300 text-gray-700 font-bold rounded-2xl hover:bg-gray-100 transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={weightKg <= 0}
            className="flex-1 bg-red-600 hover:bg-red-700 active:scale-98 disabled:opacity-50 text-white font-black py-3 px-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
          >
            <Check className="w-5 h-5" />
            Confirmar {weightKg.toFixed(3).replace('.', ',')} kg (R$ {totalPrice.toFixed(2).replace('.', ',')})
          </button>
        </div>
      </div>
    </div>
  );
}
