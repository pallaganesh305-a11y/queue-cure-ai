import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import ThemeToggle from './ThemeToggle';
import axios from 'axios';
import { 
  FiActivity, FiTv, FiLayout, FiBell, FiCheck, 
  FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiChevronDown 
} from 'react-icons/fi';

const Navbar = () => {
  const { isConnected, stats, notifications, refreshData } = useSocket();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.put('/api/settings', { doctor_status: newStatus });
      refreshData();
      setShowStatusDropdown(false);
    } catch (err) {
      console.error('Failed to change doctor status:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post('/api/notifications/read');
      refreshData();
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'away': return 'bg-amber-500';
      case 'on_break': return 'bg-amber-500';
      default: return 'bg-rose-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'away': return 'Away';
      case 'on_break': return 'On Break';
      default: return 'Offline';
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />;
      case 'warning':
        return <FiAlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />;
      case 'emergency':
        return <FiAlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0 glowing-pulse" />;
      default:
        return <FiActivity className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />;
    }
  };

  return (
    <nav className="sticky top-0 z-30 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <FiActivity className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg font-sans tracking-tight text-slate-850 dark:text-white">
                Queue Cure <span className="text-brand-500">AI</span>
              </span>
            </NavLink>

            {/* Navigation links */}
            <div className="hidden md:flex items-center gap-1.5">
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => 
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                    isActive 
                      ? 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`
                }
              >
                <FiLayout className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
              
              <NavLink 
                to="/patient-screen" 
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <FiTv className="w-4 h-4" />
                <span>TV Monitor</span>
              </NavLink>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-3">
            
            {/* Socket Status indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-xxs font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
              <span className={isConnected ? 'text-slate-600 dark:text-slate-455' : 'text-rose-550 dark:text-rose-455'}>
                {isConnected ? 'Sync' : 'Offline'}
              </span>
            </div>

            {/* Doctor Status Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowStatusDropdown(!showStatusDropdown);
                  setShowNotifDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-655 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full ${getStatusColor(stats.doctor_status)}`}></span>
                <span>Doctor: {getStatusText(stats.doctor_status)}</span>
                <FiChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Status Selector Dropdown */}
              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)}></div>
                  <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {['active', 'away', 'on_break', 'offline'].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                          stats.doctor_status === status ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></span>
                        <span>{getStatusText(status)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Notifications Feed Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown);
                  setShowStatusDropdown(false);
                }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-605 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
              >
                <FiBell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification feed panel */}
              {showNotifDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)}></div>
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 flex flex-col max-h-[400px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Recent Alerts</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] font-bold text-brand-655 dark:text-brand-405 flex items-center gap-1 hover:underline"
                        >
                          <FiCheck className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-grow divide-y divide-slate-100 dark:divide-slate-850">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          No recent logs recorded.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            className={`p-3.5 flex gap-2.5 text-xs transition-colors ${
                              !notif.is_read ? 'bg-brand-500/5 dark:bg-brand-500/10' : ''
                            }`}
                          >
                            {getNotifIcon(notif.type)}
                            <div className="flex-grow flex flex-col gap-0.5">
                              <p className="font-semibold text-slate-700 dark:text-slate-300 leading-normal">
                                {notif.message}
                              </p>
                              <span className="text-[9px] text-slate-400 font-medium">
                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dark mode switcher */}
            <ThemeToggle />

          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
