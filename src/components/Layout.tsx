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
  Lock
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useCashierAuth } from '../contexts/CashierAuthContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import NotificationToastContainer from './NotificationToastContainer';
import NotificationCenterModal from './NotificationCenterModal';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = React.useState(false);
  const { permission, openPermissionBanner } = useNotifications();
  const { isAuthenticated: isCashierAuthed, requireAuth: isCashierAuthRequired } = useCashierAuth();
  const { logoUrl, storeName } = useStoreSettings();

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
        "bg-gray-900 text-white w-full md:w-64 flex-shrink-0 flex-col transition-all duration-300 ease-in-out",
        isMobileMenuOpen ? "flex" : "hidden md:flex"
      )}>
        <div className="p-4 hidden md:flex items-center space-x-3 border-b border-gray-800">
          <img
            src={logoUrl || "/logo.png"}
            alt={storeName || "Alambari Defumados"}
            className="h-11 w-11 rounded-full object-cover border-2 border-red-600 shadow-md flex-shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col">
            <span className="font-black text-lg leading-tight tracking-tight text-white">ALAMBARI</span>
            <span className="text-xs font-bold text-red-500 tracking-widest uppercase">DEFUMADOS</span>
          </div>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => cn(
                  "group flex items-center px-3 py-2.5 my-0.5 text-sm font-medium transition-all duration-200 border-l-4 rounded-r-lg mr-2",
                  isActive 
                    ? "bg-gray-800/80 border-red-500 text-white" 
                    : "border-transparent text-gray-400 hover:bg-gray-800/40 hover:border-gray-600 hover:text-gray-100"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200",
                      isActive ? "text-red-400" : "text-gray-500 group-hover:text-gray-300"
                    )} />
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
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-3">
          {/* Quick Push Notification Widget */}
          <button
            onClick={() => setIsNotifModalOpen(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 text-left transition-all group cursor-pointer"
            title="Gerenciar Notificações de Pedidos e Mesas"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Bell className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors" />
                {permission === 'granted' ? (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full ring-1 ring-gray-900" />
                ) : (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-1 ring-gray-900" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-200 leading-none mb-0.5">
                  Notificações
                </span>
                <span className="text-[10px] text-gray-400 leading-none">
                  {permission === 'granted' ? 'Alertas Ativos' : 'Ativar Push'}
                </span>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                permission === 'granted'
                  ? 'bg-green-900/60 text-green-400 border border-green-700/50'
                  : 'bg-red-900/60 text-red-300 border border-red-700/50 animate-pulse'
              }`}
            >
              {permission === 'granted' ? 'Ativo' : 'Aviso'}
            </span>
          </button>

          <div className="flex items-center px-1">
            <div className="h-8 w-8 rounded-full mr-3 bg-gray-700 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">U</span>
            </div>
            <div className="text-sm truncate">
              <p className="font-medium text-white text-xs">Usuário Local</p>
              <p className="text-gray-400 text-[11px] truncate">PDV Alambari</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
        {/* Permission Request Prompt Banner */}
        <NotificationPermissionBanner />

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>

      {/* Real-time Toasts & Settings Modal */}
      <NotificationToastContainer />
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
    </div>
  );
}
