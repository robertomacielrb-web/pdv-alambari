import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { playDeliverySound, playTableSound, initAudioOnUserGesture } from '../lib/sound';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface InAppNotification {
  id: string;
  type: 'delivery' | 'mesa' | 'system';
  title: string;
  message: string;
  url?: string;
  timestamp: Date;
}

interface NotificationSettings {
  soundEnabled: boolean;
  notifyDelivery: boolean;
  notifyMesas: boolean;
}

interface NotificationContextValue {
  permission: NotificationPermissionState;
  isSupported: boolean;
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  requestPermission: () => Promise<NotificationPermissionState>;
  testNotification: (type?: 'delivery' | 'mesa') => void;
  toasts: InAppNotification[];
  dismissToast: (id: string) => void;
  isPermissionBannerOpen: boolean;
  dismissPermissionBanner: () => void;
  openPermissionBanner: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const STORAGE_SETTINGS_KEY = 'alambari_notif_settings';
const STORAGE_BANNER_DISMISSED_KEY = 'alambari_notif_banner_dismissed';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (!isSupported) return 'unsupported';
    try {
      return Notification.permission as NotificationPermissionState;
    } catch {
      return 'unsupported';
    }
  });

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read notification settings from localStorage', e);
    }
    return {
      soundEnabled: true,
      notifyDelivery: true,
      notifyMesas: true,
    };
  });

  const [isPermissionBannerOpen, setIsPermissionBannerOpen] = useState<boolean>(() => {
    if (!isSupported) return false;
    try {
      if (Notification.permission === 'granted') return false;
      const dismissed = sessionStorage.getItem(STORAGE_BANNER_DISMISSED_KEY);
      return !dismissed;
    } catch {
      return false;
    }
  });

  const [toasts, setToasts] = useState<InAppNotification[]>([]);

  // Keep track of observed orders so initial snapshot doesn't fire spurious alerts
  const initializedOrdersRef = useRef<boolean>(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const knownMesaItemsCountRef = useRef<Map<string, number>>(new Map());

  // Save settings on update
  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save settings to localStorage', err);
      }
      return updated;
    });
  };

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<InAppNotification, 'id' | 'timestamp'>) => {
    const newToast: InAppNotification = {
      ...toast,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    // Auto dismiss after 8s
    setTimeout(() => {
      dismissToast(newToast.id);
    }, 8000);
  }, [dismissToast]);

  const triggerAlert = useCallback((
    type: 'delivery' | 'mesa',
    title: string,
    message: string,
    url?: string
  ) => {
    // 1. Play sound if enabled
    if (settings.soundEnabled) {
      if (type === 'delivery') {
        playDeliverySound();
      } else {
        playTableSound();
      }
    }

    // 2. Display In-app visual toast
    addToast({
      type,
      title,
      message,
      url,
    });

    // 3. Display Browser push notification if permission granted
    if (isSupported && permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: message,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: `${type}-${Date.now()}`,
          requireInteraction: true,
        });

        notif.onclick = () => {
          window.focus();
          if (url) {
            window.location.hash = url;
          }
          notif.close();
        };
      } catch (err) {
        console.warn('Native notification failed, toast shown instead:', err);
      }
    }
  }, [addToast, isSupported, permission, settings.soundEnabled]);

  // Request browser notification permission
  const requestPermission = async (): Promise<NotificationPermissionState> => {
    initAudioOnUserGesture();

    if (!isSupported) {
      setPermission('unsupported');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      const mapped = result as NotificationPermissionState;
      setPermission(mapped);
      setIsPermissionBannerOpen(false);

      if (mapped === 'granted') {
        // Welcome notification
        triggerAlert(
          'delivery',
          '🔔 Notificações Ativadas!',
          'Você receberá avisos sonoros e alertas sobre novos pedidos delivery e mesas pendentes.',
          '#/delivery'
        );
      }
      return mapped;
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      setPermission('denied');
      return 'denied';
    }
  };

  const testNotification = (type: 'delivery' | 'mesa' = 'delivery') => {
    initAudioOnUserGesture();
    if (type === 'delivery') {
      triggerAlert(
        'delivery',
        '🛵 Teste: Novo Pedido Delivery!',
        'Pedido #1024 - Roberto Maciel (2x Costela Defumada) - R$ 138,00',
        '#/delivery'
      );
    } else {
      triggerAlert(
        'mesa',
        '🍽️ Teste: Mesa 04 Pendente!',
        'Mesa 04 adicionou novos cortes de churrasco para preparo.',
        '#/mesas'
      );
    }
  };

  const dismissPermissionBanner = () => {
    setIsPermissionBannerOpen(false);
    try {
      sessionStorage.setItem(STORAGE_BANNER_DISMISSED_KEY, 'true');
    } catch {}
  };

  const openPermissionBanner = () => {
    setIsPermissionBannerOpen(true);
  };

  // Real-time Firestore monitoring for Delivery orders & Pending Tables
  useEffect(() => {
    // Only listen for orders from today onwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.toISOString();

    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startOfToday)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // On very first snapshot, index all existing orders to prevent old-order spam
        if (!initializedOrdersRef.current) {
          snapshot.forEach((docSnap) => {
            const id = docSnap.id;
            const data = docSnap.data();
            knownOrderIdsRef.current.add(id);
            if (data.type === 'mesa' && Array.isArray(data.items)) {
              knownMesaItemsCountRef.current.set(id, data.items.length);
            }
          });
          initializedOrdersRef.current = true;
          return;
        }

        // Process changes
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const order = change.doc.data();

          if (change.type === 'added') {
            if (!knownOrderIdsRef.current.has(docId)) {
              knownOrderIdsRef.current.add(docId);

              // 1. Delivery order notification
              if (order.type === 'delivery' && settings.notifyDelivery) {
                const customer = order.customerName || 'Cliente Online';
                const totalFormatted = order.total
                  ? `R$ ${Number(order.total).toFixed(2).replace('.', ',')}`
                  : '';
                const itemsCount = Array.isArray(order.items) ? `${order.items.length} itens` : '';

                triggerAlert(
                  'delivery',
                  '🛵 Novo Pedido Delivery!',
                  `${customer} - ${itemsCount} (${totalFormatted})`,
                  '#/delivery'
                );
              }

              // 2. New Table order opened
              if (order.type === 'mesa' && order.status === 'open' && settings.notifyMesas) {
                const tableNum = order.tableNumber ? `Mesa ${order.tableNumber}` : 'Nova Mesa';
                const totalFormatted = order.total
                  ? `R$ ${Number(order.total).toFixed(2).replace('.', ',')}`
                  : '';

                triggerAlert(
                  'mesa',
                  `🍽️ ${tableNum} Aberta!`,
                  `Mesa aberta aguardando atendimento. ${totalFormatted}`,
                  '#/mesas'
                );
              }
            }
          } else if (change.type === 'modified') {
            // Check if table received new items
            if (order.type === 'mesa' && order.status === 'open' && settings.notifyMesas) {
              const prevCount = knownMesaItemsCountRef.current.get(docId) || 0;
              const currentCount = Array.isArray(order.items) ? order.items.length : 0;

              if (currentCount > prevCount) {
                knownMesaItemsCountRef.current.set(docId, currentCount);
                const tableNum = order.tableNumber ? `Mesa ${order.tableNumber}` : 'Mesa';
                const diff = currentCount - prevCount;

                triggerAlert(
                  'mesa',
                  `🍽️ ${tableNum}: +${diff} Pedidos!`,
                  `Novos itens adicionados para produção/atendimento.`,
                  '#/mesas'
                );
              }
            }
          }
        });
      },
      (error) => {
        console.warn('Realtime order listener error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [settings.notifyDelivery, settings.notifyMesas, triggerAlert]);

  return (
    <NotificationContext.Provider
      value={{
        permission,
        isSupported,
        settings,
        updateSettings,
        requestPermission,
        testNotification,
        toasts,
        dismissToast,
        isPermissionBannerOpen,
        dismissPermissionBanner,
        openPermissionBanner,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
