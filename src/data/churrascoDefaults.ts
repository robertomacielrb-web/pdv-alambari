import { MeatItem, SideItem, DrinkItem, ServiceItem, EventQuote } from '../types/churrasco';

export const DEFAULT_MEATS: Omit<MeatItem, 'kg' | 'total'>[] = [
  { id: 'picanha', name: 'Picanha Bovina Especial', category: 'Bovina', percentage: 25, pricePerKg: 98.00, selected: true },
  { id: 'costela_defumada', name: 'Costela Bovina Defumada', category: 'Bovina', percentage: 20, pricePerKg: 64.00, selected: true },
  { id: 'fraldinha', name: 'Fraldinha Red / Vazio', category: 'Bovina', percentage: 20, pricePerKg: 68.00, selected: false },
  { id: 'ancho', name: 'Bife Ancho Angus', category: 'Bovina', percentage: 20, pricePerKg: 85.00, selected: false },
  { id: 'cupim_defumado', name: 'Cupim Casqueirado Defumado', category: 'Bovina', percentage: 15, pricePerKg: 58.00, selected: false },
  { id: 'alcatra_maminha', name: 'Miolo de Alcatra / Maminha', category: 'Bovina', percentage: 20, pricePerKg: 59.00, selected: false },
  { id: 'contrafile', name: 'Contrafilé Grill', category: 'Bovina', percentage: 20, pricePerKg: 62.00, selected: false },
  { id: 'costelinha_bbq', name: 'Costelinha Suína BBQ Defumada', category: 'Suína', percentage: 20, pricePerKg: 54.00, selected: true },
  { id: 'panceta_rolo', name: 'Panceta / Torresmo de Rolo', category: 'Suína', percentage: 15, pricePerKg: 49.00, selected: false },
  { id: 'picanha_suina', name: 'Picanha Suína Marinada', category: 'Suína', percentage: 15, pricePerKg: 46.00, selected: false },
  { id: 'linguica_toscana', name: 'Linguiça Toscana Artesanal Alambari', category: 'Embutidos', percentage: 20, pricePerKg: 38.00, selected: true },
  { id: 'linguica_cuiabana', name: 'Linguiça Cuiabana com Queijo', category: 'Embutidos', percentage: 15, pricePerKg: 46.00, selected: false },
  { id: 'linguica_apimentada', name: 'Linguiça Suína Defumada Apimentada', category: 'Embutidos', percentage: 15, pricePerKg: 42.00, selected: false },
  { id: 'tulipa_frango', name: 'Coxinha da Asa / Tulipa Marinada', category: 'Frango', percentage: 15, pricePerKg: 28.00, selected: true },
  { id: 'sobrecoxa_defumada', name: 'Sobrecoxa Desossada Defumada', category: 'Frango', percentage: 15, pricePerKg: 32.00, selected: false },
  { id: 'coracao_frango', name: 'Coração de Frango Temperado', category: 'Frango', percentage: 10, pricePerKg: 42.00, selected: false },
  { id: 'pao_alho', name: 'Pão de Alho Especial Recheado', category: 'Outros', percentage: 10, pricePerKg: 35.00, selected: false },
  { id: 'queijo_coalho', name: 'Queijo Coalho com Orégano', category: 'Outros', percentage: 10, pricePerKg: 48.00, selected: false },
];

export const DEFAULT_SIDES: SideItem[] = [
  { id: 'arroz_branco', name: 'Arroz Branco Tradicional', quantity: 1, unit: 'porção/travessa', price: 35.00, total: 35.00, selected: true },
  { id: 'arroz_carreteiro', name: 'Arroz Carreteiro com Carne Defumada', quantity: 1, unit: 'porção/travessa', price: 65.00, total: 65.00, selected: false },
  { id: 'farofa_bacon', name: 'Farofa Crocante Especial com Bacon Alambari', quantity: 1, unit: 'kg', price: 35.00, total: 35.00, selected: true },
  { id: 'vinagrete', name: 'Vinagrete Especial com Ervas Frescas', quantity: 1, unit: 'kg', price: 30.00, total: 30.00, selected: true },
  { id: 'maionese', name: 'Maionese Caseira de Batata com Alho', quantity: 1, unit: 'kg', price: 38.00, total: 38.00, selected: false },
  { id: 'pao_frances', name: 'Pão Francês Fresquinho', quantity: 30, unit: 'unidades', price: 1.00, total: 30.00, selected: true },
  { id: 'salada_verde', name: 'Salada Verde Mix com Tomate Cereja', quantity: 1, unit: 'travessa', price: 40.00, total: 40.00, selected: false },
];

export const DEFAULT_DRINKS: DrinkItem[] = [
  { id: 'chopp_pilsen', name: 'Barril Chopp Pilsen Artesanal (30L / 50L)', quantity: 1, unit: 'barril 30L', price: 420.00, total: 420.00, selected: false },
  { id: 'cerveja_latas', name: 'Cerveja Puro Malte (Pack c/ 12)', quantity: 2, unit: 'pack 12 un', price: 58.00, total: 116.00, selected: false },
  { id: 'refrigerante_2l', name: 'Refrigerante Coca-Cola / Guaraná 2L', quantity: 6, unit: 'garrafa 2L', price: 12.00, total: 72.00, selected: true },
  { id: 'agua_mineral', name: 'Água Mineral sem Gás 500ml (Fardo 12un)', quantity: 2, unit: 'fardo 12un', price: 24.00, total: 48.00, selected: true },
  { id: 'suco_natural', name: 'Suco Natural de Frutas 1L', quantity: 4, unit: 'garrafa 1L', price: 15.00, total: 60.00, selected: false },
  { id: 'gelo_cubos', name: 'Gelo em Cubos Filtrado (Saco 5kg)', quantity: 4, unit: 'saco 5kg', price: 15.00, total: 60.00, selected: true },
  { id: 'carvao_vegetal', name: 'Carvão Vegetal Selecionado (Saco 10kg)', quantity: 2, unit: 'saco 10kg', price: 38.00, total: 76.00, selected: true },
];

export const DEFAULT_SERVICES: ServiceItem[] = [
  { id: 'churrasqueiro', name: 'Mestre Churrasqueiro Profissional (até 5h de evento)', quantity: 1, unit: 'diária', price: 350.00, total: 350.00, selected: true },
  { id: 'auxiliar', name: 'Auxiliar / Ajudante de Assador', quantity: 1, unit: 'diária', price: 200.00, total: 200.00, selected: false },
  { id: 'garcom', name: 'Garçom / Atendente de Mesa e Bebidas (5h)', quantity: 1, unit: 'diária', price: 200.00, total: 200.00, selected: false },
  { id: 'locacao_grelhas', name: 'Locação de Rechauds, Grelhas e Tábuas Especiais', quantity: 1, unit: 'kit', price: 120.00, total: 120.00, selected: false },
  { id: 'deslocamento', name: 'Taxa de Deslocamento / Frete da Equipe', quantity: 1, unit: 'serviço', price: 60.00, total: 60.00, selected: true },
  { id: 'descartaveis', name: 'Kit Descartáveis Premium (Pratos, Garfos, Copos e Guardanapos)', quantity: 1, unit: 'kit', price: 80.00, total: 80.00, selected: false },
];

export function calculateRecommendedMeatKg(
  people: number,
  gramsPerPerson: number = 400,
  durationHours: number = 4
): number {
  let multiplier = 1.0;
  if (durationHours > 4) {
    // Acréscimo suave de ~5% por hora excedente
    multiplier += (durationHours - 4) * 0.05;
  }
  const totalGrams = (people || 0) * (gramsPerPerson || 400) * multiplier;
  return Number((totalGrams / 1000).toFixed(2));
}

export function distributeMeatsProportionally(meats: MeatItem[], targetKg: number): MeatItem[] {
  const selected = meats.filter(m => m.selected);
  if (selected.length === 0 || targetKg <= 0) {
    return meats.map(m => ({ ...m, kg: 0, total: 0 }));
  }

  const sumPercentage = selected.reduce((acc, m) => acc + (m.percentage || 1), 0);

  return meats.map(meat => {
    if (!meat.selected) {
      return { ...meat, kg: 0, total: 0 };
    }
    const ratio = (meat.percentage || 1) / (sumPercentage || 1);
    const calculatedKg = Number((targetKg * ratio).toFixed(2));
    const total = Number((calculatedKg * meat.pricePerKg).toFixed(2));
    return {
      ...meat,
      kg: calculatedKg,
      total
    };
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

export function formatWhatsAppProposal(quote: EventQuote, storeSettings?: { whatsappNumber?: string; storeName?: string; pixKey?: string }): string {
  const storeName = storeSettings?.storeName || 'PDV ALAMBARI DEFUMADOS';
  const selectedMeats = quote.meats.filter(m => m.selected && m.kg > 0);
  const selectedSides = quote.sides.filter(s => s.selected);
  const selectedDrinks = quote.drinks.filter(d => d.selected);
  const selectedServices = quote.services.filter(srv => srv.selected);

  let msg = `🔥 *${storeName}* 🔥\n`;
  msg += `📋 *PROPOSTA DE ORÇAMENTO - EVENTO DE CHURRASCO*\n\n`;
  
  msg += `Olá, *${quote.clientName || 'Cliente'}*! Segue o orçamento personalizado para o seu evento:\n\n`;
  
  msg += `📅 *DADOS DO EVENTO*\n`;
  msg += `• Data: ${quote.eventDate ? new Date(quote.eventDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir'}\n`;
  if (quote.eventTime) msg += `• Horário: ${quote.eventTime}\n`;
  if (quote.eventLocation) msg += `• Local: ${quote.eventLocation}\n`;
  if (quote.eventType) msg += `• Tipo de Evento: ${quote.eventType}\n`;
  msg += `• Duração estimada: ${quote.durationHours} horas\n`;
  msg += `• Convidados: *${quote.totalGuests} pessoas*\n\n`;

  msg += `🥩 *CARDÁPIO DE CARNES SELECIONADAS*\n`;
  selectedMeats.forEach(meat => {
    msg += `• ${meat.name}\n`;
  });
  msg += `\n`;

  if (selectedSides.length > 0) {
    msg += `🥗 *ACOMPANHAMENTOS*\n`;
    selectedSides.forEach(side => {
      msg += `• ${side.name}\n`;
    });
    msg += `\n`;
  }

  if (selectedDrinks.length > 0) {
    msg += `🍻 *BEBIDAS & INSUMOS*\n`;
    selectedDrinks.forEach(drink => {
      msg += `• ${drink.name}\n`;
    });
    msg += `\n`;
  }

  if (selectedServices.length > 0) {
    msg += `👨‍🍳 *SERVIÇOS & EQUIPE INCLUSOS*\n`;
    selectedServices.forEach(srv => {
      msg += `• ${srv.name}\n`;
    });
    msg += `\n`;
  }

  msg += `💰 *VALOR FINAL DO EVENTO*\n`;
  msg += `• Investimento Total: *${formatCurrency(quote.total)}*\n`;
  if (quote.totalGuests > 0) {
    msg += `• Valor por Convidado (Tudo Incluso): *${formatCurrency(quote.pricePerPerson)} / pessoa*\n`;
  }
  if (quote.discount > 0) {
    msg += `• Desconto Especial: -${formatCurrency(quote.discount)}\n`;
  }
  msg += `\n`;

  msg += `💳 *CONDIÇÕES DE PAGAMENTO*\n`;
  msg += `• ${quote.paymentTerms || '50% de sinal na confirmação da data e 50% até o dia do evento.'}\n`;
  if (storeSettings?.pixKey) {
    msg += `• Chave Pix: \`${storeSettings.pixKey}\`\n`;
  }
  msg += `\n`;

  if (quote.notes) {
    msg += `📝 *OBSERVAÇÕES*\n${quote.notes}\n\n`;
  }

  msg += `Ficamos à disposição para tirar qualquer dúvida ou ajustar itens ao seu gosto! Aguardamos sua confirmação para reservar a data! 🙌`;

  return msg;
}

/**
 * Creates an objective executive summary for WhatsApp Web.
 */
export function formatWhatsAppSummary(
  quote: EventQuote,
  storeSettings?: { storeName?: string; pixKey?: string }
): string {
  const storeName = storeSettings?.storeName || 'ALAMBARI DEFUMADOS';
  const clientGreeting = quote.clientName ? `Olá, *${quote.clientName}*! ` : 'Olá! ';
  const eventDateFormatted = quote.eventDate
    ? new Date(quote.eventDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A definir';

  const selectedMeats = quote.meats.filter(m => m.selected && m.kg > 0).map(m => m.name);

  let msg = `🔥 *${storeName} - RESUMO DO ORÇAMENTO* 🔥\n\n`;
  msg += `${clientGreeting}Segue o resumo da proposta para o seu churrasco:\n\n`;
  msg += `📅 *Data:* ${eventDateFormatted}${quote.eventTime ? ` às ${quote.eventTime}` : ''}\n`;
  if (quote.eventLocation) msg += `📍 *Local:* ${quote.eventLocation}\n`;
  msg += `👥 *Convidados:* ${quote.totalGuests} pessoas (${quote.durationHours}h de serviço)\n`;
  if (selectedMeats.length > 0) {
    msg += `🥩 *Carnes:* ${selectedMeats.join(', ')}\n`;
  }
  msg += `\n`;
  msg += `💰 *VALORES:* \n`;
  if (quote.totalGuests > 0) {
    msg += `👉 *${formatCurrency(quote.pricePerPerson)} / pessoa* (Tudo incluso: carnes nobres, guarnições e equipe)\n`;
  }
  msg += `👉 *Investimento Total:* *${formatCurrency(quote.total)}*\n`;
  if (quote.discount > 0) {
    msg += `• Desconto aplicado: -${formatCurrency(quote.discount)}\n`;
  }
  msg += `\n`;
  msg += `💳 *Condições:* ${quote.paymentTerms || '50% de sinal para reserva da data e o restante no dia do evento.'}\n`;
  if (storeSettings?.pixKey) {
    msg += `🔑 *Chave Pix:* \`${storeSettings.pixKey}\` (Sinal 50%: *${formatCurrency(quote.total * 0.5)}*)\n`;
  }
  msg += `\nPodemos fechar a reserva da sua data? Qualquer dúvida estou à disposição! 🤝`;
  return msg;
}

