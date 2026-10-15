import { thermalPrinter, formatOrderToText } from './printer';

export interface PrintOptions {
  customerOnly?: boolean;
  productionOnly?: boolean;
}

export async function executePrint(order: any, htmlContent: string, options?: PrintOptions) {
  const printMode = localStorage.getItem('printMode') || 'browser';

  if (printMode === 'bluetooth') {
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
      console.error(e);
      if (e.message?.includes('não conectada') || e.message?.includes('not connected') || e.name === 'NetworkError') {
        alert('Impressora Bluetooth não conectada. Conecte na tela de Configurações ou mude para Impressão Padrão.');
      } else {
        alert('Falha na impressão bluetooth: ' + (e.message || 'Erro desconhecido'));
      }
      return; // Stop and let user decide if they want to fallback manually
    }
  }

  // Fallback to browser HTML print
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Bloqueador de pop-ups impediu a impressão. Por favor, permita pop-ups para este site.");
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
