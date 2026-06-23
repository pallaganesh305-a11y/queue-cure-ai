import React, { useState } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { 
  FiSearch, FiChevronDown, FiUserCheck, FiPhone,
  FiPlay, FiCheck, FiSkipForward, FiTrash2, FiEdit2, FiRotateCcw, FiRefreshCw, FiSmartphone
} from 'react-icons/fi';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

const QueueTable = ({ onEdit }) => {
  const { queue, stats, refreshData, addLocalNotification } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy] = useState('joined'); // 'joined', 'priority', 'token'
  const [activeQrItem, setActiveQrItem] = useState(null);

  // Mutators
  const triggerAction = async (method, url, body = {}) => {
    try {
      if (method === 'post') {
        await axios.post(url, body);
      } else if (method === 'delete') {
        await axios.delete(url);
      }
      refreshData();
    } catch (err) {
      if (url === '/api/queue/undo' && err.response && err.response.status === 400) {
        addLocalNotification("Nothing to undo", "warning");
      } else {
        console.error(`Failed action on ${url}:`, err);
      }
    }
  };

  const handleCallPatient = async (patient) => {
    // Complete current first
    const activeConsulting = queue.find(q => q.status === 'consulting');
    if (activeConsulting) {
      await axios.post(`/api/queue/complete/${activeConsulting.id}`);
    }
    // Set this patient as consulting
    await axios.put(`/api/queue/${patient.id}`, {
      status: 'consulting',
      called_at: new Date().toISOString()
    });
    // Trigger socket call alert through backend call-next or a custom mechanism
    // In our backend app.py, a direct PUT updates the DB and broadcasts update, but doesn't speak.
    // Let's call the next patient or trigger updates
    refreshData();
  };

  // Format wait estimate
  const formatWait = (wait) => {
    if (wait === 0) return 'Immediate';
    if (wait === -1) return 'On Hold';
    return `${wait} mins`;
  };

  // Badges styling
  const getPriorityBadge = (prio) => {
    switch (prio) {
      case 'emergency':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-105/90 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450 border border-rose-200 dark:border-rose-900/40 glowing-pulse">Emergency</span>;
      case 'high':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 border border-amber-250/30 dark:border-amber-900/30">High</span>;
      case 'medium':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-450 border border-blue-200/40 dark:border-blue-900/30">Medium</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Low</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'consulting':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-200/40 dark:border-emerald-900/35"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>In Room</span>;
      case 'skipped':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-205 dark:border-slate-700/60">Skipped</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100/90 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400 border border-yellow-205/30 dark:border-yellow-900/30">Waiting</span>;
    }
  };

  // Filter & Search Logic
  const filteredQueue = queue.filter(item => {
    const nameMatch = item.patient.name.toLowerCase().includes(searchTerm.toLowerCase());
    const tokenMatch = item.token.toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = item.patient.phone && item.patient.phone.includes(searchTerm);
    const searchMatch = nameMatch || tokenMatch || phoneMatch;

    const statusMatch = statusFilter === 'all' || item.status === statusFilter;
    const priorityMatch = priorityFilter === 'all' || item.priority === priorityFilter;

    return searchMatch && statusMatch && priorityMatch;
  });

  // Sorting
  const sortedQueue = [...filteredQueue].sort((a, b) => {
    if (sortBy === 'token') {
      return a.token.localeCompare(b.token);
    }
    if (sortBy === 'priority') {
      const prioWeight = { emergency: 4, high: 3, medium: 2, low: 1 };
      return prioWeight[b.priority] - prioWeight[a.priority];
    }
    // Default: joined (joined_at)
    return new Date(a.joined_at) - new Date(b.joined_at);
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      
      {/* Table Action Controls Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/20 dark:bg-slate-950/10">
        
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search bar */}
          <div className="relative flex-grow md:flex-grow-0">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patient, token..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm text-slate-800 dark:text-white transition-all"
            />
          </div>

          {/* Status filter dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-650 dark:text-slate-350 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="waiting">Waiting</option>
              <option value="consulting">In Room</option>
              <option value="skipped">Skipped</option>
            </select>
            <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Priority filter dropdown */}
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-655 dark:text-slate-350 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-all"
            >
              <option value="all">All Priorities</option>
              <option value="emergency">Emergency</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Admin Commands */}
        <div className="flex items-center justify-end gap-2.5 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
          <button
            onClick={() => triggerAction('post', '/api/queue/undo')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350 transition-colors"
            title="Undo Last Action"
          >
            <FiRotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to reset today's queue? This action cannot be undone.")) {
                triggerAction('post', '/api/queue/reset');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 hover:text-rose-650 dark:hover:bg-rose-955/20 dark:hover:text-rose-400 text-xs font-semibold text-slate-600 dark:text-slate-350 transition-colors"
            title="Reset Queue"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => triggerAction('post', '/api/queue/call-next')}
            disabled={stats.waiting_count === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 disabled:border-transparent text-white text-xs font-semibold transition-all shadow-md shadow-brand-500/10 cursor-pointer"
          >
            <FiPlay className="w-3.5 h-3.5" />
            <span>Call Next</span>
          </button>
        </div>

      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        {sortedQueue.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-slate-100 dark:border-slate-850 mb-4 text-slate-400">
              <FiUserCheck className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-white">No Patients Found</h4>
            <p className="text-xs text-slate-400 max-w-xs mt-1.5">
              There are no active patients matching the search parameters or enqueued today.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/5">
                <th className="px-6 py-4">Token</th>
                <th className="px-6 py-4">Patient Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Joined Time</th>
                <th className="px-6 py-4">Est. Wait</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {sortedQueue.map((item) => (
                  <motion.tr
                    key={item.id}
                    layoutId={`row_${item.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-950/5 transition-colors ${
                      item.status === 'consulting' ? 'bg-emerald-50/10 dark:bg-emerald-950/5' : ''
                    }`}
                  >
                    {/* Token */}
                    <td className="px-6 py-4 text-sm font-bold text-brand-600 dark:text-brand-400">
                      {item.token}
                    </td>

                    {/* Patient name & contact info */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-850 dark:text-white">{item.patient.name}</span>
                        <span className="text-xxs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                          {item.patient.age ? `${item.patient.age} yrs • ` : ''}
                          {item.patient.gender}
                          {item.patient.phone && (
                            <>
                              <span className="mx-1">•</span>
                              <FiPhone className="w-2.5 h-2.5 inline" />
                              <span>{item.patient.phone}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Priority Badge */}
                    <td className="px-6 py-4">
                      {getPriorityBadge(item.priority)}
                    </td>

                    {/* Joined At Time */}
                    <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-450">
                      {new Date(item.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Expected wait */}
                    <td className={`px-6 py-4 text-xs font-semibold ${
                      item.status === 'consulting' 
                        ? 'text-emerald-600 dark:text-emerald-450' 
                        : item.priority === 'emergency' 
                          ? 'text-rose-600 dark:text-rose-400' 
                          : 'text-slate-550 dark:text-slate-400'
                    }`}>
                      {formatWait(item.estimated_wait)}
                    </td>

                    {/* Row Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        
                        {/* Call / Complete Button */}
                        {item.status === 'consulting' ? (
                          <button
                            onClick={() => triggerAction('post', `/api/queue/complete/${item.id}`)}
                            className="p-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:hover:bg-emerald-950/20 dark:text-emerald-450 transition-colors"
                            title="Complete Consultation"
                          >
                            <FiCheck className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCallPatient(item)}
                            className="p-1.5 rounded-lg border border-slate-205 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                            title="Call to Consultation Room"
                          >
                            <FiPlay className="w-4 h-4" />
                          </button>
                        )}

                        {/* Skip Button */}
                        {item.status === 'waiting' && (
                          <button
                            onClick={() => triggerAction('post', `/api/queue/skip/${item.id}`)}
                            className="p-1.5 rounded-lg border border-slate-205 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                            title="Skip Patient"
                          >
                            <FiSkipForward className="w-4 h-4" />
                          </button>
                        )}

                        {/* QR Code Button */}
                        <button
                          onClick={() => setActiveQrItem(item)}
                          className="p-1.5 rounded-lg border border-slate-205 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                          title="Mobile Wait Tracker QR Code"
                        >
                          <FiSmartphone className="w-4 h-4" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 rounded-lg border border-slate-205 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                          title="Edit Patient Details"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>

                        {/* Remove / Delete Button */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ${item.patient.name} from the queue?`)) {
                              triggerAction('delete', `/api/queue/${item.id}`);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-slate-205 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:hover:bg-rose-955/20 dark:hover:text-rose-450 text-slate-500 dark:text-slate-400 transition-colors"
                          title="Remove from Queue"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </td>

                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* QR Code Modal Popup */}
      {activeQrItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveQrItem(null)}></div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-5 text-center z-10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-850 dark:text-white">Mobile Track QR</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
              Scan this code to track wait time for **{activeQrItem.patient.name}** (Token: **{activeQrItem.token}**).
            </p>
            <div className="p-3.5 bg-white rounded-xl border border-slate-150 flex items-center justify-center shadow-sm">
              <QRCodeSVG 
                value={`${window.location.origin}/patient-screen?token=${encodeURIComponent(activeQrItem.token)}`} 
                size={160} 
                level="M" 
                fgColor="#0c85eb" 
              />
            </div>
            <button
              onClick={() => setActiveQrItem(null)}
              className="mt-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default QueueTable;
