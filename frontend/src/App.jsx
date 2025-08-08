// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';

import {
  DashboardIcon, InventoryIcon, SalesIcon, CustomersIcon,
  FinancialIcon, ChartBarIcon, SettingsIcon,
  MenuIcon, ChevronRightIcon,
} from './components/icons';

import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import SalesPage from './pages/SalesPage';
import ReceiptPage from './pages/ReceiptPage';
import DashboardPage from './pages/DashboardPage';
import FinancialPage from './pages/FinancialPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

import { api } from './api/api';

const initialView = { page: 'dashboard' };

const App = () => {
  const [currentView, setCurrentView] = useState(initialView);
  const [companySettings, setCompanySettings] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return JSON.parse(localStorage.getItem('sidebarCollapsed')) || false;
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
      return next;
    });
  };

  const handleNavigate = (view) => setCurrentView(view);
  const handleSimpleNavigate = (page) => setCurrentView({ page });

  // Carrega as configurações da empresa no carregamento da aplicação
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getCompanyInfo();
        setCompanySettings(settings);
      } catch (err) {
        console.warn('Erro ao carregar configurações:', err);
      }
    };
    loadSettings();
  }, []);

  // Aplica tema e tamanho da fonte baseado nas configurações da empresa
  useEffect(() => {
    if (!companySettings) return;

    const root = document.documentElement;
    root.classList.remove('theme-petroleo', 'theme-roxo', 'theme-laranja');
    root.classList.remove('font-size-sm', 'font-size-base', 'font-size-lg');

    const fontMap = { '1': 'sm', '2': 'base', '3': 'lg' };
    const fontClass = fontMap[companySettings.fontSize || '2'];
    root.classList.add(`font-size-${fontClass}`);
    root.classList.add(`theme-${companySettings.themeColor || 'petroleo'}`);
  }, [companySettings]);

  const renderContent = () => {
    switch (currentView.page) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={handleNavigate}
            onNavigateToReceipt={(id) => handleNavigate({ page: 'receipt', transactionId: id })}
          />
        );
      case 'inventory':
        return <InventoryPage filters={currentView.filters} />;
      case 'sales':
        return <SalesPage onNavigateToReceipt={(id) => handleNavigate({ page: 'receipt', transactionId: id })} />;
      case 'customers':
        return <CustomersPage />;
      case 'financial':
        return <FinancialPage initialTab={currentView.tab} />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'receipt':
        return <ReceiptPage transactionId={currentView.transactionId} onBack={() => handleNavigate({ page: 'sales' })} />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-base-100 font-sans">
      <Sidebar
        collapsed={isCollapsed}
        onToggle={toggleSidebar}
        currentPage={currentView.page}
        onNavigate={handleSimpleNavigate}
      />
      <main className="flex-1 p-8 overflow-y-auto">{renderContent()}</main>
    </div>
  );
};

export default App;
