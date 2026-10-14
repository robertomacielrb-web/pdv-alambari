import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { 
  Calculator, 
  Store, 
  Coffee, 
  Users, 
  Package, 
  Truck,
  History,
  Menu,
  ChefHat,
  BarChart2,
  Settings,
  Receipt,
  Activity,
  Flame,
  Bell,
  Lock,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useCashierAuth } from '../contexts/CashierAuthContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { useFullscreen } from '../contexts/FullscreenContext';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import NotificationToastContainer from './NotificationToastContainer';
import NotificationCenterModal from './NotificationCenterModal';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) return saved === 'true';
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024) {
        return true;
      }
    } catch {}
    return false;
  });

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const { permission, openPermissionBanner } = useNotifications();
  const { isAuthenticated: isCashierAuthed, requireAuth: isCashierAuthRequired } = useCashierAuth();
  const { logoUrl, storeName } = useStoreSettings();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const navigation = [
    { name: 'Caixa', href: '/', icon: Calculator },
    { name: 'Balcão', href: '/balcao', icon: Store },
    { name: 'Mesas', href: '/mesas', icon: Coffee },
    { name: 'Fiados', href: '/fiados', icon: Users },
    { name: 'Delivery', href: '/delivery', icon: Truck },
    { name: 'Eventos / Churrasco', href: '/churrasco', icon: Flame },
    { name: 'ERP / Atacado', href: '/erp', icon: Package },
    { name: 'Produção', href: '/producao', icon: ChefHat },
    { name: 'Produtos', href: '/produtos', icon: Package },
    { name: 'Histórico', href: '/historico', icon: History },
    { name: 'Relatórios', href: '/relatorios', icon: BarChart2 },
    { name: 'Contas a Pagar', href: '/contas-pagar', icon: Receipt },
    { name: 'Fluxo de Caixa', href: '/fluxo-caixa', icon: Activity },
    { name: 'Configurações', href: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3">
          <img
            src={logoUrl || "/logo.png"}
            alt={storeName || "Alambari Defumados"}
            className="h-9 w-9 rounded-full object-cover border-2 border-red-600 shadow-sm"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col">
            <span className="font-black text-base tracking-tight leading-none text-white">ALAMBARI</span>
            <span className="text-[10px] font-bold text-red-500 tracking-wider uppercase">DEFUMADOS</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title={isFullscreen ? "Restaurar janela" : "Modo tela cheia"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setIsNotifModalOpen(true)}
            className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 relative transition-colors"
            title="Notificações & Alertas"
            aria-label="Abrir notificações"
          >
            <Bell className="h-5 w-5" />
            {permission === 'granted' ? (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-gray-900" />
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-gray-900" />
            )}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "bg-gray-900 text-white flex-shrink-0 flex-col transition-all duration-300 ease-in-out select-none",
        isMobileMenuOpen ? "flex w-full" : "hidden md:flex",
        isSidebarCollapsed ? "md:w-20" : "md:w-64"
      )}>
        {/* Sidebar Header */}
        <div className={cn(
          "border-b border-gray-800 hidden md:flex items-center",
          isSidebarCollapsed ? "p-3 flex-col gap-2 justify-center" : "p-4 justify-between"
        )}>
          <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "space-x-3")}>
            <img
              src={logoUrl || "/logo.png"}
              alt={storeName || "Alambari Defumados"}
              className={cn(
                "rounded-full object-cover border-2 border-red-600 shadow-md flex-shrink-0",
                isSidebarCollapsed ? "h-9 w-9" : "h-11 w-11"
              )}
              referrerPolicy="no-referrer"
            />
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-black text-lg leading-tight tracking-tight text-white">ALAMBARI</span>
                <span className="text-xs font-bold text-red-500 tracking-widest uppercase">DEFUMADOS</span>
              </div>
            )}
          </div>

          <button
            onClick={toggleSidebarCollapsed}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title={isSidebarCollapsed ? "Expandir menu (Modo Completo)" : "Recolher menu (Mais espaço no Tablet)"}
            aria-label="Alternar tamanho do menu lateral"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-gray-300 hover:text-red-400 transition-colors" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-gray-400 hover:text-red-400 transition-colors" />
            )}
          </button>
        </div>
        
        {/* Navigation Links */}
        <nav className="flex-1 px-2 py-4 space-y-1.5 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                title={item.name}
                className={({ isActive }) => cn(
                  "group flex items-center transition-all duration-200 rounded-xl",
                  isSidebarCollapsed 
                    ? "justify-center flex-col py-2 px-1 mx-1 gap-1 text-center" 
                    : "px-3 py-2.5 my-0.5 text-sm font-medium border-l-4 rounded-r-lg mr-2",
                  isActive 
                    ? (isSidebarCollapsed ? "bg-red-600 text-white shadow-md shadow-red-950/40" : "bg-gray-800/80 border-red-500 text-white") 
                    : "border-transparent text-gray-400 hover:bg-gray-800/50 hover:text-gray-100"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn(
                      "flex-shrink-0 transition-colors duration-200",
                      isSidebarCollapsed ? "h-5 w-5" : "mr-3 h-5 w-5",
                      isActive 
                        ? (isSidebarCollapsed ? "text-white" : "text-red-400") 
                        : "text-gray-400 group-hover:text-gray-200"
                    )} />
                    {isSidebarCollapsed ? (
                      <span className="text-[9px] font-bold leading-none truncate max-w-[66px]">
                        {item.name.startsWith('Eventos') ? 'Eventos' : item.name.split(' ')[0]}
                      </span>
                    ) : (
                      <>
                        <span className="flex-1 text-left">{item.name}</span>
                        {item.href === '/' && isCashierAuthRequired && (
                          <span
                            className={cn(
                              "ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1",
                              isCashierAuthed
                                ? "text-emerald-400 bg-emerald-950/60 border border-emerald-800/50"
                                : "text-amber-300 bg-amber-950/70 border border-amber-800/60"
                            )}
                            title={isCashierAuthed ? 'Caixa desbloqueado nesta sessão' : 'Caixa protegido por senha'}
                          >
                            <Lock className="w-2.5 h-2.5" />
                            {isCashierAuthed ? 'Livre' : 'Senha'}
                          </span>
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-2.5 border-t border-gray-800 space-y-2">
          {/* Quick Fullscreen Toggle Widget */}
          <button
            onClick={toggleFullscreen}
            className={cn(
              "rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 transition-all group cursor-pointer",
              isSidebarCollapsed
                ? "w-full p-2.5 flex items-center justify-center"
                : "w-full flex items-center justify-between p-2.5 text-left"
            )}
            title={isFullscreen ? "Restaurar janela normal" : "Entrar em modo tela cheia (F11)"}
          >
            <div className="flex items-center gap-2.5">
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transition-colors shrink-0" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors shrink-0" />
              )}
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-200 leading-none mb-0.5">
                    Tela Cheia
                  </span>
                  <span className="text-[10px] text-gray-400 leading-none">
                    {isFullscreen ? 'Modo Imersivo' : 'Ativar F11'}
                  </span>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  isFullscreen
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                    : 'bg-gray-750 text-gray-400 border border-gray-700'
                }`}
              >
                {isFullscreen ? 'Cheia' : 'Normal'}
              </span>
            )}
          </button>

          {/* Quick Push Notification Widget */}
          <button
            onClick={() => setIsNotifModalOpen(true)}
            className={cn(
              "rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 transition-all group cursor-pointer",
              isSidebarCollapsed
                ? "w-full p-2.5 flex items-center justify-center relative"
                : "w-full flex items-center justify-between p-2.5 text-left"
            )}
            title="Gerenciar Notificações de Pedidos e Mesas"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Bell className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors shrink-0" />
                {permission === 'granted' ? (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full ring-1 ring-gray-900" />
                ) : (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-1 ring-gray-900" />
                )}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-200 leading-none mb-0.5">
                    Notificações
                  </span>
                  <span className="text-[10px] text-gray-400 leading-none">
                    {permission === 'granted' ? 'Alertas Ativos' : 'Ativar Push'}
                  </span>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  permission === 'granted'
                    ? 'bg-green-900/60 text-green-400 border border-green-700/50'
                    : 'bg-red-900/60 text-red-300 border border-red-700/50 animate-pulse'
                }`}
              >
                {permission === 'granted' ? 'Ativo' : 'Aviso'}
              </span>
            )}
          </button>

          {/* User Status */}
          <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center py-1" : "px-1 pt-1")}>
            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 border border-gray-600">
              <span className="text-white font-bold text-xs">U</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="text-sm truncate ml-3">
                <p className="font-medium text-white text-xs">Usuário Local</p>
                <p className="text-gray-400 text-[11px] truncate">PDV Alambari</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Permission Request Prompt Banner */}
        <NotificationPermissionBanner />

        <div className="p-3 sm:p-4 md:p-6 lg:p-7 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>

      {/* Tablet & Mobile Quick Bottom Dock */}
      <nav 
        aria-label="Acesso rápido para tablet e celular"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 text-white z-40 px-2 py-1.5 flex items-center justify-around shadow-2xl select-none"
      >
        <NavLink
          to="/"
          className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[62px] active:scale-95",
            isActive ? "text-red-400 bg-gray-800/90 font-bold" : "text-gray-400 hover:text-gray-200"
          )}
        >
          <Calculator className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight leading-none font-bold">Caixa</span>
        </NavLink>

        <NavLink
          to="/balcao"
          className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[62px] active:scale-95",
            isActive ? "text-red-400 bg-gray-800/90 font-bold" : "text-gray-400 hover:text-gray-200"
          )}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight leading-none font-bold">Balcão</span>
        </NavLink>

        <NavLink
          to="/mesas"
          className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[62px] active:scale-95",
            isActive ? "text-red-400 bg-gray-800/90 font-bold" : "text-gray-400 hover:text-gray-200"
          )}
        >
          <Coffee className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight leading-none font-bold">Mesas</span>
        </NavLink>

        <NavLink
          to="/delivery"
          className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[62px] active:scale-95",
            isActive ? "text-red-400 bg-gray-800/90 font-bold" : "text-gray-400 hover:text-gray-200"
          )}
        >
          <Truck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight leading-none font-bold">Delivery</span>
        </NavLink>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[62px] text-gray-400 hover:text-gray-200 active:scale-95 cursor-pointer"
          title="Ver todos os módulos e configurações"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight leading-none font-bold">Mais</span>
        </button>
      </nav>

      {/* Real-time Toasts & Settings Modal */}
      <NotificationToastContainer />
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
    </div>
  );
}
