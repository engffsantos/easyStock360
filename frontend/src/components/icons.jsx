import React from 'react';

// Ícone base reutilizável
const IconBase = ({
  className = 'w-6 h-6',
  d,
  title,
  fillRule,
  clipRule,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d={d} fillRule={fillRule} clipRule={clipRule} />
  </svg>
);

// Ícones
export const DashboardIcon = (props) => (
  <IconBase {...props} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
);

export const InventoryIcon = (props) => (
  <IconBase {...props} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
);

export const SalesIcon = (props) => (
  <IconBase {...props} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
);

export const CustomersIcon = (props) => (
  <IconBase {...props} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
);

export const FinancialIcon = (props) => (
  <IconBase {...props} d="M12 20V10M18 20V4M6 20V16" />
);

export const ChartBarIcon = (props) => (
  <IconBase {...props} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h10" />
);

export const PlusIcon = (props) => (
  <IconBase {...props} d="M12 4v16m8-8H4" style={{ display: 'inline-block' }}/>
);

export const TrashIcon = (props) => (
  <IconBase {...props} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
);

export const EditIcon = (props) => (
  <IconBase {...props} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
);

export const CloseIcon = (props) => (
  <IconBase {...props} d="M6 18L18 6M6 6l12 12" />
);

export const SearchIcon = (props) => (
  <IconBase {...props} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
);

export const AlertTriangleIcon = (props) => (
  <IconBase {...props} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
);

export const CheckCircleIcon = (props) => (
  <IconBase {...props} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
);

export const HistoryIcon = (props) => (
  <IconBase {...props} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
);

export const MessageSquareIcon = (props) => (
    <IconBase {...props} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
);

export const PrintIcon = (props) => (
  <IconBase {...props} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H7a2 2 0 00-2 2v4a2 2 0 002 2h2m3-4H8m0 0V9h8v4m-4 5v3m-4-11H7a2 2 0 00-2 2v4a2 2 0 002 2h10a2 2 0 002-2v-4" />
);

export const ArrowLeftIcon = (props) => (
  <IconBase {...props} d="M15 18l-6-6 6-6" />
);

export const ClipboardListIcon = (props) => (
  <IconBase
    {...props}
    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0M9 12h6M9 16h6M9 8h.01"
  />
);

export const DollarSignIcon = (props) => (
  <IconBase {...props} d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
);

export const SaveIcon = (props) => (
  <IconBase {...props} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM7 3v4h10V3M7 11h2v4H7m4 0h2v-4h-2m4 0h2v-4h-2" />
);

export const TargetIcon = (props) => (
  <IconBase {...props} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
);

export const SettingsIcon = (props) => (
  <IconBase {...props} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
);

export const ReceiptIcon = (props) => (
  <IconBase {...props} d="M9 2H7a2 2 0 00-2 2v16l2-1 2 1 2-1 2 1 2-1 2 1V4a2 2 0 00-2-2h-2" />
);
export const WalletIcon = (props) => (
  <IconBase {...props} d="M3 7h18v10H3V7zm15 2a1 1 0 110 2 1 1 0 010-2z" />
);
export const MoneyIcon = (props) => (
  <IconBase {...props} d="M4 6h16v12H4zM8 10a2 2 0 104 0 2 2 0 00-4 0z" />
);
export const ClockIcon = (props) => (
  <IconBase {...props} d="M12 8v4l3 3m6-3a9 9 0 11-9-9" />
);
export const CalendarIcon = (props) => (
  <IconBase {...props} d="M8 7V3M16 7V3M4 11h16M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
);
export const TrendingUpIcon = (props) => (
  <IconBase {...props} d="M3 17l6-6 4 4 8-8" />
);
export const XCircleIcon = (props) => (
  <IconBase {...props} d="M10 10l4 4m0-4l-4 4m8-2a8 8 0 11-16 0 8 8 0 0116 0z" />
);
export const DownloadIcon = (props) => (
  <IconBase {...props} d="M4 16v-4h4V8h8v4h4v4m-8-4v4m-8-4h16" />
);

export const MenuIcon = (props) => (
  <IconBase {...props} d="M4 6h16M4 12h16M4 18h16" />
);

export const ChevronRightIcon = (props) => (
  <IconBase {...props} d="M9 5l7 7-7 7" />
);
