import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { FiActivity, FiStar } from 'react-icons/fi';
import { motion } from 'framer-motion';

const ClinicHealthIndex = () => {
  const { stats } = useSocket();
  const [displayScore, setDisplayScore] = useState(0);

  // --- Dynamic Calculations ---
  const completedCount = stats?.completed_count || 0;
  const waitingCount = stats?.waiting_count || 0;
  const skippedCount = stats?.skipped_count || 0;
  const totalWaitEstimate = stats?.total_wait_estimate || 0;
  const doctorStatus = stats?.doctor_status || 'offline';
  const doctorSpeed = stats?.doctor_speed || 'normal';
  const queueHealthStatus = stats?.queue_health?.status || 'Healthy';

  // 1. Queue Efficiency: (Completed / Total Today) * 100
  const totalToday = completedCount + waitingCount + skippedCount;
  const efficiency = totalToday === 0 ? 100 : Math.round((completedCount / totalToday) * 100);

  // 2. Doctor Productivity: based on settings status and speed multipliers
  let doctorProd = 0;
  if (doctorStatus === 'active') {
    doctorProd = doctorSpeed === 'fast' ? 100 : doctorSpeed === 'normal' ? 90 : 75;
  } else if (doctorStatus === 'on_break') {
    doctorProd = 50;
  } else if (doctorStatus === 'away') {
    doctorProd = 30;
  } else {
    doctorProd = 0;
  }

  // 3. Patient Flow density
  let flowStatus = 'Excellent';
  let flowScore = 100;
  if (waitingCount === 0) {
    flowStatus = 'Excellent';
    flowScore = 100;
  } else if (waitingCount <= 3) {
    flowStatus = 'Good';
    flowScore = 85;
  } else if (waitingCount <= 8) {
    flowStatus = 'Busy';
    flowScore = 60;
  } else {
    flowStatus = 'Congested';
    flowScore = 30;
  }

  // 4. Queue Health score
  const healthScore = queueHealthStatus === 'Healthy' ? 100 : queueHealthStatus === 'Busy' ? 70 : 40;

  // 5. Average Wait rating score
  const avgWaitTime = waitingCount === 0 ? 0 : totalWaitEstimate / waitingCount;
  let waitScore = 100;
  if (avgWaitTime <= 10) {
    waitScore = 100;
  } else if (avgWaitTime >= 45) {
    waitScore = 20;
  } else {
    waitScore = Math.round(100 - ((avgWaitTime - 10) / 35) * 80);
  }

  // --- Overall Score aggregation ---
  const overallScore = Math.round(
    0.30 * waitScore + 
    0.20 * efficiency + 
    0.25 * doctorProd + 
    0.15 * flowScore + 
    0.10 * healthScore
  ) || 0;

  // Smooth score count-up animation
  useEffect(() => {
    let startTimestamp = null;
    const duration = 800; // ms
    const startVal = displayScore;
    const endVal = overallScore;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(progress * (endVal - startVal) + startVal);
      setDisplayScore(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayScore(endVal);
      }
    };

    window.requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallScore]);

  // Ratings
  const getRatingInfo = (score) => {
    if (score >= 90) return { label: 'Outstanding', stars: 5, color: 'text-emerald-500' };
    if (score >= 80) return { label: 'Excellent', stars: 4, color: 'text-emerald-500' };
    if (score >= 70) return { label: 'Good', stars: 3, color: 'text-brand-500' };
    if (score >= 50) return { label: 'Needs Improvement', stars: 2, color: 'text-amber-500' };
    return { label: 'Critical', stars: 1, color: 'text-rose-500' };
  };

  const rating = getRatingInfo(overallScore);

  // Dynamic Insight Summary
  const getDynamicInsight = () => {
    if (doctorStatus === 'offline') {
      return "Doctor is offline. Enqueued patients cannot be served.";
    }
    if (stats?.queue_health?.status === 'Overloaded') {
      return "Queue congestion detected. Consider triaging emergency cases.";
    }
    if (overallScore >= 80) {
      return "Outstanding performance. Average waiting times are minimal.";
    }
    if (waitingCount > 6) {
      return "High waiting count. Suggest optimizing room consultation speed.";
    }
    return "Clinic performance is healthy. Patients are flowing smoothly.";
  };

  // SVG Dial Calculations
  const radius = 34;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((isNaN(overallScore) ? 0 : overallScore) / 100) * circumference;

  return (
    <div className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-slate-350 dark:hover:border-slate-700 transition-all duration-300 flex flex-col justify-between glass-card relative overflow-hidden group">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Clinic Health Index
        </span>
        <div className="flex items-center gap-2">
          {overallScore > 95 && (
            <span className="px-2.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-405 border border-emerald-200/20 glowing-pulse">
              Excellent Performance Today
            </span>
          )}
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <FiStar 
                key={i} 
                className={`w-3.5 h-3.5 ${
                  i < rating.stars 
                    ? 'text-amber-500 fill-amber-500' 
                    : 'text-slate-200 dark:text-slate-800'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Dial & Rating */}
      <div className="flex items-center gap-5 py-4">
        {/* Animated Circular Progress Dial */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              className="text-slate-100 dark:text-slate-800"
              strokeWidth={stroke}
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="40"
              cy="40"
            />
            <motion.circle
              className={
                overallScore >= 80 ? 'text-emerald-500' :
                overallScore >= 60 ? 'text-brand-500' :
                overallScore >= 50 ? 'text-amber-500' : 'text-rose-500'
              }
              strokeWidth={stroke}
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx="40"
              cy="40"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-lg font-extrabold font-mono text-slate-850 dark:text-white leading-none">
              {displayScore}
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Score</span>
          </div>
        </div>

        {/* Rating text info */}
        <div>
          <h4 className={`text-sm font-extrabold tracking-tight ${rating.color}`}>
            {rating.label}
          </h4>
          <span className="text-xxs text-slate-405 font-medium block mt-1">
            Flow: <span className="font-bold text-slate-700 dark:text-slate-300">{flowStatus}</span>
          </span>
          <span className="text-xxs text-slate-405 font-medium block">
            Health: <span className="font-bold text-slate-700 dark:text-slate-300">{queueHealthStatus}</span>
          </span>
        </div>
      </div>

      {/* Insights Message */}
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/80 flex items-start gap-2">
        <FiActivity className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-550 dark:text-slate-400 font-medium leading-relaxed">
          {getDynamicInsight()}
        </p>
      </div>

      {/* Core metrics breakdown */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 border-t border-slate-100 dark:border-slate-850/80 pt-3">
        <div className="flex justify-between items-center text-[10px] font-medium">
          <span className="text-slate-405">Efficiency</span>
          <span className="font-bold text-slate-800 dark:text-white font-mono">{efficiency}%</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-medium">
          <span className="text-slate-405">Productivity</span>
          <span className="font-bold text-slate-800 dark:text-white font-mono">{doctorProd}%</span>
        </div>
      </div>

    </div>
  );
};

export default ClinicHealthIndex;
