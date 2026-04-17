import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { getToken } from './services/api';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import DriversPage from './pages/DriversPage';
import InventoryPage from './pages/InventoryPage';
import CreditsPage from './pages/CreditsPage';
import QBOPage from './pages/QBOPage';
import InvoicesPage from './pages/InvoicesPage';
import RoutesPage from './pages/RoutesPage';
import AutoDispatchPage from './pages/AutoDispatchPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="dispatch" element={<AutoDispatchPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="quickbooks" element={<QBOPage />} />
            <Route path="settings" element={<div className="p-6"><h1 className="page-title">Settings</h1><p className="text-muted text-sm mt-2">Coming in Sprint 3</p></div>} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
