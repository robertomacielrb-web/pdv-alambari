export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Navegador não suporta Web Bluetooth API. No iPhone/iPad essa função é bloqueada pela Apple (utilize "Impressão Padrão"). Em Android, use o Chrome ou Edge.');
      }

      const knownServices = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000e0ff-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000af30-0000-1000-8000-00805f9b34fb'
      ];

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: knownServices
      });

      this.server = await this.device.gatt?.connect() || null;
      if (!this.server) throw new Error('Não foi possível conectar ao GATT server da impressora');

      let service: BluetoothRemoteGATTService | null = null;
      for (const sUuid of knownServices) {
        try {
          service = await this.server.getPrimaryService(sUuid);
          if (service) break;
        } catch (_) {}
      }

      if (!service) {
        try {
          const services = await this.server.getPrimaryServices();
          if (services && services.length > 0) {
            service = services[0];
          }
        } catch (_) {}
      }

      if (!service) {
        service = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      }

      // Procura a característica gravável
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) {
        this.characteristic = writable;
      } else {
        this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      }

      return true;
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return Boolean(this.device && this.device.gatt?.connected && this.characteristic);
  }

  /**
   * Imprime um texto genérico ou cupom individual com avanço de papel e comando de corte
   */
  async print(text: string, options?: { cut?: boolean; feedLines?: number }) {
    await this.printTicket(text, options);
  }

  /**
   * Envia uma via individual para a impressora térmica com inicialização, quebra de página e corte
   */
  async printTicket(text: string, options?: { cut?: boolean; feedLines?: number }) {
    if (!this.characteristic) {
      throw new Error('Impressora não conectada');
    }

    const encoder = new TextEncoder();
    // Normaliza acentuações para caracteres ASCII compatíveis com ESC/POS
    const normalizedText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const feedCount = options?.feedLines ?? 5;
    const feedStr = '\n'.repeat(feedCount);

    // ESC/POS Comandos:
    // ESC @: [0x1B, 0x40] Inicializar impressora
    const initCmd = new Uint8Array([0x1B, 0x40]);
    const textData = encoder.encode(normalizedText + feedStr);

    // GS V 65 0: corte de papel com avanço
    const cutCmd = options?.cut !== false
      ? new Uint8Array([0x1D, 0x56, 0x41, 0x00])
      : new Uint8Array([]);

    try {
      await this.sendChunks(initCmd);
      await this.sendChunks(textData);
      if (cutCmd.length > 0) {
        await this.sendChunks(cutCmd);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Imprime as vias do pedido: VIA DO CLIENTE e VIA DA PRODUÇÃO separadamente,
   * executando corte de papel e avanço entre cada uma delas.
   */
  async printOrder(order: any, options?: {
    customerOnly?: boolean;
    productionOnly?: boolean;
    printCustomer?: boolean;
    printProduction?: boolean;
    feedLines?: number;
  }) {
    if (order.isCashierReport) {
      const text = formatCashierReportText(order);
      await this.printTicket(text, { cut: true, feedLines: 5 });
      return;
    }

    const shouldPrintCustomer = options?.customerOnly
      ? true
      : options?.productionOnly
      ? false
      : (options?.printCustomer ?? true);

    const shouldPrintProduction = options?.productionOnly
      ? true
      : options?.customerOnly
      ? false
      : (options?.printProduction ?? true);

    // 1. VIA DO CLIENTE
    if (shouldPrintCustomer) {
      const customerText = formatCustomerReceiptText(order);
      await this.printTicket(customerText, { cut: true, feedLines: 5 });
    }

    // Intervalo de segurança para corte físico e resfriamento térmico
    if (shouldPrintCustomer && shouldPrintProduction) {
      await new Promise(resolve => setTimeout(resolve, 450));
    }

    // 2. VIA DA PRODUÇÃO
    if (shouldPrintProduction) {
      const productionText = formatProductionReceiptText(order);
      await this.printTicket(productionText, { cut: true, feedLines: 5 });
    }
  }

  private async sendChunks(data: Uint8Array) {
    if (!this.characteristic) return;
    // Chunk size de 100 bytes previne estouro de buffer BLE GATT em impressoras portáteis
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.properties.writeWithoutResponse && !this.characteristic.properties.write) {
        // @ts-ignore
        if (typeof this.characteristic.writeValueWithoutResponse === 'function') {
          // @ts-ignore
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Pequeno delay entre pacotes para evitar buffer overflow da serial térmica
      if (data.length > CHUNK_SIZE) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  }

  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }
}

export const thermalPrinter = new BluetoothPrinter();

/**
 * Formatação do relatório de Fechamento de Caixa
 */
export function formatCashierReportText(order: any): string {
  let text = `================================\n`;
  text += `      FECHAMENTO DE CAIXA\n`;
  text += `    PDV ALAMBARI DEFUMADOS\n`;
  text += `================================\n`;
  text += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
  text += `--------------------------------\n`;
  text += `Saldo Inicial:     R$ ${(order.initialBalance || 0).toFixed(2).replace('.', ',')}\n`;
  text += `--------------------------------\n`;
  text += `Dinheiro:          R$ ${(order.dinheiro || 0).toFixed(2).replace('.', ',')}\n`;
  text += `Cartao:            R$ ${(order.cartao || 0).toFixed(2).replace('.', ',')}\n`;
  text += `PIX:               R$ ${(order.pix || 0).toFixed(2).replace('.', ',')}\n`;
  text += `Fiado:             R$ ${(order.fiado || 0).toFixed(2).replace('.', ',')}\n`;
  text += `Outros:            R$ ${(order.outros || 0).toFixed(2).replace('.', ',')}\n`;
  text += `--------------------------------\n`;
  text += `Total de Vendas:   R$ ${(order.totalSales || 0).toFixed(2).replace('.', ',')}\n`;
  text += `Saldo Final Caixa: R$ ${(order.finalBalance || 0).toFixed(2).replace('.', ',')}\n`;
  text += `--------------------------------\n\n`;
  text += `     _________________________  \n`;
  text += `      Assinatura do Operador    \n`;
  text += `================================\n`;
  text += `  --- DESTAQUE AQUI (CORTE) --- \n`;
  text += `================================\n`;
  return text;
}

/**
 * Formata a VIA DO CLIENTE com cabeçalho oficial, itens, subtotais e pagamento
 */
export function formatCustomerReceiptText(order: any): string {
  let text = `================================\n`;
  text += `         VIA DO CLIENTE\n`;
  text += `     PDV ALAMBARI DEFUMADOS\n`;
  text += `================================\n`;

  const date = order.closedAt || order.createdAt || new Date().toISOString();
  const dateStr = new Date(date).toLocaleString('pt-BR');
  text += `Data: ${dateStr}\n`;

  if (order.password) {
    text += `SENHA: ${order.password}\n`;
  }
  if (order.tableNumber) {
    text += `MESA: ${order.tableNumber}\n`;
  }
  if (order.type) {
    const tipoLabel = order.type === 'delivery' ? 'ENTREGA / DELIVERY' : order.type === 'mesa' ? 'MESA' : 'BALCAO';
    text += `TIPO: ${tipoLabel}\n`;
  }
  if (order.customerName) {
    text += `CLIENTE: ${order.customerName}\n`;
  }
  if (order.deliveryPhone) {
    text += `FONE: ${order.deliveryPhone}\n`;
  }
  if (order.deliveryAddress) {
    text += `END: ${order.deliveryAddress}\n`;
  }

  text += `--------------------------------\n`;
  text += `QTD ITEM                  PRECO\n`;
  text += `--------------------------------\n`;

  for (const item of (order.items || [])) {
    const qtdStr = `${item.quantity}x`.padEnd(4);
    const nameStr = (item.name || '').substring(0, 18).padEnd(18);
    const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
    const priceStr = `R$ ${itemTotal.toFixed(2).replace('.', ',')}`.padStart(10);
    text += `${qtdStr}${nameStr}${priceStr}\n`;
    if (item.observation) {
      text += `  * Obs: ${item.observation}\n`;
    }
  }

  text += `--------------------------------\n`;

  let subtotal = order.total || 0;
  if (order.discount && order.discount > 0) {
    subtotal = (order.total || 0) + order.discount;
    if (order.type === 'delivery' && order.deliveryFee) subtotal -= order.deliveryFee;
    text += `SUBTOTAL:            R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    if (order.type === 'delivery' && order.deliveryFee) {
      text += `TAXA ENTREGA:        R$ ${Number(order.deliveryFee).toFixed(2).replace('.', ',')}\n`;
    }
    text += `DESCONTO:           -R$ ${Number(order.discount).toFixed(2).replace('.', ',')}\n`;
  } else if (order.type === 'delivery' && order.deliveryFee) {
    text += `TAXA ENTREGA:        R$ ${Number(order.deliveryFee).toFixed(2).replace('.', ',')}\n`;
  }

  if (order.serviceFee && order.serviceFee > 0) {
    text += `TAXA DE SERVICO:     R$ ${Number(order.serviceFee).toFixed(2).replace('.', ',')}\n`;
  }

  text += `TOTAL:               R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}\n`;

  if (order.splitPayments && order.splitPayments.length > 0) {
    const spText = order.splitPayments
      .map((sp: any) => `${(sp.method || '').toUpperCase()} (R$ ${Number(sp.amount || 0).toFixed(2).replace('.', ',')})`)
      .join(' + ');
    text += `PAGAMENTO: ${spText}\n`;
  } else {
    text += `PAGAMENTO: ${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A'}\n`;
  }

  text += `--------------------------------\n`;
  if (order.observations) {
    text += `OBS GERAL: ${order.observations}\n`;
    text += `--------------------------------\n`;
  }

  text += `    Obrigado pela preferencia!  \n`;
  text += `================================\n`;
  text += `  --- DESTAQUE AQUI (CORTE) --- \n`;
  text += `================================\n`;

  return text;
}

/**
 * Formata a VIA DA PRODUÇÃO (COZINHA/CHURRASQUEIRA) com senha grande, itens e observações
 */
export function formatProductionReceiptText(order: any): string {
  let text = `================================\n`;
  text += `   VIA DA PRODUCAO (COZINHA)    \n`;
  text += `     PDV ALAMBARI DEFUMADOS     \n`;
  text += `================================\n`;

  const date = order.closedAt || order.createdAt || new Date().toISOString();
  const dateStr = new Date(date).toLocaleString('pt-BR');
  text += `DATA: ${dateStr}\n`;
  text += `================================\n`;

  if (order.password) {
    text += `>>> SENHA: ${order.password} <<<\n`;
  }
  if (order.tableNumber) {
    text += `>>> MESA: ${order.tableNumber} <<<\n`;
  }
  if (order.type) {
    const tipoLabel = order.type === 'delivery' ? 'ENTREGA / DELIVERY' : order.type === 'mesa' ? 'MESA' : 'BALCAO';
    text += `TIPO: ${tipoLabel}\n`;
  }
  if (order.customerName) {
    text += `CLIENTE: ${order.customerName}\n`;
  }
  if (order.deliveryAddress) {
    text += `END: ${order.deliveryAddress}\n`;
  }

  text += `--------------------------------\n`;
  text += `ITENS PARA PREPARO:\n`;
  text += `--------------------------------\n`;

  for (const item of (order.items || [])) {
    text += `${item.quantity}x ${item.name}\n`;
    if (item.observation) {
      text += `  *** OBS: ${item.observation}\n`;
    }
  }

  text += `--------------------------------\n`;

  if (order.observations) {
    text += `********************************\n`;
    text += `ATENCAO OBS GERAL:\n`;
    text += `${order.observations}\n`;
    text += `********************************\n`;
  }

  text += `   ALAMBARI CONTROLE PRODUCAO   \n`;
  text += `================================\n`;
  text += `  --- DESTAQUE AQUI (CORTE) --- \n`;
  text += `================================\n`;

  return text;
}

/**
 * Função mantida para retrocompatibilidade geral.
 * Se nenhuma opção for passada, gera ambas as vias com indicação clara.
 */
export function formatOrderToText(order: any, options?: { customerOnly?: boolean; productionOnly?: boolean }): string {
  if (order.isCashierReport) {
    return formatCashierReportText(order);
  }

  if (options?.customerOnly) {
    return formatCustomerReceiptText(order);
  }

  if (options?.productionOnly) {
    return formatProductionReceiptText(order);
  }

  // Gera ambas as vias
  return formatCustomerReceiptText(order) + '\n\n' + formatProductionReceiptText(order);
}
