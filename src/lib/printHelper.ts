import { thermalPrinter } from './printer';

export interface PrintOptions {
  customerOnly?: boolean;
  productionOnly?: boolean;
}

export function openBrowserPrintWindow(htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Bloqueador de pop-ups impediu a impressão. Por favor, permita pop-ups para este site nas configurações do navegador.");
    return false;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
}

export async function executePrint(order: any, htmlContent: string, options?: PrintOptions) {
  const printMode = localStorage.getItem('printMode') || 'browser';

  if (printMode === 'bluetooth') {
    if (!thermalPrinter.isConnected()) {
      const wantBrowser = window.confirm(
        'Atenção: A impressão está configurada para "Impressora Bluetooth Térmica", mas nenhuma impressora está conectada no momento.\n\n' +
        'Deseja imprimir agora através da janela do navegador (Impressão Padrão)?\n\n' +
        '(Para conectar sua impressora Bluetooth, clique no ícone de Bluetooth no topo da tela ou vá em Configurações).'
      );
      if (wantBrowser) {
        openBrowserPrintWindow(htmlContent);
      }
      return;
    }

    try {
      const prefCustomer = localStorage.getItem('printCopiesCustomer') !== 'false';
      const prefProduction = localStorage.getItem('printCopiesProduction') !== 'false';

      await thermalPrinter.printOrder(order, {
        customerOnly: options?.customerOnly,
        productionOnly: options?.productionOnly || order?.productionOnly,
        printCustomer: prefCustomer,
        printProduction: prefProduction,
      });
      return;
    } catch (e: any) {
      console.error('Falha na impressão Bluetooth:', e);
      const wantBrowser = window.confirm(
        `Falha na comunicação com a impressora Bluetooth: ${e.message || 'Erro de transmissão'}.\n\n` +
        'Deseja imprimir esta comanda através do navegador como alternativa?'
      );
      if (wantBrowser) {
        openBrowserPrintWindow(htmlContent);
      }
      return;
    }
  }

  // Fallback / Padrão: Navegador
  openBrowserPrintWindow(htmlContent);
}
