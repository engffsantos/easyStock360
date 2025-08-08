// frontend/src/components/Sidebar.jsx
import React from 'react';
import {
  DashboardIcon, InventoryIcon, SalesIcon, CustomersIcon,
  FinancialIcon, ChartBarIcon, SettingsIcon,
  MenuIcon, ChevronRightIcon,
} from './icons';

const NavItem = ({ icon, label, collapsed, isActive, onClick }) => (
  <li className="mb-2">
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex items-center p-3 rounded-lg transition-colors
        ${isActive
          ? 'bg-[rgb(var(--color-primary-600))] text-white shadow-md'
          : 'text-[rgb(var(--color-primary-100))] hover:bg-[rgb(var(--color-primary-700))] hover:text-white'}`}
    >
      {icon}
      {!collapsed && <span className="ml-4 font-semibold">{label}</span>}
    </a>
  </li>
);

const Sidebar = ({ collapsed, onToggle, currentPage, onNavigate }) => {
  const widthClass = collapsed ? 'w-20' : 'w-64';

  return (
    <aside
      className={`${widthClass} p-4 flex flex-col flex-shrink-0 transition-all duration-300 no-print`}
      style={{ backgroundColor: 'rgb(var(--color-primary-900))', color: 'white' }}
    >
      {/* Cabeçalho */}
      <div className={`flex items-center justify-between ${collapsed ? 'px-0' : 'px-2'} mb-6`}>
        {!collapsed && <span className="logo text-2xl font-bold m-2">EasyStock360</span> }

        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          className="text-[rgb(var(--color-primary-200))] hover:text-white"
        >
          {collapsed
            ? <MenuIcon className="w-4 h-4" />
            : <ChevronRightIcon className="transform rotate-180 w-4 h-4" />}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto">
        <ul>
          <NavItem icon={<DashboardIcon />} label="Dashboard" collapsed={collapsed} isActive={currentPage === 'dashboard'} onClick={() => onNavigate('dashboard')} />
          <NavItem icon={<InventoryIcon />} label="Estoque" collapsed={collapsed} isActive={currentPage === 'inventory'} onClick={() => onNavigate('inventory')} />
          <NavItem icon={<SalesIcon />} label="Vendas" collapsed={collapsed} isActive={currentPage === 'sales'} onClick={() => onNavigate('sales')} />
          <NavItem icon={<CustomersIcon />} label="Clientes" collapsed={collapsed} isActive={currentPage === 'customers'} onClick={() => onNavigate('customers')} />
          <NavItem icon={<FinancialIcon />} label="Financeiro" collapsed={collapsed} isActive={currentPage === 'financial'} onClick={() => onNavigate('financial')} />
          <NavItem icon={<ChartBarIcon />} label="Relatórios" collapsed={collapsed} isActive={currentPage === 'reports'} onClick={() => onNavigate('reports')} />
        </ul>
      </nav>

      {/* Rodapé */}
      <div className="mt-auto pt-4" style={{ color: 'rgb(var(--color-primary-200))' }}>
        <div className="my-4 border-t" style={{ borderColor: 'rgb(var(--color-primary-800))' }}></div>
        <ul>
          <NavItem icon={<SettingsIcon />} label="Configurações" collapsed={collapsed} isActive={currentPage === 'settings'} onClick={() => onNavigate('settings')} />
        </ul>
        <div className={`${collapsed ? 'text-[10px]' : 'text-xs'} text-center pt-4`}>
          {!collapsed && <p>&copy; 2024 Easydata360</p>}
          <p>V1.0-08-2025</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
