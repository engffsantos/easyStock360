import React from 'react';

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white shadow-sm rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition';
  const variants = {
    primary: 'bg-primary-700 text-white hover:bg-primary-800',
    secondary: 'bg-base-100 text-base-400 border border-base-300 hover:bg-base-50',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      <span className="inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
};

export const Input = ({ id, label, ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label htmlFor={id} className="text-sm text-base-300">{label}</label>}
    <input id={id} className="px-3 py-2 border border-base-200 rounded-xl text-sm focus:outline-primary-700" {...props} />
  </div>
);

export const ModalWrapper = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-base-400">{title}</h2>
          <button onClick={onClose} className="text-base-300 hover:text-base-400 text-2xl font-bold leading-none">&times;</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export const Spinner = () => (
  <svg className="animate-spin h-6 w-6 text-primary-700" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

export const ProgressBar = ({ value, max }) => {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-base-200 rounded-full h-4">
      <div className="bg-primary-700 h-4 rounded-full transition-all" style={{ width: `${percent}%` }}></div>
    </div>
  );
};

export const Select = ({ id, label, options = [], ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label htmlFor={id} className="text-sm text-base-300">{label}</label>}
    <select id={id} className="px-3 py-2 border border-base-200 rounded-xl text-sm focus:outline-primary-700" {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
);