export interface DeliveryRegion {
  id: string;
  name: string;
  fee: number;
}

export const DEFAULT_DELIVERY_REGIONS: DeliveryRegion[] = [
  { id: 'praca', name: 'Região da praça', fee: 3 },
  { id: 'sao_judas', name: 'Região da igreja São judas', fee: 5 },
  { id: 'top_club', name: 'Região top club / trutas', fee: 10 },
  { id: 'acima_top_club', name: 'Acima top club (sapo)', fee: 15 },
  { id: 'ecovillage', name: 'Ecovillage', fee: 7 },
  { id: 'vila', name: 'Região da vila', fee: 8 },
  { id: 'sao_sebastiao', name: 'Região igreja São Sebastião', fee: 10 },
  { id: 'pedra_sonora', name: 'Região pedra sonora', fee: 12 },
  { id: 'corsino', name: 'Corsino', fee: 10 },
  { id: 'haras', name: 'Haras', fee: 10 },
  { id: 'camping', name: 'Camping', fee: 12 },
  { id: 'acima_camping', name: 'Acima do camping', fee: 15 },
];
