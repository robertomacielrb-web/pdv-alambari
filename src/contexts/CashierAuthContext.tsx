import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface CashierAuthConfig {
  username: string;
  password: string;
  requireAuth: boolean;
  updatedAt?: string;
}

interface CashierAuthContextValue {
  isAuthenticated: boolean;
  requireAuth: boolean;
  config: CashierAuthConfig;
  loading: boolean;
  login: (user: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateConfig: (newConfig: Partial<CashierAuthConfig>) => Promise<{ success: boolean; error?: string }>;
}

const DEFAULT_CONFIG: CashierAuthConfig = {
  username: 'caixa',
  password: '1234',
  requireAuth: true,
};

const SESSION_STORAGE_KEY = 'alambari_cashier_authenticated';

const CashierAuthContext = createContext<CashierAuthContextValue | undefined>(undefined);

export const CashierAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<CashierAuthConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Listen to cashier authentication configuration in Firestore
  useEffect(() => {
    const docRef = doc(db, 'settings', 'cashier_auth');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<CashierAuthConfig>;
          setConfig({
            username: data.username?.trim() || DEFAULT_CONFIG.username,
            password: data.password || DEFAULT_CONFIG.password,
            requireAuth: data.requireAuth !== undefined ? data.requireAuth : DEFAULT_CONFIG.requireAuth,
            updatedAt: data.updatedAt,
          });
        } else {
          // If document doesn't exist yet, we write the default document so it's transparent
          setDoc(
            docRef,
            {
              ...DEFAULT_CONFIG,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch((err) => {
            console.warn('Could not initialize cashier_auth document:', err);
          });
          setConfig(DEFAULT_CONFIG);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading cashier auth settings:', error);
        handleFirestoreError(error, OperationType.GET, 'settings/cashier_auth');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const login = useCallback(
    async (user: string, pass: string): Promise<{ success: boolean; error?: string }> => {
      const normalizedInputUser = user.trim().toLowerCase();
      const targetUser = (config.username || DEFAULT_CONFIG.username).trim().toLowerCase();
      const targetPass = config.password || DEFAULT_CONFIG.password;

      if (!normalizedInputUser || !pass) {
        return { success: false, error: 'Preencha o usuário e a senha.' };
      }

      if (normalizedInputUser === targetUser && pass === targetPass) {
        setIsAuthenticated(true);
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
        } catch {
          // sessionStorage might be restricted in some environments
        }
        return { success: true };
      } else {
        return { success: false, error: 'Usuário ou senha incorretos.' };
      }
    },
    [config]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const updateConfig = useCallback(
    async (newConfig: Partial<CashierAuthConfig>): Promise<{ success: boolean; error?: string }> => {
      try {
        const docRef = doc(db, 'settings', 'cashier_auth');
        const updatedPayload = {
          ...config,
          ...newConfig,
          updatedAt: new Date().toISOString(),
        };

        await setDoc(docRef, updatedPayload, { merge: true });
        setConfig(updatedPayload);
        return { success: true };
      } catch (error: any) {
        console.error('Error updating cashier auth config:', error);
        handleFirestoreError(error, OperationType.WRITE, 'settings/cashier_auth');
        return { success: false, error: error.message || 'Erro ao salvar credenciais' };
      }
    },
    [config]
  );

  // If requireAuth is false, automatically treat as authenticated
  const effectiveIsAuthenticated = !config.requireAuth || isAuthenticated;

  return (
    <CashierAuthContext.Provider
      value={{
        isAuthenticated: effectiveIsAuthenticated,
        requireAuth: config.requireAuth,
        config,
        loading,
        login,
        logout,
        updateConfig,
      }}
    >
      {children}
    </CashierAuthContext.Provider>
  );
};

export function useCashierAuth() {
  const context = useContext(CashierAuthContext);
  if (!context) {
    throw new Error('useCashierAuth must be used within a CashierAuthProvider');
  }
  return context;
}
