import React, { useState, useEffect } from 'react';
import { Bluetooth, Printer, Settings, PrinterIcon, Info } from 'lucide-react';
import { thermalPrinter } from '../lib/printer';

export default function Configuracoes() {
  const [printMode, setPrintMode] = useState<'browser' | 'bluetooth'>('browser');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('printMode') as 'browser' | 'bluetooth';
    if (savedMode) {
      setPrintMode(savedMode);
    }
  }, []);

  const handleModeChange = (mode: 'browser' | 'bluetooth') => {
    setPrintMode(mode);
    localStorage.setItem('printMode', mode);
  };

  const handleConnectBluetooth = async () => {
    setIsLoading(true);
    try {
      await thermalPrinter.connect();
      setIsConnected(true);
      handleModeChange('bluetooth');
      alert('Impressora conectada com sucesso!');
    } catch (error: any) {
      alert('Erro ao conectar impressora: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPrint = async () => {
    if (printMode === 'browser') {
      window.print();
      return;
    }

    try {
      await thermalPrinter.print('*** TESTE DE IMPRESSAO ***\nPDV ALAMBARI DEFUMADOS\nImpressora Bluetooth conectada com sucesso!\n');
    } catch (error: any) {
      alert('Erro ao imprimir: ' + error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gray-800 p-2 rounded-lg">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-4">
          <PrinterIcon className="w-6 h-6 text-gray-500" />
          Configurações de Impressora
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div 
            onClick={() => handleModeChange('browser')}
            className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
              printMode === 'browser' 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Printer className={`w-6 h-6 ${printMode === 'browser' ? 'text-indigo-600' : 'text-gray-400'}`} />
              <h3 className="font-bold text-gray-800">Impressão Padrão (Navegador)</h3>
            </div>
            <p className="text-sm text-gray-600">
              Abre a tela de impressão do navegador padrão (como impressoras USB, Rede, ou PDF).
            </p>
          </div>

          <div 
            onClick={() => handleModeChange('bluetooth')}
            className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
              printMode === 'bluetooth' 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Bluetooth className={`w-6 h-6 ${printMode === 'bluetooth' ? 'text-indigo-600' : 'text-gray-400'}`} />
              <h3 className="font-bold text-gray-800">Impressora Bluetooth Térmica</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Conexão direta a uma impressora térmica portátil ESC/POS via Bluetooth para imprimir sem tela de diálogo.
            </p>

            {printMode === 'bluetooth' && (
              <div className="space-y-3">
                <button
                  onClick={handleConnectBluetooth}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Bluetooth className="w-4 h-4" />
                  {isLoading ? 'Conectando...' : isConnected ? 'Conectar Outra Impressora' : 'Conectar Impressora Bluetooth'}
                </button>
                {isConnected && (
                  <span className="text-xs text-green-600 font-bold block text-center mt-1">Conectado na Sessão Atual</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center">
          <button
            onClick={handleTestPrint}
            className="bg-gray-800 text-white font-bold px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Imprimir Página de Teste
          </button>
        </div>

        <div className="mt-6 bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3 items-start text-sm">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">Como funciona a Impressão Bluetooth?</p>
            <p>
              Por questões de segurança dos navegadores, a conexão com dispositivos Bluetooth deve ser inicializada **sempre que você abrir a página**. O app enviará texto padronizado em formato ESC/POS para a impressora. Nem todas as impressoras bluetooth possuem a permissão habilitada para conexão web.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
