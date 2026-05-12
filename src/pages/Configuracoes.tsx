import React, { useState, useEffect } from 'react';
import { Bluetooth, Printer, Settings, PrinterIcon, Info, Store, Save, ExternalLink, Copy } from 'lucide-react';
import { thermalPrinter } from '../lib/printer';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export default function Configuracoes() {
  const [printMode, setPrintMode] = useState<'browser' | 'bluetooth'>('browser');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('printMode') as 'browser' | 'bluetooth';
    if (savedMode) {
      setPrintMode(savedMode);
    }
    
    // Load store settings
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'store');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setWhatsappNumber(docSnap.data().whatsappNumber || '');
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'settings', 'store'), {
        whatsappNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('Configurações da loja salvas com sucesso!');
    } catch (error) {
      alert('Erro ao salvar as configurações.');
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    } finally {
      setIsSavingConfig(false);
    }
  };

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
          <Store className="w-6 h-6 text-gray-500" />
          Configurações da Loja
        </h2>

        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Link do seu Cardápio Digital
            </label>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/cardapio`}
                className="flex-1 border-2 border-gray-200 bg-gray-50 rounded-lg p-3 text-sm outline-none text-gray-500"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/cardapio`);
                  alert('Link copiado!');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-lg border-2 border-gray-200 transition-colors"
                title="Copiar Link"
              >
                <Copy className="w-5 h-5" />
              </button>
              <a
                href="/cardapio"
                target="_blank"
                rel="noreferrer"
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-3 rounded-lg border-2 border-indigo-100 transition-colors"
                title="Abrir Cardápio"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Envie este link para seus clientes ou coloque na sua bio do Instagram.
            </p>

            <label className="block text-sm font-bold text-gray-700 mb-1">
              Número do WhatsApp (Pedidos)
            </label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Apenas números com DDD. Inclua o código do país (ex: 55 para o Brasil).
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={isSavingConfig}
            className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {isSavingConfig ? 'Salvando...' : (
              <>
                <Save className="w-4 h-4" /> Salvar Configurações
              </>
            )}
          </button>
        </div>
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
              Por questões de segurança, a impressora deve ser conectada **sempre que você abrir a página**.<br/><br/>
              <b>Atenção Celulares:</b> A Apple (iPhone/iPad) <u>bloqueia</u> totalmente o Bluetooth no navegador. No Android, costuma funcionar pelo Google Chrome. Se seu celular não suporta, selecione a <b>Impressão Padrão</b> e instale um app gerenciador de impressão da sua impressora (como o <i>RawBT</i> no Android) e compartilhe a página/PDF com ele.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
