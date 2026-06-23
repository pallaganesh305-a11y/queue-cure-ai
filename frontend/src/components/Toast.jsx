import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { FiInfo, FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiX } from 'react-icons/fi';

const Toast = () => {
  const { notifications } = useSocket();
  const [activeToasts, setActiveToasts] = useState([]);

  useEffect(() => {
    if (notifications.length === 0) return;
    
    // Get the most recent notification
    const latest = notifications[0];
    
    // Check if we already have this toast displayed
    const exists = activeToasts.some(t => t.id === latest.id);
    if (!exists) {
      const newToast = {
        ...latest,
        expiry: Date.now() + 4000
      };
      
      setActiveToasts(prev => [newToast, ...prev].slice(0, 3)); // Max 3 toasts at a time
      
      // Auto-remove after 4 seconds
      setTimeout(() => {
        setActiveToasts(prev => prev.filter(t => t.id !== latest.id));
      }, 4000);
    }
  }, [notifications, activeToasts]);

  const removeToast = (id) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning':
        return <FiAlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'emergency':
        return <FiAlertCircle className="w-5 h-5 text-rose-500 glowing-pulse" />;
      default:
        return <FiInfo className="w-5 h-5 text-brand-500" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/90 dark:bg-emerald-950/20';
      case 'warning':
        return 'border-amber-100 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/20';
      case 'emergency':
        return 'border-rose-100 dark:border-rose-900/40 bg-rose-50/95 dark:bg-rose-950/20';
      default:
        return 'border-brand-100 dark:border-brand-900/40 bg-brand-50/90 dark:bg-brand-950/20';
    }
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {activeToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border glass shadow-lg ${getBorderColor(
              toast.type
            )}`}
          >
            <div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-grow">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
