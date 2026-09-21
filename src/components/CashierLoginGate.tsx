import React, { useState } from 'react';
import { Lock, Unlock, User, Eye, EyeOff, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { useCashierAuth } from '../contexts/CashierAuthContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';

interface CashierLoginGateProps {
  onSuccess?: () => void;
}

export default function CashierLoginGate({ onSuccess }: CashierLoginGateProps) {
  const { login, config } = useCashierAuth();
  const { logoUrl, storeName } = useStoreSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || 'Usuário ou senha incorretos.');
      }
    } catch (err: any) {
      setError('Erro ao processar login. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDefaults = () => {
    setUsername(config.username || 'caixa');
    setPassword(config.password || '1234');
    setError(null);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header Visual */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-red-600/20 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-3">
              <img
                src={logoUrl || "/logo.png"}
                alt={storeName || "Alambari Defumados"}
                className="w-16 h-16 rounded-full object-cover border-2 border-red-500 shadow-md bg-black/40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-600 border-2 border-gray-900 flex items-center justify-center shadow">
                <Lock className="w-3 h-3 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Acesso ao Caixa
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-xs leading-relaxed">
              Área restrita de controle financeiro, saldo, abertura e fechamento de turno.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Campo Usuário */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Usuário
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: caixa ou gerente"
                autoComplete="username"
                autoFocus
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Senha
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha do caixa"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Liberar Acesso ao Caixa</span>
              </>
            )}
          </button>

          {/* Dica de Acesso / Atalho de credenciais de fábrica */}
          <div className="pt-4 border-t border-gray-100">
            <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-amber-950">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  Credenciais Iniciais do Caixa
                </span>
                <button
                  type="button"
                  onClick={handleFillDefaults}
                  className="text-[11px] text-red-600 hover:text-red-700 underline font-semibold cursor-pointer"
                >
                  Preencher
                </button>
              </div>
              <p className="text-[11px] text-amber-800 leading-normal">
                Padrão: usuário <strong className="font-semibold">{config.username || 'caixa'}</strong> e senha <strong className="font-semibold">{config.password || '1234'}</strong>.
              </p>
              <p className="text-[10px] text-gray-500">
                Você pode alterar o usuário e a senha a qualquer momento na aba <strong>Configurações</strong>.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
