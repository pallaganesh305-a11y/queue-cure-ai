import React from 'react';

const StatCard = ({ title, value, icon: Icon, description, color = 'brand', loading = false, pulse = false }) => {
  const getColorClasses = (col) => {
    switch (col) {
      case 'emerald':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30';
      case 'rose':
        return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/30';
      case 'amber':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30';
      default:
        return 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 border-brand-100 dark:border-brand-900/30';
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="h-4 w-28 skeleton-shimmer rounded"></div>
          <div className="w-10 h-10 rounded-xl skeleton-shimmer"></div>
        </div>
        <div className="h-8 w-16 skeleton-shimmer rounded mt-2"></div>
        <div className="h-3 w-36 skeleton-shimmer rounded mt-1"></div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-slate-350 dark:hover:border-slate-700 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${pulse ? 'glowing-emerald-pulse border-emerald-500/50' : ''}`}>
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-transparent dark:from-slate-850 dark:to-transparent opacity-40 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>

      <div className="flex justify-between items-start relative z-10">
        <div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-wide uppercase">
            {title}
          </span>
          <h3 className="text-3xl font-bold text-slate-850 dark:text-white mt-2 font-sans tracking-tight">
            {value}
          </h3>
        </div>
        <div className={`p-2.5 rounded-xl border flex items-center justify-center ${getColorClasses(color)}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 mt-4 relative z-10 flex items-center gap-1.5 font-medium">
        <span>{description}</span>
      </div>
    </div>
  );
};

export default StatCard;
