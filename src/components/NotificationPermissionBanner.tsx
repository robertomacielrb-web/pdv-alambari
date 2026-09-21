import React from 'react';
import { Bell, X, Check, Volume2, Truck, Coffee } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationPermissionBanner() {
  const {
    permission,
    isSupported,
    isPermissionBannerOpen,
    requestPermission,
    dismissPermissionBanner,
  } = useNotifications();

  if (!isSupported || !isPermissionBannerOpen || permission === 'granted') {
    return null;
  }

  return (
    <aside
      aria-label="Aviso de notificações"
      className="bg-gradient-to-r from-gray-950 via-gray-900 to-red-950 text-white border-b-2 border-red-600 shadow-xl px-4 py-3 sticky top-0 z-40"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="relative mt-0.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 animate-pulse">
              <Bell className="w-5 h-5" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-gray-900 animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base text-white">
                Ativar Notificações de Pedidos & Mesas
              </h4>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                Alerta Sonoro
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 mt-0.5 leading-snug">
              Receba avisos imediatos na tela e sons de campainha quando novos pedidos de delivery entrarem ou mesas estiverem pendentes.
            </p>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-red-400" /> Novos Deliveries
              </span>
              <span className="flex items-center gap-1">
                <Coffee className="w-3.5 h-3.5 text-amber-400" /> Mesas Pendentes
              </span>
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-green-400" /> Avisos Sonoros
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0 w-full md:w-auto">
          <button
            onClick={() => requestPermission()}
            className="flex-1 md:flex-initial bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Ativar Notificações
          </button>
          
          <button
            onClick={dismissPermissionBanner}
            className="text-gray-400 hover:text-white px-3 py-2 text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1"
            title="Fechar por agora"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Depois</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
