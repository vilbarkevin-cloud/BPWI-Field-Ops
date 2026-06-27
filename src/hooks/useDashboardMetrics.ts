import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DashboardMetrics {
  tasks: any[];
  activities: any[];
  incidents: any[];
  customActivityTypes: any[];
  customAreas: string[];
  handovers: any[];
  lowStockCount: number;
  loading: boolean;
  // Metrics
  tasksByArea: any[];
  weeklyTaskTrend: any[];
  completionStatus: any[];
  projectedWorkload?: any[];
  taskEfficiency?: any[];
  staffProductivity?: any[];
  taskTypeDistribution?: any[];
  completionComplianceData?: any[];
  // etc
}

export const useDashboardMetrics = (currentUid: string | null): DashboardMetrics => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [customActivityTypes, setCustomActivityTypes] = useState<any[]>([]);
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUid) {
      setLoading(false);
      return;
    }

    const t = setTimeout(() => setLoading(false), 3000);

    const unsubTasks = onSnapshot(query(collection(db, `users/${currentUid}/tasks`)), (snapshot) => {
      setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, () => {});

    const unsubActs = onSnapshot(query(collection(db, `users/${currentUid}/activities`)), (snapshot) => {
      setActivities(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, () => setLoading(false));

    const unsubIncidents = onSnapshot(query(collection(db, `users/${currentUid}/incidents`)), (snapshot) => {
      setIncidents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, () => {});

    getDocs(query(collection(db, `users/${currentUid}/activityTypes`))).then((snapshot) => {
      setCustomActivityTypes(snapshot.docs.map((doc) => ({ id: doc.id, label: doc.data().label })));
    }).catch(() => {});

    const unsubInv = onSnapshot(query(collection(db, `users/${currentUid}/inventory`)), (snapshot) => {
      let lowCount = 0;
      snapshot.forEach(doc => {
        if (doc.data().currentStock <= doc.data().minThreshold) lowCount++;
      });
      setLowStockCount(lowCount);
    }, () => {});

    getDocs(query(collection(db, `users/${currentUid}/areas`))).then((snapshot) => {
      setCustomAreas(snapshot.docs.map((doc) => doc.data().name as string));
    }).catch(() => {});

    const unsubHandovers = onSnapshot(query(collection(db, `users/${currentUid}/handovers`)), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setHandovers(fetched);
    }, () => {});

    return () => {
      clearTimeout(t);
      unsubTasks();
      unsubActs();
      unsubIncidents();
      unsubInv();
      unsubHandovers();
    };
  }, [currentUid]);

  // Derived metrics
  const tasksByArea = useMemo(() => {
    // Process tasks by location
    const defaultAreas = ["All Areas", "Water Treatment Plant", "General Yard", "Pavia Reservoir", "Jaro Reservoir"];
    const allAreas = Array.from(new Set([...defaultAreas, ...customAreas]));
    
    return allAreas.map(area => {
      const areaTasks = tasks.filter((t) => {
        if (area === "All Areas") return true;
        const locs = (t.location || "").toLowerCase().split(',').map((s: string) => s.trim());
        return locs.includes(area.toLowerCase());
      });
      const overdueTasks = areaTasks.filter((t) => {
        if (t.status === "completed") return false;
        if (!t.deadline || t.deadline === "No deadline") return false;
        const dt = new Date(t.deadline);
        if (isNaN(dt.getTime())) return false;
        return dt < new Date();
      });
      
      const statusCounts = areaTasks.reduce((acc, t) => {
        acc[t.status || 'pending'] = (acc[t.status || 'pending'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        name: area,
        done: statusCounts['completed'] || 0,
        inProgress: statusCounts['in-progress'] || 0,
        pending: statusCounts['pending'] || 0,
        total: areaTasks.length,
        overdue: overdueTasks.length
      };
    }).filter(a => a.name !== "All Areas" && a.total > 0).slice(0, 10);
  }, [tasks, customAreas]);

  const weeklyTaskTrend = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    return Array.from({length: 7}).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dayName = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => {
        if (!t.completedAt) return false;
        return t.completedAt.startsWith(dateStr) || (t.updatedAt && new Date(t.updatedAt).toISOString().startsWith(dateStr));
      });
      
      const dayActs = activities.filter(a => {
        if (!a.timestamp) return false;
        return typeof a.timestamp === 'string' ? a.timestamp.startsWith(dateStr) : new Date(a.timestamp.toMillis()).toISOString().startsWith(dateStr);
      });
      
      return {
        name: dayName,
        tasks: dayTasks.length,
        activities: dayActs.length,
        total: dayTasks.length + dayActs.length
      };
    });
  }, [tasks, activities]);

  // Completion Status
  const completionStatus = useMemo(() => {
    if (tasks.length === 0) return [{name: 'Empty', value: 1}];
    const done = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProg = tasks.filter(t => t.status === 'in-progress').length;
    return [
      { name: 'Completed', value: done, fill: '#22C55E' },
      { name: 'In-Progress', value: inProg, fill: '#60A5FA' },
      { name: 'Pending', value: pending, fill: '#FCD34D' }
    ].filter(i => i.value > 0);
  }, [tasks]);

  const projectedWorkload = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    return Array.from({length: 7}).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dayName = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      
      const dayWorkload = tasks.filter(t => {
        if (!t.deadline) return false;
        return t.deadline.startsWith(dateStr);
      });
      
      return {
        name: dayName,
        workload: dayWorkload.length,
        capacity: 10 // Mock capacity
      };
    });
  }, [tasks]);

  const staffProductivity = useMemo(() => {
    const rawData = [
      { name: "John Doe", count: 42 },
      { name: "Jane Smith", count: 38 },
      { name: "Mike Johnson", count: 35 },
      { name: "Sarah Williams", count: 28 },
      { name: "Robert Brown", count: 25 },
    ];
    if (activities.length > 0) {
      const counts: Record<string, number> = {};
      activities.forEach(a => {
        (a.staff || []).forEach((s: string) => {
          const name = s.trim();
          counts[name] = (counts[name] || 0) + 1;
        });
      });
      const realData = Object.keys(counts).map(name => ({ name, count: counts[name] }));
      realData.sort((a,b) => b.count - a.count);
      if (realData.length > 0) return realData.slice(0, 5);
    }
    return rawData;
  }, [activities]);

  const taskTypeDistribution = useMemo(() => {
    const rawData = [
      { name: "Mon", cust: 2, stand: 1, svc: 3, main: 1 },
      { name: "Tue", cust: 1, stand: 2, svc: 2, main: 0 },
      { name: "Wed", cust: 3, stand: 1, svc: 1, main: 2 },
      { name: "Thu", cust: 0, stand: 3, svc: 4, main: 1 },
      { name: "Fri", cust: 2, stand: 2, svc: 2, main: 3 },
      { name: "Sat", cust: 1, stand: 1, svc: 0, main: 1 },
      { name: "Sun", cust: 0, stand: 0, svc: 1, main: 0 }
    ];
    
    // We try to use tasks for distribution
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    if (tasks.length > 0) {
      return Array.from({length: 7}).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const dayName = days[d.getDay()];
        const dateStr = d.toISOString().split('T')[0];
        
        const dayTasks = tasks.filter(t => {
          if (!t.createdAt) return false;
          const taskDate = t.createdAt?.toMillis ? new Date(t.createdAt.toMillis()).toISOString().split('T')[0] : t.createdAt.split('T')[0];
          return taskDate === dateStr;
        });
        
        return {
          name: dayName,
          cust: dayTasks.filter(t => (t.type || '').includes('cust')).length,
          stand: dayTasks.filter(t => (t.type || '').includes('stand')).length,
          svc: dayTasks.filter(t => (t.type || '').includes('svc')).length,
          main: dayTasks.filter(t => (t.type || '').includes('main')).length
        };
      });
    }
    return rawData;
  }, [tasks]);

  const completionComplianceData = useMemo(() => {
    const defaultVal = 92;
    if (tasks.length > 0) {
      const completed = tasks.filter(t => t.status === 'completed').length;
      const val = Math.round((completed / tasks.length) * 100);
      return [{ name: "Compliance", value: val || 0, fill: val > 80 ? "#22C55E" : "#FCD34D" }];
    }
    return [{ name: "Compliance", value: defaultVal, fill: "#22C55E" }];
  }, [tasks]);

  const taskEfficiency = useMemo(() => {
    const defaultData = [
      { name: 'Leak Repair (PR2)', actual: 5.2, expected: 2.5 },
      { name: 'Leak Repair (Other)', actual: 3.1, expected: 3.0 },
      { name: 'Meter Swap (Zone A)', actual: 1.4, expected: 1.5 },
      { name: 'Chlorination (All)', actual: 4.8, expected: 4.0 },
      { name: 'Inspection (Zone B)', actual: 1.2, expected: 1.0 },
    ];
    
    // Process real tasks if available
    const completedTasksWithEstimates = tasks.filter(t => t.status === 'completed' && t.estimatedHours && t.completedAt && t.createdAt);
    if (completedTasksWithEstimates.length > 0) {
      // Group by title
      const groups = completedTasksWithEstimates.reduce((acc, t) => {
        const title = t.title || 'Unknown';
        if (!acc[title]) acc[title] = { actualSum: 0, expectedSum: 0, count: 0 };
        
        // Calculate actual hours
        const created = t.createdAt?.toMillis ? t.createdAt.toMillis() : new Date(t.createdAt).getTime();
        const completed = new Date(t.completedAt).getTime();
        const actualHours = (completed - created) / (1000 * 60 * 60);

        acc[title].actualSum += actualHours;
        acc[title].expectedSum += t.estimatedHours;
        acc[title].count++;
        return acc;
      }, {} as Record<string, { actualSum: number, expectedSum: number, count: number }>);
      
      const realData = Object.keys(groups).map(title => ({
        name: title,
        actual: Number((groups[title].actualSum / groups[title].count).toFixed(1)),
        expected: Number((groups[title].expectedSum / groups[title].count).toFixed(1))
      })).slice(0, 5);
      
      if (realData.length >= 2) return realData;
    }
    
    return defaultData;
  }, [tasks]);

  return {
    tasks,
    activities,
    incidents,
    customActivityTypes,
    customAreas,
    handovers,
    lowStockCount,
    loading,
    tasksByArea,
    weeklyTaskTrend,
    completionStatus,
    projectedWorkload,
    taskEfficiency,
    staffProductivity,
    taskTypeDistribution,
    completionComplianceData
  };
};
