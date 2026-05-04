import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { 
  Calculator, 
  Store, 
  Coffee, 
  Users, 
  Package, 
  History,
  LogOut,
  Menu
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Caixa', href: '/', icon: Calculator },
    { name: 'Balcão', href: '/balcao', icon: Store },
    { name: 'Mesas', href: '/mesas', icon: Coffee },
    { name: 'Fiados', href: '/fiados', icon: Users },
    { name: 'Produtos', href: '/produtos', icon: Package },
    { name: 'Histórico', href: '/historico', icon: History },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          <Store className="h-6 w-6" />
          <span className="font-bold text-lg">PDV Simples</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "bg-gray-900 text-white w-full md:w-64 flex-shrink-0 flex-col transition-all duration-300 ease-in-out",
        isMobileMenuOpen ? "flex" : "hidden md:flex"
      )}>
        <div className="p-4 hidden md:flex items-center space-x-2 border-b border-gray-800">
          <Store className="h-8 w-8" />
          <span className="font-bold text-xl">PDV Simples</span>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                  isActive ? "bg-red-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center mb-4">
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.email}`} 
              alt="Avatar" 
              className="h-8 w-8 rounded-full mr-3"
            />
            <div className="text-sm truncate">
              <p className="font-medium">{user?.displayName || 'Usuário'}</p>
              <p className="text-gray-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
