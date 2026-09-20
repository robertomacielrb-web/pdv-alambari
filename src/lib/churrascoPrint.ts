import { EventQuote } from '../types/churrasco';
import { formatCurrency } from '../data/churrascoDefaults';
import { executePrint } from './printHelper';

export function printChurrascoProposal(
  quote: EventQuote,
  storeSettings?: { storeName?: string; whatsappNumber?: string; pixKey?: string }
) {
  const storeName = storeSettings?.storeName || 'PDV ALAMBARI DEFUMADOS';
  const selectedMeats = quote.meats.filter(m => m.selected && m.kg > 0);
  const selectedSides = quote.sides.filter(s => s.selected);
  const selectedDrinks = quote.drinks.filter(d => d.selected);
  const selectedServices = quote.services.filter(s => s.selected);

  const eventDateFormatted = quote.eventDate
    ? new Date(quote.eventDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A definir';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Proposta de Orçamento - ${quote.clientName}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 0;
          font-size: 13px;
          line-height: 1.4;
        }
        .header {
          border-bottom: 2px solid #b91c1c;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 {
          margin: 0;
          color: #991b1b;
          font-size: 22px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header .subtitle {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 16px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
        }
        .info-label {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        .info-value {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }
        th {
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          text-transform: uppercase;
          padding: 6px 8px;
          text-align: left;
          border: 1px solid #e2e8f0;
        }
        td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          font-size: 12px;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .totals-card {
          margin-top: 14px;
          background: #fff7ed;
          border: 1px solid #ffedd5;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .total-highlight {
          font-size: 18px;
          font-weight: 800;
          color: #9a3412;
        }
        .per-person {
          font-size: 12px;
          color: #c2410c;
          font-weight: 600;
        }
        .terms-box {
          margin-top: 16px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          font-size: 11px;
          color: #475569;
        }
        .signatures {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
        }
        .signature-line {
          width: 42%;
          border-top: 1px solid #94a3b8;
          text-align: center;
          padding-top: 6px;
          font-size: 11px;
          color: #475569;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${storeName}</h1>
          <div class="subtitle">Especialistas em Churrasco, Defumados e Cortes Nobres</div>
        </div>
        <div>
          <span class="badge">Orçamento de Evento</span>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Cliente</span>
          <span class="info-value">${quote.clientName || 'Não informado'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Telefone / WhatsApp</span>
          <span class="info-value">${quote.clientPhone || 'Não informado'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Data do Evento</span>
          <span class="info-value">${eventDateFormatted} ${quote.eventTime ? `às ${quote.eventTime}` : ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Localização</span>
          <span class="info-value">${quote.eventLocation || 'A combinar'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Total de Convidados</span>
          <span class="info-value">${quote.totalGuests} pessoas</span>
        </div>
        <div class="info-item">
          <span class="info-label">Duração & Tipo</span>
          <span class="info-value">${quote.durationHours}h de evento • ${quote.eventType || 'Churrasco'}</span>
        </div>
      </div>

      <div class="section-title">🥩 Cardápio de Carnes & Cortes Nobres Inclusos</div>
      <table>
        <thead>
          <tr>
            <th>Corte / Especialidade</th>
            <th>Categoria</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${selectedMeats.map(meat => `
            <tr>
              <td><strong>${meat.name}</strong></td>
              <td>${meat.category}</td>
              <td class="text-center" style="color: #16a34a; font-weight: 600;">✓ Incluso</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${selectedSides.length > 0 ? `
        <div class="section-title">🥗 Acompanhamentos & Guarnições</div>
        <table>
          <thead>
            <tr>
              <th>Item / Guarnição</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedSides.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td class="text-center" style="color: #16a34a; font-weight: 600;">✓ Incluso</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${selectedDrinks.length > 0 ? `
        <div class="section-title">🍻 Bebidas & Insumos</div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedDrinks.map(d => `
              <tr>
                <td><strong>${d.name}</strong></td>
                <td class="text-center" style="color: #16a34a; font-weight: 600;">✓ Incluso</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${selectedServices.length > 0 ? `
        <div class="section-title">👨‍🍳 Serviços & Equipe Profissional</div>
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedServices.map(srv => `
              <tr>
                <td><strong>${srv.name}</strong></td>
                <td class="text-center" style="color: #16a34a; font-weight: 600;">✓ Incluso</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="totals-card">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #9a3412; font-weight: bold;">Investimento Total da Proposta</div>
          <div class="total-highlight">${formatCurrency(quote.total)}</div>
          ${quote.totalGuests > 0 ? `<div class="per-person">${formatCurrency(quote.pricePerPerson)} por pessoa (tudo incluso)</div>` : ''}
        </div>
        <div class="text-right" style="font-size: 11px; color: #475569;">
          ${quote.discount > 0 ? `<div style="color: #16a34a; font-weight: bold;">Desconto Especial: -${formatCurrency(quote.discount)}</div>` : ''}
          <div style="margin-top: 4px; font-weight: bold; color: #1e293b;">${quote.totalGuests} convidados inclusos</div>
        </div>
      </div>

      <div class="terms-box">
        <strong>Condições Comerciais & Pagamento:</strong><br/>
        • ${quote.paymentTerms || '50% de sinal no aceite para reserva da data e 50% até a realização do evento.'}<br/>
        ${storeSettings?.pixKey ? `• <strong>Chave Pix para Reserva:</strong> ${storeSettings.pixKey}<br/>` : ''}
        • Validade desta proposta: 7 dias corridos a partir da data de emissão.<br/>
        ${quote.notes ? `• <strong>Observações:</strong> ${quote.notes}<br/>` : ''}
      </div>

      <div class="signatures">
        <div class="signature-line">
          ${storeName}<br/>
          Responsável pelo Evento
        </div>
        <div class="signature-line">
          ${quote.clientName || 'Cliente'}<br/>
          Aceite da Proposta
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  executePrint(quote, html);
}

export function printChurrasqueiroList(quote: EventQuote, storeSettings?: { storeName?: string }) {
  const storeName = storeSettings?.storeName || 'PDV ALAMBARI DEFUMADOS';
  const selectedMeats = quote.meats.filter(m => m.selected && m.kg > 0);
  const selectedSides = quote.sides.filter(s => s.selected);
  const selectedDrinks = quote.drinks.filter(d => d.selected);

  const eventDateFormatted = quote.eventDate
    ? new Date(quote.eventDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A definir';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ficha do Churrasqueiro & Lista de Compras</title>
      <style>
        body {
          font-family: monospace, sans-serif;
          padding: 16px;
          color: #000;
          font-size: 13px;
        }
        h2, h3 { margin: 4px 0; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 4px 0; text-align: left; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      <h2>🔥 ${storeName} 🔥</h2>
      <h3>FICHA DO CHURRASQUEIRO / LISTA DE COMPRAS</h3>
      <div>Cliente: <strong>${quote.clientName}</strong></div>
      <div>Data: <strong>${eventDateFormatted} (${quote.eventTime || 'Horário a definir'})</strong></div>
      <div>Local: ${quote.eventLocation || 'Não especificado'}</div>
      <div>Convidados: <strong>${quote.totalGuests} pessoas</strong></div>
      <div>Duração: ${quote.durationHours}h</div>

      <div class="divider"></div>
      <h3>🥩 CARNES PARA PREPARO / CORTE (${quote.totalMeatKg.toFixed(2).replace('.', ',')} KG TOTAL)</h3>
      <table>
        <thead>
          <tr>
            <th>[ ] ITEM</th>
            <th class="text-right">PESO (KG)</th>
          </tr>
        </thead>
        <tbody>
          ${selectedMeats.map(m => `
            <tr>
              <td>[ ] ${m.name}</td>
              <td class="text-right"><strong>${m.kg.toFixed(2).replace('.', ',')} kg</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${selectedSides.length > 0 ? `
        <div class="divider"></div>
        <h3>🥗 ACOMPANHAMENTOS</h3>
        <table>
          <tbody>
            ${selectedSides.map(s => `
              <tr>
                <td>[ ] ${s.name}</td>
                <td class="text-right">${s.quantity} ${s.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${selectedDrinks.length > 0 ? `
        <div class="divider"></div>
        <h3>🍻 BEBIDAS E CARVÃO/GELO</h3>
        <table>
          <tbody>
            ${selectedDrinks.map(d => `
              <tr>
                <td>[ ] ${d.name}</td>
                <td class="text-right">${d.quantity} ${d.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${quote.services.filter(srv => srv.selected).length > 0 ? `
        <div class="divider"></div>
        <h3>👨‍🍳 SERVIÇOS & EQUIPE</h3>
        <table>
          <tbody>
            ${quote.services.filter(srv => srv.selected).map(srv => `
              <tr>
                <td>[ ] ${srv.name}</td>
                <td class="text-right">${srv.quantity} ${srv.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="divider"></div>
      <h3>💰 ESPELHO FINANCEIRO (DADOS DO CHURRASQUEIRO)</h3>
      <table>
        <tbody>
          <tr>
            <td>Subtotal de Carnes:</td>
            <td class="text-right"><strong>${formatCurrency(quote.meats.filter(m => m.selected).reduce((acc, m) => acc + (m.total || 0), 0))}</strong></td>
          </tr>
          <tr>
            <td>Subtotal Acompanhamentos:</td>
            <td class="text-right"><strong>${formatCurrency(quote.sides.filter(s => s.selected).reduce((acc, s) => acc + (s.total || 0), 0))}</strong></td>
          </tr>
          <tr>
            <td>Subtotal Bebidas & Insumos:</td>
            <td class="text-right"><strong>${formatCurrency(quote.drinks.filter(d => d.selected).reduce((acc, d) => acc + (d.total || 0), 0))}</strong></td>
          </tr>
          <tr>
            <td>Subtotal Serviços / Diárias:</td>
            <td class="text-right"><strong>${formatCurrency(quote.services.filter(s => s.selected).reduce((acc, s) => acc + (s.total || 0), 0))}</strong></td>
          </tr>
          <tr style="border-top: 1px dashed #cbd5e1;">
            <td><strong>Subtotal de Custos:</strong></td>
            <td class="text-right"><strong>${formatCurrency(quote.subtotal)}</strong></td>
          </tr>
          ${(quote.profit || 0) > 0 ? `
            <tr>
              <td><strong>Lucro Adicional (${quote.profitPerPerson ? 'R$ ' + quote.profitPerPerson.toFixed(2).replace('.', ',') + '/pes' : ''}${quote.profitPercent ? (quote.profitPerPerson ? ' • ' : '') + quote.profitPercent + '%' : ''}):</strong></td>
              <td class="text-right" style="color: #16a34a; font-weight: bold;">+${formatCurrency(quote.profit || 0)}</td>
            </tr>
          ` : ''}
          ${quote.discount > 0 ? `
            <tr>
              <td>Desconto Concedido:</td>
              <td class="text-right" style="color: #dc2626;">-${formatCurrency(quote.discount)}</td>
            </tr>
          ` : ''}
          <tr style="border-top: 1px solid #000;">
            <td><strong>VALOR FINAL DO EVENTO:</strong></td>
            <td class="text-right"><strong>${formatCurrency(quote.total)}</strong></td>
          </tr>
        </tbody>
      </table>

      ${quote.notes ? `
        <div class="divider"></div>
        <div><strong>Observações do Cliente:</strong> ${quote.notes}</div>
      ` : ''}

      <div class="divider"></div>
      <div style="font-size: 11px; text-align: center;">Bom evento e excelente churrasco!</div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  executePrint(quote, html);
}
