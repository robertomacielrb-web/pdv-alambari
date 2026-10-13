import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface FullscreenContextType {
  isFullscreen: boolean;
  isSupported: boolean;
  autoFullscreenEnabled: boolean;
  error: string | null;
  toggleFullscreen: () => Promise<boolean>;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  setAutoFullscreenEnabled: (enabled: boolean) => void;
  clearError: () => void;
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

export function FullscreenProvider({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoFullscreenEnabled, setAutoFullscreenState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pdv_auto_fullscreen') === 'true';
    } catch {
      return false;
    }
  });

  const checkIsFullscreen = useCallback((): boolean => {
    const doc = document as any;
    return !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }, []);

  // Sync state on fullscreen changes
  useEffect(() => {
    const updateStatus = () => {
      setIsFullscreen(checkIsFullscreen());
    };

    updateStatus();

    // Check support
    const doc = document as any;
    const el = document.documentElement as any;
    const supported = !!(
      doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled ||
      el.requestFullscreen ||
      el.webkitRequestFullscreen
    );
    setIsSupported(supported);

    document.addEventListener('fullscreenchange', updateStatus);
    document.addEventListener('webkitfullscreenchange', updateStatus);
    document.addEventListener('mozfullscreenchange', updateStatus);
    document.addEventListener('MSFullscreenChange', updateStatus);

    return () => {
      document.removeEventListener('fullscreenchange', updateStatus);
      document.removeEventListener('webkitfullscreenchange', updateStatus);
      document.removeEventListener('mozfullscreenchange', updateStatus);
      document.removeEventListener('MSFullscreenChange', updateStatus);
    };
  }, [checkIsFullscreen]);

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      } else {
        throw new Error('Seu navegador não oferece suporte nativo para tela cheia. Pressione F11.');
      }
      setIsFullscreen(true);
      return true;
    } catch (err: any) {
      console.warn('Erro ao entrar em tela cheia:', err);
      const msg = err?.message || 'Não foi possível ativar o modo tela cheia. Tente pressionar F11 no teclado.';
      setError(msg);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const doc = document as any;
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
      setIsFullscreen(false);
      return true;
    } catch (err: any) {
      console.warn('Erro ao sair da tela cheia:', err);
      return false;
    }
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (checkIsFullscreen()) {
      return await exitFullscreen();
    } else {
      return await enterFullscreen();
    }
  }, [checkIsFullscreen, enterFullscreen, exitFullscreen]);

  const setAutoFullscreenEnabled = useCallback((enabled: boolean) => {
    setAutoFullscreenState(enabled);
    try {
      localStorage.setItem('pdv_auto_fullscreen', enabled ? 'true' : 'false');
    } catch (err) {
      console.warn('Não foi possível salvar preferência de tela cheia no localStorage:', err);
    }
  }, []);

  // Auto fullscreen on first user interaction if enabled
  useEffect(() => {
    if (!autoFullscreenEnabled || checkIsFullscreen()) return;

    const handleFirstUserInteraction = () => {
      if (!checkIsFullscreen()) {
        enterFullscreen().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstUserInteraction, { once: true });
    window.addEventListener('keydown', handleFirstUserInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstUserInteraction);
      window.removeEventListener('keydown', handleFirstUserInteraction);
    };
  }, [autoFullscreenEnabled, checkIsFullscreen, enterFullscreen]);

  return (
    <FullscreenContext.Provider
      value={{
        isFullscreen,
        isSupported,
        autoFullscreenEnabled,
        error,
        toggleFullscreen,
        enterFullscreen,
        exitFullscreen,
        setAutoFullscreenEnabled,
        clearError: () => setError(null),
      }}
    >
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  const context = useContext(FullscreenContext);
  if (!context) {
    throw new Error('useFullscreen must be used within a FullscreenProvider');
  }
  return context;
}
