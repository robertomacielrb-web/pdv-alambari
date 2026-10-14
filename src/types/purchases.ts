export interface PurchaseItem {
  id: string;
  productId?: string;
  name: string;
  category?: string;
  quantity: number;
  unit: 'kg' | 'un' | 'cx' | 'pct' | 'fd' | 'l' | string;
  unitPrice: number;
  totalPrice: number;
  observation?: string;
}

export type PurchaseOrderStatus = 
  | 'rascunho'
  | 'enviado'
  | 'confirmado'
  | 'recebido'
  | 'cancelado';

export interface PurchaseOrder {
  id?: string;
  orderNumber: string;
  supplierName: string;
  supplierPhone?: string;
  supplierContact?: string;
  supplierCnpj?: string;
  status: PurchaseOrderStatus;
  items: PurchaseItem[];
  subtotal: number;
  discount?: number;
  shippingFee?: number;
  total: number;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  receivedAt?: string;
  syncedToBills?: boolean;
}

export interface SupplierQuickInfo {
  name: string;
  phone?: string;
  contact?: string;
  cnpj?: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: 'kg' | 'un' | 'cx' | 'pct' | 'fd' | 'l' | 'saco' | 'lata' | 'bdj' | string;
  estimatedPrice?: number;
  totalEstimated?: number;
  checked?: boolean;
  notes?: string;
  productId?: string;
}

export type ShoppingListStatus = 'aberta' | 'em_compras' | 'concluida' | 'arquivada';

export interface ShoppingList {
  id?: string;
  title: string;
  destination?: string;
  supplierName?: string;
  supplierPhone?: string;
  buyerName?: string;
  targetDate?: string;
  status: ShoppingListStatus;
  items: ShoppingListItem[];
  totalEstimated: number;
  totalActual?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}
