import React from 'react';

const IconBase = ({ d, className = 'w-6 h-6', ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// Exportações
export const DashboardIcon = (props) => <IconBase d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" {...props} />;
export const InventoryIcon = (props) => <IconBase d="M20 13V5a2 2 0 00-2-2H6a2 2 0 00-2 2v8m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4" {...props} />;
export const SalesIcon = (props) => <IconBase d="M3 3v18h18M9 17l3-3 4 4M13 11h5v5" {...props} />;
export const CustomersIcon = (props) => <IconBase d="M17 20h5v-2a4 4 0 00-5-4M9 20H4v-2a4 4 0 015-4m3 6a4 4 0 000-8 4 4 0 000 8zm6-10a4 4 0 11-8 0 4 4 0 018 0z" {...props} />;
export const FinancialIcon = (props) => <IconBase d="M12 8c-2.5 0-4 1.5-4 3s1.5 3 4 3 4 1.5 4 3-1.5 3-4 3-4-1.5-4-3m4-12v2m0 16v2" {...props} />;
export const ChartBarIcon = (props) => <IconBase d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" {...props} />;
export const PlusIcon = (props) => <IconBase d="M12 4v16m8-8H4" {...props} />;
export const TrashIcon = (props) => <IconBase d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3" {...props} />;
export const EditIcon = (props) => <IconBase d="M11 5h7M5 12l4 4L19 6" {...props} />;
export const CloseIcon = (props) => <IconBase d="M6 18L18 6M6 6l12 12" {...props} />;
export const SearchIcon = (props) => <IconBase d="M21 21l-4.35-4.35M11 5a6 6 0 100 12 6 6 0 000-12z" {...props} />;
export const AlertTriangleIcon = (props) => <IconBase d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" {...props} />;
export const CheckCircleIcon = (props) => <IconBase d="M9 12l2 2 4-4m-3 9a9 9 0 110-18 9 9 0 010 18z" {...props} />;
export const HistoryIcon = (props) => <IconBase d="M12 8v4l3 3m6-3a9 9 0 11-9-9" {...props} />;
export const MessageSquareIcon = (props) => <IconBase d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" {...props} />;
export const PrintIcon = (props) => <IconBase d="M6 9V2h12v7M6 18v4h12v-4M6 14h12a2 2 0 002-2v-2H4v2a2 2 0 002 2z" {...props} />;
export const ArrowLeftIcon = (props) => <IconBase d="M15 19l-7-7 7-7" {...props} />;
export const ClipboardListIcon = (props) => <IconBase d="M9 5h6M9 9h6M9 13h6M5 7h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z" {...props} />;
export const DollarSignIcon = (props) => <IconBase d="M12 1v22M17 5H9.5a2.5 2.5 0 000 5h5a2.5 2.5 0 010 5H6" {...props} />;
export const SaveIcon = (props) => <IconBase d="M17 16l-4-4m0 0l-4 4m4-4v9M4 4h16v16H4z" {...props} />;
export const TargetIcon = (props) => <IconBase d="M12 19a7 7 0 100-14 7 7 0 000 14zM12 12V6M12 12l3 3" {...props} />;
export const ReceiptIcon = (props) => <IconBase d="M9 2H7a2 2 0 00-2 2v16l2-1 2 1 2-1 2 1 2-1 2 1V4a2 2 0 00-2-2h-2" {...props} />;
export const WalletIcon = (props) => <IconBase d="M3 7h18v10H3V7zm15 2a1 1 0 110 2 1 1 0 010-2z" {...props} />;
export const MoneyIcon = (props) => <IconBase d="M4 6h16v12H4zM8 10a2 2 0 104 0 2 2 0 00-4 0z" {...props} />;
export const ClockIcon = (props) => <IconBase d="M12 8v4l3 3m6-3a9 9 0 11-9-9" {...props} />;
export const CalendarIcon = (props) => <IconBase d="M8 7V3M16 7V3M4 11h16M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" {...props} />;
export const TrendingUpIcon = (props) => <IconBase d="M3 17l6-6 4 4 8-8" {...props} />;
export const XCircleIcon = (props) => <IconBase d="M10 10l4 4m0-4l-4 4m8-2a8 8 0 11-16 0 8 8 0 0116 0z" {...props} />;
export const SettingsIcon = (props) => (
  <IconBase {...props} d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm7.43-2.52a1 1 0 0 1 .23 1.09l-1.67 2.89a1 1 0 0 1-.88.5H15.5a7.47 7.47 0 0 1-.49 1.13l1.03 1.78a1 1 0 0 1-.37 1.37l-2.89 1.67a1 1 0 0 1-1.09-.23l-1.43-1.43a7.47 7.47 0 0 1-1.13.49v2.61a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.61a7.47 7.47 0 0 1-1.13-.49L5.44 22.3a1 1 0 0 1-1.37.37L1.67 21a1 1 0 0 1-.23-1.09l1.67-2.89a1 1 0 0 1 .88-.5h2.11a7.47 7.47 0 0 1 .49-1.13L5.56 13.6a1 1 0 0 1 .37-1.37l2.89-1.67a1 1 0 0 1 1.09.23l1.43 1.43a7.47 7.47 0 0 1 1.13-.49V9a1 1 0 0 1 1-1h2.11a1 1 0 0 1 1 1v2.61a7.47 7.47 0 0 1 1.13.49l1.43-1.43a1 1 0 0 1 1.37-.37l2.89 1.67z" />
);
