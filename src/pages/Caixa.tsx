import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Lock, Unlock, DollarSign } from 'lucide-react';

interface CashierSession {
  id: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  initialBalance: number;
  finalBalance?: number;
  totalSales: number;
}

export default function Caixa() {
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialBalanceInput, setInitialBalanceInput] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'cashierSessions'), where('status', '==', 'open'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setCurrentSession({ id: doc.id, ...doc.data() } as CashierSession);
        } else {
          setCurrentSession(null);
        }
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashierSessions')
    );
    return () => unsubscribe();
  }, []);

  const handleOpenCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialBalance = parseFloat(initialBalanceInput.replace(',', '.'));
    if (isNaN(initialBalance) || initialBalance < 0) {
      alert('Valor inicial inválido');
      return;
    }

    try {
      await addDoc(collection(db, 'cashierSessions'), {
        status: 'open',
        openedAt: new Date().toISOString(),
        initialBalance,
        totalSales: 0
      });
      setInitialBalanceInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cashierSessions');
    }
  };

  const handleCloseCashier = async () => {
    if (!currentSession) return;
    
    if (window.confirm('Tem certeza que deseja fechar o caixa?')) {
      try {
        // Calculate total sales from closed orders during this session
        const q = query(
          collection(db, 'orders'), 
          where('status', '==', 'closed'),
          where('cashierId', '==', currentSession.id)
        );
        const snapshot = await getDocs(q);
        let totalSales = 0;
        snapshot.forEach(doc => {
          totalSales += doc.data().total;
        });

        const finalBalance = currentSession.initialBalance + totalSales;

        await updateDoc(doc(db, 'cashierSessions', currentSession.id), {
          status: 'closed',
          closedAt: new Date().toISOString(),
          totalSales,
          finalBalance
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `cashierSessions/${currentSession.id}`);
      }
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Controle de Caixa</h1>

      {currentSession ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6 border-b pb-4">
            <div className="flex items-center text-green-600">
              <Unlock className="w-8 h-8 mr-3" />
              <div>
                <h2 className="text-xl font-bold">Caixa Aberto</h2>
                <p className="text-sm text-gray-500">
                  Aberto em: {new Date(currentSession.openedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseCashier}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
            >
              <Lock className="w-5 h-5 mr-2" />
              Fechar Caixa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Saldo Inicial</p>
              <p className="text-2xl font-bold text-gray-800">
                R$ {currentSession.initialBalance.toFixed(2).replace('.', ',')}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-600 mb-1">Vendas Registradas (Estimativa)</p>
              <p className="text-2xl font-bold text-red-800">
                R$ {currentSession.totalSales.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Lock className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Caixa Fechado</h2>
            <p className="text-gray-500 text-sm mt-1">Abra o caixa para iniciar as vendas</p>
          </div>

          <form onSubmit={handleOpenCashier}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Saldo Inicial (Troco)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={initialBalanceInput}
                  onChange={(e) => setInitialBalanceInput(e.target.value)}
                  placeholder="0,00"
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center justify-center"
            >
              <Unlock className="w-5 h-5 mr-2" />
              Abrir Caixa
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
