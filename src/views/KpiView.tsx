import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { BarChart3, TrendingUp, TrendingDown, Target, Clock, CheckCircle2, X, Download, Award, ShieldAlert, Zap, Medal, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from 'recharts';
import { defaultStaff } from '../lib/dataStore';

interface KpiViewProps {
  currentUid?: string | null;
}

export function KpiView({ currentUid }: KpiViewProps) {
  const [customStaff, setCustomStaff] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    // Load staff: Firestore first, localStorage fallback
    if (currentUid) {
      const q = query(collection(db, `users/${currentUid}/staff`));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setCustomStaff(snap.docs.map(d => d.data().name as string));
        } else {
          const stored = localStorage.getItem('watsanStaff');
          setCustomStaff(stored ? JSON.parse(stored) : defaultStaff);
        }
      });
      return () => unsub();
    } else {
      const stored = localStorage.getItem('watsanStaff');
      setCustomStaff(stored ? JSON.parse(stored).filter((s: string) => !s.includes('Kevin Vilbar')) : defaultStaff);
    }
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;
    const actQ = query(collection(db, `users/${currentUid}/activities`));
    const taskQ = query(collection(db, `users/${currentUid}/tasks`));
    const unsubAct = onSnapshot(actQ, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTask = onSnapshot(taskQ, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAct(); unsubTask(); };
  }, [currentUid]);

  // Generate mock KPI data for each staff member
  const getMockKPIs = (name: string, index: number) => {
    // Make Kevin have great stats
    const isKevin = name.includes('Kevin Vilbar');
    const baseScore = isKevin ? 98 : 75 + (index * 7) % 20;
    const taskCompletion = isKevin ? 100 : 80 + (index * 5) % 20;
    const avgTime = isKevin ? '1.2' : (2.0 + (index % 3)).toFixed(1);
    
    return {
      score: baseScore,
      tasks: taskCompletion,
      hours: avgTime,
      trend: index % 3 === 0 ? 'down' : 'up',
      jobsDone: 120 + (index * 13) % 50,
      safetyScore: isKevin ? 100 : 85 + (index * 3) % 15,
      punctuality: isKevin ? 100 : 80 + (index * 6) % 20,
    };
  };

  return (
    <div className="p-4 max-w-7xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="flex flex-col gap-10">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Team Performance KPIs</h2>
          <p className="text-on-surface-variant mt-1">Individual performance metrics and activity scores.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overall Team Stats */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 lg:p-6 flex items-center gap-4 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Target className="w-24 h-24" />
              </div>
              <div className="p-3 bg-primary text-white rounded-xl shrink-0 shadow-sm relative z-10">
                <Target className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <p className="text-sm lg:text-label-md text-primary font-bold uppercase tracking-wider whitespace-nowrap">Avg Team Score</p>
                <div className="flex items-baseline gap-1">
                  <h3 className="font-display-sm text-2xl lg:text-3xl font-bold text-on-surface">86.4</h3>
                  <span className="text-xs text-primary font-semibold">/ 100</span>
                </div>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-2xl p-4 lg:p-6 flex items-center gap-4 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <div className="p-3 bg-secondary text-white rounded-xl shrink-0 shadow-sm relative z-10">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <p className="text-sm lg:text-label-md text-on-surface-variant font-bold uppercase tracking-wider whitespace-nowrap">Jobs Completed</p>
                <h3 className="font-display-sm text-2xl lg:text-3xl font-bold text-on-surface">1,249</h3>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-2xl p-4 lg:p-6 flex items-center gap-4 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Clock className="w-24 h-24" />
              </div>
              <div className="p-3 bg-surface-variant text-on-surface-variant rounded-xl shrink-0 shadow-sm relative z-10">
                <Clock className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <p className="text-sm lg:text-label-md text-on-surface-variant font-bold uppercase tracking-wider whitespace-nowrap">Avg Resolution</p>
                <h3 className="font-display-sm text-2xl lg:text-3xl font-bold text-on-surface">2.4h</h3>
              </div>
            </div>
          </div>

          {/* Comparative Scores Chart */}
          {(() => {
            const chartData = customStaff.map((staff, idx) => ({
              name: staff.split(' ')[0], // just first name for chart fit
              score: getMockKPIs(staff, idx).score,
              fullName: staff
            })).sort((a, b) => b.score - a.score);

            return (
              <div className="col-span-full">
                <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <h3 className="font-headline-md text-on-surface flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary"/> Comparative Quality Scores
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-1">Relative performance ranking across active field technicians.</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div className="flex items-center gap-1.5 focus:outline-none">
                        <div className="w-3 h-3 rounded-full bg-success"></div>
                        <span className="text-on-surface-variant">Top (90+)</span>
                      </div>
                      <div className="flex items-center gap-1.5 focus:outline-none">
                        <div className="w-3 h-3 rounded-full bg-primary/80"></div>
                        <span className="text-on-surface-variant">Standard</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-72 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0066CC" stopOpacity={1} />
                            <stop offset="100%" stopColor="#0066CC" stopOpacity={0.6} />
                          </linearGradient>
                          <linearGradient id="topGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22C55E" stopOpacity={1} />
                            <stop offset="100%" stopColor="#22C55E" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                          fontFamily="Inter, sans-serif"
                          fontWeight={500}
                          tick={{ fill: '#6B7280' }}
                        />
                        <YAxis 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          width={40}
                          fontFamily="Inter, sans-serif"
                          tick={{ fill: '#6B7280' }}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: '1px solid #E5E7EB', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            padding: '12px',
                            backgroundColor: 'white'
                          }}
                          itemStyle={{
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '0'
                          }}
                          cursor={{ fill: 'rgba(0, 102, 204, 0.05)', radius: 4 }}
                        />
                        <Bar 
                          dataKey="score" 
                          radius={[6, 6, 0, 0]} 
                          name="Quality Score" 
                          maxBarSize={45}
                        >
                          {chartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.score >= 90 ? 'url(#topGradient)' : 'url(#barGradient)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Individual Scores */}
          <div className="col-span-full">
            <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 className="font-headline-md text-on-surface flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary"/> Individual Rankings
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-variant/30 border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wider">
                      <th className="py-4 px-6 font-medium">Team Member</th>
                      <th className="py-4 px-6 font-medium">Quality Score</th>
                      <th className="py-4 px-6 font-medium">Task Completion</th>
                      <th className="py-4 px-6 font-medium">Avg Time (hrs)</th>
                      <th className="py-4 px-6 font-medium text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customStaff.map((staff, idx) => {
                      const kpi = getMockKPIs(staff, idx);
                      const isTop = kpi.score >= 90;
                      
                      return (
                        <tr 
                          key={staff} 
                          onClick={() => setSelectedStaff(staff)}
                          className="border-b border-outline-variant/50 hover:bg-surface-container-lowest transition-colors group cursor-pointer"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${isTop ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface'}`}>
                                  {staff.charAt(0)}
                                </div>
                                {kpi.score >= 95 && (
                                  <div className="absolute -top-1 -right-1 bg-tertiary text-white p-0.5 rounded-full shadow-sm border border-white">
                                    <Medal className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-label-md text-on-surface group-hover:text-primary transition-colors flex items-center gap-1.5">
                                  {staff}
                                  {kpi.score >= 95 && <Star className="w-3 h-3 text-tertiary fill-tertiary" />}
                                </div>
                                {staff.includes('Kevin Vilbar') && <div className="text-[10px] text-primary uppercase font-bold tracking-wider">Tech Head</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-full max-w-[100px] h-2 bg-surface-variant rounded-full overflow-hidden">
                                <div className={`h-full ${isTop ? 'bg-primary' : 'bg-[#0052A3]'}`} style={{ width: `${kpi.score}%` }}></div>
                              </div>
                              <span className={`font-mono text-sm font-medium ${isTop ? 'text-primary' : 'text-on-surface'}`}>{kpi.score}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono text-sm text-on-surface-variant">{kpi.tasks}%</td>
                          <td className="py-4 px-6 font-mono text-sm text-on-surface-variant">{kpi.hours}</td>
                          <td className="py-4 px-6 text-right">
                            {kpi.trend === 'up' ? (
                              <div className="flex items-center justify-end gap-1 text-[#166534] bg-[#bbf7d0]/30 inline-flex px-2 py-1 rounded">
                                <TrendingUp className="w-4 h-4"/>
                                <span className="text-xs font-bold">+2.4%</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1 text-error bg-error/10 inline-flex px-2 py-1 rounded">
                                <TrendingDown className="w-4 h-4"/>
                                <span className="text-xs font-bold">-1.1%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Employee Appraisal Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-[896px] min-w-[300px] md:min-w-[700px] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container-lowest">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                  {selectedStaff.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-surface leading-tight">{selectedStaff}</h2>
                  <p className="text-sm text-on-surface-variant">Performance Appraisal Scorecard</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStaff(null)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const idx = customStaff.indexOf(selectedStaff);
                const kpi = getMockKPIs(selectedStaff, idx !== -1 ? idx : 0);
                const isTop = kpi.score >= 90;
                
                return (
                  <div className="space-y-6">
                    {/* Top Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm text-on-surface-variant font-medium">Overall Quality Score</p>
                          <Target className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-end gap-2">
                          <h3 className={`text-3xl font-bold ${isTop ? 'text-primary' : 'text-on-surface'}`}>{kpi.score}</h3>
                          <span className="text-sm text-on-surface-variant mb-1">/ 100</span>
                        </div>
                        <div className="w-full mt-3 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                          <div className={`h-full ${isTop ? 'bg-primary' : 'bg-[#0052A3]'}`} style={{ width: `${kpi.score}%` }}></div>
                        </div>
                      </div>
                      
                      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm text-on-surface-variant font-medium">Task Completion</p>
                          <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                        </div>
                        <div className="flex items-end gap-2">
                          <h3 className="text-3xl font-bold text-on-surface">{kpi.tasks}%</h3>
                        </div>
                        <div className="w-full mt-3 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                          <div className="h-full bg-[#166534]" style={{ width: `${kpi.tasks}%` }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-surface-variant/30 rounded-xl p-4 text-center">
                        <Clock className="w-5 h-5 mx-auto mb-2 text-on-surface-variant" />
                        <p className="text-xs text-on-surface-variant mb-1">Avg Resolution</p>
                        <p className="text-lg font-bold text-on-surface">{kpi.hours}h</p>
                      </div>
                      <div className="bg-surface-variant/30 rounded-xl p-4 text-center">
                        <Zap className="w-5 h-5 mx-auto mb-2 text-[#00A8A8]" />
                        <p className="text-xs text-on-surface-variant mb-1">Jobs Done</p>
                        <p className="text-lg font-bold text-on-surface">{kpi.jobsDone}</p>
                      </div>
                      <div className="bg-surface-variant/30 rounded-xl p-4 text-center">
                        <ShieldAlert className="w-5 h-5 mx-auto mb-2 text-[#FF6B35]" />
                        <p className="text-xs text-on-surface-variant mb-1">Safety Score</p>
                        <p className="text-lg font-bold text-on-surface">{kpi.safetyScore}%</p>
                      </div>
                      <div className="bg-surface-variant/30 rounded-xl p-4 text-center">
                        <Award className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <p className="text-xs text-on-surface-variant mb-1">Punctuality</p>
                        <p className="text-lg font-bold text-on-surface">{kpi.punctuality}%</p>
                      </div>
                    </div>

                    {/* Charts */}
                    {(() => {
                      const baseScore = kpi.score;
                      const baseTime = parseFloat(kpi.hours);
                      const baseJobs = kpi.jobsDone;
                      const mockTrendData = [
                        { name: 'Jan', score: Math.max(0, baseScore - 12), avgTime: baseTime + 0.6, completed: Math.max(0, baseJobs - 25) },
                        { name: 'Feb', score: Math.max(0, baseScore - 5), avgTime: baseTime + 0.3, completed: Math.max(0, baseJobs - 12) },
                        { name: 'Mar', score: Math.max(0, baseScore - 8), avgTime: baseTime + 0.4, completed: Math.max(0, baseJobs - 18) },
                        { name: 'Apr', score: Math.max(0, baseScore - 2), avgTime: baseTime + 0.1, completed: Math.max(0, baseJobs - 5) },
                        { name: 'May', score: Math.min(100, baseScore + 2), avgTime: Math.max(0.5, baseTime - 0.2), completed: baseJobs + 8 },
                        { name: 'Jun', score: baseScore, avgTime: baseTime, completed: baseJobs },
                      ];

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm min-w-0">
                          <div className="flex flex-col min-w-0">
                            <label className="block text-sm font-semibold text-on-surface mb-4">Quality Score Trend (6 Months)</label>
                            <div className="h-48 w-full min-w-0">
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <LineChart data={mockTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={25} />
                                  <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#E5E7EB', strokeWidth: 2 }}
                                  />
                                  <Line type="monotone" dataKey="score" stroke="#0066CC" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="Score" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className="flex flex-col min-w-0">
                            <label className="block text-sm font-semibold text-on-surface mb-4">Jobs Completed vs Resolution</label>
                            <div className="h-48 w-full min-w-0">
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart data={mockTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                                  <YAxis yAxisId="left" orientation="left" fontSize={11} tickLine={false} axisLine={false} width={25} />
                                  <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} width={25} />
                                  <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                  />
                                  <Bar yAxisId="left" dataKey="completed" fill="#00A8A8" radius={[4, 4, 0, 0]} name="Jobs (Qty)" maxBarSize={30} />
                                  <Line yAxisId="right" type="monotone" dataKey="avgTime" stroke="#FF6B35" strokeWidth={2} name="Avg Time (h)" dot={false} />
                                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Evaluator Notes Section */}
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Appraisal Notes / Feedback</label>
                      <textarea 
                        className="w-full form-input h-32 resize-none text-sm p-3"
                        placeholder="Enter supervisor feedback for the appraisal period here..."
                        defaultValue={isTop ? "Exceptional performance this quarter. Consistently meets and exceeds expectations in task resolution and quality stringency." : "Solid performance. Keep working on reducing average resolution times for complex maintenance tasks."}
                      />
                    </div>

                    {/* KPI Computation Breakdown */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                        <Target className="w-4 h-4" /> Score Computation Breakdown & Criteria
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-on-surface-variant">Task Completion (40%)</span>
                            <span className="font-semibold text-on-surface">{(kpi.tasks * 0.4).toFixed(1)} pts</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                            <div className="h-full bg-[#166534]" style={{ width: `${kpi.tasks}%` }}></div>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-on-surface-variant">Resolution Time (30%)</span>
                            <span className="font-semibold text-on-surface">{Math.min(30, 30 * (2.5 / Math.max(1, parseFloat(kpi.hours)))).toFixed(1)} pts</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF6B35]" style={{ width: `${Math.min(100, 100 * (2.5 / Math.max(1, parseFloat(kpi.hours))))}%` }}></div>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-on-surface-variant">Safety & Punctuality (30%)</span>
                            <span className="font-semibold text-on-surface">{((kpi.safetyScore * 0.15) + (kpi.punctuality * 0.15)).toFixed(1)} pts</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                            <div className="h-full bg-[#00A8A8]" style={{ width: `${(kpi.safetyScore + kpi.punctuality) / 2}%` }}></div>
                          </div>
                        </div>
                        
                        <div className="bg-surface border border-outline-variant rounded-lg p-3 text-xs text-on-surface-variant space-y-2">
                          <p><strong className="text-on-surface">Metrics Criteria:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li><strong>Task Completion:</strong> Expected to complete 90%+ assigned PMs and tickets.</li>
                            <li><strong>Resolution Time:</strong> Baseline is &le; 2.5h per standard task. Faster completion rewards higher points.</li>
                            <li><strong>Safety Score:</strong> Derived from incident reports and PPE compliance.</li>
                            <li><strong>Punctuality:</strong> Based on attendance and on-time arrival for daily shifts.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button 
                onClick={() => setSelectedStaff(null)} 
                className="btn-secondary text-sm px-4 py-2"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  alert("Exporting scorecard to PDF...");
                  setSelectedStaff(null);
                }} 
                className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
