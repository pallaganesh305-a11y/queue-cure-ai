import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import QueueTable from '../components/QueueTable';
import RegistrationModal from '../components/RegistrationModal';
import AnalyticsView from '../components/AnalyticsView';
import AiAssistant from '../components/AiAssistant';
import Toast from '../components/Toast';
import ClinicHealthIndex from '../components/ClinicHealthIndex';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { 
  FiUsers, FiUserCheck, FiClock, FiActivity, FiPlus, FiGrid, FiBarChart2, FiEdit2, FiX 
} from 'react-icons/fi';

const Dashboard = () => {
  const { stats, refreshData } = useSocket();
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'analytics'
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);

  // Switch tab listener for voice command integration
  useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e.detail === 'queue' || e.detail === 'analytics') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-tab', handleSwitchTab);
  }, []);

  // Edit Modal form setup
  const { register, handleSubmit, setValue, reset, formState: { isSubmitting } } = useForm();

  const handleOpenEdit = (queueItem) => {
    setEditPatient(queueItem);
    setValue('name', queueItem.patient.name);
    setValue('age', queueItem.patient.age || '');
    setValue('gender', queueItem.patient.gender);
    setValue('phone', queueItem.patient.phone || '');
    setValue('priority', queueItem.priority);
    setValue('consultation_type', queueItem.consultation_type);
    setValue('symptoms', queueItem.patient.symptoms || '');
    setValue('notes', queueItem.notes || '');
  };

  const handleCloseEdit = () => {
    setEditPatient(null);
    reset();
  };

  const handleEditSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        age: data.age ? parseInt(data.age, 10) : null
      };
      await axios.put(`/api/queue/${editPatient.id}`, payload);
      refreshData();
      handleCloseEdit();
    } catch (err) {
      console.error('Failed to update patient:', err);
      alert('Error updating patient details.');
    }
  };

  // Dynamic greetings
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080b11] pb-16 flex flex-col font-sans transition-colors duration-200">
      <Navbar />
      <Toast />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex flex-col gap-6">
        
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-850 dark:text-white">
              {getGreeting()}, Receptionist
            </h1>
            <p className="text-xs text-slate-505 dark:text-slate-400 mt-1 font-medium">
              Manage patient enqueuing, priority triaging, and real-time dashboard layouts.
            </p>
          </div>
          
          <button
            onClick={() => setIsRegModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-605 hover:bg-brand-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
          >
            <FiPlus className="w-4 h-4" />
            <span>Register Patient</span>
          </button>
        </div>

        {/* Statistics & Health Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard
              title="Waiting Patients"
              value={stats.waiting_count}
              icon={FiUsers}
              description="Active waiting queue size"
              color="brand"
            />
            <StatCard
              title="Current Consulting"
              value={stats.current_token !== "N/A" ? stats.current_token : "None"}
              icon={FiUserCheck}
              description={stats.current_token !== "N/A" ? `Patient: ${stats.current_patient}` : "Doctor is currently free"}
              color="emerald"
              pulse={stats.current_token !== "N/A"}
            />
            <StatCard
              title="Avg Consultation"
              value={`${stats.average_consultation}m`}
              icon={FiClock}
              description="Computed dynamic duration"
              color="amber"
            />
            <StatCard
              title="Queue Health"
              value={stats.queue_health.status}
              icon={FiActivity}
              description={stats.queue_health.recommendation || "Queue flow is normal"}
              color={stats.queue_health.color}
            />
          </div>
          <div className="lg:col-span-1">
            <ClinicHealthIndex />
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 mt-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
              activeTab === 'queue'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
          >
            <FiGrid className="w-4 h-4" />
            <span>Active Queue</span>
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
              activeTab === 'analytics'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
          >
            <FiBarChart2 className="w-4 h-4" />
            <span>Live Analytics</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="flex-grow">
          {activeTab === 'queue' ? (
            <QueueTable onEdit={handleOpenEdit} />
          ) : (
            <AnalyticsView />
          )}
        </div>

      </main>

      {/* Floating AI Admin Assistant */}
      <AiAssistant />

      {/* Registration Modal Overlay */}
      <RegistrationModal
        isOpen={isRegModalOpen}
        onClose={() => setIsRegModalOpen(false)}
        onSuccess={() => refreshData()}
      />

      {/* Patient Edit Detail Modal */}
      {editPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseEdit}></div>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <h3 className="text-sm font-bold text-slate-805 dark:text-white flex items-center gap-1.5">
                <FiEdit2 className="w-4 h-4 text-brand-500" />
                Edit Patient Details
              </h3>
              <button onClick={handleCloseEdit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-205">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleEditSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white"
                  {...register('name')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age</label>
                  <input
                    type="number"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white"
                    {...register('age')}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gender</label>
                  <select
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-white"
                    {...register('gender')}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                <select
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-white"
                  {...register('priority')}
                >
                  <option value="low">Low (Routine)</option>
                  <option value="medium">Medium (Standard)</option>
                  <option value="high">High (Urgent)</option>
                  <option value="emergency">Emergency (Immediate)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Symptoms</label>
                <textarea
                  rows="2"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white resize-none"
                  {...register('symptoms')}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  rows="2"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white resize-none"
                  {...register('notes')}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-brand-655 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/10"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
