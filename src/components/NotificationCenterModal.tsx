import React from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Truck,
  Coffee,
  HelpCircle,
  Play,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenterModal({
  isOpen,
  onClose,
}: NotificationCenterModalProps) {
  const {
    permission,
    isSupported,
    settings,
    updateSettings,
    requestPermission,
    testNotification,
  } = useNotifications();

  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col">
        {/* Modal Header */}
        <div className="bg-gray-900 text-white p-5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/20 text-red-500 rounded-xl border border-red-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Notificações & Alertas
              </h3>
              <p className="text-xs text-gray-400">
                Avisos automáticos de Delivery e Mesas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Status da Permissão do Navegador */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Permissão Push no Navegador
                </span>
                <div className="flex items-center gap-2">
                  {permission === 'granted' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-green-800">
                          Notificações Ativas
                        </p>
                        <p className="text-xs text-green-700">
                          O navegador tem permissão para exibir alertas na tela.
                        </p>
                      </div>
                    </>
                  ) : permission === 'denied' ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-red-800">
                          Bloqueadas no Navegador
                        </p>
                        <p className="text-xs text-red-700">
                          Para receber notificações, clique no ícone de cadeado/configurações na barra do navegador e permita "Notificações".
                        </p>
                      </div>
                    </>
                  ) : !isSupported ? (
                    <>
                      <HelpCircle className="w-5 h-5 text-gray-500 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-gray-800">
                          Não Suportado
                        </p>
                        <p className="text-xs text-gray-600">
                          Seu navegador não oferece suporte à API Push. Alertas visuais e sonoros funcionarão internamente.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Bell className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-amber-800">
                          Não Ativadas
                        </p>
                        <p className="text-xs text-amber-700">
                          Solicite a permissão para não perder pedidos quando o navegador estiver minimizado.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {permission !== 'granted' && isSupported && permission !== 'denied' && (
              <button
                onClick={() => requestPermission()}
                className="mt-3 w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Bell className="w-4 h-4" />
                Permitir Notificações no Navegador
              </button>
            )}
          </div>

          {/* Preferências de Alertas */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
              Tipos de Alerta
            </h4>

            {/* Delivery Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">
                    Novos Pedidos Delivery
                  </p>
                  <p className="text-xs text-gray-500">
                    Avisar quando cliente pedir online ou no delivery
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyDelivery}
                onChange={(e) =>
                  updateSettings({ notifyDelivery: e.target.checked })
                }
                className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer"
              />
            </label>

            {/* Mesas Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">
                    Mesas Pendentes
                  </p>
                  <p className="text-xs text-gray-500">
                    Avisar sobre abertura de mesas e novos itens adicionados
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyMesas}
                onChange={(e) =>
                  updateSettings({ notifyMesas: e.target.checked })
                }
                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
              />
            </label>

            {/* Som Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    settings.soundEnabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">
                    Efeito Sonoro (Campainha)
                  </p>
                  <p className="text-xs text-gray-500">
                    Tocar som alegre de aviso junto com a notificação
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) =>
                  updateSettings({ soundEnabled: e.target.checked })
                }
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Testes Rápidos */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2.5">
              Testar Notificações
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => testNotification('delivery')}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-red-600" />
                Testar Delivery
              </button>
              <button
                onClick={() => testNotification('mesa')}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-amber-600" />
                Testar Mesa
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              navigate('/configuracoes');
            }}
            className="text-xs text-gray-600 hover:text-gray-900 font-semibold flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" /> Mais Configurações
          </button>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
