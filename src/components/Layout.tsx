import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { 
  Calculator, 
  Store, 
  Coffee, 
  Users, 
  Package, 
  History,
  Menu,
  ChefHat,
  BarChart2
} from 'lucide-react';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Caixa', href: '/', icon: Calculator },
    { name: 'Balcão', href: '/balcao', icon: Store },
    { name: 'Mesas', href: '/mesas', icon: Coffee },
    { name: 'Fiados', href: '/fiados', icon: Users },
    { name: 'Produção', href: '/producao', icon: ChefHat },
    { name: 'Produtos', href: '/produtos', icon: Package },
    { name: 'Histórico', href: '/historico', icon: History },
    { name: 'Relatórios', href: '/relatorios', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          <Store className="h-6 w-6" />
          <span className="font-bold text-lg">PDV Alambari Defumados</span>
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
          <span className="font-bold text-xl">PDV Alambari Defumados</span>
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
                    {item.name}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center mb-4">
            <div className="h-8 w-8 rounded-full mr-3 bg-gray-700 flex items-center justify-center">
              <span className="text-white font-bold text-xs">U</span>
            </div>
            <div className="text-sm truncate">
              <p className="font-medium">Usuário Local</p>
              <p className="text-gray-400 text-xs truncate">PDV</p>
            </div>
          </div>
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
