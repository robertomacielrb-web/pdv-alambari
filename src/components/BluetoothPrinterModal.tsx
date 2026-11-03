import React, { useState } from 'react';
import {
  Bluetooth,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  HelpCircle,
  RotateCw,
  Power,
  Sliders,
  X,
  Smartphone,
  Info
} from 'lucide-react';
import { useBluetoothPrinter } from '../contexts/BluetoothPrinterContext';

export default function BluetoothPrinterModal() {
  const {
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
    closeModal,
  } = useBluetoothPrinter();

  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isModalOpen) return null;

  const handleConnect = async () => {
    setTestStatus(null);
    const res = await connect();
    if (!res.success) {
      setTestStatus(res.error || 'Erro ao conectar impressora');
    } else {
      setTestStatus('Impressora conectada com sucesso!');
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  const handleRunTest = async (type: 'simple' | 'complete') => {
    setIsTesting(true);
    setTestStatus('Enviando dados para a impressora...');
    const res = await testPrint(type);
    setIsTesting(false);
    if (res.success) {
      setTestStatus('Cupom de teste impresso com sucesso!');
      setTimeout(() => setTestStatus(null), 4000);
    } else {
      setTestStatus(res.error || 'Erro ao enviar impressão.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-tight">
                Impressora Térmica Bluetooth
              </h3>
              <p className="text-xs text-gray-500">
                Conexão Web Bluetooth direta pelo navegador
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Status do Navegador */}
          {!isSupported && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-sm">Navegador sem suporte a Web Bluetooth</strong>
                <span>
                  O navegador atual não permite conexões Bluetooth diretas. No <b>iPhone/iPad</b> essa API é bloqueada pela Apple (utilize "Impressão Padrão"). Em <b>computadores e Android</b>, utilize o <b>Google Chrome</b> ou <b>Microsoft Edge</b>.
                </span>
              </div>
            </div>
          )}

          {/* Status do Dispositivo */}
          <div className={`rounded-xl border p-4 transition-all ${
            isConnected
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status da Impressora
                  </div>
                  <div className="text-base font-black text-gray-900 flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                        <span>Conectada: <b>{deviceName || 'Impressora Térmica'}</b></span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-gray-400 inline" />
                        <span>Desconectada</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isConnected ? (
                <button
                  type="button"
                  onClick={disconnect}
                  className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors self-start sm:self-center cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={!isSupported || isConnecting}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-center"
                >
                  {isConnecting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-3.5 h-3.5" />
                      <span>Conectar Bluetooth</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {testStatus && (
              <div className="mt-3 pt-3 border-t border-gray-200/60 text-xs font-bold text-gray-800 flex items-center gap-1.5 animate-in fade-in">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{testStatus}</span>
              </div>
            )}
          </div>

          {/* Seleção do Modo de Impressão */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Modo Padrão de Envio de Impressão
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPrintMode('bluetooth')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  printMode === 'bluetooth'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-900 mb-0.5">
                  <Bluetooth className="w-4 h-4 text-blue-600" />
                  <span>Bluetooth Direto</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Imprime instantaneamente na bobina térmica sem abrir caixa de diálogo.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('browser')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  printMode === 'browser'
                    ? 'bg-gray-100 border-gray-500 ring-2 ring-gray-400/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-900 mb-0.5">
                  <Printer className="w-4 h-4 text-gray-600" />
                  <span>Janela do Navegador</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Abre a janela tradicional de impressão para impressoras USB, Wi-Fi ou salvar em PDF.
                </p>
              </button>
            </div>
          </div>

          {/* Configurações da Bobina Térmica */}
          <div className="bg-gray-50/80 rounded-xl border border-gray-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-gray-600" />
                Largura da Bobina Térmica
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                    : 'bg-gray-100/60 border-gray-300 text-gray-600 hover:bg-white'
                }`}
              >
                <span>Bobina 58mm</span>
                <span className="text-[10px] font-normal text-gray-500">Padrão portátil (32 colunas)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                    : 'bg-gray-100/60 border-gray-300 text-gray-600 hover:bg-white'
                }`}
              >
                <span>Bobina 80mm</span>
                <span className="text-[10px] font-normal text-gray-500">Padrão de balcão (48 colunas)</span>
              </button>
            </div>

            {/* Vias de Impressão */}
            <div className="pt-2 border-t border-gray-200/80 space-y-2">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                Vias que saem automaticamente na venda:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-800 cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={printCopiesCustomer}
                    onChange={(e) => setPrintCopiesCustomer(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>1. Via do Cliente</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-800 cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={printCopiesProduction}
                    onChange={(e) => setPrintCopiesProduction(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>2. Via da Produção</span>
                </label>
              </div>
            </div>
          </div>

          {/* Testes de Impressão */}
          {isConnected && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Testes com a Impressora Conectada
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => handleRunTest('simple')}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 px-3 rounded-lg text-xs transition-colors border border-gray-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Receipt className="w-3.5 h-3.5 text-gray-600" />
                  <span>Teste Rápido (1 Via)</span>
                </button>

                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => handleRunTest('complete')}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Testar 2 Vias (Cliente + Cozinha)</span>
                </button>
              </div>
            </div>
          )}

          {/* Dicas de Conexão */}
          <div className="text-[11px] text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-1">
            <p className="font-bold text-gray-700 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Como parear a impressora:
            </p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Ligue sua impressora térmica Bluetooth e certifique-se de que a luz azul está piscando.</li>
              <li>Clique em <b>"Conectar Bluetooth"</b> acima. O navegador exibirá a lista de dispositivos próximos.</li>
              <li>Selecione o modelo (ex: <i>POS-58, MPT-II, Bluetooth Printer</i>) e clique em <b>Parear</b>.</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t mt-3 flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors cursor-pointer"
          >
            Pronto / Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
