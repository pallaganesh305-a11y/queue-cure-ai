import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { FiCpu, FiTrendingUp, FiActivity, FiClock, FiCheckSquare } from 'react-icons/fi';

const COLORS = ['#0c85eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const AnalyticsView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('/api/analytics');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-64 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl skeleton-shimmer"></div>
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl skeleton-shimmer"></div>
          <div className="h-64 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl skeleton-shimmer"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { insights, hourly_trend, types_distribution, priority_distribution, peak_hours } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* AI Daily Insights Panel */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-650 dark:text-brand-400">
              <FiCpu className="w-5 h-5 glowing-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-850 dark:text-white">AI Daily Insights</h3>
          </div>
          
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/80 mb-6">
            <p className="text-xs leading-relaxed text-slate-650 dark:text-slate-350">
              {insights.summary_text || "Gathering active consultation details to formulate intelligence metrics."}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-850">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <FiClock className="w-3.5 h-3.5 text-slate-400" />
                Peak Rush Hour
              </span>
              <span className="text-xs font-bold text-slate-850 dark:text-white">{insights.peak_hour}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-850">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <FiActivity className="w-3.5 h-3.5 text-slate-400" />
                Avg Consultation
              </span>
              <span className="text-xs font-bold text-slate-850 dark:text-white">{insights.avg_consultation_time} mins</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-850">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <FiTrendingUp className="w-3.5 h-3.5 text-slate-400" />
                Longest Wait Time
              </span>
              <span className="text-xs font-bold text-slate-850 dark:text-white">{insights.longest_wait} mins</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <FiCheckSquare className="w-3.5 h-3.5 text-slate-400" />
                Completion Rate
              </span>
              <span className="text-xs font-bold text-slate-850 dark:text-white">{insights.completion_rate}%</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-850/80 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          Calculated at: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Chart 1: Patients Served (Area) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Patients Served (Hourly)
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly_trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorServed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c85eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0c85eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    color: '#1e293b' 
                  }} 
                />
                <Area type="monotone" dataKey="served" stroke="#0c85eb" strokeWidth={2} fillOpacity={1} fill="url(#colorServed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Peak Hours Inflow (Bar) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Peak Arrival Hours
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peak_hours} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    color: '#1e293b' 
                  }} 
                />
                <Bar dataKey="patients" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Consultation Types Split (Pie) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Consultation Breakdown
          </h4>
          <div className="flex items-center justify-between gap-4 flex-grow">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={types_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {types_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-1/2 flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {types_distribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xxs font-medium">
                  <div className="flex items-center gap-1.5 text-slate-500 truncate">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white shrink-0 ml-1">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 4: Priority Distribution (Donut Pie) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Priority Distribution
          </h4>
          <div className="flex items-center justify-between gap-4 flex-grow">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priority_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={55}
                    dataKey="value"
                  >
                    {priority_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-1/2 flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {priority_distribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xxs font-medium">
                  <div className="flex items-center gap-1.5 text-slate-500 truncate">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }}></div>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white shrink-0 ml-1">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default AnalyticsView;
