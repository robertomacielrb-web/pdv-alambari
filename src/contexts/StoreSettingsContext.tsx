import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface StoreSettingsData {
  storeName?: string;
  logoUrl?: string;
  whatsappNumber?: string;
  pixKey?: string;
  updatedAt?: string;
}

interface StoreSettingsContextValue {
  logoUrl: string;
  isCustomLogo: boolean;
  storeName: string;
  whatsappNumber: string;
  pixKey: string;
  loading: boolean;
  updateLogo: (newLogo: string) => Promise<{ success: boolean; error?: string }>;
  resetLogo: () => Promise<{ success: boolean; error?: string }>;
  updateSettings: (newSettings: Partial<StoreSettingsData>) => Promise<{ success: boolean; error?: string }>;
}

export const DEFAULT_STORE_NAME = 'Alambari Defumados';
export const DEFAULT_LOGO_URL = '/logo.png';
const LOCAL_LOGO_CACHE_KEY = 'alambari_cached_logo_url';

const StoreSettingsContext = createContext<StoreSettingsContextValue | undefined>(undefined);

export const StoreSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettingsData>(() => {
    let cachedLogo = '';
    try {
      cachedLogo = localStorage.getItem(LOCAL_LOGO_CACHE_KEY) || '';
    } catch {
      // ignore
    }
    return {
      storeName: DEFAULT_STORE_NAME,
      logoUrl: cachedLogo || DEFAULT_LOGO_URL,
      whatsappNumber: '',
      pixKey: '',
    };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'store');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as StoreSettingsData;
          const resolvedLogo = data.logoUrl?.trim() || DEFAULT_LOGO_URL;
          setSettings({
            storeName: data.storeName || DEFAULT_STORE_NAME,
            logoUrl: resolvedLogo,
            whatsappNumber: data.whatsappNumber || '',
            pixKey: data.pixKey || '',
            updatedAt: data.updatedAt,
          });
          try {
            if (data.logoUrl?.trim()) {
              localStorage.setItem(LOCAL_LOGO_CACHE_KEY, data.logoUrl.trim());
            } else {
              localStorage.removeItem(LOCAL_LOGO_CACHE_KEY);
            }
          } catch {
            // ignore
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to store settings:', error);
        handleFirestoreError(error, OperationType.GET, 'settings/store');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateLogo = useCallback(
    async (newLogo: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const docRef = doc(db, 'settings', 'store');
        const trimmed = newLogo.trim();
        await setDoc(
          docRef,
          {
            logoUrl: trimmed,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        setSettings((prev) => ({
          ...prev,
          logoUrl: trimmed || DEFAULT_LOGO_URL,
        }));

        try {
          if (trimmed) {
            localStorage.setItem(LOCAL_LOGO_CACHE_KEY, trimmed);
          } else {
            localStorage.removeItem(LOCAL_LOGO_CACHE_KEY);
          }
        } catch {
          // ignore
        }

        return { success: true };
      } catch (error: any) {
        console.error('Error updating store logo:', error);
        handleFirestoreError(error, OperationType.WRITE, 'settings/store');
        return { success: false, error: error.message || 'Erro ao salvar a logo' };
      }
    },
    []
  );

  const resetLogo = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const docRef = doc(db, 'settings', 'store');
      await setDoc(
        docRef,
        {
          logoUrl: '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setSettings((prev) => ({
        ...prev,
        logoUrl: DEFAULT_LOGO_URL,
      }));

      try {
        localStorage.removeItem(LOCAL_LOGO_CACHE_KEY);
      } catch {
        // ignore
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error resetting store logo:', error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/store');
      return { success: false, error: error.message || 'Erro ao restaurar a logo' };
    }
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<StoreSettingsData>): Promise<{ success: boolean; error?: string }> => {
      try {
        const docRef = doc(db, 'settings', 'store');
        const payload = {
          ...newSettings,
          updatedAt: new Date().toISOString(),
        };
        await setDoc(docRef, payload, { merge: true });
        setSettings((prev) => ({ ...prev, ...newSettings }));
        return { success: true };
      } catch (error: any) {
        console.error('Error updating store settings:', error);
        handleFirestoreError(error, OperationType.WRITE, 'settings/store');
        return { success: false, error: error.message || 'Erro ao salvar configurações' };
      }
    },
    []
  );

  const effectiveLogoUrl = settings.logoUrl && settings.logoUrl !== '' ? settings.logoUrl : DEFAULT_LOGO_URL;
  const isCustomLogo = effectiveLogoUrl !== DEFAULT_LOGO_URL;

  return (
    <StoreSettingsContext.Provider
      value={{
        logoUrl: effectiveLogoUrl,
        isCustomLogo,
        storeName: settings.storeName || DEFAULT_STORE_NAME,
        whatsappNumber: settings.whatsappNumber || '',
        pixKey: settings.pixKey || '',
        loading,
        updateLogo,
        resetLogo,
        updateSettings,
      }}
    >
      {children}
    </StoreSettingsContext.Provider>
  );
};

export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    throw new Error('useStoreSettings must be used within a StoreSettingsProvider');
  }
  return context;
}
