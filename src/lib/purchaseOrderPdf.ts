import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseOrder, ShoppingList } from '../types/purchases';

export interface PurchaseStoreSettings {
  storeName?: string;
  whatsappNumber?: string;
  pixKey?: string;
}

export function formatCurrencyBRL(value: number): string {
  return (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generates and downloads a professional Purchase Order PDF.
 */
export function generatePurchaseOrderPDF(
  order: PurchaseOrder,
  storeSettings?: PurchaseStoreSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const storeName = storeSettings?.storeName || 'ALAMBARI DEFUMADOS';
  const storePhone = storeSettings?.whatsappNumber || '';

  // Palette: Deep Burgundy/Red (#991b1b), Slate (#1e293b), Muted (#64748b)
  const primaryRed: [number, number, number] = [153, 27, 27];
  const darkSlate: [number, number, number] = [30, 41, 59];
  const mutedText: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [248, 250, 252];

  let currentY = 0;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...primaryRed);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Main Header Block
  currentY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primaryRed);
  doc.text(storeName.toUpperCase(), margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  currentY += 4.5;
  doc.text(
    `Setor de Compras & Suprimentos | ${storePhone ? `WhatsApp: ${storePhone} | ` : ''}Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    margin,
    currentY
  );

  // Right-aligned Title & Order Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkSlate);
  doc.text('PEDIDO DE COMPRA', pageWidth - margin, 16, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryRed);
  doc.text(order.orderNumber || '#PC-001', pageWidth - margin, 21.5, { align: 'right' });

  // Status Badge
  const statusLabels: Record<string, string> = {
    rascunho: 'RASCUNHO',
    enviado: 'ENVIADO AO FORNECEDOR',
    confirmado: 'CONFIRMADO',
    recebido: 'RECEBIDO / CONCLUÍDO',
    cancelado: 'CANCELADO',
  };
  const statusText = statusLabels[order.status] || order.status.toUpperCase();
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text(`STATUS: ${statusText}`, pageWidth - margin, 26, { align: 'right' });

  // Divider Line
  currentY = 28;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 3. Information Cards (Supplier & Commercial Terms)
  currentY += 5;
  const colWidth = (contentWidth - 6) / 2;

  // Box 1: Fornecedor (Left)
  doc.setFillColor(...lightBg);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, colWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryRed);
  doc.text('DADOS DO FORNECEDOR', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkSlate);
  doc.text(order.supplierName || 'Fornecedor não informado', margin + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);

  let suppInfoY = currentY + 17;
  if (order.supplierContact) {
    doc.text(`Contato / Vendedor: ${order.supplierContact}`, margin + 4, suppInfoY);
    suppInfoY += 4.5;
  }
  if (order.supplierPhone) {
    doc.text(`Telefone / WhatsApp: ${order.supplierPhone}`, margin + 4, suppInfoY);
    suppInfoY += 4.5;
  }
  if (order.supplierCnpj) {
    doc.text(`CNPJ / CPF: ${order.supplierCnpj}`, margin + 4, suppInfoY);
  }

  // Box 2: Condições & Entrega (Right)
  const rightColX = margin + colWidth + 6;
  doc.setFillColor(...lightBg);
  doc.roundedRect(rightColX, currentY, colWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryRed);
  doc.text('CONDIÇÕES DO FORNECIMENTO', rightColX + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkSlate);

  let condY = currentY + 12;
  const formattedDelivery = order.expectedDeliveryDate
    ? new Date(order.expectedDeliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A combinar com fornecedor';
  doc.text(`Previsão de Entrega: `, rightColX + 4, condY);
  doc.setFont('helvetica', 'bold');
  doc.text(formattedDelivery, rightColX + 36, condY);

  condY += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Condição de Pagamento: `, rightColX + 4, condY);
  doc.setFont('helvetica', 'bold');
  doc.text(order.paymentTerms || 'A combinar', rightColX + 42, condY);

  condY += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Local de Entrega: `, rightColX + 4, condY);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName, rightColX + 30, condY);

  currentY += 40;

  // 4. Products / Items Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkSlate);
  doc.text('ITENS SOLICITADOS NO PEDIDO', margin, currentY);
  currentY += 3;

  const tableBody = (order.items || []).map((item, idx) => {
    const formattedQty = item.unit === 'kg'
      ? `${Number(item.quantity || 0).toFixed(3).replace('.', ',')} kg`
      : `${item.quantity || 0} ${item.unit || 'un'}`;

    const formattedUnit = item.unitPrice > 0 ? formatCurrencyBRL(item.unitPrice) : 'A cotar';
    const formattedTotal = item.totalPrice > 0 ? formatCurrencyBRL(item.totalPrice) : 'A cotar';

    return [
      String(idx + 1),
      item.name || 'Produto',
      item.category || '-',
      formattedQty,
      formattedUnit,
      formattedTotal,
      item.observation || '',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Descrição do Item / Insumo', 'Categoria', 'Qtd', 'Preço Unit.', 'Total (R$)', 'Observações']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryRed,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkSlate,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 26, textColor: mutedText },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: primaryRed },
      6: { cellWidth: 32, fontSize: 7.5, textColor: mutedText },
    },
    margin: { left: margin, right: margin },
  });

  // Get table end position
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : currentY + 30;

  // 5. Totals & Notes Section
  let bottomY = finalY;

  // Check if we need a new page for totals & signatures
  if (bottomY > pageHeight - 55) {
    doc.addPage();
    bottomY = margin + 10;
  }

  const totalsBoxWidth = 72;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;

  // Left: Instructions & Notes
  const notesWidth = contentWidth - totalsBoxWidth - 8;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, bottomY, notesWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkSlate);
  doc.text('INSTRUÇÕES DE ENTREGA & OBSERVAÇÕES:', margin + 4, bottomY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  const noteLines = doc.splitTextToSize(
    order.notes ||
      '• Conferir quantidade e integridade dos itens no ato do descarregamento.\n• Acompanhar Nota Fiscal Eletrônica (DANFE) correspondente ao pedido.\n• Horário de recebimento: Segunda a Sábado em horário comercial.',
    notesWidth - 8
  );
  doc.text(noteLines, margin + 4, bottomY + 11);

  // Right: Totals Box
  doc.setFillColor(...lightBg);
  doc.roundedRect(totalsBoxX, bottomY, totalsBoxWidth, 34, 2, 2, 'FD');

  let totY = bottomY + 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  doc.text('Subtotal dos Itens:', totalsBoxX + 4, totY);
  doc.text(formatCurrencyBRL(order.subtotal || order.total || 0), totalsBoxX + totalsBoxWidth - 4, totY, { align: 'right' });

  if (order.shippingFee && order.shippingFee > 0) {
    totY += 5;
    doc.text('Frete:', totalsBoxX + 4, totY);
    doc.text(formatCurrencyBRL(order.shippingFee), totalsBoxX + totalsBoxWidth - 4, totY, { align: 'right' });
  }

  if (order.discount && order.discount > 0) {
    totY += 5;
    doc.text('Desconto:', totalsBoxX + 4, totY);
    doc.setTextColor(5, 150, 105);
    doc.text(`- ${formatCurrencyBRL(order.discount)}`, totalsBoxX + totalsBoxWidth - 4, totY, { align: 'right' });
    doc.setTextColor(...mutedText);
  }

  totY = bottomY + 28;
  doc.setFillColor(254, 242, 242);
  doc.rect(totalsBoxX, bottomY + 22, totalsBoxWidth, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryRed);
  doc.text('TOTAL DO PEDIDO:', totalsBoxX + 4, totY);
  doc.setFontSize(11);
  doc.text(formatCurrencyBRL(order.total || 0), totalsBoxX + totalsBoxWidth - 4, totY, { align: 'right' });

  // 6. Signatures Area
  let signY = bottomY + 45;
  if (signY > pageHeight - 25) {
    doc.addPage();
    signY = margin + 20;
  }

  const signWidth = (contentWidth - 20) / 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);

  // Buyer Signature
  doc.line(margin, signY, margin + signWidth, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text(storeName.toUpperCase(), margin + signWidth / 2, signY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text('Comprador / Responsável pelo Pedido', margin + signWidth / 2, signY + 7.5, { align: 'center' });

  // Supplier Acceptance Signature
  const suppSignX = margin + signWidth + 20;
  doc.line(suppSignX, signY, suppSignX + signWidth, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text((order.supplierName || 'FORNECEDOR').toUpperCase(), suppSignX + signWidth / 2, signY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text('Aceite e Confirmação de Entrega', suppSignX + signWidth / 2, signY + 7.5, { align: 'center' });

  // Footer: Page Number & Verification
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    doc.text(
      `Pedido gerado automaticamente pelo PDV ${storeName} | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Downloads the PDF directly with a normalized filename.
 */
export function exportPurchaseOrderPDF(
  order: PurchaseOrder,
  storeSettings?: PurchaseStoreSettings
): void {
  const doc = generatePurchaseOrderPDF(order, storeSettings);
  const cleanSupplier = (order.supplierName || 'Fornecedor').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanOrderNum = (order.orderNumber || 'PC-001').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Pedido_Compra_${cleanOrderNum}_${cleanSupplier}.pdf`;
  doc.save(fileName);
}

/**
 * Generates the clean WhatsApp formatted text representation of the Purchase Order.
 */
export function formatPurchaseOrderWhatsApp(
  order: PurchaseOrder,
  storeSettings?: PurchaseStoreSettings
): string {
  const storeName = storeSettings?.storeName || 'Alambari Defumados';
  const deliveryFormatted = order.expectedDeliveryDate
    ? new Date(order.expectedDeliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A combinar';

  const itemsText = (order.items || [])
    .map((item) => {
      const formattedQty = item.unit === 'kg'
        ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg`
        : `${item.quantity} ${item.unit || 'un'}`;
      const priceText = item.unitPrice > 0 ? ` (R$ ${item.unitPrice.toFixed(2).replace('.', ',')}/${item.unit})` : '';
      const totalText = item.totalPrice > 0 ? ` = R$ ${item.totalPrice.toFixed(2).replace('.', ',')}` : '';
      const obsText = item.observation ? ` [Obs: ${item.observation}]` : '';
      return `• *${item.name}*: ${formattedQty}${priceText}${totalText}${obsText}`;
    })
    .join('\n');

  return `🥩 *PEDIDO DE COMPRA - ${storeName.toUpperCase()}*
📋 *Pedido Nº:* ${order.orderNumber || '#PC-001'}
👤 *Fornecedor:* ${order.supplierName || 'Fornecedor'}
${order.supplierContact ? `🤝 *Contato:* ${order.supplierContact}\n` : ''}📅 *Data do Pedido:* ${new Date(order.createdAt).toLocaleDateString('pt-BR')}
🚚 *Previsão de Entrega:* ${deliveryFormatted}
💳 *Condição de Pagamento:* ${order.paymentTerms || 'A combinar'}

📦 *ITENS DO PEDIDO:*
${itemsText}

💰 *VALOR TOTAL: R$ ${(order.total || 0).toFixed(2).replace('.', ',')}*
${order.notes ? `\n📝 *Observações:* ${order.notes}\n` : ''}
📄 _O PDF oficial deste Pedido de Compra foi gerado e está disponível em anexo para conferência._

Por favor, confirme o recebimento deste pedido e o prazo de entrega. Obrigado!`.trim();
}

/**
 * Generates and downloads a clean, professional Shopping List PDF (Lista de Compras).
 */
export function generateShoppingListPDF(
  list: ShoppingList,
  storeSettings?: PurchaseStoreSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const storeName = storeSettings?.storeName || 'ALAMBARI DEFUMADOS';
  const storePhone = storeSettings?.whatsappNumber || '';

  const primaryRed: [number, number, number] = [153, 27, 27];
  const darkSlate: [number, number, number] = [30, 41, 59];
  const mutedText: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [248, 250, 252];

  let currentY = 0;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...primaryRed);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Main Header Block
  currentY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primaryRed);
  doc.text(storeName.toUpperCase(), margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  currentY += 4.5;
  const issueDate = new Date().toLocaleDateString('pt-BR');
  const issueTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.text(
    `Setor de Compras & Suprimentos | ${storePhone ? `WhatsApp: ${storePhone} | ` : ''}Emissão: ${issueDate} às ${issueTime}`,
    margin,
    currentY
  );

  // Right-aligned Title & Status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...darkSlate);
  doc.text('LISTA DE COMPRAS', pageWidth - margin, 16, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryRed);
  doc.text(list.title || 'Suprimentos & Reposição', pageWidth - margin, 21.5, { align: 'right' });

  // Status Badge
  const statusLabels: Record<string, string> = {
    aberta: 'EM ABERTO / PLANEJAMENTO',
    em_compras: 'EM ANDAMENTO (COMPRANDO)',
    concluida: 'COMPRAS CONCLUÍDAS',
    arquivada: 'ARQUIVADA',
  };
  const statusText = statusLabels[list.status] || list.status.toUpperCase();
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text(`STATUS: ${statusText}`, pageWidth - margin, 26, { align: 'right' });

  // Divider Line
  currentY = 28;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 3. Information Cards (Destination, Buyer, Target Date, Counters)
  currentY += 4;
  const colWidth = (contentWidth - 6) / 2;

  // Box 1: Destino / Fornecedor
  doc.setFillColor(...lightBg);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, colWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryRed);
  doc.text('DESTINO / LOCAL DE COMPRA', margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkSlate);
  const destName = list.destination || list.supplierName || 'Mercado Geral / Fornecedores Variados';
  doc.text(destName, margin + 4, currentY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  if (list.supplierPhone) {
    doc.text(`Contato / WhatsApp: ${list.supplierPhone}`, margin + 4, currentY + 16.5);
  } else if (list.buyerName) {
    doc.text(`Responsável: ${list.buyerName}`, margin + 4, currentY + 16.5);
  } else {
    doc.text('Uso interno e conferência de insumos', margin + 4, currentY + 16.5);
  }

  // Box 2: Resumo e Data Prevista
  const box2X = margin + colWidth + 6;
  doc.setFillColor(...lightBg);
  doc.roundedRect(box2X, currentY, colWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryRed);
  doc.text('PLANEJAMENTO & METAS', box2X + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkSlate);
  const targetDateStr = list.targetDate
    ? new Date(list.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date(list.createdAt).toLocaleDateString('pt-BR');
  doc.text(`Data Prevista: ${targetDateStr}`, box2X + 4, currentY + 11.5);

  const totalItemsCount = list.items?.length || 0;
  const checkedItemsCount = (list.items || []).filter((it) => it.checked).length;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryRed);
  doc.text(
    `Total de Itens: ${totalItemsCount} ${checkedItemsCount > 0 ? `(${checkedItemsCount} já conferidos)` : ''}`,
    box2X + 4,
    currentY + 17
  );

  currentY += 28;

  // 4. AutoTable for Shopping List Items
  const tableData = (list.items || []).map((item, index) => {
    const isChecked = Boolean(item.checked);
    const boxSymbol = isChecked ? '[ X ]' : '[   ]';
    const formattedQty = item.unit === 'kg'
      ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg`
      : `${item.quantity} ${item.unit || 'un'}`;

    const estText = item.estimatedPrice && item.estimatedPrice > 0
      ? `Est: ${formatCurrencyBRL(item.estimatedPrice)}/${item.unit}`
      : '';
    const obsText = item.notes ? `\nObs: ${item.notes}` : '';
    const estCombined = [estText, obsText].filter(Boolean).join('');

    return [
      boxSymbol,
      String(index + 1),
      item.name + (item.notes && !estText ? `\n(${item.notes})` : ''),
      item.category || 'Geral',
      formattedQty,
      estCombined || '—',
      '________________',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['[✓]', '#', 'Item / Insumo / Descrição', 'Categoria', 'Quantidade', 'Estimativa / Obs', 'Valor Pago / Visto']],
    body: tableData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: primaryRed,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
      2: { cellWidth: 'auto', fontStyle: 'bold' },
      3: { cellWidth: 32, fontStyle: 'normal' },
      4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 35, fontStyle: 'normal' },
      6: { cellWidth: 32, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  // 5. Bottom Observations and Summary
  let finalY = (doc as any).lastAutoTable.finalY + 6;

  if (finalY + 36 > pageHeight - 15) {
    doc.addPage();
    finalY = margin + 10;
  }

  // Left: Instructions / Notes box
  const notesWidth = contentWidth * 0.62;
  const totalsBoxWidth = contentWidth - notesWidth - 6;
  const totalsBoxX = margin + notesWidth + 6;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, finalY, notesWidth, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkSlate);
  doc.text('LEMBRETES & OBSERVAÇÕES DE COMPRA:', margin + 4, finalY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  const noteLines = doc.splitTextToSize(
    list.notes ||
      '• Conferir datas de validade, embalagens e estado dos cortes.\n• Solicitar cupom fiscal ou nota para lançamento no caixa/contabilidade.\n• Marcar com visto ou "X" cada item conferido ao colocar no carrinho.',
    notesWidth - 8
  );
  doc.text(noteLines, margin + 4, finalY + 11);

  // Right: Summary Box
  doc.setFillColor(...lightBg);
  doc.roundedRect(totalsBoxX, finalY, totalsBoxWidth, 30, 2, 2, 'FD');

  let totY = finalY + 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Itens Cadastrados:', totalsBoxX + 4, totY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlate);
  doc.text(`${totalItemsCount}`, totalsBoxX + totalsBoxWidth - 4, totY, { align: 'right' });

  totY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Itens Já Comprados:', totalsBoxX + 4, totY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`${checkedItemsCount} / ${totalItemsCount}`, totalsBoxX + totalsBoxWidth - 4, totY, { align: 'right' });

  totY += 6.5;
  doc.setFillColor(254, 242, 242);
  doc.rect(totalsBoxX, totY - 4, totalsBoxWidth, 11, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryRed);
  doc.text('ESTIMATIVA TOTAL:', totalsBoxX + 4, totY + 3);
  doc.setFontSize(9.5);
  const estVal = list.totalEstimated > 0 ? formatCurrencyBRL(list.totalEstimated) : 'A calcular';
  doc.text(estVal, totalsBoxX + totalsBoxWidth - 4, totY + 3, { align: 'right' });

  // 6. Signature line
  const signY = finalY + 38;
  if (signY < pageHeight - 16) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    const signW = 75;
    doc.line(margin, signY, margin + signW, signY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    doc.text('Visto do Responsável pelas Compras', margin + signW / 2, signY + 4, { align: 'center' });
  }

  // Footer: Page Number & Verification
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    doc.text(
      `Lista de Compras gerada pelo PDV ${storeName} | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Downloads the Shopping List PDF with a formatted name.
 */
export function exportShoppingListPDF(
  list: ShoppingList,
  storeSettings?: PurchaseStoreSettings
): void {
  const doc = generateShoppingListPDF(list, storeSettings);
  const cleanTitle = (list.title || 'Lista_de_Compras').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Lista_Compras_${cleanTitle}_${dateStr}.pdf`;
  doc.save(fileName);
}

/**
 * Generates the clean WhatsApp formatted text representation of a Shopping List.
 */
export function formatShoppingListWhatsApp(
  list: ShoppingList,
  storeSettings?: PurchaseStoreSettings
): string {
  const storeName = storeSettings?.storeName || 'Alambari Defumados';
  const targetDateStr = list.targetDate
    ? new Date(list.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date(list.createdAt).toLocaleDateString('pt-BR');

  // Group items by category for clear reading
  const grouped = new Map<string, typeof list.items>();
  (list.items || []).forEach((item) => {
    const cat = item.category || 'Geral / Outros';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  });

  let itemsText = '';
  grouped.forEach((categoryItems, catName) => {
    itemsText += `\n📁 *${catName.toUpperCase()}*\n`;
    categoryItems.forEach((item) => {
      const box = item.checked ? '✅' : '⬜';
      const formattedQty = item.unit === 'kg'
        ? `${Number(item.quantity).toFixed(3).replace('.', ',')} kg`
        : `${item.quantity} ${item.unit || 'un'}`;
      const estText = item.estimatedPrice && item.estimatedPrice > 0
        ? ` (~R$ ${item.estimatedPrice.toFixed(2).replace('.', ',')}/${item.unit})`
        : '';
      const notesText = item.notes ? ` _(Obs: ${item.notes})_` : '';
      itemsText += `${box} *${item.name}*: ${formattedQty}${estText}${notesText}\n`;
    });
  });

  const totalCount = list.items?.length || 0;
  const checkedCount = (list.items || []).filter((i) => i.checked).length;

  return `🛒 *LISTA DE COMPRAS - ${storeName.toUpperCase()}*
📋 *Lista:* ${list.title}
📅 *Data Prevista:* ${targetDateStr}
${list.destination || list.supplierName ? `📍 *Destino / Fornecedor:* ${list.destination || list.supplierName}\n` : ''}${list.buyerName ? `👤 *Comprador:* ${list.buyerName}\n` : ''}
📦 *ITENS DA LISTA:*
${itemsText}
📊 *Progresso:* ${checkedCount} de ${totalCount} itens conferidos
${list.totalEstimated > 0 ? `💰 *Estimativa Total: R$ ${list.totalEstimated.toFixed(2).replace('.', ',')}*\n` : ''}${list.notes ? `\n📝 *Observações:* ${list.notes}\n` : ''}
📄 _O PDF completo desta Lista de Compras foi gerado para impressão e conferência física._`.trim();
}

/**
 * Formats a shopping list for 80mm / 58mm thermal printers.
 */
export function formatShoppingListThermal(
  list: ShoppingList,
  storeSettings?: PurchaseStoreSettings
): string {
  const storeName = storeSettings?.storeName || 'ALAMBARI DEFUMADOS';
  const dateStr = new Date().toLocaleDateString('pt-BR');
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let text = `================================\n`;
  text += `      ${storeName.toUpperCase()}\n`;
  text += `       LISTA DE COMPRAS\n`;
  text += `================================\n`;
  text += `Lista: ${list.title}\n`;
  if (list.destination || list.supplierName) {
    text += `Local: ${list.destination || list.supplierName}\n`;
  }
  text += `Data: ${dateStr} as ${timeStr}\n`;
  text += `--------------------------------\n`;
  text += `[ ] ITEM           QTD   UNID\n`;
  text += `--------------------------------\n`;

  (list.items || []).forEach((item) => {
    const box = item.checked ? '[X]' : '[ ]';
    const nameTrunc = item.name.substring(0, 16).padEnd(16, ' ');
    const qtyStr = item.unit === 'kg'
      ? Number(item.quantity).toFixed(2)
      : String(item.quantity);
    const unitStr = (item.unit || 'un').padEnd(4, ' ');
    text += `${box} ${nameTrunc} ${qtyStr.padStart(5, ' ')} ${unitStr}\n`;
    if (item.notes) {
      text += `    Obs: ${item.notes.substring(0, 26)}\n`;
    }
  });

  text += `--------------------------------\n`;
  text += `Total de Itens: ${list.items?.length || 0}\n`;
  if (list.totalEstimated > 0) {
    text += `Estimativa: R$ ${list.totalEstimated.toFixed(2)}\n`;
  }
  text += `================================\n`;
  text += `Conferido por: _________________\n\n\n`;

  return text;
}
