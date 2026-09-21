import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  Printer, 
  Settings, 
  PrinterIcon, 
  Info, 
  Store, 
  Save, 
  ExternalLink, 
  Copy, 
  Shield, 
  Download,
  Bell,
  Volume2,
  VolumeX,
  Truck,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Play,
  HelpCircle,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  User,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Link as LinkIcon,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { thermalPrinter } from '../lib/printer';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNotifications } from '../contexts/NotificationContext';
import { useCashierAuth } from '../contexts/CashierAuthContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { compressAndResizeImage } from '../lib/imageCompressor';

export default function Configuracoes() {
  const [printMode, setPrintMode] = useState<'browser' | 'bluetooth'>('browser');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  const {
    logoUrl,
    isCustomLogo,
    storeName,
    updateLogo,
    resetLogo,
  } = useStoreSettings();

  const [currentStoreName, setCurrentStoreName] = useState(storeName || 'Alambari Defumados');
  const [logoMethod, setLogoMethod] = useState<'upload' | 'url'>('upload');
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (storeName) {
      setCurrentStoreName(storeName);
    }
  }, [storeName]);

  const {
    config: cashierConfig,
    updateConfig: updateCashierConfig,
    logout: lockCashier,
    isAuthenticated: isCashierAuthed,
  } = useCashierAuth();
  const [cashierUser, setCashierUser] = useState(cashierConfig.username);
  const [cashierPass, setCashierPass] = useState(cashierConfig.password);
  const [cashierRequireAuth, setCashierRequireAuth] = useState(cashierConfig.requireAuth);
  const [showCashierPass, setShowCashierPass] = useState(false);
  const [isSavingCashierAuth, setIsSavingCashierAuth] = useState(false);

  useEffect(() => {
    setCashierUser(cashierConfig.username);
    setCashierPass(cashierConfig.password);
    setCashierRequireAuth(cashierConfig.requireAuth);
  }, [cashierConfig]);

  const {
    permission,
    isSupported,
    settings: notifSettings,
    updateSettings: updateNotifSettings,
    requestPermission,
    testNotification,
  } = useNotifications();

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
          const data = docSnap.data();
          setWhatsappNumber(data.whatsappNumber || '');
          setPixKey(data.pixKey || '');
          if (data.storeName) {
            setCurrentStoreName(data.storeName);
          }
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
        storeName: currentStoreName.trim() || 'Alambari Defumados',
        whatsappNumber,
        pixKey,
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

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setLogoFeedback({ type: 'error', message: 'Por favor, selecione um arquivo de imagem válido (.png, .jpg, .webp, .svg).' });
      return;
    }
    try {
      setIsSavingLogo(true);
      setLogoFeedback(null);
      const compressed = await compressAndResizeImage(file, 400, 400, 0.88);
      setPendingLogoPreview(compressed);
    } catch (err: any) {
      setLogoFeedback({ type: 'error', message: err.message || 'Erro ao processar a imagem selecionada.' });
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleConfirmSaveLogo = async () => {
    if (!pendingLogoPreview) return;
    setIsSavingLogo(true);
    setLogoFeedback(null);
    const res = await updateLogo(pendingLogoPreview);
    setIsSavingLogo(false);
    if (res.success) {
      setPendingLogoPreview(null);
      setLogoFeedback({ type: 'success', message: 'Nova logo salva e aplicada com sucesso!' });
      setTimeout(() => setLogoFeedback(null), 5000);
    } else {
      setLogoFeedback({ type: 'error', message: res.error || 'Erro ao salvar o logotipo.' });
    }
  };

  const handleApplyLogoUrl = async () => {
    const trimmed = logoUrlInput.trim();
    if (!trimmed) {
      setLogoFeedback({ type: 'error', message: 'Por favor, insira o link da imagem.' });
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      setLogoFeedback({ type: 'error', message: 'A URL deve iniciar com http:// ou https://' });
      return;
    }
    setIsSavingLogo(true);
    setLogoFeedback(null);
    const res = await updateLogo(trimmed);
    setIsSavingLogo(false);
    if (res.success) {
      setLogoUrlInput('');
      setPendingLogoPreview(null);
      setLogoFeedback({ type: 'success', message: 'Logotipo atualizado com sucesso a partir da URL!' });
      setTimeout(() => setLogoFeedback(null), 5000);
    } else {
      setLogoFeedback({ type: 'error', message: res.error || 'Erro ao salvar o logotipo.' });
    }
  };

  const handleResetLogo = async () => {
    if (!confirm('Deseja realmente restaurar o logotipo original padrão do sistema?')) {
      return;
    }
    setIsSavingLogo(true);
    setLogoFeedback(null);
    const res = await resetLogo();
    setIsSavingLogo(false);
    if (res.success) {
      setPendingLogoPreview(null);
      setLogoFeedback({ type: 'success', message: 'Logotipo padrão restaurado com sucesso!' });
      setTimeout(() => setLogoFeedback(null), 5000);
    } else {
      setLogoFeedback({ type: 'error', message: res.error || 'Erro ao restaurar a logo.' });
    }
  };

  const handleSaveCashierAuth = async () => {
    if (!cashierUser.trim()) {
      alert('Por favor, informe o usuário de acesso ao Caixa.');
      return;
    }
    if (!cashierPass) {
      alert('Por favor, informe a senha de acesso ao Caixa.');
      return;
    }

    setIsSavingCashierAuth(true);
    const result = await updateCashierConfig({
      username: cashierUser.trim(),
      password: cashierPass,
      requireAuth: cashierRequireAuth,
    });
    setIsSavingCashierAuth(false);

    if (result.success) {
      alert('Credenciais da aba do Caixa atualizadas com sucesso!');
    } else {
      alert('Erro ao salvar credenciais do caixa: ' + (result.error || 'Tente novamente'));
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

  const handleDownloadBackup = async () => {
    if (!window.confirm("Deseja gerar e baixar um arquivo de backup com todos os dados atuais?")) return;
    setIsDownloadingBackup(true);
    try {
      const collectionsToBackup = ['products', 'orders', 'bills', 'tables', 'cashierSessions', 'settings'];
      const backupData: Record<string, any[]> = {};
      
      for (const colName of collectionsToBackup) {
        const querySnapshot = await getDocs(collection(db, colName));
        const colData: any[] = [];
        querySnapshot.forEach((docSnap) => {
          colData.push({ id: docSnap.id, ...docSnap.data() });
        });
        backupData[colName] = colData;
      }

      const backupDataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupDataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_caixa_pdv_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erro ao baixar backup:', error);
      alert('Erro ao realizar o backup.');
    } finally {
      setIsDownloadingBackup(false);
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

        {/* Logo Oficial da Marca */}
        <div className="flex items-center gap-4 p-4 bg-gray-900 text-white rounded-xl mb-6 border border-gray-800">
          <img
            src="/logo.png"
            alt="Logo Alambari Defumados"
            className="w-16 h-16 rounded-full object-cover border-2 border-red-500 shadow-md shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-red-400 block">Identidade Visual & Logotipo</span>
            <h3 className="text-lg font-black text-white">Alambari Defumados</h3>
            <p className="text-xs text-gray-300">
              Logotipo oficial ativo no menu lateral, cabeçalhos, cardápio digital e propostas de orçamento.
            </p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Link do seu Cardápio Digital
            </label>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/#/cardapio`}
                className="flex-1 border-2 border-gray-200 bg-gray-50 rounded-lg p-3 text-sm outline-none text-gray-500"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#/cardapio`);
                  alert('Link copiado!');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-lg border-2 border-gray-200 transition-colors"
                title="Copiar Link"
              >
                <Copy className="w-5 h-5" />
              </button>
              <a
                href="#/cardapio"
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
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Apenas números com DDD. Inclua o código do país (ex: 55 para o Brasil).
            </p>

            <label className="block text-sm font-bold text-gray-700 mb-1">
              Chave Pix (Para recebimentos e propostas de eventos)
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Ex: CNPJ, Telefone, E-mail ou Chave Aleatória"
              className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Esta chave será incluída automaticamente nas propostas de orçamento de churrasco para cobrança do sinal.
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

      {/* Segurança & Senha da Aba do Caixa */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Segurança & Senha da Aba do Caixa
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Proteja a visualização financeira, saldos e fechamento de caixa com usuário e senha.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                cashierRequireAuth
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              {cashierRequireAuth ? 'Proteção Ativa' : 'Acesso Livre'}
            </span>
            {cashierRequireAuth && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  isCashierAuthed
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {isCashierAuthed ? 'Sessão Liberada' : 'Bloqueado'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Toggle de Ativação */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-bold text-gray-800">
                Exigir usuário e senha para abrir a aba do Caixa
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Quando ativado, qualquer pessoa que clicar em "Caixa" precisará informar as credenciais abaixo para ver os dados.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
              <input
                type="checkbox"
                checked={cashierRequireAuth}
                onChange={(e) => setCashierRequireAuth(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Campo Usuário */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Usuário de Acesso ao Caixa
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={cashierUser}
                  onChange={(e) => setCashierUser(e.target.value)}
                  placeholder="Ex: caixa ou gerente"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Identificador digitado no momento do login (padrão: <span className="font-semibold">caixa</span>).
              </p>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Senha de Acesso ao Caixa
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showCashierPass ? 'text' : 'password'}
                  value={cashierPass}
                  onChange={(e) => setCashierPass(e.target.value)}
                  placeholder="Digite a senha"
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCashierPass(!showCashierPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  title={showCashierPass ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showCashierPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Senha exigida para destravar o painel (padrão: <span className="font-semibold">1234</span>).
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCashierAuth}
                disabled={isSavingCashierAuth}
                className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-2.5 px-6 rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingCashierAuth ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Salvar Senha do Caixa</span>
              </button>

              {cashierRequireAuth && isCashierAuthed && (
                <button
                  type="button"
                  onClick={() => {
                    lockCashier();
                    alert('Aba do Caixa bloqueada! Agora será exigido usuário e senha para acessá-la.');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center gap-1.5 text-sm cursor-pointer"
                  title="Bloquear agora para testar a tela de senha"
                >
                  <Lock className="w-4 h-4 text-red-500" />
                  <span>Bloquear Caixa Agora</span>
                </button>
              )}
            </div>

            <p className="text-xs text-gray-400 italic">
              * Salvo no banco de dados da loja em tempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Notificações Push & Alertas em Tempo Real */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-600" />
            Notificações Push & Alertas em Tempo Real
          </h2>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto ${
              permission === 'granted'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : permission === 'denied'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {permission === 'granted'
              ? 'Push Ativo no Navegador'
              : permission === 'denied'
              ? 'Bloqueado no Navegador'
              : 'Permissão Pendente'}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          Configure avisos automáticos na tela e sons de campainha sempre que chegarem novos pedidos de delivery ou quando clientes e garçons registrarem pedidos em mesas.
        </p>

        {/* Status e Ação de Permissão */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {permission === 'granted' ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
              ) : permission === 'denied' ? (
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <HelpCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="font-bold text-sm text-gray-900">
                  {permission === 'granted'
                    ? 'Permissão Concedida com Sucesso'
                    : permission === 'denied'
                    ? 'Notificações Bloqueadas no Navegador'
                    : 'Permissão Não Concedida Ainda'}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {permission === 'granted'
                    ? 'O sistema exibirá notificações na área de trabalho e no celular mesmo se você estiver em outra aba.'
                    : permission === 'denied'
                    ? 'O navegador bloqueou as notificações. Para reativar, clique no ícone de ajustes/cadeado na barra de endereço do navegador e mude Notificações para "Permitir".'
                    : 'Clique no botão ao lado para solicitar a permissão do navegador.'}
                </p>
              </div>
            </div>

            {permission !== 'granted' && isSupported && (
              <button
                onClick={() => requestPermission()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
              >
                <Bell className="w-4 h-4" />
                {permission === 'denied' ? 'Tentar Reativar' : 'Ativar Notificações'}
              </button>
            )}
          </div>
        </div>

        {/* Toggles de Preferências */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {/* Toggle Delivery */}
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-gray-300 transition-colors bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-red-50 text-red-600">
                <Truck className="w-5 h-5" />
              </div>
              <input
                type="checkbox"
                checked={notifSettings.notifyDelivery}
                onChange={(e) =>
                  updateNotifSettings({ notifyDelivery: e.target.checked })
                }
                className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Pedidos Delivery</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Alerta instantâneo quando um cliente pedir online ou no balcão delivery.
              </p>
            </div>
          </div>

          {/* Toggle Mesas */}
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-gray-300 transition-colors bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Coffee className="w-5 h-5" />
              </div>
              <input
                type="checkbox"
                checked={notifSettings.notifyMesas}
                onChange={(e) =>
                  updateNotifSettings({ notifyMesas: e.target.checked })
                }
                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Mesas Pendentes</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Alerta quando novas mesas forem abertas ou novos cortes forem pedidos.
              </p>
            </div>
          </div>

          {/* Toggle Som */}
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-gray-300 transition-colors bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                {notifSettings.soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </div>
              <input
                type="checkbox"
                checked={notifSettings.soundEnabled}
                onChange={(e) =>
                  updateNotifSettings({ soundEnabled: e.target.checked })
                }
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Campainha Sonora</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Sintetizador de áudio integrado (não falha e não precisa de internet).
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Teste */}
        <div className="pt-4 border-t flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">
            Disparar Teste:
          </span>
          <button
            onClick={() => testNotification('delivery')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-red-600" />
            Testar Alerta Delivery
          </button>
          <button
            onClick={() => testNotification('mesa')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-amber-600" />
            Testar Alerta Mesa
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-4">
          <Shield className="w-6 h-6 text-emerald-500" />
          Backup e Segurança
        </h2>

        <div className="max-w-md space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Faça o download de todos os dados do sistema (vendas, produtos, contas, sessões de caixa) em formato JSON para fins de backup e segurança. Recomendamos realizar backups periodicamente.
          </p>

          <button
            onClick={handleDownloadBackup}
            disabled={isDownloadingBackup}
            className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {isDownloadingBackup ? (
              'Gerando Backup...'
            ) : (
              <>
                <Download className="w-5 h-5" /> Baixar Backup dos Dados
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
