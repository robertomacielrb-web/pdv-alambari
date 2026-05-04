import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Store } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isIframe, setIsIframe] = React.useState(false);

  React.useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-red-600 p-3 rounded-full">
            <Store className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          PDV Simples
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Faça login para acessar o sistema
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {isIframe && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              <p className="font-bold mb-1">Aviso:</p>
              O login com Google pode não funcionar dentro do visualizador. 
              Se o botão não responder, tente <strong>abrir o app em uma nova aba</strong>.
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
          </button>
        </div>
      </div>
    </div>
  );
}
