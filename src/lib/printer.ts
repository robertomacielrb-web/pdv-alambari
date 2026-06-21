export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Navegador não suporta Web Bluetooth API. No iPhone/iPad essa função é bloqueada pela Apple (utilize "Impressão Padrão"). Em Android, use o Chrome ou Edge.');
      }

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      this.server = await this.device.gatt?.connect() || null;
      if (!this.server) throw new Error('Não foi possível conectar ao GATT server');

      const service = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      return true;
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      throw error;
    }
  }

  async print(text: string) {
    if (!this.characteristic) {
      throw new Error('Impressora não conectada');
    }

    const encoder = new TextEncoder();
    // Normalize string to replace accents, etc. 
    const normalizedText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Add ESC/POS init and print commands
    const initCmd = new Uint8Array([0x1B, 0x40]); // Initialize
    const textData = encoder.encode(normalizedText + '\n\n'); 
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x41, 0x00]); // Partial cut

    try {
      await this.sendChunks(initCmd);
      await this.sendChunks(textData);
      await this.sendChunks(cutCmd);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  private async sendChunks(data: Uint8Array) {
    if (!this.characteristic) return;
    const CHUNK_SIZE = 512;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
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

export function formatOrderToText(order: any): string {
  if (order.isCashierReport) {
    let text = `      FECHAMENTO DE CAIXA\n`;
    text += `--------------------------------\n`;
    text += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
    text += `--------------------------------\n`;
    text += `Saldo Inicial:     R$ ${order.initialBalance.toFixed(2)}\n`;
    text += `--------------------------------\n`;
    text += `Dinheiro:          R$ ${order.dinheiro.toFixed(2)}\n`;
    text += `Cartao:            R$ ${order.cartao.toFixed(2)}\n`;
    text += `PIX:               R$ ${order.pix.toFixed(2)}\n`;
    text += `Fiado:             R$ ${order.fiado.toFixed(2)}\n`;
    text += `Outros:            R$ ${order.outros.toFixed(2)}\n`;
    text += `--------------------------------\n`;
    text += `Total de Vendas:   R$ ${order.totalSales.toFixed(2)}\n`;
    text += `Saldo Final Caixa: R$ ${order.finalBalance.toFixed(2)}\n`;
    text += `--------------------------------\n`;
    text += `\n`;
    text += `     _________________________  \n`;
    text += `      Assinatura do Operador    \n`;
    text += `--------------------------------\n\n`;
    return text;
  }

  let text = '';
  const date = order.closedAt || order.createdAt || new Date().toISOString();
  const dateStr = new Date(date).toLocaleString('pt-BR');

  text += `      PDV ALAMBARI DEFUMADOS\n`;
  text += `--------------------------------\n`;
  text += `Data: ${dateStr}\n`;
  
  if (order.password) text += `SENHA: ${order.password}\n`;
  if (order.tableNumber) text += `MESA: ${order.tableNumber}\n`;
  if (order.customerName) text += `CLIENTE: ${order.customerName}\n`;
  
  text += `--------------------------------\n`;
  text += `QTD ITEM                  PRECO\n`;
  text += `--------------------------------\n`;

  for (const item of order.items) {
    const qtdStr = `${item.quantity}x`.padEnd(4);
    const nameStr = item.name.substring(0, 18).padEnd(18);
    const priceStr = `R$ ${(item.price * item.quantity).toFixed(2)}`.padStart(10);
    text += `${qtdStr}${nameStr}${priceStr}\n`;
    if (item.observation) {
      text += `  Obs: ${item.observation}\n`;
    }
  }

  text += `--------------------------------\n`;
  text += `TOTAL:               R$ ${order.total.toFixed(2).replace('.', ',')}\n`;
  text += `PAGAMENTO: ${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A'}\n`;
  text += `--------------------------------\n`;
  if (order.observations) {
    text += `OBS GERAL: ${order.observations}\n`;
    text += `--------------------------------\n`;
  }
  text += `     Obrigado pela prefeencia!    \n`;
  text += `--------------------------------\n\n`;

  // Via Producao
  text += `      VIA DA PRODUCAO - PDV     \n`;
  text += `--------------------------------\n`;
  if (order.password) text += `SENHA: ${order.password}\n`;
  if (order.tableNumber) text += `MESA: ${order.tableNumber}\n`;
  if (order.customerName) text += `CLIENTE: ${order.customerName}\n`;
  text += `Data: ${dateStr}\n`;
  text += `--------------------------------\n`;

  for (const item of order.items) {
    text += `${item.quantity}x ${item.name}\n`;
    if (item.observation) {
      text += `  Obs: ${item.observation}\n`;
    }
  }
  text += `--------------------------------\n`;

  return text;
}
