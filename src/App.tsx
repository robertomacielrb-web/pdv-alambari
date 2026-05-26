import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Caixa from './pages/Caixa';
import Balcao from './pages/Balcao';
import Mesas from './pages/Mesas';
import Fiados from './pages/Fiados';
import Delivery from './pages/Delivery';
import Producao from './pages/Producao';
import Produtos from './pages/Produtos';
import Historico from './pages/Historico';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import Cardapio from './pages/Cardapio';
import ContasPagar from './pages/ContasPagar';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/cardapio" element={<Cardapio />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Caixa />} />
        <Route path="balcao" element={<Balcao />} />
        <Route path="mesas" element={<Mesas />} />
        <Route path="fiados" element={<Fiados />} />
        <Route path="delivery" element={<Delivery />} />
        <Route path="producao" element={<Producao />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="historico" element={<Historico />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="contas-pagar" element={<ContasPagar />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
