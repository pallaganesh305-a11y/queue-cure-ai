import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import SoundAnnouncer from '../components/SoundAnnouncer';
import ThemeToggle from '../components/ThemeToggle';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiClock, FiActivity, FiUser, FiPlay, 
  FiMapPin, FiAlertCircle, 
  FiVolume2, FiVolumeX, FiCheck, FiBell, FiArrowRight, FiArrowLeft
} from 'react-icons/fi';

const PatientScreen = () => {
  const { queue, stats } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // URL token parsing
  const [targetToken, setTargetToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  
  const [inputToken, setInputToken] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const prevStatusRef = useRef(null);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const waitingPatients = queue.filter(q => q.status === 'waiting');
  const consultingPatient = queue.find(q => q.status === 'consulting');

  // Find target patient in queue
  const targetQueueItem = queue.find(q => q.token.toLowerCase() === targetToken.toLowerCase());
  
  // Calculate position ahead (waiting patients before target)
  let positionAhead = -1;
  let targetStatus = 'unknown'; // 'relax', 'ready', 'proceed', 'serving', 'completed', 'unknown'
  
  if (targetQueueItem) {
    if (targetQueueItem.status === 'consulting') {
      positionAhead = 0;
      targetStatus = 'serving';
    } else if (targetQueueItem.status === 'waiting') {
      // Find position in ordered waiting list
      const sortedWaiting = [
        ...queue.filter(q => q.status === 'waiting' && q.priority === 'emergency').sort((a,b) => new Date(a.joined_at) - new Date(b.joined_at)),
        ...queue.filter(q => q.status === 'waiting' && q.priority !== 'emergency').sort((a,b) => new Date(a.joined_at) - new Date(b.joined_at))
      ];
      
      const idx = sortedWaiting.findIndex(q => q.id === targetQueueItem.id);
      positionAhead = idx !== -1 ? idx + 1 : 999;
      
      if (positionAhead === 1) {
        targetStatus = 'proceed';
      } else if (positionAhead >= 2 && positionAhead <= 5) {
        targetStatus = 'ready';
      } else if (positionAhead > 5) {
        targetStatus = 'relax';
      }
    } else if (targetQueueItem.status === 'skipped') {
      targetStatus = 'skipped';
    }
  }

  // Handle Voice and Audio transitions
  const playGentleSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playTone(587.33, now, 0.25); // D5
      playTone(659.25, now + 0.1, 0.4); // E5
    } catch (e) {
      console.error(e);
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!targetToken || !targetQueueItem || !audioEnabled) return;
    
    if (prevStatusRef.current !== null && prevStatusRef.current !== targetStatus) {
      if (targetStatus === 'ready') {
        playGentleSound();
      } else if (targetStatus === 'proceed') {
        const room = stats.current_room || "Consultation Room 1";
        speakText(`Token ${targetToken.split('').join(' ')}, please proceed to ${room}.`);
      } else if (targetStatus === 'serving') {
        const room = stats.current_room || "Consultation Room 1";
        speakText(`Token ${targetToken.split('').join(' ')}, is now being served in ${room}.`);
      }
    }
    
    prevStatusRef.current = targetStatus;
  }, [targetStatus, targetToken, targetQueueItem, audioEnabled, stats.current_room]);

  // Track max position using a ref to calculate progress bar percentage without triggering extra renders
  const maxPositionRef = useRef(positionAhead);
  if (positionAhead > maxPositionRef.current) {
    maxPositionRef.current = positionAhead;
  }
  const maxPosition = maxPositionRef.current;

  const rawProgress = consultingPatient && targetStatus === 'serving' 
    ? 100 
    : positionAhead > 0 
      ? Math.max(10, Math.min(95, 100 - (positionAhead / (maxPosition || positionAhead + 3)) * 100))
      : 0;
  const progressPercentage = isNaN(rawProgress) ? 0 : rawProgress;

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (inputToken.trim()) {
      setTargetToken(inputToken.trim());
      // Update browser URL query param without full refresh
      const newUrl = `${window.location.pathname}?token=${encodeURIComponent(inputToken.trim())}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      setInputToken('');
    }
  };

  const handleClearTrack = () => {
    setTargetToken('');
    window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
    prevStatusRef.current = null;
  };

  const getPriorityBadge = (prio) => {
    switch (prio) {
      case 'emergency':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">Emergency</span>;
      case 'high':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">High</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#07090e] dark:text-slate-100 flex flex-col font-sans p-6 transition-colors duration-250">
      
      {/* Header bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-850">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <FiActivity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Queue Cure Waiting Screen</h1>
            <span className="text-xs text-slate-405 font-medium">{stats.current_room || "Consultation Room 1"}</span>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Audio Announcer (Global TV announcer) */}
          {!targetToken && <SoundAnnouncer />}

          {/* Individual Tracker Audio Toggle */}
          {targetToken && (
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold transition-all duration-300 ${
                audioEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-900/60 glowing-pulse'
                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              {audioEnabled ? <FiVolume2 className="w-4 h-4" /> : <FiVolumeX className="w-4 h-4" />}
              <span>Voice Alerts: {audioEnabled ? 'Active' : 'Muted'}</span>
            </button>
          )}
          
          {/* Theme switcher */}
          <ThemeToggle />

          {/* Time display */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-sm font-semibold tracking-wide">
            <FiClock className="w-4 h-4 text-slate-450" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </header>

      {/* Conditional Display: Personalized Tracker View vs TV General View */}
      {targetToken ? (
        // PERSONALIZED SMART PATIENT ASSISTANT VIEW
        <div className="flex-grow flex items-center justify-center py-8">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col gap-6 relative overflow-hidden">
            
            {/* Background blur overlay */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-indigo-500"></div>

            {/* Back Button */}
            <button
              onClick={handleClearTrack}
              className="self-start flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-750 dark:hover:text-slate-200 transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Back to TV Monitor</span>
            </button>

            {targetQueueItem ? (
              <div className="flex flex-col gap-6">
                {/* Header Profile */}
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850 pb-5">
                  <div>
                    <h2 className="text-xxs font-bold uppercase tracking-wider text-slate-400">Personal Patient Tracker</h2>
                    <h3 className="text-xl font-extrabold text-slate-850 dark:text-white mt-1">{targetQueueItem.patient.name}</h3>
                    <p className="text-xs text-slate-450 mt-1 font-mono">Token: <span className="font-bold text-brand-600 dark:text-brand-400">{targetQueueItem.token}</span></p>
                  </div>
                  {getPriorityBadge(targetQueueItem.priority)}
                </div>

                {/* Smart Queue Status Display */}
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  {targetStatus === 'serving' && (
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 glowing-pulse">
                        <FiCheck className="w-8 h-8" />
                      </div>
                      <h4 className="text-3xl font-extrabold text-slate-850 dark:text-white tracking-tight">Now Serving</h4>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-450 px-4 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                        Please enter {stats.current_room || "Room 1"}
                      </p>
                    </motion.div>
                  )}

                  {targetStatus === 'proceed' && (
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 glowing-pulse">
                        <FiArrowRight className="w-8 h-8" />
                      </div>
                      <h4 className="text-3xl font-extrabold text-slate-850 dark:text-white tracking-tight">Proceed to Room</h4>
                      <p className="text-xs text-rose-600 dark:text-rose-400 max-w-sm mt-1">
                        Only 1 patient ahead of you. Please proceed towards the consultation room.
                      </p>
                    </motion.div>
                  )}

                  {targetStatus === 'ready' && (
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <FiBell className="w-8 h-8" />
                      </div>
                      <h4 className="text-3xl font-extrabold text-slate-850 dark:text-white tracking-tight">Get Ready</h4>
                      <p className="text-xs text-amber-600 dark:text-amber-450 max-w-sm mt-1">
                        Your turn is approaching. There are {positionAhead} patients ahead. Please stay nearby.
                      </p>
                    </motion.div>
                  )}

                  {targetStatus === 'relax' && (
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <FiCheck className="w-8 h-8" />
                      </div>
                      <h4 className="text-3xl font-extrabold text-slate-850 dark:text-white tracking-tight">Relax</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                        You still have some time. There are {positionAhead} patients ahead of you.
                      </p>
                    </motion.div>
                  )}

                  {targetStatus === 'skipped' && (
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-400 text-white flex items-center justify-center">
                        <FiAlertCircle className="w-8 h-8" />
                      </div>
                      <h4 className="text-3xl font-extrabold text-slate-850 dark:text-white tracking-tight">Status: Skipped</h4>
                      <p className="text-xs text-slate-405 max-w-sm mt-1">
                        You were skipped. Please speak with the receptionist at the front desk to be recalled.
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Progress Bar (except for skipped status) */}
                {targetStatus !== 'skipped' && (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-xxs font-bold text-slate-400 uppercase tracking-wider">
                      <span>Registration</span>
                      <span>Serving</span>
                    </div>
                    <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-750">
                      <motion.div 
                        initial={{ width: '0%' }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                )}

                {/* Remaining metrics grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-850 pt-5">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Patients Ahead</span>
                    <span className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono mt-1 block">
                      {targetStatus === 'serving' ? '0' : positionAhead === -1 ? 'N/A' : positionAhead}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Wait</span>
                    <span className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono mt-1 block">
                      {targetStatus === 'serving' ? 'Immediate' : targetStatus === 'skipped' ? 'On Hold' : `${targetQueueItem.estimated_wait} mins`}
                    </span>
                  </div>
                </div>

                {/* Audio Enablement Banner */}
                {!audioEnabled && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-400 text-xxs font-medium flex items-center justify-between gap-3">
                    <span>Unlock dynamic chimes and text-to-speech turn directions.</span>
                    <button
                      onClick={() => setAudioEnabled(true)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-550 text-white rounded-lg text-xxs font-bold tracking-wide transition-colors shrink-0"
                    >
                      Enable Audio
                    </button>
                  </div>
                )}

              </div>
            ) : (
              // Not found in active queue: check if they entered a wrong token or if it's completed
              <div className="py-8 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center mb-4 text-slate-400 border border-slate-200/50 dark:border-slate-800">
                  <FiAlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">Token Not Found</h4>
                <p className="text-xs text-slate-450 mt-1 max-w-sm">
                  The token **{targetToken}** is not active in today's waiting list. It may have been completed, removed, or is incorrect.
                </p>
                <button
                  onClick={handleClearTrack}
                  className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl"
                >
                  Return to Waiting Monitor
                </button>
              </div>
            )}

          </div>
        </div>
      ) : (
        // STANDARD CLINIC TV waiting MONITOR VIEW
        <div className="flex-grow flex flex-col gap-6">
          
          {/* Quick tracker lookup header banner */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
            <div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Track Your Turn</h3>
              <p className="text-xxs text-slate-405 font-medium mt-0.5">Enter your enqueued token prefix to view personal wait alerts.</p>
            </div>
            
            <form onSubmit={handleTrackSubmit} className="flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="E.g., QC-105"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-slate-800 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-500/10 cursor-pointer"
              >
                Track
              </button>
            </form>
          </div>

          <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Big Screen Call-Outs (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Big Calling Token Display */}
              <div className="flex-grow flex flex-col justify-center items-center bg-white dark:bg-slate-900 border-2 border-slate-205 dark:border-slate-800 rounded-3xl p-10 shadow-lg text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent opacity-60 dark:opacity-40"></div>
                
                {consultingPatient ? (
                  <motion.div
                    key={consultingPatient.id}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                    className="relative z-10 w-full flex flex-col items-center"
                  >
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider mb-8 glowing-pulse">
                      <FiPlay className="w-3.5 h-3.5 fill-white" />
                      <span>Now Serving</span>
                    </div>
                    
                    <h2 className="text-7xl sm:text-9xl font-extrabold text-brand-600 dark:text-brand-400 tracking-tight leading-none drop-shadow-sm font-mono">
                      {consultingPatient.token}
                    </h2>
                    
                    <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-8 tracking-tight">
                      {consultingPatient.patient.name}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-4 px-4.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850/80 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <FiMapPin className="w-4 h-4 text-brand-500" />
                      <span>Please proceed to **{stats.current_room}**</span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-slate-100 dark:border-slate-850 mb-6 text-slate-355 dark:text-slate-600">
                      <FiUser className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">No Active Consultations</h3>
                    <p className="text-xs text-slate-405 mt-2 max-w-sm leading-relaxed">
                      Doctor is currently offline or waiting to call the next patient in line.
                    </p>
                  </div>
                )}
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-550 dark:text-slate-400 tracking-wider">Average Wait</span>
                  <span className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono">{stats.average_consultation}m</span>
                  <span className="text-xxs text-slate-405 font-medium">Per completed patient</span>
                </div>
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-550 dark:text-slate-400 tracking-wider">Doctor Speed</span>
                  <span className="text-2xl font-extrabold text-slate-800 dark:text-white capitalize">{stats.doctor_speed}</span>
                  <span className="text-xxs text-slate-405 font-medium">Consulting multiplier</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-550 dark:text-slate-400 tracking-wider">Queue Status</span>
                  <span className="text-2xl font-extrabold text-slate-850 dark:text-white flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full bg-${stats.queue_health.color}-500`}></span>
                    {stats.queue_health.status}
                  </span>
                  <span className="text-xxs text-slate-405 font-medium truncate">{stats.queue_health.recommendation || "Queue flow is normal"}</span>
                </div>
              </div>

            </div>

            {/* Right Column: Waiting Queue Timeline & QR Code (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6 max-h-[80vh]">
              
              {/* Waiting Queue List Card */}
              <div className="flex-grow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md flex flex-col overflow-hidden">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-850">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide uppercase">Waiting Timeline</h3>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-[10px] font-bold text-slate-500">
                    {waitingPatients.length} Waiting
                  </span>
                </div>

                <div className="flex-grow overflow-y-auto mt-4 pr-1 space-y-3.5 scrollbar-thin">
                  <AnimatePresence initial={false}>
                    {waitingPatients.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <h4 className="text-xs font-semibold text-slate-400">Queue is Clear</h4>
                        <p className="text-xxs text-slate-405 max-w-xs mt-1">
                          Registered patients will appear in this timeline instantly.
                        </p>
                      </div>
                    ) : (
                      waitingPatients.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                          className={`p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex justify-between items-center ${
                            item.priority === 'emergency' ? 'border-rose-350 dark:border-rose-900/40 bg-rose-50/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                              {idx + 1}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-extrabold text-brand-600 dark:text-brand-450 font-mono tracking-wide">{item.token}</span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{item.patient.name}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {getPriorityBadge(item.priority)}
                            <div className="text-right">
                              <span className="text-xxs font-bold text-slate-400 block uppercase">Est. Wait</span>
                              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 font-mono">
                                {item.estimated_wait === -1 ? 'On Hold' : `${item.estimated_wait}m`}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* QR Code Scan card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center gap-5 shrink-0">
                <div className="p-2.5 bg-white rounded-xl border border-slate-150 flex items-center justify-center shrink-0">
                  <QRCodeSVG 
                    value={window.location.origin + '/patient-screen'} 
                    size={85} 
                    level="M" 
                    fgColor="#0c85eb" 
                  />
                </div>
                <div className="flex-grow">
                  <h4 className="text-xs font-bold text-slate-850 dark:text-white">Track on your Phone</h4>
                  <p className="text-[10px] text-slate-405 leading-relaxed mt-1">
                    Scan the QR code to watch this wait board directly from your mobile device. Enter your token to see your personalized smart progress tracking.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default PatientScreen;
