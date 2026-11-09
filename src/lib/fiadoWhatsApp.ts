import { format } from "date-fns";

export interface FiadoWhatsAppItem {
  name: string;
  quantity: number | string;
  price: number | string;
  unit?: string;
  observation?: string;
}

export interface FiadoWhatsAppOrder {
  id?: string;
  customerName?: string;
  customerPhone?: string;
  items: FiadoWhatsAppItem[];
  total: number;
  discount?: number;
  createdAt?: string;
  password?: number;
}

export interface FiadoStoreSettings {
  storeName?: string;
  pixKey?: string;
  whatsappNumber?: string;
}

/**
 * Clean phone numbers to international WhatsApp format (defaults to Brazil +55)
 */
export function cleanWhatsAppNumber(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  // If user already typed with country code e.g. 5511999999999
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  // Brazil mobile/landline with DDD (10 or 11 digits)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Formats a phone number for display e.g. (11) 99999-9999
 */
export function formatPhoneDisplay(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Builds the official WhatsApp text representation of a Fiado account bill.
 */
export function formatFiadoWhatsAppMessage(
  order: FiadoWhatsAppOrder,
  settings?: FiadoStoreSettings
): string {
  const store = settings?.storeName || "Alambari Defumados";
  const clientName = (order.customerName || "Cliente").trim();
  let dateFormatted = "";
  try {
    dateFormatted = order.createdAt
      ? format(new Date(order.createdAt), "dd/MM/yyyy • HH:mm")
      : format(new Date(), "dd/MM/yyyy • HH:mm");
  } catch {
    dateFormatted = format(new Date(), "dd/MM/yyyy • HH:mm");
  }

  const itemsList = (order.items || [])
    .map((item) => {
      const isKg = item.unit === "kg";
      const qtyText = isKg
        ? `${Number(item.quantity).toFixed(3).replace(".", ",")} kg`
        : `${Number(item.quantity)}x`;
      const priceNum = Number(item.price) || 0;
      const qtyNum = Number(item.quantity) || 1;
      const subtotalText = (priceNum * qtyNum).toFixed(2).replace(".", ",");
      const obsText = item.observation ? ` _(Obs: ${item.observation})_` : "";

      return `▫️ *${qtyText}* ${item.name} - R$ ${subtotalText}${obsText}`;
    })
    .join("\n");

  const subtotal = (order.items || []).reduce(
    (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0
  );
  const discountVal = Number(order.discount) || 0;
  const totalVal = Number(order.total) || Math.max(0, subtotal - discountVal);

  let msg = `*🍢 ${store.toUpperCase()}*\n`;
  msg += `📋 *CONTA FIADO / EXTRATO DE CONSUMO*\n`;
  msg += `--------------------------------------\n`;
  msg += `👤 *Cliente:* ${clientName}\n`;
  msg += `📅 *Data:* ${dateFormatted}\n`;
  if (order.password) {
    msg += `🔢 *Comanda:* #${order.password}\n`;
  }
  msg += `--------------------------------------\n\n`;

  msg += `*ITENS CONSUMIDOS:*\n`;
  msg += itemsList ? `${itemsList}\n\n` : `_(Nenhum item registrado no momento)_\n\n`;

  if (discountVal > 0) {
    msg += `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\n`;
    msg += `🏷️ Desconto: - R$ ${discountVal.toFixed(2).replace(".", ",")}\n`;
  }

  msg += `💰 *TOTAL A PAGAR: R$ ${totalVal.toFixed(2).replace(".", ",")}*\n\n`;

  if (settings?.pixKey?.trim()) {
    msg += `🔑 *Chave PIX para pagamento:*\n`;
    msg += `\`${settings.pixKey.trim()}\`\n`;
    msg += `_(Copie e cole a chave PIX acima no app do seu banco)_\n\n`;
  }

  msg += `⚠️ _Caso já tenha efetuado o pagamento via PIX ou transferência, por favor nos envie o comprovante nesta conversa para darmos baixa na sua conta._\n\n`;
  msg += `Qualquer dúvida estamos à disposição. Muito obrigado pela preferência! ✨`;

  return msg;
}

/**
 * Builds the URL to open WhatsApp with pre-filled message.
 */
export function buildFiadoWhatsAppUrl(
  order: FiadoWhatsAppOrder,
  settings?: FiadoStoreSettings,
  phoneOverride?: string
): string {
  const text = formatFiadoWhatsAppMessage(order, settings);
  const rawPhone = phoneOverride || order.customerPhone || "";
  const cleanPhone = cleanWhatsAppNumber(rawPhone);
  const encodedText = encodeURIComponent(text);

  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Opens WhatsApp in a new browser tab.
 */
export function sendFiadoWhatsApp(
  order: FiadoWhatsAppOrder,
  settings?: FiadoStoreSettings,
  phoneOverride?: string
): void {
  const url = buildFiadoWhatsAppUrl(order, settings, phoneOverride);
  window.open(url, "_blank");
}
