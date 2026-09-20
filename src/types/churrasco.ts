export interface MeatItem {
  id: string;
  name: string;
  category: 'Bovina' | 'Suína' | 'Frango' | 'Embutidos' | 'Outros';
  percentage: number; // Suggested proportion %
  kg: number;
  pricePerKg: number;
  total: number;
  selected: boolean;
  isCustom?: boolean;
}

export interface SideItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  selected: boolean;
  isCustom?: boolean;
}

export interface DrinkItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  selected: boolean;
  isCustom?: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  selected: boolean;
  isCustom?: boolean;
}

export interface EventQuote {
  id?: string;
  clientName: string;
  clientPhone: string;
  eventDate: string;
  eventTime?: string;
  eventLocation?: string;
  eventType?: string;
  durationHours: number;
  totalGuests: number;
  gramsPerPerson?: number;
  adultsMen?: number;
  adultsWomen?: number;
  children?: number;
  gramsPerMan?: number;
  gramsPerWoman?: number;
  gramsPerChild?: number;
  totalMeatKg: number;
  meats: MeatItem[];
  sides: SideItem[];
  drinks: DrinkItem[];
  services: ServiceItem[];
  subtotal: number;
  profit?: number;
  profitPercent?: number;
  profitPerPerson?: number;
  discount: number;
  total: number;
  pricePerPerson: number;
  paymentTerms?: string;
  notes?: string;
  status: 'pendente' | 'enviado' | 'aceito' | 'recusado' | 'aprovado' | 'realizado' | 'cancelado';
  createdAt: string;
  updatedAt?: string;
}
