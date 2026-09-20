import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventQuote } from '../types/churrasco';
import { formatCurrency } from '../data/churrascoDefaults';

export interface StoreSettingsInfo {
  storeName?: string;
  whatsappNumber?: string;
  pixKey?: string;
}

/**
 * Generates and downloads a clean, beautifully formatted customer-ready PDF proposal.
 */
export function exportChurrascoProposalPDF(
  quote: EventQuote,
  storeSettings?: StoreSettingsInfo
): void {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const storeName = storeSettings?.storeName || 'PDV ALAMBARI DEFUMADOS';
  const whatsappNumber = storeSettings?.whatsappNumber || '';
  const pixKey = storeSettings?.pixKey || '';

  const eventDateFormatted = quote.eventDate
    ? new Date(quote.eventDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A definir';

  const issueDateFormatted = new Date().toLocaleDateString('pt-BR');

  // Primary colors
  const primaryRed: [number, number, number] = [153, 27, 27]; // #991b1b
  const darkSlate: [number, number, number] = [30, 41, 59]; // #1e293b
  const textMuted: [number, number, number] = [100, 116, 139]; // #64748b
  const emeraldGreen: [number, number, number] = [5, 150, 105]; // #059669

  let currentY = margin;

  // 1. Top Bar Header Decoration
  doc.setFillColor(...primaryRed);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Main Header Block
  currentY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primaryRed);
  doc.text(storeName.toUpperCase(), margin, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text('PROPOSTA COMERCIAL DE CHURRASCO & EVENTOS', margin, currentY + 5);

  // Right side header info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text(`Emissão: ${issueDateFormatted}`, pageWidth - margin, currentY, { align: 'right' });
  doc.text(`Validade: 7 dias`, pageWidth - margin, currentY + 4.5, { align: 'right' });

  // Status Badge
  const statusLabel = 
    quote.status === 'aprovado' || quote.status === 'aceito' ? 'PROPOSTA ACEITA' :
    quote.status === 'realizado' ? 'EVENTO REALIZADO' :
    quote.status === 'recusado' ? 'PROPOSTA RECUSADA' :
    quote.status === 'enviado' ? 'PROPOSTA ENVIADA' :
    'ORÇAMENTO COMERCIAL';
  
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(pageWidth - margin - 46, currentY + 7, 46, 6, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryRed);
  doc.text(statusLabel, pageWidth - margin - 23, currentY + 11.2, { align: 'center' });

  currentY += 17;

  // Thin separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  // 3. Client & Event Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 27, 2, 2, 'FD');

  const col1X = margin + 4;
  const col2X = margin + 65;
  const col3X = margin + 126;

  // Column 1: Client details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('DADOS DO CLIENTE', col1X, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkSlate);
  doc.text(quote.clientName || 'Cliente não informado', col1X, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  if (quote.clientPhone) {
    doc.text(`WhatsApp: ${quote.clientPhone}`, col1X, currentY + 15);
  }
  doc.text(`Tipo: ${quote.eventType || 'Churrasco Completo'}`, col1X, currentY + 20);

  // Column 2: Event date & location
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('DATA & LOCALIZAÇÃO', col2X, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  doc.text(`Data: ${eventDateFormatted}${quote.eventTime ? ` às ${quote.eventTime}` : ''}`, col2X, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Local: ${quote.eventLocation || 'No local indicado pelo cliente'}`, col2X, currentY + 15, { maxWidth: 58 });
  doc.text(`Duração prevista: ${quote.durationHours} horas`, col2X, currentY + 22);

  // Column 3: Guests & meat summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('CAPACIDADE & ESTRUTURA', col3X, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryRed);
  doc.text(`${quote.totalGuests} CONVIDADOS`, col3X, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  
  let guestSubdetail = '';
  if (quote.adultsMen || quote.adultsWomen || quote.children) {
    guestSubdetail = `(${quote.adultsMen || 0}H, ${quote.adultsWomen || 0}M, ${quote.children || 0}C)`;
    doc.text(guestSubdetail, col3X, currentY + 15);
  } else {
    doc.text(`Média planejada p/ pessoa`, col3X, currentY + 15);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text(`Total em Carnes: ${quote.totalMeatKg.toFixed(1)} kg`, col3X, currentY + 20.5);

  currentY += 32;

  // Filter selected items
  const selectedMeats = quote.meats.filter(m => m.selected && m.kg > 0);
  const selectedSides = quote.sides.filter(s => s.selected);
  const selectedDrinks = quote.drinks.filter(d => d.selected);
  const selectedServices = quote.services.filter(s => s.selected);

  // 4. Meats Table
  if (selectedMeats.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryRed);
    doc.text('1. CARNES NOBRES & CORTES SELECIONADOS', margin, currentY);
    currentY += 2;

    const meatRows = selectedMeats.map(m => [
      m.name,
      m.category,
      `${m.kg.toFixed(2)} kg`,
      'Grelhado e fatiado no ponto desejado'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Corte / Produto', 'Categoria', 'Quantidade Prevista', 'Especificação']],
      body: meatRows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: primaryRed,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 32 },
        2: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 'auto' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    currentY = (finalY || currentY) + 6;
  }

  // Check if we need to avoid page break collisions
  if (currentY > pageHeight - 95 && (selectedSides.length > 0 || selectedDrinks.length > 0 || selectedServices.length > 0)) {
    doc.addPage();
    currentY = margin + 5;
  }

  // 5. Sides Table
  if (selectedSides.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryRed);
    doc.text('2. ACOMPANHAMENTOS & GUARNIÇÕES', margin, currentY);
    currentY += 2;

    const sideRows = selectedSides.map(s => [
      s.name,
      `${s.quantity} ${s.unit}`,
      'Incluso no buffet à vontade para os convidados'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Item / Guarnição', 'Quantidade', 'Descrição / Servimento']],
      body: sideRows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [180, 83, 9], // Amber-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2
      },
      alternateRowStyles: {
        fillColor: [254, 252, 232]
      },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 'auto' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    currentY = (finalY || currentY) + 6;
  }

  // 6. Drinks & Supplies (if any)
  if (selectedDrinks.length > 0) {
    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = margin + 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryRed);
    doc.text('3. BEBIDAS & SUPRIMENTOS INCLUSOS', margin, currentY);
    currentY += 2;

    const drinkRows = selectedDrinks.map(d => [
      d.name,
      `${d.quantity} ${d.unit}`,
      'Fornecido gelado / pronto para consumo'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Bebida / Suprimento', 'Quantidade Prevista', 'Condição']],
      body: drinkRows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [30, 58, 138], // Blue-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 'auto' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    currentY = (finalY || currentY) + 6;
  }

  // 7. Services & Staff (if any)
  if (selectedServices.length > 0) {
    if (currentY > pageHeight - 75) {
      doc.addPage();
      currentY = margin + 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryRed);
    doc.text('4. SERVIÇOS & EQUIPE PROFISSIONAL', margin, currentY);
    currentY += 2;

    const serviceRows = selectedServices.map(s => [
      s.name,
      `${s.quantity} ${s.unit}`,
      'Equipe uniformizada, com utensílios e equipamentos'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Serviço Profissional', 'Quantidade', 'Observação']],
      body: serviceRows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [55, 65, 81], // Gray-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 'auto' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    currentY = (finalY || currentY) + 6;
  }

  // Ensure there's space for Financial Investment Box & Signatures (needs at least ~65mm)
  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = margin + 5;
  }

  // 8. Financial Investment Highlight Box
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  // Left part: Valor por pessoa em destaque
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryRed);
  doc.text('VALOR FECHADO POR CONVIDADO (TUDO INCLUSO):', margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...emeraldGreen);
  doc.text(`${formatCurrency(quote.pricePerPerson)} / pessoa`, margin + 4, currentY + 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(`Pacote completo para ${quote.totalGuests} convidados confirmados.`, margin + 4, currentY + 17.5);
  doc.text(`Sinal de 50% para reserva de data: ${formatCurrency(quote.total * 0.5)}`, margin + 4, currentY + 21.5);

  // Right part: Total Final
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryRed);
  doc.text('INVESTIMENTO TOTAL DO EVENTO:', pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...primaryRed);
  doc.text(formatCurrency(quote.total), pageWidth - margin - 4, currentY + 13, { align: 'right' });

  if (quote.discount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...emeraldGreen);
    doc.text(`(Desconto especial aplicado: -${formatCurrency(quote.discount)})`, pageWidth - margin - 4, currentY + 17.5, { align: 'right' });
  }

  currentY += 28;

  // 9. Payment Terms & Commercial Notes
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, contentWidth, 20, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text('Condições Comerciais & Pagamento:', margin + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const paymentText = quote.paymentTerms || '50% de sinal para reserva da data e o restante até o início do evento.';
  doc.text(`• Condição: ${paymentText}`, margin + 3, currentY + 9, { maxWidth: contentWidth - 6 });

  if (pixKey) {
    doc.setFont('helvetica', 'bold');
    doc.text(`• Chave Pix para Reserva: `, margin + 3, currentY + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(pixKey, margin + 40, currentY + 13);
  }

  const notesText = quote.notes ? `• Observações: ${quote.notes}` : '• Validade da proposta: 7 dias corridos.';
  doc.text(notesText, margin + 3, currentY + 17, { maxWidth: contentWidth - 6 });

  currentY += 25;

  // Check if signatures fit
  if (currentY > pageHeight - 24) {
    doc.addPage();
    currentY = margin + 15;
  }

  // 10. Signatures
  const sigWidth = 70;
  const sig1X = margin + 10;
  const sig2X = pageWidth - margin - sigWidth - 10;
  const lineY = currentY + 10;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(sig1X, lineY, sig1X + sigWidth, lineY);
  doc.line(sig2X, lineY, sig2X + sigWidth, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text(storeName, sig1X + sigWidth / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('Responsável pelo Evento', sig1X + sigWidth / 2, lineY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text(quote.clientName || 'Cliente', sig2X + sigWidth / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('Aceite e Aprovação da Proposta', sig2X + sigWidth / 2, lineY + 7.5, { align: 'center' });

  // 11. Headers/Footers on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Bottom footer line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    
    // Left footer
    doc.text(`Proposta Comercial • ${quote.clientName || 'Cliente'}`, margin, pageHeight - 4.5);
    
    // Center footer (Contact)
    if (whatsappNumber) {
      doc.text(`Contato: ${whatsappNumber}`, pageWidth / 2, pageHeight - 4.5, { align: 'center' });
    }

    // Right footer (Page Number)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
  }

  // 12. Friendly filename
  const cleanClientName = (quote.clientName || 'Cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 30);

  const dateSlug = quote.eventDate || new Date().toISOString().split('T')[0];
  const fileName = `Proposta_Churrasco_${cleanClientName}_${dateSlug}.pdf`;

  // Trigger download
  doc.save(fileName);
}
