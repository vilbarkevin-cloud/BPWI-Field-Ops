import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-[384px] px-4 md:px-0">
        {toasts.map(toast => {
          const typeConfig = {
            success: { bg: 'bg-[#ECFDF5]', border: 'border-[#22C55E]', text: 'text-[#065F46]', icon: <CheckCircle className="w-5 h-5 text-[#22C55E]" /> },
            error: { bg: 'bg-[#FEF2F2]', border: 'border-[#EF4444]', text: 'text-[#7F1D1D]', icon: <XCircle className="w-5 h-5 text-[#EF4444]" /> },
            warning: { bg: 'bg-[#FFFBEB]', border: 'border-[#FCD34D]', text: 'text-[#78350F]', icon: <AlertTriangle className="w-5 h-5 text-[#FCD34D]" /> },
            info: { bg: 'bg-[#EFF6FF]', border: 'border-[#3B82F6]', text: 'text-[#0C2340]', icon: <Info className="w-5 h-5 text-[#3B82F6]" /> },
          };
          const config = typeConfig[toast.type];
          
          return (
            <div 
              key={toast.id} 
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-md shadow-lg border-l-4 ${config.bg} ${config.border} animate-in slide-in-from-bottom-5 fade-in duration-300`}
            >
              {config.icon}
              <div className={`flex-1 font-semibold text-sm ${config.text}`}>
                {toast.message}
              </div>
              <button onClick={() => removeToast(toast.id)} className={`flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity ${config.text}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
