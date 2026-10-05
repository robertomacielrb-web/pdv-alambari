import React, { useState, useEffect } from 'react';
import { Scale, X, Plus, Minus, DollarSign, Check } from 'lucide-react';

export interface WeighableProduct {
  id: string;
  name: string;
  price: number;
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

const PRESET_GRAMS = [
  { label: '100g', grams: 100 },
  { label: '200g', grams: 200 },
  { label: '250g', grams: 250 },
  { label: '300g', grams: 300 },
  { label: '400g', grams: 400 },
  { label: '500g (½ kg)', grams: 500 },
  { label: '750g', grams: 750 },
  { label: '1,0 kg', grams: 1000 },
  { label: '1,5 kg', grams: 1500 },
  { label: '2,0 kg', grams: 2000 },
];

export const formatKg = (kg: number): string => {
  return Number(kg || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }) + ' kg';
};

export const parseKgValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export default function WeightModal({
  isOpen,
  product,
  initialWeight = 0.5,
  initialObservation = '',
  onClose,
  onConfirm,
}: WeightModalProps) {
  const [weightKg, setWeightKg] = useState<number>(0.5);
  const [weightInputStr, setWeightInputStr] = useState<string>('0,500');
  const [inputMode, setInputMode] = useState<'weight' | 'value'>('weight');
  const [targetValueStr, setTargetValueStr] = useState<string>('');
  const [observation, setObservation] = useState<string>('');

  useEffect(() => {
    if (isOpen && product) {
      const starting = initialWeight > 0 ? initialWeight : 0.5;
      setWeightKg(starting);
      setWeightInputStr(starting.toFixed(3).replace('.', ','));
      setTargetValueStr((starting * product.price).toFixed(2).replace('.', ','));
      setObservation(initialObservation || '');
      setInputMode('weight');
    }
  }, [isOpen, product, initialWeight, initialObservation]);

  if (!isOpen || !product) return null;

  const pricePerKg = Number(product.price) || 0;
  const totalPrice = weightKg * pricePerKg;

  const handleWeightInputChange = (text: string) => {
    setWeightInputStr(text);
    const parsed = parseKgValue(text);
    if (!isNaN(parsed) && parsed >= 0) {
      setWeightKg(parsed);
      setTargetValueStr((parsed * pricePerKg).toFixed(2).replace('.', ','));
    }
  };

  const handleTargetValueChange = (text: string) => {
    setTargetValueStr(text);
    const parsedVal = parseKgValue(text);
    if (!isNaN(parsedVal) && parsedVal >= 0 && pricePerKg > 0) {
      const calculatedKg = Math.round((parsedVal / pricePerKg) * 1000) / 1000;
      setWeightKg(calculatedKg);
      setWeightInputStr(calculatedKg.toFixed(3).replace('.', ','));
    }
  };

  const applyGrams = (grams: number) => {
    const kg = grams / 1000;
    setWeightKg(kg);
    setWeightInputStr(kg.toFixed(3).replace('.', ','));
    setTargetValueStr((kg * pricePerKg).toFixed(2).replace('.', ','));
  };

  const adjustGrams = (deltaGrams: number) => {
    const currentGrams = Math.round(weightKg * 1000);
    const newGrams = Math.max(10, currentGrams + deltaGrams);
    applyGrams(newGrams);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weightKg <= 0) {
      alert('Por favor, informe um peso maior que zero.');
      return;
    }
    onConfirm(weightKg, observation.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-amber-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full">
                  Cobrança por Quilo (KG)
                </span>
              </div>
              <h3 className="font-black text-lg sm:text-xl leading-tight mt-0.5 text-white">
                {product.name}
              </h3>
              <p className="text-white/80 text-xs sm:text-sm font-semibold">
                Preço: <span className="text-white font-bold">R$ {pricePerKg.toFixed(2).replace('.', ',')} / kg</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Mode Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setInputMode('weight')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                inputMode === 'weight'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Scale className="w-4 h-4 text-red-600" />
              Por Peso (Kg / Gramas)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('value')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                inputMode === 'value'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Por Valor em R$ (Ex: R$ 20,00)
            </button>
          </div>

          {/* Primary Input Section */}
          {inputMode === 'weight' ? (
            <div className="space-y-3">
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wider">
                Digite ou Ajuste o Peso (Kg)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustGrams(-100)}
                  className="p-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-xl transition-all shrink-0 text-sm"
                  title="Diminuir 100g"
                >
                  -100g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(-50)}
                  className="p-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-xl transition-all shrink-0 text-sm"
                  title="Diminuir 50g"
                >
                  -50g
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={weightInputStr}
                    onChange={(e) => handleWeightInputChange(e.target.value)}
                    placeholder="0,000"
                    autoFocus
                    className="w-full text-center text-2xl sm:text-3xl font-black text-gray-900 border-2 border-red-500 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-4 focus:ring-red-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">
                    kg
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustGrams(50)}
                  className="p-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-xl transition-all shrink-0 text-sm"
                  title="Aumentar 50g"
                >
                  +50g
                </button>
                <button
                  type="button"
                  onClick={() => adjustGrams(100)}
                  className="p-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-xl transition-all shrink-0 text-sm"
                  title="Aumentar 100g"
                >
                  +100g
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wider">
                Quanto o cliente deseja gastar? (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xl">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={targetValueStr}
                  onChange={(e) => handleTargetValueChange(e.target.value)}
                  placeholder="0,00"
                  autoFocus
                  className="w-full text-center text-2xl sm:text-3xl font-black text-emerald-700 border-2 border-emerald-500 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <p className="text-xs text-gray-500 text-center font-medium">
                Calcula o peso exato de acordo com o valor desejado em Reais.
              </p>
            </div>
          )}

          {/* Quick Preset Gram Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Pesos Mais Pedidos (Atalhos Rápidos)
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                {(weightKg * 1000).toFixed(0)}g selecionado
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {PRESET_GRAMS.map((item) => {
                const isSelected = Math.abs(weightKg - item.grams / 1000) < 0.005;
                return (
                  <button
                    key={item.grams}
                    type="button"
                    onClick={() => applyGrams(item.grams)}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-sm scale-102 font-black'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Calculation Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300/80 rounded-2xl p-4 shadow-xs">
            <div className="flex justify-between items-center text-xs sm:text-sm text-amber-900 pb-2 border-b border-amber-200/60">
              <span className="font-semibold flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-700" />
                Peso Calculado:
              </span>
              <span className="font-black text-base text-gray-900">
                {weightKg.toFixed(3).replace('.', ',')} kg{' '}
                <span className="text-xs text-gray-500 font-normal">
                  ({(weightKg * 1000).toFixed(0)} gramas)
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-sm text-amber-900 py-1.5 border-b border-amber-200/60">
              <span className="font-semibold">Preço por quilo:</span>
              <span className="font-bold text-gray-700">
                R$ {pricePerKg.toFixed(2).replace('.', ',')} / kg
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2">
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
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Fatiada bem fina, sem capa de gordura, mal passada..."
              className="w-full text-sm border border-gray-300 rounded-xl p-3 focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={weightKg <= 0}
            className="flex-1 bg-red-600 hover:bg-red-700 active:scale-98 disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Check className="w-5 h-5" />
            Adicionar {weightKg.toFixed(3).replace('.', ',')} kg (R$ {totalPrice.toFixed(2).replace('.', ',')})
          </button>
        </div>
      </div>
    </div>
  );
}
