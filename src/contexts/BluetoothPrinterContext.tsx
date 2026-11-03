import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { thermalPrinter, formatCustomerSenhaHighlight } from '../lib/printer';

interface BluetoothPrinterContextType {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  printMode: 'browser' | 'bluetooth';
  setPrintMode: (mode: 'browser' | 'bluetooth') => void;
  paperWidth: '58mm' | '80mm';
  setPaperWidth: (width: '58mm' | '80mm') => void;
  printCopiesCustomer: boolean;
  setPrintCopiesCustomer: (val: boolean) => void;
  printCopiesProduction: boolean;
  setPrintCopiesProduction: (val: boolean) => void;
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => void;
  testPrint: (type?: 'simple' | 'complete') => Promise<{ success: boolean; error?: string }>;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const BluetoothPrinterContext = createContext<BluetoothPrinterContextType | undefined>(undefined);

export function BluetoothPrinterProvider({ children }: { children: React.ReactNode }) {
  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const [isConnected, setIsConnected] = useState<boolean>(() => thermalPrinter.isConnected());
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string | null>(() => thermalPrinter.getDeviceName());
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [printMode, setPrintModeState] = useState<'browser' | 'bluetooth'>(() => {
    try {
      return (localStorage.getItem('printMode') as 'browser' | 'bluetooth') || 'browser';
    } catch {
      return 'browser';
    }
  });

  const [paperWidth, setPaperWidthState] = useState<'58mm' | '80mm'>(() => {
    try {
      return (localStorage.getItem('thermalPaperWidth') as '58mm' | '80mm') || '58mm';
    } catch {
      return '58mm';
    }
  });

  const [printCopiesCustomer, setPrintCopiesCustomerState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('printCopiesCustomer') !== 'false';
    } catch {
      return true;
    }
  });

  const [printCopiesProduction, setPrintCopiesProductionState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('printCopiesProduction') !== 'false';
    } catch {
      return true;
    }
  });

  // Subscribe to physical printer state changes
  useEffect(() => {
    const unsubscribe = thermalPrinter.addConnectionListener((connected, name) => {
      setIsConnected(connected);
      setDeviceName(name);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const setPrintMode = useCallback((mode: 'browser' | 'bluetooth') => {
    setPrintModeState(mode);
    try {
      localStorage.setItem('printMode', mode);
    } catch {}
  }, []);

  const setPaperWidth = useCallback((width: '58mm' | '80mm') => {
    setPaperWidthState(width);
    try {
      localStorage.setItem('thermalPaperWidth', width);
    } catch {}
  }, []);

  const setPrintCopiesCustomer = useCallback((val: boolean) => {
    setPrintCopiesCustomerState(val);
    try {
      localStorage.setItem('printCopiesCustomer', String(val));
    } catch {}
  }, []);

  const setPrintCopiesProduction = useCallback((val: boolean) => {
    setPrintCopiesProductionState(val);
    try {
      localStorage.setItem('printCopiesProduction', String(val));
    } catch {}
  }, []);

  const connect = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupported) {
      const err = 'Navegador não suporta Web Bluetooth API (No iPhone/iPad a Apple bloqueia. No Android ou PC, use Google Chrome ou Edge).';
      return { success: false, error: err };
    }

    setIsConnecting(true);
    try {
      await thermalPrinter.connect();
      setIsConnected(true);
      setDeviceName(thermalPrinter.getDeviceName());
      setPrintMode('bluetooth');
      return { success: true };
    } catch (error: any) {
      console.error('Falha ao conectar Bluetooth:', error);
      const msg = error.name === 'NotFoundError'
        ? 'Nenhuma impressora foi selecionada.'
        : error.message || 'Erro ao conectar à impressora Bluetooth.';
      return { success: false, error: msg };
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported, setPrintMode]);

  const disconnect = useCallback(() => {
    thermalPrinter.disconnect();
    setIsConnected(false);
    setDeviceName(null);
  }, []);

  const testPrint = useCallback(async (type: 'simple' | 'complete' = 'simple'): Promise<{ success: boolean; error?: string }> => {
    if (!thermalPrinter.isConnected()) {
      return { success: false, error: 'Impressora Bluetooth não conectada.' };
    }

    try {
      if (type === 'simple') {
        const text =
          '================================\n' +
          '     TESTE RAPIDO IMPRESSORA    \n' +
          '     PDV ALAMBARI DEFUMADOS     \n' +
          '================================\n' +
          `Status: Conexao Bluetooth OK\n` +
          `Dispositivo: ${thermalPrinter.getDeviceName() || 'Termica'}\n` +
          `Largura: ${paperWidth}\n` +
          `Data:   ${new Date().toLocaleString('pt-BR')}\n` +
          formatCustomerSenhaHighlight('042') +
          '   Destaque Senha Grande OK!    \n' +
          '================================\n';
        await thermalPrinter.print(text, { cut: true, feedLines: 5 });
      } else {
        const mockOrder = {
          password: '042',
          type: 'balcao',
          createdAt: new Date().toISOString(),
          customerName: 'Cliente Teste Alambari',
          items: [
            { name: 'Costela Defumada Especial', quantity: 1, price: 48.0, observation: 'Bem passada' },
            { name: 'Refrigerante Lata 350ml', quantity: 2, price: 7.0 },
          ],
          total: 62.0,
          paymentMethod: 'pix',
          observations: 'Teste de 2 vias (Cliente + Cozinha) com corte automatico',
        };

        await thermalPrinter.printOrder(mockOrder, {
          printCustomer: printCopiesCustomer,
          printProduction: printCopiesProduction,
        });
      }
      return { success: true };
    } catch (e: any) {
      console.error('Erro no teste de impressão:', e);
      return { success: false, error: e.message || 'Falha ao enviar dados para a impressora.' };
    }
  }, [paperWidth, printCopiesCustomer, printCopiesProduction]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <BluetoothPrinterContext.Provider
      value={{
        isSupported,
        isConnected,
        isConnecting,
        deviceName,
        printMode,
        setPrintMode,
        paperWidth,
        setPaperWidth,
        printCopiesCustomer,
        setPrintCopiesCustomer,
        printCopiesProduction,
        setPrintCopiesProduction,
        connect,
        disconnect,
        testPrint,
        isModalOpen,
        openModal,
        closeModal,
      }}
    >
      {children}
    </BluetoothPrinterContext.Provider>
  );
}

export function useBluetoothPrinter() {
  const context = useContext(BluetoothPrinterContext);
  if (!context) {
    throw new Error('useBluetoothPrinter deve ser usado dentro de um BluetoothPrinterProvider');
  }
  return context;
}
