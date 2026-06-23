import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
      aria-label="Toggle Dark Mode"
    >
      {theme === 'light' ? (
        <FiMoon className="w-5 h-5 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <FiSun className="w-5 h-5 transition-transform duration-300 hover:rotate-90" />
      )}
    </button>
  );
};

export default ThemeToggle;
