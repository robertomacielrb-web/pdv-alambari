import React from 'react';
import { Truck, Coffee, Bell, X, ArrowRight, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationToastContainer() {
  const { toasts, dismissToast } = useNotifications();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2">
      {toasts.map((toast) => {
        const isDelivery = toast.type === 'delivery';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto shadow-2xl rounded-xl border p-4 bg-white transition-all transform animate-in slide-in-from-right-4 duration-200 ${
              isDelivery
                ? 'border-red-500 ring-2 ring-red-500/20'
                : 'border-amber-500 ring-2 ring-amber-500/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl text-white shrink-0 ${
                    isDelivery ? 'bg-red-600 shadow-md' : 'bg-amber-600 shadow-md'
                  }`}
                >
                  {isDelivery ? (
                    <Truck className="w-5 h-5" />
                  ) : (
                    <Coffee className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h5 className="font-black text-sm text-gray-900 leading-tight">
                      {toast.title}
                    </h5>
                    <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-medium leading-normal">
                    {toast.message}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2">
                    {toast.url && (
                      <button
                        onClick={() => {
                          dismissToast(toast.id);
                          if (toast.url?.startsWith('#/')) {
                            navigate(toast.url.replace('#/', '/'));
                          } else if (toast.url) {
                            navigate(toast.url);
                          }
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 transition-colors ${
                          isDelivery
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        Ver Detalhes <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => dismissToast(toast.id)}
                      className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 font-medium"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
