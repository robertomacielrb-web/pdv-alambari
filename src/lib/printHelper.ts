import { thermalPrinter, formatOrderToText } from './printer';

export async function executePrint(order: any, htmlContent: string) {
  const printMode = localStorage.getItem('printMode') || 'browser';

  if (printMode === 'bluetooth') {
    try {
      const textData = formatOrderToText(order);
      await thermalPrinter.print(textData);
      return;
    } catch (e: any) {
      console.error(e);
      if (e.message.includes('não conectada') || e.message.includes('not connected') || e.name === 'NetworkError') {
        alert('Impressora Bluetooth não conectada. Conecte na tela de Configurações ou mude para Impressão Padrão.');
      } else {
        alert('Falha na impressão bluetooth: ' + e.message);
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
