import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Caixa from './pages/Caixa';
import Balcao from './pages/Balcao';
import Mesas from './pages/Mesas';
import Fiados from './pages/Fiados';
import Producao from './pages/Producao';
import Produtos from './pages/Produtos';
import Historico from './pages/Historico';
import Relatorios from './pages/Relatorios';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Caixa />} />
        <Route path="balcao" element={<Balcao />} />
        <Route path="mesas" element={<Mesas />} />
        <Route path="fiados" element={<Fiados />} />
        <Route path="producao" element={<Producao />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="historico" element={<Historico />} />
        <Route path="relatorios" element={<Relatorios />} />
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
