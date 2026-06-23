import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiActivity, FiArrowRight, FiCpu, FiZap, FiVolume2, 
  FiMoon, FiChevronDown, FiShield, FiHeart 
} from 'react-icons/fi';
import ThemeToggle from '../components/ThemeToggle';

const LandingPage = () => {
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', damping: 20, stiffness: 100 }
    }
  };

  const faqs = [
    {
      q: "How does the AI Wait Time Prediction work?",
      a: "Our system goes beyond simple average multiplication. It evaluates active waiting queue lengths, emergency patient priority offsets, the doctor's custom consulting speed multiplier (Fast/Normal/Slow), and historical traffic loads at different times of the day to generate highly accurate predictions."
    },
    {
      q: "Is the synchronization truly instant?",
      a: "Yes! Every single administrative operation (adding, calling, skipping, or completing a patient) is processed on the backend and broadcast instantly to all connected Receptionist and TV screens using Socket.IO WebSockets."
    },
    {
      q: "Can the patient access the screen on their phone?",
      a: "Absolutely. The patient screen displays a unique QR code. Patients can scan it on their mobile phone to view their live queue position, estimated wait, and doctor status in real-time, letting them wait comfortably nearby."
    },
    {
      q: "Does this support offline mode or reconnects?",
      a: "Yes. The Socket.IO client automatically reconnects after a connection failure. In addition, the frontend features an automatic HTTP polling backup to retrieve updates if WebSockets are completely blocked by network firewalls."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#080b11] dark:text-slate-100 transition-colors duration-250 selection:bg-brand-500 selection:text-white">
      
      {/* Mini-Header */}
      <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-[#080b11]/80 backdrop-blur-md border-b border-slate-250/40 dark:border-slate-850/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/10">
              <FiActivity className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight">Queue Cure <span className="text-brand-500">AI</span></span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link 
              to="/dashboard"
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-brand-500/15"
            >
              Enter Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-brand-400 to-indigo-500 rounded-full blur-[140px] opacity-20 dark:opacity-15 pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-200 dark:border-brand-900/30 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400 text-xxs font-bold uppercase tracking-wider mb-6"
          >
            <FiCpu className="w-3.5 h-3.5 animate-spin delay-1000" />
            <span>AI Wait predictions • Socket.io Enabled</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-4xl sm:text-6xl font-extrabold font-sans tracking-tight leading-tight text-slate-850 dark:text-white"
          >
            Know Your Turn. <br />
            <span className="bg-gradient-to-r from-brand-500 to-indigo-500 bg-clip-text text-transparent">Save Your Time.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed"
          >
            Queue Cure AI is an enterprise-grade real-time clinic queue management SaaS. 
            Eliminate paper tokens, reduce customer anxiety with AI wait predictions, 
            and streamline consultations instantly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-6.5 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-550 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-500/20"
            >
              <span>Receptionist Dashboard</span>
              <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/patient-screen"
              className="flex items-center gap-2 px-6.5 py-3.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-sm tracking-wide hover:bg-slate-50 dark:hover:bg-slate-850 transition-all shadow-sm"
            >
              <span>Patient Waiting Screen</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Screen Preview Graphic */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xl glass-card overflow-hidden"
        >
          {/* Mockup Topbar */}
          <div className="flex items-center justify-between pb-3 px-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            </div>
            <div className="h-4 w-44 rounded bg-slate-100 dark:bg-slate-950/40"></div>
            <div className="w-8"></div>
          </div>
          
          {/* Mockup Dashboard Content */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Current Token</span>
              <span className="text-2xl font-bold text-brand-655 dark:text-brand-400">QC-108</span>
              <span className="text-xxs text-slate-450">Patient: Sarah Parker</span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Average consultation</span>
              <span className="text-2xl font-bold text-slate-850 dark:text-white">8.4 mins</span>
              <span className="text-xxs text-emerald-555">Calculated dynamically</span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Queue Health</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-450">Healthy</span>
              <span className="text-xxs text-slate-450">Smooth flow</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <section className="bg-white dark:bg-slate-900/40 border-y border-slate-200/60 dark:border-slate-850 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-slate-850 dark:text-white">Built for High-Velocity Clinics</h2>
            <p className="text-xs text-slate-400 mt-3 uppercase tracking-wider font-bold">Production-grade features</p>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            
            {/* Feature 1: AI Predict */}
            <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FiCpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">AI Wait Prediction</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Calculates wait times dynamically using queue position, doctor consultation speeds, and hourly loads.
              </p>
            </motion.div>

            {/* Feature 2: Real-time Sync */}
            <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FiZap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">WebSocket Synchronization</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Powered by Flask-SocketIO. Updates reflect instantly across all monitors without page refreshes.
              </p>
            </motion.div>

            {/* Feature 3: Sound alerts */}
            <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FiVolume2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Voice Announcement</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Speaks called tokens aloud in room announcements, eliminating the need to watch TV screens constantly.
              </p>
            </motion.div>

            {/* Feature 4: Theme Toggle */}
            <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FiMoon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Fluid Dark Mode</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Designed to minimize eyestrain for medical staff and patients waiting under different lighting conditions.
              </p>
            </motion.div>

            {/* Feature 5: Security */}
            <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FiShield className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Transaction Safety</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Backend transaction locks block concurrent Call Next clicks, preventing duplicate token processing.
              </p>
            </motion.div>

            {/* Feature 6: PWA Ready */}
            <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FiActivity className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Live Health Tracker</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Monitors queue load levels to trigger active recommendations, helping clinic managers adjust pacing.
              </p>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-extrabold text-center text-slate-850 dark:text-white mb-16">
          Frequently Asked Questions
        </h2>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="border border-slate-250/60 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-6 py-4.5 text-left flex justify-between items-center text-sm font-bold text-slate-800 dark:text-white transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-950/20"
              >
                <span>{faq.q}</span>
                <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${activeFaq === index ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {activeFaq === index && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pt-1 border-t border-slate-100 dark:border-slate-850 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-250/40 dark:border-slate-850/80 py-12 text-center text-xs text-slate-450 bg-slate-50/60 dark:bg-slate-950/20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <FiActivity className="w-4 h-4 text-brand-500" />
            <span className="font-bold text-slate-800 dark:text-white">Queue Cure AI</span>
          </div>
          <p className="flex items-center justify-center gap-1">
            Made with <FiHeart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for National Full-Stack Hackathon © 2026.
          </p>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
