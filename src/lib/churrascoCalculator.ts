import { MeatItem } from '../types/churrasco';

export interface MeatCalculationResult {
  gramsPerPerson: number;
  kgPerPerson: number;
  totalWeightKg: number;
  totalGuests: number;
  durationHours: number;
  appetiteCategory: 'leve' | 'tradicional' | 'farto' | 'festival';
  appetiteLabel: string;
  appetiteDescription: string;
}

/**
 * Calcula a quantidade de gramas de carne por pessoa a partir do peso total (em kg) e do número de convidados.
 * @param totalWeightKg Peso total de carnes em quilogramas (ex: 20)
 * @param totalGuests Número total de pessoas/convidados (ex: 40)
 * @returns Quantidade em gramas por pessoa (ex: 500)
 */
export function calculateGramsPerPerson(totalWeightKg: number, totalGuests: number): number {
  if (!totalGuests || totalGuests <= 0 || !totalWeightKg || totalWeightKg <= 0) {
    return 0;
  }
  const grams = (totalWeightKg * 1000) / totalGuests;
  return Math.round(grams);
}

/**
 * Retorna a classificação de consumo com base nas gramas por pessoa.
 */
export function getAppetiteCategory(gramsPerPerson: number): {
  category: 'leve' | 'tradicional' | 'farto' | 'festival';
  label: string;
  description: string;
} {
  if (gramsPerPerson < 320) {
    return {
      category: 'leve',
      label: 'Econômico / Coquetel',
      description: 'Ideal para eventos com fartura de acompanhamentos, entradas ou duração curta.'
    };
  }
  if (gramsPerPerson <= 460) {
    return {
      category: 'tradicional',
      label: 'Padrão Tradicional',
      description: 'Média recomendada de 350g a 450g por pessoa para churrasco completo com guarnições.'
    };
  }
  if (gramsPerPerson <= 620) {
    return {
      category: 'farto',
      label: 'Farto / Carnívoros',
      description: 'Excelente para grupos com alto consumo de carnes nobres e eventos de 4h a 6h.'
    };
  }
  return {
    category: 'festival',
    label: 'Super Farto / Festival',
    description: 'Consumo muito elevado, recomendado para eventos de dia inteiro ou churrascadas longas.'
  };
}

/**
 * Calcula a quantidade de carne recomendada (em kg) a partir do número de convidados e gramas por pessoa.
 * Leva em consideração acréscimo suave para durações superiores a 4 horas.
 */
export function calculateTotalMeatWeight(
  totalGuests: number,
  gramsPerPerson: number = 400,
  durationHours: number = 4
): number {
  if (!totalGuests || totalGuests <= 0) return 0;
  let multiplier = 1.0;
  if (durationHours > 4) {
    multiplier += (durationHours - 4) * 0.05; // 5% por hora extra
  }
  const totalGrams = totalGuests * (gramsPerPerson || 400) * multiplier;
  return Number((totalGrams / 1000).toFixed(2));
}

/**
 * Função utilitária bidirecional completa para o cálculo de carne por pessoa e peso total dinâmicos.
 */
export function calculateMeatPerPersonDetails(
  totalWeightKg: number,
  totalGuests: number,
  durationHours: number = 4
): MeatCalculationResult {
  const guests = Math.max(0, totalGuests);
  const weight = Math.max(0, totalWeightKg);
  const gramsPerPerson = calculateGramsPerPerson(weight, guests);
  const kgPerPerson = Number((gramsPerPerson / 1000).toFixed(3));
  const appetite = getAppetiteCategory(gramsPerPerson);

  return {
    gramsPerPerson,
    kgPerPerson,
    totalWeightKg: weight,
    totalGuests: guests,
    durationHours,
    appetiteCategory: appetite.category,
    appetiteLabel: appetite.label,
    appetiteDescription: appetite.description
  };
}

/**
 * Ajusta a distribuição de peso entre os cortes de carnes selecionados para atingir um peso total específico em kg.
 * Preserva as porcentagens de proporção e recalcula o custo de cada item.
 */
export function adjustMeatDistribution(meats: MeatItem[], targetTotalKg: number): MeatItem[] {
  const selected = meats.filter(m => m.selected);
  if (selected.length === 0 || targetTotalKg <= 0) {
    return meats.map(m => (!m.selected ? { ...m, kg: 0, total: 0 } : m));
  }

  const sumPercentage = selected.reduce((acc, m) => acc + (m.percentage || 1), 0);

  return meats.map(meat => {
    if (!meat.selected) {
      return { ...meat, kg: 0, total: 0 };
    }
    const ratio = (meat.percentage || 1) / (sumPercentage || 1);
    const calculatedKg = Number((targetTotalKg * ratio).toFixed(2));
    const total = Number((calculatedKg * meat.pricePerKg).toFixed(2));
    return {
      ...meat,
      kg: calculatedKg,
      total
    };
  });
}
