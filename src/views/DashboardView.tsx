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
} from "lucide-react";
import {
  AreaChart,
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
} from "firebase/firestore";

interface DashboardViewProps {
  setActiveTab: (tab: any) => void;
  currentUid?: string | null;
}

// Sourced from shared lib/activityTypes.ts — "all" prepended for dashboard filter
const activityTypes = [{ id: "all", label: "All Activities" }, ...ACTIVITY_TYPES];

const mockDataByActivity: Record<string, any[]> = {
  all: [
    { name: "Mon", completed: 12, pending: 4 },
    { name: "Tue", completed: 15, pending: 6 },
    { name: "Wed", completed: 18, pending: 3 },
    { name: "Thu", completed: 22, pending: 5 },
    { name: "Fri", completed: 25, pending: 2 },
    { name: "Sat", completed: 10, pending: 0 },
    { name: "Sun", completed: 8, pending: 1 },
  ],
  meter_inst: [
    { name: "Mon", completed: 2, pending: 1 },
    { name: "Tue", completed: 3, pending: 2 },
    { name: "Wed", completed: 4, pending: 0 },
    { name: "Thu", completed: 5, pending: 1 },
    { name: "Fri", completed: 6, pending: 0 },
    { name: "Sat", completed: 3, pending: 0 },
    { name: "Sun", completed: 2, pending: 0 },
  ],
  leak_repair: [
    { name: "Mon", completed: 5, pending: 2 },
    { name: "Tue", completed: 4, pending: 3 },
    { name: "Wed", completed: 6, pending: 1 },
    { name: "Thu", completed: 7, pending: 2 },
    { name: "Fri", completed: 8, pending: 1 },
    { name: "Sat", completed: 3, pending: 0 },
    { name: "Sun", completed: 2, pending: 1 },
  ],
};

const getTrendData = (activityId: string, activities: any[]) => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date().getDay();
  // Generate last 7 days in order up to today
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    let d = today - i;
    if (d < 0) d += 7;
    last7Days.push(days[d]);
  }

  const defaultMock =
    mockDataByActivity[activityId] || mockDataByActivity["all"];
  const hasRealData = activities.length > 0;

  if (!hasRealData) {
    // Deterministic placeholder — no real data yet
    return defaultMock.map((d) => ({
      name: d.name,
      completed: Math.floor(d.completed / 3),
      pending: Math.floor(d.pending / 2),
    }));
  }

  // Calculate from real activities
  return last7Days.map((dayName) => {
    // Find activities that match the day of week (simplified for this demo)
    const dayActivities = activities.filter((a) => {
      const aDate = new Date(a.date);
      return (
        days[aDate.getDay()] === dayName &&
        (activityId === "all" || a.type === activityId)
      );
    });

    return {
      name: dayName,
      completed: dayActivities.filter((a) => a.status === "completed").length
      pending: dayActivities.filter((a) => a.status === "pending").length,
    };
  });
};

const facilityData = [
  {
    id: "1",
    name: "Pavia Plant",
    pump: 12,
    meter: 8,
    leak: 3,
    lat: 10.7766,
    lng: 122.5447,
    status: "operational",
    details: "All systems nominal.",
  },
  {
    id: "2",
    name: "Wakeboard Pump Station",
    pump: 8,
    meter: 5,
    leak: 1,
    lat: 10.781,
    lng: 122.5691,
    status: "operational",
    details: "Operating at 85% capacity.",
  },
  {
    id: "3",
    name: "PR2 Reservoir",
    pump: 5,
    meter: 12,
    leak: 4,
    lat: 10.7924,
    lng: 122.5512,
    status: "warning",
    details: "Pressure drop detected. Inspection required.",
  },
  {
    id: "4",
    name: "BAR Water Treatment",
    pump: 3,
    meter: 6,
    leak: 2,
    lat: 10.801,
    lng: 122.5499,
    status: "critical",
    details: "Main pump failure. Emergency maintenance dispatched.",
  },
];

export function DashboardView({
  setActiveTab,
  currentUid,
}: DashboardViewProps) {
  const [selectedActivity, setSelectedActivity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("All Areas");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const { isLowDataMode } = useNetworkInfo();

  useEffect(() => {
    if (!currentUid) {
      setIsSyncing(false);
      return;
    }

    const tasksQuery = query(collection(db, `users/${currentUid}/tasks`));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(fetchedTasks);
    }, (error) => {
      console.error("Tasks listener error:", error);
    });

    const actsQuery = query(collection(db, `users/${currentUid}/activities`));
    const unsubActs = onSnapshot(actsQuery, (snapshot) => {
      const fetchedActs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setActivities(fetchedActs);
      setIsSyncing(false);
    }, (error) => {
      console.error("Activities listener error:", error);
      setIsSyncing(false);
    });

    const invQuery = query(collection(db, `users/${currentUid}/inventory`));
    const unsubInv = onSnapshot(invQuery, (snapshot) => {
      let lowCount = 0;
      snapshot.forEach((doc) => {
        const item = doc.data();
        if (item.currentStock <= item.minThreshold) {
          lowCount++;
        }
      });
      setLowStockCount(lowCount);
    }, (error) => {
      console.error("Inventory listener error:", error);
    });

    const areasQuery = query(collection(db, `users/${currentUid}/areas`));
    const unsubAreas = onSnapshot(areasQuery, (snapshot) => {
      const fetchedAreas = snapshot.docs.map((doc) => doc.data().name as string);
      setCustomAreas(fetchedAreas);
    }, (error) => {
      console.error("Areas listener error:", error);
    });

    return () => {
      unsubTasks();
      unsubActs();
      unsubInv();
      unsubAreas();
    };
  }, [currentUid]);

  const defaultAreas = [
    "All Areas",
    "DHP",
    "PRR",
    "PR2",
    "BAR",
    "LEG",
    "Pavia",
    "Wakeboard",
  ];

  const areas = useMemo(() => {
    return [...defaultAreas, ...customAreas];
  }, [customAreas]);

  const filteredTasks = useMemo(() => {
    return selectedArea === "All Areas"
      ? tasks
      : tasks.filter((t) => t.location?.includes(selectedArea));
  }, [tasks, selectedArea]);

  const filteredActivities = useMemo(() => {
    let acts = activities;
    if (selectedArea !== "All Areas")
      acts = acts.filter((a) => a.area?.includes(selectedArea));
    if (selectedActivity !== "all")
      acts = acts.filter((a) => a.type === selectedActivity);
    return acts;
  }, [activities, selectedArea, selectedActivity]);

  const tasksCompletedPercent = useMemo(() => {
    if (filteredTasks.length === 0) return 0;
    const completed = filteredTasks.filter(
      (t) => t.status === "completed",
    ).length;
    return Math.round((completed / filteredTasks.length) * 100);
  }, [filteredTasks]);

  const tasksByArea = useMemo(() => {
    const areaNames = ["DHP", "PRR", "PR2", "BAR", "LEG", "Pavia", "Wakeboard"];
    return areaNames.map((area) => {
      // Just check if location string includes area name loosely
      const areaTasks = tasks.filter((t) => {
        const loc = (t.location || "").toLowerCase();
        const a = area.toLowerCase();
        return loc.includes(a);
      });
      return {
        name: area,
        done: areaTasks.filter((t) => t.status === "completed").length,
        pending: areaTasks.filter((t) => t.status !== "completed").length,
      };
    });
  }, [tasks]);

  const sunburstData = useMemo(() => {
    const innerData: any[] = [];
    const outerData: any[] = [];

    tasksByArea.forEach((area, index) => {
      const total = area.done + area.pending;
      if (total > 0) {
        innerData.push({
          name: area.name,
          value: total,
          fill: `#00${(66 - index * 5).toString().padStart(2, "0")}CC`,
        });
        if (area.done > 0)
          outerData.push({
            name: `${area.name} (Done)`,
            value: area.done,
            fill: "#22C55E",
          });
        if (area.pending > 0)
          outerData.push({
            name: `${area.name} (Pending)`,
            value: area.pending,
            fill: "#FCD34D",
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
              onClick={async () => {
                const newArea = window.prompt("Enter new area name:");
                if (newArea && newArea.trim() && currentUid) {
                  try {
                    await addDoc(collection(db, `users/${currentUid}/areas`), {
                      name: newArea.trim().toUpperCase(),
                    });
                  } catch (error) {
                    console.error("Error adding area:", error);
                    alert("Failed to add area. Please try again.");
                  }
                }
              }}
              className="flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-full text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/60 transition-colors"
              title="Add New Area"
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
                {activityTypes.map((act) => (
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
        <div className="bg-error-container text-on-error-container p-4 rounded-xl shadow-sm flex items-start sm:items-center gap-3 border border-error/20 justify-between flex-col md:flex-row">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 md:mt-0 text-error" />
            <div>
              <h4 className="font-semibold">Inventory Alert: Low Stock</h4>
              <p className="text-sm opacity-90 mt-0.5">
                There are {lowStockCount} items running below minimum threshold
                limits. Please review.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("inventory")}
            className="px-4 py-2 border border-error/30 rounded-lg text-sm font-semibold hover:bg-error/10 shrink-0 self-end md:self-center"
          >
            View Inventory
          </button>
        </div>
      )}

      {isSyncing ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-gutter">
            <div className="h-[120px] skeleton"></div>
            <div className="h-[120px] skeleton"></div>
            <div className="h-[120px] skeleton"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <div className="h-[360px] skeleton"></div>
            <div className="h-[360px] skeleton"></div>
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
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary/70 mt-0.5">
                    Assigned Work
                  </span>
                </div>
                <div className="bg-primary/10 p-1.5 rounded text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-display font-bold text-on-surface leading-none">
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
                  <span className="text-[10px] uppercase font-bold tracking-wider text-secondary/80 mt-0.5">
                    Ad-Hoc Logs
                  </span>
                </div>
                <div className="bg-secondary/10 p-1.5 rounded text-secondary">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              {filteredActivities.length > 0 ? (
                <div className="flex items-end justify-between mt-auto">
                  <span className="text-3xl font-display font-bold text-secondary leading-none">
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
              {new Set(filteredActivities.flatMap((a) => a.staff || [])).size >
              0 ? (
                <div className="flex items-end justify-between mt-auto">
                  <span className="text-3xl font-display font-bold text-tertiary leading-none">
                    {
                      new Set(filteredActivities.flatMap((a) => a.staff || []))
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
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          dataKey="done"
                          name="Completed"
                          fill="#0066CC"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={30}
                        />
                        <Bar
                          dataKey="pending"
                          name="Pending"
                          fill="#FF6B35"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={30}
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
                      <PieChart>
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
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Task Density Heatmap */}
                <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base text-on-surface font-semibold">
                      Task Density by Area
                    </h3>
                  </div>

                  <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="min-w-[400px]">
                      {/* Grid header */}
                      <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-2 mb-2">
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
                        {[
                          "DHP (Main)",
                          "PRR",
                          "PR2 (East)",
                          "BAR",
                          "LEG",
                          "Pavia Sub",
                          "Wakeboard",
                        ].map((area, rIdx) => (
                          <div
                            key={area}
                            className="grid grid-cols-[80px_repeat(7,1fr)] gap-2"
                          >
                            {/* Frozen left column */}
                            <div className="sticky left-0 z-10 bg-white flex items-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] pr-2">
                              <span
                                className="text-xs font-semibold text-on-surface truncate"
                                title={area}
                              >
                                {area}
                              </span>
                            </div>

                            {/* Day cells */}
                            {[...Array(7)].map((_, cIdx) => {
                              const intensity = Math.floor(Math.random() * 4); // 0 to 3
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
                                  title={`${area} - Day ${cIdx + 1}`}
                                >
                                  {intensity > 0
                                    ? intensity * 10 +
                                      Math.floor(Math.random() * 10)
                                    : ""}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
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
                      <BarChart
                        data={[
                          { name: "Mon", cust: 2, stand: 1, svc: 3, main: 1 },
                          { name: "Tue", cust: 1, stand: 2, svc: 2, main: 0 },
                          { name: "Wed", cust: 3, stand: 1, svc: 4, main: 2 },
                        ]}
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
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Done", value: 45 },
                            { name: "Pending", value: 20 },
                            { name: "In Progress", value: 15 },
                          ]}
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
                          <LineChart
                            data={mockDataByActivity["leak_repair"]}
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
                          92%
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
                      <PieChart margin={{ top: 20 }}>
                        <Pie
                          data={[{ value: 85 }, { value: 15 }]}
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
                      <BarChart
                        data={[
                          { name: "John Doe", count: 42 },
                          { name: "Jane Smith", count: 38 },
                          { name: "Mike Ross", count: 30 },
                          { name: "Sarah Lee", count: 45 },
                        ]}
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
                  <h3 className="text-base font-semibold mb-4 text-on-surface flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-primary" /> GPS Locations
                  </h3>
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
                        <ComposedChart
                          data={[
                            { name: "W1", sched: 10, comp: 8 },
                            { name: "W2", sched: 12, comp: 12 },
                            { name: "W3", sched: 15, comp: 10 },
                            { name: "W4", sched: 8, comp: 9 },
                          ]}
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
                      <PieChart>
                        <Pie
                          data={[{ value: 78 }, { value: 22 }]}
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
                      const intensity = Math.floor(Math.random() * 4);
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
                            {Math.floor(Math.random() * 10)}x
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
                      <PieChart>
                        <Pie
                          data={[
                            { name: "10,000L", value: 30 },
                            { name: "5,000L", value: 45 },
                            { name: "Over 10kL", value: 25 },
                          ]}
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
                        <BarChart
                          data={[
                            { name: "Pavia", count: 12 },
                            { name: "Wakeboard", count: 8 },
                            { name: "PR2", count: 5 },
                            { name: "BAR", count: 9 },
                          ]}
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
                      <LineChart
                        data={[
                          { name: "Jan", count: 2 },
                          { name: "Feb", count: 1 },
                          { name: "Mar", count: 4 },
                          { name: "Apr", count: 2 },
                          { name: "May", count: 5 },
                          { name: "Jun", count: 3 },
                        ]}
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
                      <BarChart
                        data={[
                          { name: "Pump A", maint: 10, rep: 5, fail: 2 },
                          { name: "Pump B", maint: 8, rep: 3, fail: 1 },
                          { name: "Pump C", maint: 12, rep: 4, fail: 4 },
                        ]}
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
                      <ComposedChart
                        data={[
                          { time: "08:00", flow: 120, press: 45 },
                          { time: "09:00", flow: 122, press: 44 },
                          { time: "10:00", flow: 118, press: 46 },
                          { time: "11:00", flow: 125, press: 42 },
                          { time: "12:00", flow: 130, press: 40 },
                          { time: "13:00", flow: 110, press: 48 },
                        ]}
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
                      <ScatterChart margin={{ left: -20 }}>
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
                          data={[
                            { energy: 100, water: 200 },
                            { energy: 120, water: 100 },
                            { energy: 170, water: 300 },
                            { energy: 140, water: 250 },
                            { energy: 150, water: 400 },
                            { energy: 110, water: 280 },
                          ]}
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
                      <BarChart
                        data={[
                          { name: "Filter 1", sched: 30, actual: 35 },
                          { name: "Filter 2", sched: 30, actual: 28 },
                          { name: "Filter 3", sched: 45, actual: 45 },
                          { name: "Filter 4", sched: 60, actual: 70 },
                        ]}
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
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="100%"
                        barSize={20}
                        data={[
                          { name: "Compliance", value: 92, fill: "#22C55E" },
                        ]}
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
                      92%
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
                      <BarChart
                        data={[
                          { name: "Zone A", vol: 400 },
                          { name: "Zone B", vol: 300 },
                          { name: "Zone C", vol: 500 },
                          { name: "Zone D", vol: 200 },
                        ]}
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
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Recyclables", value: 45 },
                            { name: "Organic", value: 35 },
                            { name: "General", value: 20 },
                          ]}
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
                      <BarChart
                        data={[
                          { name: "Genset Area", usage: 120 },
                          { name: "Admin Bldg", usage: 80 },
                          { name: "Pump Station", usage: 150 },
                          { name: "Gate", usage: 50 },
                        ]}
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
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="100%"
                        barSize={20}
                        data={[
                          { name: "Compliance", value: 88, fill: "#0066CC" },
                        ]}
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
                        88%
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
                      const intensity = Math.floor(Math.random() * 4);
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
                    onClick={() => setIsExportModalOpen(false)}
                    className="w-full px-4 py-3 text-sm font-semibold text-on-surface border border-outline hover:bg-surface-container-low rounded-xl transition-colors flex items-center gap-3"
                  >
                    <FileEdit className="w-5 h-5 text-on-surface-variant" />{" "}
                    Export CSV Data
                  </button>
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="w-full px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm flex items-center gap-3"
                  >
                    <ArrowUpRight className="w-5 h-5 text-on-primary" />{" "}
                    Download PDF Report
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
        </>
      )}
    </div>
  );
}
