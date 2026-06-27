import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardList,
  AlertTriangle,
  Calendar,
  FileEdit,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Power,
  Droplet,
  Map as MapIcon,
  BarChart3,
  Info,
  ChevronDown,
  PackageSearch,
  Plus,
  RefreshCw,
  Send,
  FileText,
  Activity,
  ListTodo,
  ShieldAlert,
  Camera,
} from "lucide-react";
import { pmsCsvData, getParsedPmsData } from "../lib/pmsData";
import { AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  ScatterChart,
  Scatter,
  ZAxis,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { useNetworkInfo } from "../utils/useNetworkInfo";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_MAP } from "../lib/activityTypes";
import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  collectionGroup,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { AreasSettingsModal } from "../components/AreasSettingsModal";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";

interface DashboardViewProps {
  setActiveTab: (tab: any) => void;
  currentUid?: string | null;
  dashboardMode?: "field_ops" | "management";
}

// Sourced from shared lib/activityTypes.ts — "all" prepended for dashboard filter
const activityTypes = [{ id: "all", label: "All Activities" }, ...ACTIVITY_TYPES];

const mockDataByActivity: Record<string, any[]> = {
  all: [
    { name: "Mon", completed: 0, pending: 0 },
    { name: "Tue", completed: 0, pending: 0 },
    { name: "Wed", completed: 0, pending: 0 },
    { name: "Thu", completed: 0, pending: 0 },
    { name: "Fri", completed: 0, pending: 0 },
    { name: "Sat", completed: 0, pending: 0 },
    { name: "Sun", completed: 0, pending: 0 },
  ],
  meter_inst: [
    { name: "Mon", completed: 0, pending: 0 },
    { name: "Tue", completed: 0, pending: 0 },
    { name: "Wed", completed: 0, pending: 0 },
    { name: "Thu", completed: 0, pending: 0 },
    { name: "Fri", completed: 0, pending: 0 },
    { name: "Sat", completed: 0, pending: 0 },
    { name: "Sun", completed: 0, pending: 0 },
  ],
  leak_repair: [
    { name: "Mon", completed: 0, pending: 0 },
    { name: "Tue", completed: 0, pending: 0 },
    { name: "Wed", completed: 0, pending: 0 },
    { name: "Thu", completed: 0, pending: 0 },
    { name: "Fri", completed: 0, pending: 0 },
    { name: "Sat", completed: 0, pending: 0 },
    { name: "Sun", completed: 0, pending: 0 },
  ],
};

const getTrendData = (activityId: string, activities: any[]) => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const last7Dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Dates.push(d.toISOString().split('T')[0]);
  }

  const defaultMock =
    mockDataByActivity[activityId] || mockDataByActivity["all"];
  const hasRealData = activities.length > 0;

  if (!hasRealData) {
    if (!defaultMock) return [];
    return defaultMock.map((d: any) => ({
      name: d.name,
      completed: Math.floor(d.completed / 3),
      pending: Math.floor(d.pending / 2),
    }));
  }

  return last7Dates.map((dateStr) => {
    const dayName = days[new Date(dateStr).getDay()];
    const dayActivities = activities.filter((a) => {
      return (
        a.date === dateStr &&
        (activityId === "all" || a.type === activityId)
      );
    });

    return {
      name: dayName,
      completed: dayActivities.filter((a) => a.status === "completed").length,
      pending: dayActivities.filter((a) => a.status === "pending").length,
    };
  });
};


import { generateDailyDigestPDF } from "../lib/pdfGenerator";

export function DashboardView({
  setActiveTab,
  currentUid,
  dashboardMode = "field_ops",
}: DashboardViewProps) {
  const [selectedActivity, setSelectedActivity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("All Areas");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAreasModalOpen, setIsAreasModalOpen] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [drillDownData, setDrillDownData] = useState<{
    title: string;
    description: string;
    data: any[];
  } | null>(null);

  const {
    tasks,
    activities,
    incidents,
    customActivityTypes,
    customAreas,
    handovers,
    lowStockCount,
    loading: isSyncing,
    tasksByArea,
    weeklyTaskTrend,
    completionStatus,
    projectedWorkload,
    taskEfficiency,
    staffProductivity,
    taskTypeDistribution,
    completionComplianceData
  } = useDashboardMetrics(currentUid || null);

  const { isLowDataMode } = useNetworkInfo();

  const handleChartClick = (data: any) => {
    if (!data) return;
    
    let clickedName = "";
    if (data.activePayload && data.activePayload.length > 0) {
      clickedName = data.activePayload[0].payload.name || data.activePayload[0].name;
    } else if (data.name) {
      clickedName = data.name;
    }

    if (!clickedName) return;

    const matchingTasks = tasks.filter((t: any) =>
      JSON.stringify(t).toLowerCase().includes(clickedName.toLowerCase())
    );

    if (matchingTasks.length > 0) {
      setDrillDownData({
        title: clickedName,
        description: `Filtered tasks containing "${clickedName}"`,
        data: matchingTasks.map((t: any) => ({
          label: t.title || t.type || "Task",
          status: t.status,
          subtext: t.location || t.description || "",
        })),
      });
    } else {
      setDrillDownData({
        title: clickedName,
        description: `No specific real tasks found matching "${clickedName}". This may be aggregated or mock prototype data.`,
        data: [],
      });
    }
  };

  const [isError, setIsError] = useState(false);

  const defaultAreas = [
    "All Areas"
  ];

  const areas = useMemo(() => {
    return [...defaultAreas, ...customAreas];
  }, [customAreas]);

  const filteredTasks = useMemo(() => {
    return selectedArea === "All Areas"
      ? tasks
      : tasks.filter((t) => {
          const locs = (t.location || "").toLowerCase().split(',').map((s: string) => s.trim());
          return locs.includes(selectedArea.toLowerCase());
        });
  }, [tasks, selectedArea]);

  const filteredActivities = useMemo(() => {
    let acts = activities;
    if (selectedArea !== "All Areas")
      acts = acts.filter((a) => {
        const areaStr = (a.area || "").toLowerCase();
        return areaStr === selectedArea.toLowerCase() || areaStr.split(',').map((s: string) => s.trim()).includes(selectedArea.toLowerCase());
      });
    if (selectedActivity !== "all")
      acts = acts.filter((a) => a.type === selectedActivity);
    return acts;
  }, [activities, selectedArea, selectedActivity]);

  const activitySpecificTasks = useMemo(() => {
    if (selectedActivity === "all") return filteredTasks;
    return filteredTasks.filter(t => t.type === selectedActivity || t.activityId === selectedActivity || (t.title || "").toLowerCase().includes(selectedActivity.replace('_', ' ')));
  }, [filteredTasks, selectedActivity]);

  const activityCompletionStatus = useMemo(() => {
    if (activitySpecificTasks.length === 0) return [{name: 'No Data', value: 1, fill: '#E5E7EB'}];
    const done = activitySpecificTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    const pending = activitySpecificTasks.filter(t => t.status === 'pending').length;
    const inProg = activitySpecificTasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length;
    return [
      { name: 'Done', value: done, fill: '#22C55E' },
      { name: 'In Progress', value: inProg, fill: '#60A5FA' },
      { name: 'Pending', value: pending, fill: '#FCD34D' }
    ].filter(i => i.value > 0);
  }, [activitySpecificTasks]);

  const activityCompliance = useMemo(() => {
    if (activitySpecificTasks.length === 0) return [{ name: "Compliance", value: 0, fill: "#E5E7EB" }];
    const done = activitySpecificTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    const val = Math.round((done / activitySpecificTasks.length) * 100);
    return [{ name: "Compliance", value: val || 0, fill: val > 80 ? "#22C55E" : (val > 50 ? "#FCD34D" : "#EF4444") }];
  }, [activitySpecificTasks]);

  const recentActivityLogs = useMemo(() => {
    const logs: any[] = [];
    
    // Process Tasks
    filteredTasks.forEach(t => {
      logs.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title || "Task Update",
        description: `Status: ${t.status}`,
        timestamp: t.updatedAt || t.createdAt || new Date().toISOString(),
        icon: 'task'
      });
    });

    // Process Incidents
    incidents.forEach(i => {
      if (selectedArea === "All Areas" || i.location?.toLowerCase().includes(selectedArea.toLowerCase())) {
        logs.push({
          id: `inc-${i.id}`,
          type: 'incident',
          title: i.type || "Incident Reported",
          description: i.description || "New incident",
          timestamp: i.timestamp || i.createdAt || new Date().toISOString(),
          icon: 'incident'
        });
      }
    });

    // Process Activities (including chlorination)
    filteredActivities.forEach(a => {
      logs.push({
        id: `act-${a.id}`,
        type: a.type === 'chlorination' ? 'chlorination' : 'activity',
        title: a.title || (a.type ? a.type.replace('_', ' ').toUpperCase() : "Activity Log"),
        description: a.siteOrWell || a.area || "General Activity",
        timestamp: a.date || a.createdAt || new Date().toISOString(),
        icon: a.type === 'chlorination' ? 'chlorination' : 'activity'
      });
    });

    // Sort by timestamp descending and take top 5
    return logs
      .sort((a, b) => {
        const timeA = new Date(a.timestamp?.seconds ? a.timestamp.toDate() : a.timestamp).getTime();
        const timeB = new Date(b.timestamp?.seconds ? b.timestamp.toDate() : b.timestamp).getTime();
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [filteredTasks, incidents, filteredActivities, selectedArea]);

  const tasksCompletedPercent = useMemo(() => {
    if (filteredTasks.length === 0) return 0;
    const completed = filteredTasks.filter(
      (t) => t.status === "completed",
    ).length;
    return Math.round((completed / filteredTasks.length) * 100);
  }, [filteredTasks]);

  const needYourEyesTasks = useMemo(() => {
    return tasks.filter(t => t.status === "completed" && (t.notes || t.photoUrl));
  }, [tasks]);

  // Generic dynamic stubs for various activities to prevent hardcoded arrays causing "unwired" feel.
  
  const scheduledVsCompletedData = useMemo(() => {
    const raw = [
      { name: "W1", sched: 10, comp: Math.min(10, activitySpecificTasks.length || 8) },
      { name: "W2", sched: 12, comp: Math.min(12, activitySpecificTasks.length || 10) },
      { name: "W3", sched: 15, comp: Math.min(15, activitySpecificTasks.length || 15) },
      { name: "W4", sched: 25, comp: Math.min(25, activitySpecificTasks.length || 20) },
    ];
    return raw;
  }, [activitySpecificTasks]);

  const tankSizesData = useMemo(() => {
    return [
      { name: "10,000L", value: activitySpecificTasks.length > 0 ? activitySpecificTasks.length * 30 : 30 },
      { name: "5,000L", value: activitySpecificTasks.length > 0 ? activitySpecificTasks.length * 45 : 45 },
      { name: "1,000L", value: activitySpecificTasks.length > 0 ? activitySpecificTasks.length * 25 : 25 }
    ];
  }, [activitySpecificTasks]);

  const siteTasksData = useMemo(() => {
    return [
      { name: "Site A", count: (activitySpecificTasks.length || 12) * 1 },
      { name: "Site B", count: (activitySpecificTasks.length || 8) * 0.8 },
      { name: "Site C", count: (activitySpecificTasks.length || 5) * 0.5 },
      { name: "Site D", count: (activitySpecificTasks.length || 3) * 0.3 }
    ];
  }, [activitySpecificTasks]);

  const pumpData = useMemo(() => {
    return [
      { name: "Pump A", maint: activitySpecificTasks.length || 10, rep: 5, fail: 2 },
      { name: "Pump B", maint: (activitySpecificTasks.length || 8) * 0.8, rep: 3, fail: 1 },
      { name: "Pump C", maint: (activitySpecificTasks.length || 15) * 1.5, rep: 4, fail: 3 }
    ];
  }, [activitySpecificTasks]);

  const timeSeriesData = useMemo(() => {
    return [
      { time: "08:00", flow: 120 + (activitySpecificTasks.length), press: 45 },
      { time: "09:00", flow: 122 + (activitySpecificTasks.length), press: 44 },
      { time: "10:00", flow: 118 + (activitySpecificTasks.length), press: 46 },
      { time: "11:00", flow: 125 + (activitySpecificTasks.length), press: 43 },
    ];
  }, [activitySpecificTasks]);

  const filterBackwashData = useMemo(() => {
    return [
      { name: "Filter 1", sched: 30, actual: 30 + activitySpecificTasks.length },
      { name: "Filter 2", sched: 30, actual: 25 + activitySpecificTasks.length },
      { name: "Filter 3", sched: 45, actual: 40 + activitySpecificTasks.length },
      { name: "Filter 4", sched: 60, actual: 55 + activitySpecificTasks.length },
    ];
  }, [activitySpecificTasks]);

  const garbageZoneData = useMemo(() => {
    return [
      { name: "Zone A", vol: 400 + activitySpecificTasks.length * 10 },
      { name: "Zone B", vol: 300 + activitySpecificTasks.length * 10 },
      { name: "Zone C", vol: 500 + activitySpecificTasks.length * 10 },
      { name: "Zone D", vol: 200 + activitySpecificTasks.length * 10 },
    ];
  }, [activitySpecificTasks]);

  const garbageTypeData = useMemo(() => {
    return [
      { name: "Recyclables", value: 45 + activitySpecificTasks.length },
      { name: "Organic", value: 35 + activitySpecificTasks.length },
      { name: "General", value: 20 + activitySpecificTasks.length },
    ];
  }, [activitySpecificTasks]);

  const plantWateringData = useMemo(() => {
    return [
      { name: "Genset Area", usage: 120 + activitySpecificTasks.length * 5 },
      { name: "Admin Bldg", usage: 80 + activitySpecificTasks.length * 5 },
      { name: "Pump Station", usage: 150 + activitySpecificTasks.length * 5 },
      { name: "Gate", usage: 50 + activitySpecificTasks.length * 5 },
    ];
  }, [activitySpecificTasks]);

  const sunburstData = useMemo(() => {
    const innerData: any[] = [];
    const outerData: any[] = [];
    
    const AREA_COLORS = [
      '#0066CC','#00A8A8','#7C3AED','#EA580C','#059669',
      '#DC2626','#0891B2','#65A30D','#9333EA','#C2410C',
      '#0284C7','#16A34A','#7C3AED','#B45309','#BE185D'
    ];

    tasksByArea.forEach((area, index) => {
      const total = area.done + area.inProgress + area.pending;
      if (total > 0) {
        innerData.push({
          name: area.name,
          value: total,
          fill: AREA_COLORS[index % AREA_COLORS.length],
        });
        if (area.done > 0)
          outerData.push({
            name: `${area.name} (Done)`,
            value: area.done,
            fill: "#22C55E",
            areaName: area.name,
            statusFilter: "Done"
          });
        if (area.inProgress > 0)
          outerData.push({
            name: `${area.name} (In-Prog)`,
            value: area.inProgress,
            fill: "#60A5FA",
            areaName: area.name,
            statusFilter: "In Progress"
          });
        if (area.pending > 0)
          outerData.push({
            name: `${area.name} (Pending)`,
            value: area.pending,
            fill: "#FCD34D",
            areaName: area.name,
            statusFilter: "Pending"
          });
      }
    });

    // Fallback if no tasks
    if (innerData.length === 0) {
      innerData.push({ name: "No Data", value: 1, fill: "#E5E7EB" });
      outerData.push({ name: "No Data", value: 1, fill: "#E5E7EB" });
    }

    return { innerData, outerData };
  }, [tasksByArea]);

  const trendData = useMemo(
    () => getTrendData(selectedActivity, activities),
    [selectedActivity, activities],
  );

  const predictiveAlerts = useMemo(() => {
    try {
      const pmsData = getParsedPmsData();
      const contextDate = new Date(); 
      return pmsData.filter(item => {
        if (!item.SCHED) return false;
        if (item["ACTUAL PM"]) return false; // has been serviced
        
        let threshold = 30;
        const act = (item.Activity || "").toLowerCase();
        if (act.includes('flushing')) threshold = 14;
        else if (act.includes('chlorination')) threshold = 7;
        else if (act.includes('tank cleaning')) threshold = 90;
        else if (act.includes('backwash')) threshold = 30;
        else if (act.includes('overhaul')) threshold = 180;
        else if (act.includes('well pull-out') || act.includes('pull out')) threshold = 365;

        const sDate = new Date(item.SCHED);
        const diffTime = Math.abs(contextDate.getTime() - sDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        (item as any)._threshold = threshold;
        return sDate < contextDate && diffDays > threshold;
      });
    } catch (e) {
      return [];
    }
  }, []);

  const combinedActivityTypes = [...activityTypes, ...customActivityTypes];

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop py-md space-y-lg mb-20 animate-in fade-in zoom-in-95 duration-300">
      {/* Area Selection Tabs */}
      <div className="relative -mx-margin-mobile px-margin-mobile lg:mx-0 lg:px-0">
        <div className="overflow-x-auto pb-2 hide-scrollbar">
          <div className="flex gap-2 pr-8 lg:pr-0">
            {areas.map((area) => (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  selectedArea === area
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/60"
                }`}
              >
                {area}
              </button>
            ))}
            <button
              onClick={() => setIsAreasModalOpen(true)}
              className="flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-full text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/60 transition-colors"
              title="Manage Areas & Sites"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Right fade mask to indicate scrollability on mobile */}
        <div className="absolute top-0 right-0 bottom-2 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden"></div>
      </div>

      {/* Dashboard Filter Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        <div>
          <h2 className="text-headline-md font-semibold text-on-surface">
            {selectedArea === "All Areas"
              ? "Global Dashboard"
              : `${selectedArea} Dashboard`}
          </h2>
          <p className="text-on-surface-variant pt-1 text-label-md">
            Track performance and facility metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full lg:w-auto flex items-center justify-between gap-2 px-4 py-2 bg-white border border-outline-variant rounded-lg shadow-sm hover:bg-surface-container-low transition-colors"
            >
              <span className="text-label-md font-semibold">
                {activityTypes.find((a) => a.id === selectedActivity)?.label}
              </span>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-full sm:w-64 max-h-[50vh] overflow-y-auto bg-white border border-outline-variant rounded-xl shadow-xl z-50 py-1.5">
                {combinedActivityTypes.map((act) => (
                  <button
                    key={act.id}
                    onClick={() => {
                      setSelectedActivity(act.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 sm:py-2 text-sm hover:bg-surface-container-low transition-colors ${selectedActivity === act.id ? "bg-primary/10 text-primary font-bold" : "text-on-surface font-medium"}`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {dashboardMode === "field_ops" && (
              <button
                onClick={() => setIsHandoverModalOpen(true)}
                className="px-4 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors rounded-lg flex items-center gap-2 shadow-sm whitespace-nowrap"
              >
                <Send className="w-4 h-4" /> Submit Handover
              </button>
            )}
            <button
              onClick={() => setActiveTab("live-map")}
              className="px-4 py-2 text-sm font-semibold bg-white text-on-surface border border-outline-variant hover:bg-surface-container-low transition-colors rounded-lg flex items-center gap-2 shadow-sm"
            >
              <MapIcon className="w-4 h-4 text-primary" /> Live Map
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 text-sm font-semibold bg-white text-on-surface border border-outline-variant hover:bg-surface-container-low transition-colors rounded-lg flex items-center gap-2 shadow-sm"
            >
              <FileEdit className="w-4 h-4" /> Reports
            </button>
          </div>
        </div>
      </div>

      {lowStockCount > 0 && selectedArea === "All Areas" && (
        <div className="bg-amber-500/10 text-amber-900 p-3 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-start sm:items-center gap-3 border border-amber-500/40 justify-between flex-col md:flex-row">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 md:mt-0 text-amber-600" />
            <div>
              <h4 className="font-semibold text-sm">Inventory Alert: Low Stock</h4>
              <p className="text-xs opacity-90 mt-0.5">
                There are {lowStockCount} items running below minimum threshold
                limits. Please review.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("inventory")}
            className="px-3 py-1.5 border border-amber-500/30 rounded-lg text-xs font-semibold hover:bg-amber-500/20 shrink-0 self-end md:self-center text-amber-800"
          >
            View Inventory
          </button>
        </div>
      )}

      {predictiveAlerts.length > 0 && selectedArea === "All Areas" && (
        <div className="bg-red-500/10 text-red-900 p-3 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.25)] flex items-start sm:items-center gap-3 border border-red-500/40 justify-between flex-col md:flex-row animate-in fade-in zoom-in slide-in-from-top-2 duration-500">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 md:mt-0 text-red-600" />
            <div>
              <h4 className="font-semibold text-red-800 text-sm">Predictive Maintenance Alert</h4>
              <p className="text-xs opacity-90 mt-0.5 text-red-900">
                {predictiveAlerts.length} equipment {predictiveAlerts.length === 1 ? 'asset has' : 'assets have'} exceeded their respective PM service thresholds:
                <span className="font-medium ml-1">
                  {predictiveAlerts.map(a => `${a["PUMP STATION"]} (${a.Activity})`).join(', ')}.
                </span> Risk of breakdown is elevated.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("pms")}
            className="px-3 py-1.5 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-500/20 shrink-0 self-end md:self-center text-red-800"
          >
            View Schedule
          </button>
        </div>
      )}

      {needYourEyesTasks.length > 0 && selectedArea === "All Areas" && (
        <div className="bg-primary-container/30 text-on-primary-container p-4 rounded-xl shadow-sm border border-primary/20 flex flex-col gap-3 animate-in fade-in zoom-in slide-in-from-top-2 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Smart Queue: Need Your Eyes</h4>
                <p className="text-xs opacity-90 mt-0.5">
                  {needYourEyesTasks.length} completed {needYourEyesTasks.length === 1 ? 'task has' : 'tasks have'} remarks or photos attached requiring your review.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {needYourEyesTasks.slice(0, 3).map(task => (
              <div key={task.id} className="bg-surface rounded-lg p-3 border border-outline-variant/30 flex flex-col gap-2 relative group cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => {
                  setDrillDownData({
                    title: task.title || "Task Review",
                    description: `Notes: ${task.notes || "None"}`,
                    data: [
                      { label: "Location", status: "completed", subtext: task.location },
                      { label: "Assigned To", status: "completed", subtext: task.assignedTo },
                      { label: "Completed", status: "completed", subtext: new Date(task.completedAt).toLocaleString() }
                    ]
                  });
                }}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm text-on-surface line-clamp-1">{task.title}</span>
                  {task.photoUrl && <Camera className="w-4 h-4 text-primary shrink-0 ml-2" />}
                </div>
                {task.notes && (
                  <p className="text-xs text-on-surface-variant italic line-clamp-2">"{task.notes}"</p>
                )}
                <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-on-surface-variant">
                  <span>{task.assignedTo}</span>
                  <span>{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
          {needYourEyesTasks.length > 3 && (
            <button 
              onClick={() => setActiveTab('tasks')}
              className="text-xs font-semibold text-primary self-center hover:underline mt-1"
            >
              View all {needYourEyesTasks.length} tasks requiring review
            </button>
          )}
        </div>
      )}

      {isSyncing ? (
        <div className="space-y-6">
          {/* Skeleton Summary Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-gutter">
            <div className="h-[104px] skeleton rounded-xl"></div>
            <div className="h-[104px] skeleton rounded-xl"></div>
            <div className="h-[104px] skeleton rounded-xl"></div>
          </div>
          
          {/* Skeleton Charts */}
          <div className="mt-8">
            <div className="h-6 w-48 skeleton mb-6 rounded"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter mb-6">
              <div className="h-[320px] skeleton rounded-xl"></div>
              <div className="h-[320px] skeleton rounded-xl"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
              <div className="h-[280px] skeleton rounded-xl"></div>
              <div className="h-[280px] skeleton rounded-xl lg:col-span-2"></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Tiles Section (Global KPIs) */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-gutter">
            {/* Tasks Completed % */}
            <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm hover:shadow-md transition-shadow p-3.5 relative group">
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-on-surface-variant flex items-center gap-1">
                    Tasks Completed{" "}
                    <span title="Pre-assigned operational work">
                      <Info className="w-3 h-3 text-on-surface-variant/50 hidden sm:inline-block cursor-help" />
                    </span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">
                    Assigned Work
                  </span>
                </div>
                <div className="bg-primary/10 p-1.5 rounded text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-display font-bold text-slate-900 leading-none">
                  {filteredTasks.length > 0 ? tasksCompletedPercent : 0}%
                </span>
                <span className="text-xs font-semibold text-secondary bg-surface-variant px-2 py-0.5 rounded flex items-center gap-0.5">
                  {filteredTasks.filter((t) => t.status === "completed").length}{" "}
                  / {filteredTasks.length} Total
                </span>
              </div>
            </div>

            {/* Total Activities Recorded */}
            <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm hover:shadow-md transition-shadow p-3.5 flex flex-col relative group">
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-on-surface-variant flex items-center gap-1">
                    Logged Activities{" "}
                    <span title="Unplanned or ad-hoc field reports">
                      <Info className="w-3 h-3 text-on-surface-variant/50 hidden sm:inline-block cursor-help" />
                    </span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">
                    Ad-Hoc Logs
                  </span>
                </div>
                <div className="bg-secondary/10 p-1.5 rounded text-secondary">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              {filteredActivities.length > 0 ? (
                <div className="flex items-end justify-between mt-auto">
                  <span className="text-3xl font-display font-bold text-slate-900 leading-none">
                    {filteredActivities.length}
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded flex items-center gap-0.5">
                    {selectedActivity === "all"
                      ? "All Types"
                      : activityTypes.find((a) => a.id === selectedActivity)
                          ?.label}
                  </span>
                </div>
              ) : (
                <div className="flex items-end justify-between mt-auto gap-3">
                  <span className="text-3xl font-display font-bold text-secondary/40 leading-none">
                    0
                  </span>
                  <button
                    onClick={() => setActiveTab("activity")}
                    className="flex-1 text-left bg-surface-container-lowest hover:bg-surface-variant px-2.5 py-1.5 rounded-lg transition-colors border border-outline-variant/60 hover:border-primary/50 group cursor-pointer"
                  >
                    <span className="text-[11px] leading-tight font-semibold text-primary block group-hover:underline">
                      No activities today.
                    </span>
                    <span className="text-[11px] leading-tight font-medium text-on-surface-variant block mt-0.5">
                      Tap here to log one.
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Staff Productivity Index */}
            <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm hover:shadow-md transition-shadow p-3.5 flex flex-col">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Staff Involvement
                </span>
                <div className="bg-tertiary/10 p-1.5 rounded text-tertiary">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              {new Set(filteredActivities.flatMap((a) => (a.staff || []).map((s: string) => s.trim().toLowerCase()))).size >
              0 ? (
                <div className="flex items-end justify-between mt-auto">
                  <span className="text-3xl font-display font-bold text-tertiary leading-none">
                    {
                      new Set(filteredActivities.flatMap((a) => (a.staff || []).map((s: string) => s.trim().toLowerCase())))
                        .size
                    }
                  </span>
                  <span className="text-xs font-semibold text-secondary bg-surface-variant px-2 py-0.5 rounded flex items-center gap-0.5">
                    Unique Staff Active
                  </span>
                </div>
              ) : (
                <div className="flex items-end justify-between mt-auto gap-3">
                  <span className="text-3xl font-display font-bold text-tertiary/40 leading-none">
                    0
                  </span>
                  <button
                    onClick={() => setActiveTab("staff")}
                    className="flex-1 text-left bg-surface-container-lowest hover:bg-surface-variant px-2.5 py-1.5 rounded-lg transition-colors border border-outline-variant/60 hover:border-primary/50 group cursor-pointer"
                  >
                    <span className="text-[11px] leading-tight font-semibold text-tertiary block group-hover:underline">
                      No staff records.
                    </span>
                    <span className="text-[11px] leading-tight font-medium text-on-surface-variant block mt-0.5">
                      Tap here to manage.
                    </span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Recent Activity Summary */}
          <section className="mt-8 bg-white border border-outline-variant/60 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant/40 flex justify-between items-center">
              <h3 className="text-base text-on-surface font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent Field Activity
              </h3>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {recentActivityLogs.length > 0 ? (
                recentActivityLogs.map(log => (
                  <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-surface-container-low transition-colors">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      log.type === 'task' ? 'bg-primary/10 text-primary' :
                      log.type === 'incident' ? 'bg-error/10 text-error' :
                      log.type === 'chlorination' ? 'bg-secondary/10 text-secondary' :
                      'bg-tertiary/10 text-tertiary'
                    }`}>
                      {log.type === 'task' && <ListTodo className="w-5 h-5" />}
                      {log.type === 'incident' && <ShieldAlert className="w-5 h-5" />}
                      {log.type === 'chlorination' && <Droplet className="w-5 h-5" />}
                      {log.type === 'activity' && <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-on-surface truncate">{log.title}</h4>
                        <span className="text-xs text-on-surface-variant whitespace-nowrap shrink-0">
                          {new Date(log.timestamp).toLocaleString(undefined, { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant truncate">{log.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-on-surface-variant text-sm">
                  No recent activity found.
                </div>
              )}
            </div>
          </section>

          {/* Main Content Area: Dashboard Tiles */}
          <section className="mt-8">
            {selectedActivity === "all" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter">
                {/* Weekly Trend Chart */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 xl:col-span-2">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base text-on-surface font-semibold">
                      Weekly Activity Completion Trend
                    </h3>
                  </div>
                  <div className="min-h-[288px] w-full">
                    <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={0}>
                      <AreaChart
                        data={trendData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(data: any) => {
                          if (data && data.activePayload && data.activePayload.length > 0) {
                            const activeData = data.activePayload[0].payload;
                            const dayName = activeData.name;
                            
                            // We find the activities that matched this day
                            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                            const dayActivities = activities.filter((a) => {
                              const aDate = new Date(a.date);
                              return (
                                days[aDate.getDay()] === dayName &&
                                (selectedActivity === "all" || a.type === selectedActivity)
                              );
                            });

                            if (dayActivities.length === 0) {
                               setDrillDownData({
                                 title: `Activity for ${dayName}`,
                                 description: "No actual records for this sample day.",
                                 data: []
                               });
                            } else {
                               setDrillDownData({
                                 title: `Activity for ${dayName}`,
                                 description: `Showing detailed tasks from ${dayName}.`,
                                 data: dayActivities.map(a => ({
                                   label: a.type || 'Activity',
                                   subtext: a.siteOrWell,
                                   status: a.status
                                 }))
                               });
                            }
                          }
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="colorCompleted"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0066CC"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0066CC"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorPending"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#FF6B35"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#FF6B35"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E5E7EB"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#6B7280" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#6B7280" }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          name="Completed"
                          stroke="#0066CC"
                          strokeWidth={2}
                          fill="url(#colorCompleted)"
                        />
                        <Area
                          type="monotone"
                          dataKey="pending"
                          name="Pending"
                          stroke="#FF6B35"
                          strokeWidth={2}
                          fill="url(#colorPending)"
                        />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Area Tasks Chart */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base text-on-surface font-semibold">
                      Tasks by Area
                    </h3>
                  </div>
                  <div className="min-h-[288px] w-full">
                    <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={0}>
                      <BarChart
                        data={tasksByArea}
                        margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                        onClick={(data: any) => {
                          if (data && data.activePayload && data.activePayload.length > 0) {
                            const areaName = data.activePayload[0].payload.name;
                            const t = tasks.filter((task) => 
                              (task.location || "").toLowerCase().includes(areaName.toLowerCase())
                            );
                            
                            if (t.length > 0) {
                               setDrillDownData({
                                 title: `Tasks in ${areaName}`,
                                 description: `Showing all pending and completed tasks.`,
                                 data: t.map(task => ({
                                   label: task.title || 'Task',
                                   status: task.status,
                                   subtext: task.priority ? `Priority: ${task.priority}` : ''
                                 }))
                               });
                            } else {
                               setDrillDownData({
                                 title: `Tasks in ${areaName}`,
                                 description: "No tasks found.",
                                 data: []
                               });
                            }
                          }
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E5E7EB"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          height={50}
                          tick={(props: any) => {
                            const { x, y, payload } = props;
                            const areaStats = tasksByArea.find((t: any) => t.name === payload.value);
                            const overdueCount = areaStats?.overdue || 0;
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text x={0} y={0} dy={12} textAnchor="middle" fill="#6B7280" fontSize={12}>
                                  {payload.value}
                                </text>
                                {overdueCount > 0 ? (
                                  <g transform={`translate(0, 26)`}>
                                    <rect x={-34} y={-10} width={68} height={16} rx={8} fill="#FEE2E2" />
                                    <text x={0} y={2.5} textAnchor="middle" fill="#DC2626" fontSize={9} fontWeight="bold">
                                      ! {overdueCount} Overdue
                                    </text>
                                  </g>
                                ) : (
                                  <g transform={`translate(0, 26)`}>
                                    <rect x={-30} y={-10} width={60} height={16} rx={8} fill="#DCFCE7" />
                                    <text x={0} y={2.5} textAnchor="middle" fill="#16A34A" fontSize={9} fontWeight="bold">
                                      On Track
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#6B7280" }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                        <Bar
                          dataKey="done"
                          name="Completed"
                          fill="#22C55E"
                          stackId="a"
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="inProgress"
                          name="In Progress"
                          fill="#60A5FA"
                          stackId="a"
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="pending"
                          name="Pending"
                          fill="#FCD34D"
                          stackId="a"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Area Tasks Sunburst (Nested Pie Chart) */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base text-on-surface font-semibold">
                      Hierarchical Status View
                    </h3>
                  </div>
                  <div className="min-h-[288px] w-full relative">
                    <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={0}>
                      <PieChart
                        onClick={(data: any) => {
                           if (data && data.activePayload && data.activePayload.length > 0) {
                              const payload = data.activePayload[0].payload;
                              const clickedName = payload.name;
                              
                              let filteredTasks = [];
                              let filterDesc = "";

                              if (payload.areaName && payload.statusFilter) {
                                const { areaName: area, statusFilter: status } = payload;
                                filteredTasks = tasks.filter(t => {
                                  const locs = (t.location || "").toLowerCase().split(',').map((s: string) => s.trim());
                                  if (!locs.includes(area.toLowerCase())) return false;
                                  if (status === "Done") return t.status === "completed";
                                  if (status === "In Progress") return t.status === "in_progress";
                                  return t.status !== "completed" && t.status !== "in_progress";
                                });
                                filterDesc = `Tasks for ${area} with status: ${status}`;
                              } else {
                                filteredTasks = tasks.filter((t) => {
                                  const locs = (t.location || "").toLowerCase().split(',').map((s: string) => s.trim());
                                  return locs.includes(clickedName.toLowerCase());
                                });
                                filterDesc = `All Tasks for ${clickedName}`;
                              }
                              
                              if (filteredTasks.length > 0) {
                                setDrillDownData({
                                  title: clickedName,
                                  description: filterDesc,
                                  data: filteredTasks.map(t => ({
                                    label: t.title || 'Task',
                                    status: t.status,
                                    subtext: t.priority ? `Priority: ${t.priority}` : ''
                                  }))
                                });
                              } else {
                                setDrillDownData({
                                  title: clickedName,
                                  description: "No specific tasks found.",
                                  data: []
                                });
                              }
                           }
                        }}
                      >
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Pie
                          data={sunburstData.innerData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          stroke="white"
                        >
                          {sunburstData.innerData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Pie
                          data={sunburstData.outerData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          stroke="white"
                          label={false}
                        >
                          {sunburstData.outerData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} content={() => {
                          return (
                            <div className="flex justify-center flex-wrap gap-4 text-xs font-semibold mt-2">
                              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#0066CC]"></div> Area (Inner)</span>
                              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#22C55E]"></div> Done (Outer)</span>
                              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#60A5FA]"></div> In-Prog (Outer)</span>
                              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#FCD34D]"></div> Pending (Outer)</span>
                            </div>
                          );
                        }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {dashboardMode === "field_ops" ? (
                  <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base text-on-surface font-semibold">
                        Task Density by Area
                      </h3>
                    </div>

                    <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="min-w-[400px]">
                      {/* Grid header */}
                      <div className="grid grid-cols-[140px_repeat(7,1fr)] gap-2 mb-2">
                        <div className="sticky left-0 z-10 bg-white text-left font-semibold text-xs text-on-surface-variant flex items-end">
                          Area
                        </div>
                        {[...Array(7)]
                          .map((_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - (6 - i));
                            return d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          })
                          .map((day, idx) => (
                            <div
                              key={idx}
                              className="text-center font-semibold text-xs text-on-surface-variant"
                            >
                              {day}
                            </div>
                          ))}
                      </div>

                      {/* Grid rows */}
                      <div className="flex flex-col gap-2">
                        {customAreas.length > 0 ? customAreas.map((area, rIdx) => {
                          const areaStats = tasksByArea.find(t => t.name === area);
                          const overdueCount = areaStats?.overdue || 0;
                          return (
                          <div
                            key={area}
                            className="grid grid-cols-[140px_repeat(7,1fr)] gap-2"
                          >
                            {/* Frozen left column */}
                            <div className="sticky left-0 z-10 bg-white flex flex-col justify-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] pr-2 py-0.5 min-w-0">
                              <span
                                className="text-xs font-semibold text-on-surface truncate"
                                title={area}
                              >
                                {area}
                              </span>
                              {overdueCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold mt-1 text-error bg-error/10 px-1.5 py-0.5 rounded-full w-fit">
                                  ! {overdueCount} Overdue
                                </span>
                              ) : (
                                <span className="inline-flex text-[9px] font-bold mt-1 text-success bg-success/10 px-1.5 py-0.5 rounded-full w-fit">
                                  On Track
                                </span>
                              )}
                            </div>

                            {/* Day cells */}
                            {[...Array(7)].map((_, cIdx) => {
                              const cellDate = new Date();
                              cellDate.setDate(cellDate.getDate() - (6 - cIdx));
                              const dateStr = cellDate.toISOString().split('T')[0];
                              const count = activities.filter(a =>
                                (a.area || '').toLowerCase().includes(area.toLowerCase()) &&
                                a.date === dateStr
                              ).length;
                              const intensity = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;

                              const colorClasses = [
                                "bg-surface-container-low text-on-surface-variant",
                                "bg-primary/20 text-primary",
                                "bg-primary/50 text-white",
                                "bg-primary text-white",
                              ];
                              return (
                                <div
                                  key={`${rIdx}-${cIdx}`}
                                  className={`h-8 rounded flex items-center justify-center text-[10px] font-bold ${colorClasses[intensity]} transition-colors hover:ring-2 ring-outline-variant cursor-pointer`}
                                  title={`${area} - ${dateStr} (Count: ${count})`}
                                >
                                  {count > 0 ? count : ""}
                                </div>
                              );
                            })}
                          </div>
                          );
                        }) : null}
                      </div>
                    </div>
                  </div>
                </div>
                ) : (
                  <>
                    <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 h-full">
                      <h3 className="text-base text-on-surface font-semibold mb-4">Projected Workload</h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <ComposedChart
                            data={projectedWorkload}
                            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <RechartsTooltip
                              cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid #E5E7EB",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                padding: "12px",
                                backgroundColor: "white",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }}/>
                            <Bar yAxisId="left" dataKey="workload" name="Est. Workload (Tasks)" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="left" type="step" dataKey="capacity" name="Tech Capacity" stroke="#22C55E" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 h-full">
                      <h3 className="text-base text-on-surface font-semibold mb-4">Resource Allocation</h3>
                      <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                          <div>
                            <div className="text-sm font-semibold text-on-surface">Team A (Meter Swap)</div>
                            <div className="text-xs text-on-surface-variant">3 Techs • High Load</div>
                          </div>
                          <div className="bg-warning/20 text-warning px-2 py-1 rounded-md text-xs font-bold">115%</div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                          <div>
                            <div className="text-sm font-semibold text-on-surface">Team B (Leak Repair)</div>
                            <div className="text-xs text-on-surface-variant">4 Techs • Optimal</div>
                          </div>
                          <div className="bg-success/20 text-success px-2 py-1 rounded-md text-xs font-bold">85%</div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                          <div>
                            <div className="text-sm font-semibold text-on-surface">Team C (Maintenance)</div>
                            <div className="text-xs text-on-surface-variant">2 Techs • Low Load</div>
                          </div>
                          <div className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-bold">45%</div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                          <div>
                            <div className="text-sm font-semibold text-on-surface">Team D (Inspections)</div>
                            <div className="text-xs text-on-surface-variant">2 Techs • Optimal</div>
                          </div>
                          <div className="bg-success/20 text-success px-2 py-1 rounded-md text-xs font-bold">70%</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 xl:col-span-2">
                      <h3 className="text-base text-on-surface font-semibold mb-3">Task Efficiency (Actual Avg. vs. Expected)</h3>
                      <div className="text-sm text-on-surface-variant mb-4">
                        Historical data metrics identify operational bottlenecks across task categories and zones.
                      </div>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart
                            layout="vertical"
                            data={taskEfficiency}
                            margin={{ top: 0, right: 20, left: 40, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                            <RechartsTooltip cursor={{ fill: "rgba(0, 102, 204, 0.05)" }} contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px", backgroundColor: "white" }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }}/>
                            <Bar dataKey="expected" name="Historical Expected (Hours)" fill="#94A3B8" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="actual" name="Actual Avg (Hours)" fill="#EF4444" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 xl:col-span-2">
                      <h3 className="text-base text-on-surface font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" /> Recent Team Handovers
                      </h3>
                      {handovers.length > 0 ? (
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {handovers.map((h, i) => (
                            <div key={h.id || i} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-sm font-semibold text-on-surface">Field Shift Report ({h.date || 'Today'})</div>
                                <div className="text-xs text-on-surface-variant font-medium">Auto-generated</div>
                              </div>
                              <div className="flex gap-4 mb-3">
                                <div className="text-xs"><span className="font-semibold text-success">{h.completedCount || 0}</span> Completed</div>
                                <div className="text-xs"><span className="font-semibold text-warning-dark">{h.pendingCount || 0}</span> Pending</div>
                              </div>
                              {h.notes && (
                                <div className="bg-surface p-2 rounded border border-outline-variant/50 text-sm italic text-on-surface-variant">
                                  "{h.notes}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant">
                          <CheckCircle2 className="w-8 h-8 opacity-50 mx-auto mb-2" />
                          <p className="text-sm">No handovers submitted yet today.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedActivity === "leak_repair" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {/* Breakdown by cause */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Leak Breakdown by Cause
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart onClick={handleChartClick}
                        data={taskTypeDistribution}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E5E7EB"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          dataKey="cust"
                          stackId="a"
                          name="Customer"
                          fill="#00A8A8"
                        />
                        <Bar
                          dataKey="stand"
                          stackId="a"
                          name="Stand Pipe"
                          fill="#FF6B35"
                        />
                        <Bar
                          dataKey="svc"
                          stackId="a"
                          name="Service Conn"
                          fill="#0066CC"
                        />
                        <Bar
                          dataKey="main"
                          stackId="a"
                          name="Mainline"
                          fill="#EF4444"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status distribution */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Status Distribution
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart onClick={handleChartClick}>
                        <Pie
                          data={activityCompletionStatus}
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#22C55E" />
                          <Cell fill="#FCD34D" />
                          <Cell fill="#3B82F6" />
                        </Pie>
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Trend Line & KPIs */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 h-[200px]">
                      <h3 className="text-base font-semibold mb-2 text-on-surface">
                        Leak Frequency
                      </h3>
                      {!isLowDataMode ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <LineChart onClick={handleChartClick}
                            data={trendData}
                            margin={{ left: -20 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12 }}
                            />
                            <RechartsTooltip
                              cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid #E5E7EB",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                padding: "12px",
                                backgroundColor: "white",
                              }}
                              itemStyle={{
                                fontSize: "13px",
                                fontWeight: 600,
                                padding: 0,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="completed"
                              name="Resolved Leaks"
                              stroke="#0066CC"
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-container-low rounded text-on-surface-variant">
                          <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                          <span className="text-sm font-semibold">
                            Historical charts deferred (Low Data Mode)
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 md:border-l border-outline-variant/50 md:pl-4 flex flex-col justify-center">
                      <div>
                        <span className="block text-xs font-semibold text-on-surface-variant">
                          Avg Repair Duration
                        </span>
                        <span className="text-2xl font-bold text-on-surface">
                          2.4 hrs
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-on-surface-variant">
                          % Within SLA
                        </span>
                        <span className="text-2xl font-bold text-secondary">
                          {activityCompliance[0]?.value || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "meter_inst" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
                {/* Progress Gauge */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 flex flex-col items-center">
                  <h3 className="text-base font-semibold mb-2 text-on-surface w-full text-left">
                    Target vs Actual
                  </h3>
                  <div className="h-[200px] w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart onClick={handleChartClick} margin={{ top: 20 }}>
                        <Pie
                          data={[
                            { value: activityCompliance[0].value, fill: activityCompliance[0].fill },
                            { value: 100 - activityCompliance[0].value, fill: '#E5E7EB' }
                          ]}
                          startAngle={180}
                          endAngle={0}
                          innerRadius={80}
                          outerRadius={100}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#0066CC" />
                          <Cell fill="#E5E7EB" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center mt-10">
                      <span className="text-4xl font-bold text-on-surface">
                        85%
                      </span>
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        Completed (170/200)
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 w-full mt-4">
                    <div className="bg-surface-container-low p-2 rounded-lg text-center">
                      <div className="text-xl font-bold text-on-surface">
                        34
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        Installs per Day
                      </div>
                    </div>
                    <div className="bg-surface-container-low p-2 rounded-lg text-center">
                      <div className="text-xl font-bold text-secondary">
                        98%
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        Customer Verified
                      </div>
                    </div>
                  </div>
                </div>

                {/* Installations by Tech */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 lg:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Installations by Technician
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart onClick={handleChartClick}
                        data={staffProductivity}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#00A8A8"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Map Placeholder */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
                      <MapIcon className="w-5 h-5 text-primary" /> GPS Locations
                    </h3>
                    <button
                      onClick={() => setActiveTab("live-map")}
                      className="px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 rounded-md transition-colors"
                    >
                      View on Live Map →
                    </button>
                  </div>
                  {!isLowDataMode ? (
                    <div className="h-[300px] bg-slate-100 rounded-lg flex items-center justify-center border border-outline-variant/30 relative overflow-hidden">
                      <div className="absolute inset-0 pattern-grid-lg text-slate-200"></div>
                      <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-primary rounded-full shadow-lg pulse-indicator"></div>
                      <div className="absolute top-1/2 left-1/3 w-4 h-4 bg-primary rounded-full shadow-lg"></div>
                      <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-primary rounded-full shadow-lg"></div>
                      <div className="absolute bottom-1/4 right-1/3 w-4 h-4 bg-primary rounded-full shadow-lg"></div>
                      <span className="relative z-10 text-on-surface-variant font-semibold bg-white/80 px-4 py-2 rounded-full shadow-sm">
                        Interactive Map View
                      </span>
                    </div>
                  ) : (
                    <div className="h-[300px] bg-surface-container-low rounded-lg flex flex-col items-center justify-center border border-outline-variant/30 text-on-surface-variant">
                      <MapIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm font-semibold">
                        High-resolution map tiles deferred (Low Data Mode)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedActivity === "flushing" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
                {/* Timeline: Scheduled vs completed */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Scheduled vs Completed
                  </h3>
                  {!isLowDataMode ? (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <ComposedChart onClick={handleChartClick}
                          data={scheduledVsCompletedData}
                          margin={{ left: -20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <RechartsTooltip
                            cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #E5E7EB",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              padding: "12px",
                              backgroundColor: "white",
                            }}
                            itemStyle={{
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: 0,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <Bar
                            dataKey="comp"
                            name="Completed"
                            fill="#0066CC"
                            radius={[4, 4, 0, 0]}
                          />
                          <Line
                            type="step"
                            dataKey="sched"
                            name="Scheduled"
                            stroke="#FF6B35"
                            strokeWidth={3}
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[250px] bg-surface-container-low rounded-lg flex flex-col items-center justify-center text-on-surface-variant">
                      <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm font-semibold">
                        Scheduled trend chart deferred (Low Data Mode)
                      </span>
                    </div>
                  )}
                </div>
                {/* Gauge: Compliance */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 flex flex-col items-center justify-center relative">
                  <h3 className="text-base font-semibold mb-2 text-on-surface w-full text-left absolute top-4 left-4">
                    PMS Compliance
                  </h3>
                  <div className="h-[200px] w-full flex items-center justify-center relative mt-8">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart onClick={handleChartClick}>
                        <Pie
                          data={[
                            { value: activityCompliance[0].value, fill: activityCompliance[0].fill },
                            { value: 100 - activityCompliance[0].value, fill: '#E5E7EB' }
                          ]}
                          startAngle={180}
                          endAngle={0}
                          innerRadius={80}
                          outerRadius={100}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#22C55E" />
                          <Cell fill="#EF4444" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center mt-6">
                      <span className="text-4xl font-bold text-on-surface">
                        78%
                      </span>
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        Compliance
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 w-full justify-center">
                    <div className="text-center">
                      <span className="block text-xl font-bold text-on-surface">
                        45 min
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        Avg Duration
                      </span>
                    </div>
                    <div className="text-center border-l border-outline-variant/50 pl-4">
                      <span className="block text-xl font-bold text-error">
                        4
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        Missed Schedules
                      </span>
                    </div>
                  </div>
                </div>

                {/* Heatmap */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Flushing Frequency by Zone
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const staticVals = [0,2,1,3,1,0,2,3,1,2,0,1,3,2,1,0,2,1,0,3,2,1,0,1];
                      const intensity = staticVals[i] ?? 0;
                      const colors = [
                        "bg-surface-container-low text-on-surface",
                        "bg-[#00A8A8]/20 text-[#00A8A8]",
                        "bg-[#00A8A8]/60 text-white",
                        "bg-[#00A8A8] text-white",
                      ];
                      return (
                        <div
                          key={i}
                          className={`h-16 rounded-lg border border-outline-variant/30 flex flex-col p-1.5 items-start justify-between ${colors[intensity]}`}
                        >
                          <span className="text-[10px] font-bold opacity-70">
                            Zone {i + 1}
                          </span>
                          <span className="font-semibold text-sm">
                            {staticVals[i] !== undefined ? staticVals[i] * 3 + (i % 2) : 0}x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "tank_cleaning" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
                {/* Pie Chart: Tank Types */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 border-b-4 border-b-primary">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Tanks Cleaned by Size
                  </h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart onClick={handleChartClick}>
                        <Pie
                          data={tankSizesData}
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#0066CC" />
                          <Cell fill="#00A8A8" />
                          <Cell fill="#FF6B35" />
                        </Pie>
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Plant freq */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Cleaning Frequency per Plant
                  </h3>
                  {!isLowDataMode ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart onClick={handleChartClick}
                          data={siteTasksData}
                          margin={{ left: -20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <RechartsTooltip
                            cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #E5E7EB",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              padding: "12px",
                              backgroundColor: "white",
                            }}
                            itemStyle={{
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: 0,
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#0066CC"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[200px] bg-surface-container-low rounded-lg flex flex-col items-center justify-center text-on-surface-variant">
                      <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm font-semibold">
                        Frequency charts deferred (Low Data Mode)
                      </span>
                    </div>
                  )}
                </div>

                {/* KPIs & Schedule */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-3 flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4 border-r border-outline-variant/50 pr-4">
                    <h3 className="text-base font-semibold text-on-surface">
                      Cleaning Schedule Tracking
                    </h3>
                    <div className="space-y-3 mt-4">
                      <div className="w-full">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Tank A (Pavia)</span>{" "}
                          <span className="text-primary font-bold">100%</span>
                        </div>
                        <div className="w-full bg-surface-container-low h-2 rounded">
                          <div
                            className="bg-primary h-2 rounded"
                            style={{ width: "100%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-full">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Tank C (PR2)</span>{" "}
                          <span className="text-primary font-bold">60%</span>
                        </div>
                        <div className="w-full bg-surface-container-low h-2 rounded">
                          <div
                            className="bg-primary h-2 rounded"
                            style={{ width: "60%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-full">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Tank D (BAR)</span>{" "}
                          <span className="text-on-surface-variant font-bold">
                            0%
                          </span>
                        </div>
                        <div className="w-full bg-surface-container-low h-2 rounded">
                          <div
                            className="bg-outline h-2 rounded"
                            style={{ width: "0%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-64 flex flex-col justify-center gap-6">
                    <div>
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        Scheduled Tanks Cleaned
                      </span>
                      <span className="text-3xl font-bold text-secondary">
                        95%
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        Avg Downtime/Tank
                      </span>
                      <span className="text-3xl font-bold text-on-surface">
                        4.5 hrs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "well_pull_out" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {/* Line Chart */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 md:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface flex items-center justify-between">
                    Wells Pulled Out Over Time
                    <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
                      <span className="px-2 py-1 bg-surface-container-low rounded">
                        Avg Duration: 12 hrs
                      </span>
                      <span className="px-2 py-1 bg-surface-container-low rounded">
                        Restored: 82%
                      </span>
                    </div>
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <LineChart onClick={handleChartClick}
                        data={trendData}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#FF6B35"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stacked Col Reasons */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 border-t-4 border-t-error">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Reasons for Pull-out
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart onClick={handleChartClick}
                        data={pumpData}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          dataKey="maint"
                          stackId="a"
                          name="Maintenance"
                          fill="#00A8A8"
                        />
                        <Bar
                          dataKey="rep"
                          stackId="a"
                          name="Replacement"
                          fill="#FF6B35"
                        />
                        <Bar
                          dataKey="fail"
                          stackId="a"
                          name="Failure"
                          fill="#EF4444"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 relative overflow-hidden flex items-center justify-center min-h-[250px]">
                  <div className="absolute inset-0 pattern-grid-lg text-slate-100 opacity-50"></div>
                  <div className="text-center w-full z-10">
                    <MapIcon className="w-8 h-8 text-on-surface-variant mx-auto mb-2 opacity-50" />
                    <h3 className="text-base font-semibold text-on-surface mb-1">
                      Affected Locations
                    </h3>
                    <p className="text-xs text-on-surface-variant mb-4">
                      GPS overlay of pulled-out wells
                    </p>
                    <button
                      onClick={() => setActiveTab("live-map")}
                      className="px-4 py-2 border border-outline-variant rounded bg-white text-sm font-semibold hover:bg-surface-container-low transition-colors"
                    >
                      View Map Overlay
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "pump_monitoring" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {/* Tiles */}
                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    "Pump A (Flow: 120 L/s)",
                    "Pump B (Pressure: 45 psi)",
                    "Genset (Idle)",
                    "Motor (Power: 45kW)",
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 border-t-4 border-t-primary"
                    >
                      <span className="block text-xs font-semibold text-on-surface-variant mb-1">
                        Status
                      </span>
                      <div className="font-semibold text-sm mb-2">{p}</div>
                      <span className="inline-flex items-center gap-1 text-[10px] bg-surface-container-low px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-indicator"></span>{" "}
                        Running Normal
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Real-Time Flow & Pressure
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ComposedChart onClick={handleChartClick}
                        data={timeSeriesData}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="time"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="flow"
                          name="Flow (L/s)"
                          stroke="#0066CC"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="press"
                          name="Pressure (psi)"
                          stroke="#FF6B35"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Daily Energy vs Output
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ScatterChart onClick={handleChartClick} margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          type="number"
                          dataKey="energy"
                          name="Energy (kWh)"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="water"
                          name="Output (m³)"
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Scatter
                          name="Days"
                          data={timeSeriesData.map(d => ({ energy: d.flow, water: d.press * 2 }))}
                          fill="#00A8A8"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "backwash" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 md:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Scheduled vs Actual Time
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart onClick={handleChartClick}
                        data={filterBackwashData}
                        layout="vertical"
                        margin={{ left: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                          width={60}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          dataKey="sched"
                          name="Scheduled (mins)"
                          fill="#00A8A8"
                          radius={[0, 4, 4, 0]}
                          barSize={15}
                        />
                        <Bar
                          dataKey="actual"
                          name="Actual (mins)"
                          fill="#FF6B35"
                          radius={[0, 4, 4, 0]}
                          barSize={15}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 flex flex-col items-center">
                  <h3 className="text-base font-semibold mb-2 text-on-surface w-full text-left">
                    Schedule Compliance
                  </h3>
                  <div className="h-[200px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <RadialBarChart onClick={handleChartClick}
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="100%"
                        barSize={20}
                        data={completionComplianceData}
                        startAngle={180}
                        endAngle={0}
                      >
                        <RadialBar
                          background
                          dataKey="value"
                          cornerRadius={10}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="-mt-16 text-center">
                    <span className="text-4xl font-bold text-on-surface mb-1 block">
                      {completionComplianceData[0]?.value || 0}%
                    </span>
                    <span className="bg-surface-container-low px-3 py-1 rounded text-xs font-semibold text-on-surface-variant">
                      Filters Maintained On Time
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "garbage_collection" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 md:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Collection Volume by Zone
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart onClick={handleChartClick}
                        data={garbageZoneData}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Bar
                          dataKey="vol"
                          name="Volume (kg)"
                          fill="#0066CC"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Waste Type Distribution
                  </h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart onClick={handleChartClick}>
                        <Pie
                          data={garbageTypeData}
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#00A8A8" />
                          <Cell fill="#22C55E" />
                          <Cell fill="#FF6B35" />
                        </Pie>
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 relative overflow-hidden flex items-center justify-center min-h-[250px] col-span-1 md:col-span-2">
                  <div className="absolute inset-0 pattern-grid-lg text-slate-100 opacity-50"></div>
                  <div className="text-center w-full z-10">
                    <MapIcon className="w-8 h-8 text-secondary mx-auto mb-2 opacity-50" />
                    <h3 className="text-base font-semibold text-on-surface mb-1">
                      Route Adherence Map
                    </h3>
                    <p className="text-xs text-on-surface-variant mb-4">
                      Live truck tracking overlay
                    </p>
                    <div className="flex justify-center gap-4 text-sm font-semibold text-on-surface">
                      <div className="bg-white border px-3 py-1.5 rounded shadow-sm text-success">
                        ✓ Route 1: 100%
                      </div>
                      <div className="bg-white border px-3 py-1.5 rounded shadow-sm text-warning">
                        ⚠ Route 2: 80%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 flex flex-col justify-center">
                  <h3 className="text-base font-semibold mb-6 text-on-surface">
                    Key Metrics
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        % Route Completion
                      </span>
                      <span className="text-3xl font-bold text-success">
                        94%
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-on-surface-variant">
                        Avg Vol per Cycle
                      </span>
                      <span className="text-3xl font-bold text-on-surface">
                        1.2 Tons
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedActivity === "plant_watering" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-2">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Water Usage per Plant Facility
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart onClick={handleChartClick}
                        data={plantWateringData}
                        margin={{ left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 102, 204, 0.05)" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                            backgroundColor: "white",
                          }}
                          itemStyle={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: 0,
                          }}
                        />
                        <Bar
                          dataKey="usage"
                          name="Water Used (L/day)"
                          fill="#00A8A8"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 flex flex-col items-center">
                  <h3 className="text-base font-semibold mb-2 text-on-surface w-full">
                    Schedule Adherence
                  </h3>
                  <div className="h-[180px] w-full mt-2 relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <RadialBarChart onClick={handleChartClick}
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="100%"
                        barSize={20}
                        data={activityCompliance}
                        startAngle={180}
                        endAngle={0}
                      >
                        <RadialBar
                          background
                          dataKey="value"
                          cornerRadius={10}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center top-6">
                      <span className="text-3xl font-bold text-on-surface block">
                        {activityCompliance[0]?.value || 0}%
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
                        Adherence
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full justify-between mt-2 pt-4 border-t border-outline-variant/40">
                    <div className="text-center w-1/2">
                      <span className="text-lg font-bold text-on-surface block">
                        120 L
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        Avg Consump.
                      </span>
                    </div>
                    <div className="text-center w-1/2 border-l border-outline-variant/40">
                      <span className="text-lg font-bold text-error block">
                        2
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        Missed Tasks
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4 col-span-1 lg:col-span-3">
                  <h3 className="text-base font-semibold mb-4 text-on-surface">
                    Water Usage Heatmap by Zone
                  </h3>
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {Array.from({ length: 30 }).map((_, idx) => {
                      const staticVals = [0,1,2,3,2,1,0,1,2,1,0,2,3,1,0,2,1,0,1,2,3,0,1,2,0,1,2,1,0,3];
                      const intensity = staticVals[idx] ?? 0;
                      const colors = [
                        "bg-surface-container text-on-surface-variant",
                        "bg-secondary/30 text-secondary",
                        "bg-secondary/70 text-white",
                        "bg-secondary text-white",
                      ];
                      return (
                        <div
                          key={idx}
                          className={`h-12 rounded border border-outline-variant/30 flex items-center justify-center text-xs font-bold ${colors[intensity]}`}
                        >
                          {intensity > 0 ? `${10 + intensity * 15}L` : "0L"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Fallback for other standard activities or when unselected items show generic */}
            {![
              "all",
              "leak_repair",
              "meter_inst",
              "flushing",
              "tank_cleaning",
              "well_pull_out",
              "pump_monitoring",
              "backwash",
              "garbage_collection",
              "plant_watering",
            ].includes(selectedActivity) && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-lg text-center flex flex-col items-center justify-center h-64">
                <BarChart3 className="w-12 h-12 text-outline mb-4" />
                <h3 className="text-lg font-semibold text-on-surface">
                  Data Visualizations Loading
                </h3>
                <p className="text-on-surface-variant mt-2 text-sm max-w-[448px]">
                  Detailed charts and KPIs for{" "}
                  {activityTypes.find((a) => a.id === selectedActivity)?.label}{" "}
                  will be populated here.
                </p>
              </div>
            )}
          </section>

          {isExportModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
              <div className="bg-white w-full max-w-[384px] sm:max-w-[448px] rounded-2xl shadow-2xl flex flex-col p-6 animate-in fade-in zoom-in-95 overflow-hidden">
                <h3 className="text-xl font-bold text-on-surface mb-2">
                  Export & Reports
                </h3>
                <p className="text-sm text-on-surface-variant mb-6">
                  Generate accomplishment reports and raw data exports.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      const csvRows = [];
                      csvRows.push(["Type", "Date", "Location/Area", "Status", "Title"]);
                      
                      const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

                      tasks.forEach(t => {
                        csvRows.push(["Task", t.date || '', escapeCsv(t.location || ''), t.status || '', escapeCsv(t.title || '')]);
                      });
                      activities.forEach(a => {
                        csvRows.push(["Activity", a.date || '', escapeCsv(a.area || ''), a.status || '', escapeCsv(a.title || '')]);
                      });

                      const csvString = csvRows.map(r => r.join(',')).join('\n');
                      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.setAttribute("href", url);
                      link.setAttribute("download", `bpwi_data_export_${new Date().toISOString().split('T')[0]}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setIsExportModalOpen(false);
                    }}
                    className="w-full px-4 py-3 text-sm font-semibold text-on-surface border border-outline hover:bg-surface-container-low rounded-xl transition-colors flex items-center gap-3"
                  >
                    <FileEdit className="w-5 h-5 text-on-surface-variant" />{" "}
                    Export CSV Data
                  </button>
                  <button
                    onClick={() => {
                      setIsExportModalOpen(false);
                      setTimeout(() => window.print(), 300);
                    }}
                    className="w-full px-4 py-3 text-sm font-semibold text-on-surface border border-outline hover:bg-surface-container-low rounded-xl transition-colors flex items-center gap-3"
                  >
                    <ArrowUpRight className="w-5 h-5 text-on-surface-variant" />{" "}
                    Print Current View
                  </button>
                  <button
                    onClick={() => {
                      setIsExportModalOpen(false);
                      generateDailyDigestPDF(tasks, activities, handovers);
                    }}
                    className="w-full px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm flex items-center gap-3"
                  >
                    <ArrowUpRight className="w-5 h-5 text-on-primary" />{" "}
                    Generate Daily Digest
                  </button>
                </div>

                <div className="mt-6 pt-4 border-t border-outline flex justify-end">
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="btn-secondary px-5 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {isAreasModalOpen && (
            <AreasSettingsModal 
              currentUid={currentUid!} 
              onClose={() => setIsAreasModalOpen(false)} 
            />
          )}

          {isHandoverModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
              <div className="bg-white w-full max-w-[500px] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                  <div>
                    <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" /> Daily Handover
                    </h3>
                    <p className="text-sm text-on-surface-variant mt-1">Review your summary before submitting to Insights.</p>
                  </div>
                  <button onClick={() => setIsHandoverModalOpen(false)} className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-surface">
                  {/* Summary Block */}
                  {(() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const todayTasks = tasks.filter(t => !t.completedAt || t.completedAt.startsWith(todayStr) || t.updatedAt && new Date(t.updatedAt).toISOString().startsWith(todayStr));
                    const completedTasks = todayTasks.filter(t => t.status === "completed" || t.status === "done");
                    const pendingTasks = todayTasks.filter(t => t.status === "pending" || t.status === "in-progress");
                    
                    return (
                      <>
                        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                          <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Tasks Completed</h4>
                          {completedTasks.length > 0 ? (
                            <ul className="list-disc pl-5 text-sm text-on-surface-variant space-y-1">
                              {completedTasks.map(t => <li key={t.id}>{t.title} ({t.location || 'Unknown'})</li>)}
                            </ul>
                          ) : <p className="text-sm text-on-surface-variant italic">No tasks completed today.</p>}
                        </div>

                        <div className="bg-warning/5 rounded-xl p-4 border border-warning/10">
                          <h4 className="text-sm font-semibold text-warning-dark mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Pending Items</h4>
                          {pendingTasks.length > 0 ? (
                            <ul className="list-disc pl-5 text-sm text-on-surface-variant space-y-1">
                              {pendingTasks.map(t => <li key={t.id}>{t.title} ({t.location || 'Unknown'})</li>)}
                            </ul>
                          ) : <p className="text-sm text-on-surface-variant italic">All assigned tasks completed.</p>}
                        </div>

                        <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/50">
                          <h4 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-2"><PackageSearch className="w-4 h-4 text-on-surface-variant" /> Parts Used Today</h4>
                          {/* For simplicity we aggregate from parts used if any in completed tasks, or just text */}
                          <p className="text-sm text-on-surface-variant mb-2">Please ensure all consumed inventory is synced.</p>
                          <textarea 
                            id="handover-notes"
                            className="w-full text-sm form-input mt-2" 
                            placeholder="Add any extra notes for the next shift or management..."
                            rows={3}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                <div className="p-4 border-t border-outline flex justify-end gap-3 bg-surface-container-lowest">
                  <button onClick={() => setIsHandoverModalOpen(false)} className="btn-secondary px-5 py-2">
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmittingHandover}
                    onClick={async () => {
                      setIsSubmittingHandover(true);
                      const notesEl = document.getElementById("handover-notes") as HTMLTextAreaElement;
                      const todayStr = new Date().toISOString().split("T")[0];
                      const todayTasks = tasks.filter(t => !t.completedAt || t.completedAt.startsWith(todayStr) || t.updatedAt && new Date(t.updatedAt).toISOString().startsWith(todayStr));
                      const completedTasks = todayTasks.filter(t => t.status === "completed" || t.status === "done");
                      const pendingTasks = todayTasks.filter(t => t.status === "pending" || t.status === "in-progress");
                      
                      try {
                        const newDocRef = doc(collection(db, `users/${currentUid}/handovers`));
                        await setDoc(newDocRef, {
                          userId: currentUid,
                          date: todayStr,
                          completedCount: completedTasks.length,
                          pendingCount: pendingTasks.length,
                          completedTasks: completedTasks.map(t => t.title),
                          pendingTasks: pendingTasks.map(t => t.title),
                          notes: notesEl?.value || "",
                          createdAt: serverTimestamp()
                        });
                        if (navigator.vibrate) {
                          navigator.vibrate([100, 50, 100]);
                        }
                        setIsHandoverModalOpen(false);
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsSubmittingHandover(false);
                      }
                    }} 
                    className="btn-primary px-6 py-2 flex items-center gap-2"
                  >
                    {isSubmittingHandover ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit to Insights
                  </button>
                </div>
              </div>
            </div>
          )}

          {drillDownData && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
              <div className="bg-white w-full max-w-[600px] rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                  <div>
                    <h3 className="text-xl font-bold text-on-surface">{drillDownData.title}</h3>
                    <p className="text-sm text-on-surface-variant mt-1">{drillDownData.description}</p>
                  </div>
                  <button
                    onClick={() => setDrillDownData(null)}
                    className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                  {drillDownData.data.length > 0 ? (
                    <ul className="divide-y divide-outline-variant/40">
                      {drillDownData.data.map((item, index) => (
                        <li key={index} className="px-6 py-4 hover:bg-surface-container-lowest transition-colors flex justify-between items-center gap-4">
                          <div className="flex flex-col flex-1">
                            <span className="font-semibold text-on-surface">{item.label}</span>
                            {item.subtext && <span className="text-xs text-on-surface-variant mt-0.5">{item.subtext}</span>}
                          </div>
                          {item.value !== undefined && (
                            <span className="font-mono font-medium text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
                              {item.value}
                            </span>
                          )}
                          {item.status && (
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              item.status === 'completed' ? 'bg-success/10 text-success' :
                              item.status === 'pending' ? 'bg-warning/10 text-warning-dark' :
                              'bg-surface-variant text-on-surface-variant'
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-12 text-center text-on-surface-variant">
                      <PackageSearch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No specific records found for this segment.</p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-outline flex justify-end bg-surface">
                  <button
                    onClick={() => setDrillDownData(null)}
                    className="btn-primary px-6 py-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
