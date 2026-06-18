import React, { useState, useEffect, useMemo } from "react";
import {
  Square,
  Wrench,
  Droplet,
  Brush,
  Settings2,
  Waves,
  Trash2,
  Camera,
  CheckSquare,
  Plus,
  Power,
  Users,
  MapPin,
  X,
  Clock,
  ChevronDown,
  Loader2,
  ShieldAlert,
  Activity,
  History,
  AlertTriangle
} from "lucide-react";
import { openDB } from "idb";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { areasAndSites, defaultStaff } from "../lib/dataStore";
import { useNetworkInfo } from "../utils/useNetworkInfo";
import { compressImage } from "../utils/imageCompression";
import { useToast } from "../utils/ToastContext";
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  where,
} from "firebase/firestore";
import {
  PrintableMeterTest,
  MeterTestData,
} from "../components/PrintableMeterTest";

const initHistoryDB = async () => {
  return openDB("watsan-history-cache", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("activities")) {
        const store = db.createObjectStore("activities", { keyPath: "id" });
        store.createIndex("site", "siteOrWell");
        store.createIndex("type", "type");
      }
    },
  });
};

const activityTypes = [
  { id: "meter_inst", icon: Square, label: "Meter Installation" },
  { id: "meter_rep", icon: Square, label: "Meter Replacement" },
  { id: "meter_test", icon: Square, label: "Meter Test" },
  { id: "meter_check_bulk", icon: Square, label: "Meter Checking (Bulk)" },
  {
    id: "meter_check_indiv",
    icon: Square,
    label: "Meter Checking (Individual)",
  },
  { id: "reconnection", icon: Power, label: "Reconnection" },
  { id: "leak_repair", icon: Wrench, label: "Leak Repair" },
  { id: "leak_detect", icon: Wrench, label: "Leak Detection" },
  { id: "flushing", icon: Droplet, label: "Flushing" },
  { id: "tank_clean", icon: Brush, label: "Tank Cleaning" },
  { id: "tank_oc", icon: Settings2, label: "Tank Opening & Closing" },
  { id: "pump_mon", icon: Settings2, label: "Pump House Monitoring" },
  { id: "genset_mon", icon: Power, label: "Genset Monitoring" },
  { id: "backwash", icon: Waves, label: "Backwash" },
  { id: "hydro_test", icon: Droplet, label: "Hydro Testing" },
];

interface ActivityViewProps {
  isOnline?: boolean;
  currentUser?: string | null;
  currentUid?: string | null;
}

export function ActivityView({
  isOnline = true,
  currentUser,
  currentUid,
}: ActivityViewProps) {
  const { isLowDataMode } = useNetworkInfo();
  const { showToast } = useToast();
  const [photoDataSaved, setPhotoDataSaved] = useState(0); // Track MB saved
  const [isSubmitting, setIsSubmitting] = useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let savedBytes = 0;

    // Simulate reading and compressing
    for (let i = 0; i < files.length; i++) {
      const originalFile = files[i];
      const compressed = await compressImage(originalFile, isLowDataMode);

      if (compressed.size < originalFile.size) {
        savedBytes += originalFile.size - compressed.size;
      }
    }

    if (savedBytes > 0) {
      setPhotoDataSaved((prev) => prev + savedBytes);
    }
  };

  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  // Specific state for Flushing
  const [blowOffs, setBlowOffs] = useState<{ id: number; name: string; initialPhoto?: string; finalPhoto?: string }[]>([
    { id: Date.now(), name: "Blow-off 1" },
  ]);

  const handleBlowOffPhoto = (id: number, type: 'initial' | 'final', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBlowOffs(prev => prev.map(bo => {
        if (bo.id === id) {
          return { ...bo, [type === 'initial' ? 'initialPhoto' : 'finalPhoto']: dataUrl };
        }
        return bo;
      }));
    };
    reader.readAsDataURL(file);
  };
  
  // Form State
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedSiteOrWell, setSelectedSiteOrWell] = useState("");
  const [blockLot, setBlockLot] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);

  const [visitCount, setVisitCount] = useState<number>(1);
  const [repPresent, setRepPresent] = useState<"Y" | "N">("N");
  const [leakIndication, setLeakIndication] = useState<"Y" | "N">("N");

  const [currentReading, setCurrentReading] = useState<number | "">("");
  const [reading1, setReading1] = useState<number | "">("");
  const [reading2, setReading2] = useState<number | "">("");
  const [reading3, setReading3] = useState<number | "">("");
  const [witnessedBy, setWitnessedBy] = useState("");
  const [testAccountName, setTestAccountName] = useState("");
  const [jobOrderNumber, setJobOrderNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  
  const [isMeterRunning, setIsMeterRunning] = useState<string>("Yes");
  const [needsDeclogging, setNeedsDeclogging] = useState<string>("No");
  const [needsReplacement, setNeedsReplacement] = useState<string>("No");
  const [prevMeterSize, setPrevMeterSize] = useState("");
  const [prevMeterBrand, setPrevMeterBrand] = useState("");
  const [prevMeterSerial, setPrevMeterSerial] = useState("");
  const [prevMeterReading, setPrevMeterReading] = useState<number | "">("");
  const [newMeterSize, setNewMeterSize] = useState("");
  const [newMeterBrand, setNewMeterBrand] = useState("");
  const [newMeterSerial, setNewMeterSerial] = useState("");
  const [newMeterInitialReading, setNewMeterInitialReading] = useState<
    number | ""
  >("");

  const [isManagerView, setIsManagerView] = useState(false);
  const [meterTestStatus, setMeterTestStatus] = useState("Pending");
  
  const [gensetInitialFuel, setGensetInitialFuel] = useState<number | "">("");
  const [gensetFinalFuel, setGensetFinalFuel] = useState<number | "">("");
  
  const [siteHistory, setSiteHistory] = useState<any[]>([]);

  const { fuelChartData, lastPmsDate } = useMemo(() => {
    const gensetHistory = siteHistory.filter(h => h.type === 'genset_mon').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const fuelChartData = gensetHistory.map(h => {
      const p = h.details;
      let level = null;
      if (p?.gensetFinalFuel != null && p?.gensetFinalFuel !== "") {
        level = Number(p.gensetFinalFuel);
      } else if (p?.gensetRefillLevel && p.gensetRefillLevel !== "" && p.gensetRefillLevel !== "low") {
        level = Number(p.gensetRefillLevel);
      } else if (p?.gensetInitialFuel != null && p?.gensetInitialFuel !== "") {
        level = Number(p.gensetInitialFuel);
      }
      return {
        date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fuel: level
      };
    }).filter(d => d.fuel !== null);
    
    // Find last PMS date
    const lastPms = gensetHistory.slice().reverse().find(h => h.details?.gensetCause === "pms");
    
    return { fuelChartData, lastPmsDate: lastPms ? new Date(lastPms.date).toLocaleDateString() : null };
  }, [siteHistory]);

  useEffect(() => {
    if (!currentUid || !selectedActivity || !isOnline) {
      setPendingTasks([]);
      return;
    }
    const fetchTasks = async () => {
      try {
        const q = query(
          collection(db, `users/${currentUid}/tasks`),
          where("status", "==", "pending") // Could also check assignedTo here, but doing it in memory is fine given no complex index needed 
        );
        const snap = await getDocs(q);
        const tasks = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((t: any) => t.linkedActivity === selectedActivity && (t.assignedTo === currentUser || t.assignedTo === "Unassigned")); // Filter for current activity and assignee
        setPendingTasks(tasks);
      } catch (err) {
        console.error("Error fetching linked tasks", err);
      }
    };
    fetchTasks();
  }, [currentUid, selectedActivity, isOnline, currentUser]);

  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId);
    if (!taskId) {
      setJobOrderNumber("");
      setAccountNumber("");
      setTestAccountName("");
      return;
    }
    const task = pendingTasks.find(t => t.id === taskId);
    if (task) {
      if (task.joNumber) setJobOrderNumber(task.joNumber);
      if (task.accountNumber) setAccountNumber(task.accountNumber);
      if (task.accountName) setTestAccountName(task.accountName);
    }
  };

  useEffect(() => {
    if (!selectedSiteOrWell || !currentUid) return;
    const fetchHistory = async () => {
      try {
        const dbIdb = await initHistoryDB();
        if (isOnline) {
          const q = query(
            collection(db, `users/${currentUid}/activities`),
            where("siteOrWell", "==", selectedSiteOrWell)
          );
          const snap = await getDocs(q);
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          docs.forEach(d => dbIdb.put("activities", d));
          setSiteHistory(docs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else {
          const tx = dbIdb.transaction("activities", "readonly");
          const index = tx.store.index("site");
          let offlineDocs = await index.getAll(selectedSiteOrWell);
          setSiteHistory(offlineDocs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    };
    fetchHistory();
  }, [selectedSiteOrWell, isOnline, currentUid]);

  const [customStaff, setCustomStaff] = useState<string[]>([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [didRefillFuel, setDidRefillFuel] = useState<boolean>(false);
  const [gensetCause, setGensetCause] = useState<string>("");
  const [gensetRefillLevel, setGensetRefillLevel] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("watsanStaff");
    if (stored) {
      const parsed = JSON.parse(stored);
      setCustomStaff(
        parsed.filter(
          (s: string) =>
            !s.includes("Kevin Vilbar") && s !== "Darwil Fernandez",
        ),
      );
    } else {
      setCustomStaff(defaultStaff);
    }
  }, []);

  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [gpsLocation, setGpsLocation] = useState("Acquiring location...");
  const [isLocating, setIsLocating] = useState(true);

  const requestLocation = () => {
    setIsLocating(true);
    setGpsLocation("Acquiring location...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation(
            `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          );
          setIsLocating(false);
        },
        (error) => {
          let errMsg = "Location Unavailable";
          if (error.code === 1) errMsg = "Permission Denied";
          else if (error.code === 2) errMsg = "Position Unavailable";
          else if (error.code === 3) errMsg = "Timeout";
          setGpsLocation(`${errMsg} (Mock: 10.776632, 122.544711)`);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 },
      );
    } else {
      setGpsLocation("Geolocation not supported");
      setIsLocating(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US"));
    }, 1000);

    requestLocation();

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    // Smart Defaults: Auto-select if only one site option or reset
    const options = siteOptions();
    if (options.length === 1) {
      setSelectedSiteOrWell(options[0]);
    } else {
      setSelectedSiteOrWell("");
    }
  }, [selectedArea, selectedActivity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Silently capture GPS in background
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log(
            "Geotagged test:",
            position.coords.latitude,
            position.coords.longitude,
          );
          finalizeSubmit();
        },
        (error) => {
          console.warn("Geolocation failed silently:", error.message);
          finalizeSubmit();
        },
        { timeout: 5000 },
      );
    } else {
      finalizeSubmit();
    }
  };

  const finalizeSubmit = async () => {
    let linkedMsg = "";

    if (!currentUid) {
      showToast("Error: User not authenticated", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      if (selectedActivity === "meter_test" && meterTestStatus === "Failed") {
        const taskId = `task-${Date.now()}`;
        await setDoc(doc(db, `users/${currentUid}/tasks`, taskId), {
          userId: currentUid,
          title: "Meter Replacement Needed",
          priority: "high",
          location: selectedSiteOrWell || selectedArea || "Field",
          deadline: "Pending Assignment",
          description: `Generated from failed Meter Test at ${blockLot || "unknown location"}. Scheduled for replacement.`,
          assignedTo: "Unassigned",
          status: "pending",
          isSynced: navigator.onLine,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        linkedMsg +=
          '\n✓ Automatically created "Pending Meter Replacement" task.';
      }

      if (selectedActivity === "leak_detect" || leakIndication === "Y") {
        const taskId = `task-${Date.now() + 1}`;
        await setDoc(doc(db, `users/${currentUid}/tasks`, taskId), {
          userId: currentUid,
          title: "Pending Leak Repair",
          priority: "high",
          location: selectedSiteOrWell || selectedArea || "Field",
          deadline: "Pending Assignment",
          description: `Leak detected at ${blockLot || "unknown location"} during ${selectedActivity === "leak_detect" ? "Leak Detection" : "other activity"}. Requires immediate follow-up.`,
          assignedTo: "Unassigned",
          status: "pending",
          isSynced: navigator.onLine,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        linkedMsg += '\n✓ Automatically created "Pending Leak Repair" task.';
      }

      // Explicitly complete the selected task if there is one
      if (selectedTaskId) {
        await updateDoc(doc(db, `users/${currentUid}/tasks`, selectedTaskId), {
          status: "completed",
          updatedAt: serverTimestamp(),
        });
        linkedMsg += `\n✓ Marked associated task as completed.`;
      }

      // Instead of sweeping all tasks iteratively like localStorage, we just query ones that match.
      // But resolving tasks across all collections for closing is an advanced feature; for prototype, update tasks that match condition:
      if (
        selectedActivity === "meter_rep" ||
        selectedActivity === "leak_repair"
      ) {
        const q = query(collection(db, `users/${currentUid}/tasks`));
        const snapshots = await getDocs(q);
        let closedCount = 0;

        snapshots.forEach((taskDoc) => {
          const taskData = taskDoc.data();
          if (taskData.status !== "completed") {
            let matches = false;
            if (
              selectedActivity === "meter_rep" &&
              taskData.title.includes("Replacement")
            )
              matches = true;
            if (
              selectedActivity === "leak_repair" &&
              taskData.title.includes("Leak")
            )
              matches = true;

            if (matches) {
              updateDoc(taskDoc.ref, {
                status: "completed",
                description:
                  taskData.description +
                  `\n[Resolved by activity on ${currentDate}]`,
                updatedAt: serverTimestamp(),
              });
              closedCount++;
            }
          }
        });

        if (closedCount > 0) {
          linkedMsg += `\n✓ Auto-closed ${closedCount} pending task(s).`;
        }
      }

      // --- Save Activity ---
      const actId = `act-${Date.now()}`;
      await setDoc(doc(db, `users/${currentUid}/activities`, actId), {
        userId: currentUid,
        type: selectedActivity,
        area: selectedArea,
        siteOrWell: selectedSiteOrWell,
        blockLot: blockLot,
        staff: selectedStaff,
        date: new Date().toISOString(),
        status: "completed",
        isSynced: isOnline,
        blowOffs: selectedActivity === "flushing" ? blowOffs : [],
        details: {
          meterTestStatus,
          leakIndication,
          ...(isMeterCheck
            ? { isMeterRunning, needsDeclogging, needsReplacement }
            : {}),
          ...(isMeterReplacement
            ? {
                prevMeterSize,
                prevMeterBrand,
                prevMeterSerial,
                prevMeterReading,
                newMeterSize,
                newMeterBrand,
                newMeterSerial,
                newMeterInitialReading,
              }
            : {}),
          ...(selectedActivity === "genset_mon" ? {
            gensetCause,
            gensetRefillLevel,
            didRefillFuel,
            gensetInitialFuel,
            gensetFinalFuel,
          } : {})
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const msg =
        (isOnline
          ? "Accomplishment report submitted successfully!"
          : "Offline mode: Report saved locally. Will sync when online.") +
        linkedMsg;
      showToast(msg, "success");

      if (selectedActivity === "meter_test" && testAccountName) {
        // Trigger print after save
        setTimeout(() => {
          window.print();
        }, 500);
      }
    } catch (e) {
      console.error("Error saving activity to Firebase:", e);
      showToast("Error saving report", "error");
    }

    setSelectedActivity(null);
    setSelectedArea("");
    setSelectedSiteOrWell("");
    setBlockLot("");
    setSelectedStaff([]);
    setBlowOffs([{ id: Date.now(), name: "Blow-off 1" }]);
    setIsSubmitting(false);

    // Reset newly added meter states
    setVisitCount(1);
    setRepPresent("N");
    setLeakIndication("N");
    setCurrentReading("");
    setReading1("");
    setReading2("");
    setReading3("");
    setMeterTestStatus("Pending");
    setGensetCause("");
    setGensetRefillLevel("");
  };

  const addBlowOff = () => {
    setBlowOffs([
      ...blowOffs,
      { id: Date.now(), name: `Blow-off ${blowOffs.length + 1}` },
    ]);
  };

  const removeBlowOff = (id: number) => {
    if (blowOffs.length <= 1) return;
    setBlowOffs(blowOffs.filter((b) => b.id !== id));
  };

  const toggleStaff = (staff: string) => {
    if (selectedStaff.includes(staff)) {
      setSelectedStaff(selectedStaff.filter((s) => s !== staff));
    } else {
      setSelectedStaff([...selectedStaff, staff]);
    }
  };

  const isMeterActivity = [
    "meter_inst",
    "meter_rep",
    "meter_test",
    "meter_check_bulk",
    "meter_check_indiv",
  ].includes(selectedActivity || "");
  const isPumpOrGenset = ["pump_mon", "genset_mon"].includes(
    selectedActivity || "",
  );
  const isTankActivity = ["tank_clean", "tank_oc"].includes(
    selectedActivity || "",
  );
  const needsWellOrTank =
    isPumpOrGenset || isTankActivity || selectedActivity === "backwash";
  const isMeterTest = selectedActivity === "meter_test";
  const isMeterCheck =
    selectedActivity === "meter_check_bulk" ||
    selectedActivity === "meter_check_indiv";
  const isMeterReplacement = selectedActivity === "meter_rep";

  const [customAreas, setCustomAreas] = useState<{area: string, name: string, sites: string[]}[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/areas`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          area: data.name,
          name: data.name,
          sites: []
        };
      });
      setCustomAreas(fetched);
    }, (error) => {
        console.error("Area listener error:", error);
    });
    return () => unsubscribe();
  }, [currentUid]);

  const allAreasAndSites = [...areasAndSites, ...customAreas];

  const siteOptions = () => {
    const areaData = allAreasAndSites.find((a) => a.area === selectedArea);
    if (!areaData) return [];

    // Smart Defaults logic for specific facilities
    if (selectedArea === "PAVIA") {
      if (isPumpOrGenset)
        return [
          "Genset - Primary",
          "Genset - Backup",
          "Main Pump Group 1",
          "Main Pump Group 2",
        ];
      if (isTankActivity)
        return [
          "Clarifier Sub-Tank A",
          "Clarifier Sub-Tank B",
          "Filtration Buffer Tank",
        ];
      return [
        "Plant 1: Main Control",
        "Plant 2: Booster Area",
        "Filtration System",
        "Intake Area",
      ];
    }

    if (selectedArea === "WAKEBOARD") {
      if (isPumpOrGenset) return ["Wakeboard Booster 1", "Wakeboard Genset"];
      if (isTankActivity) return ["Wakeboard Primary Tank", "Secondary Buffer"];
      return areaData.sites;
    }

    if (needsWellOrTank) {
      const wellsAndTanks = [];
      for (let i = 1; i <= 6; i++) {
        wellsAndTanks.push(`Well ${i}`);
        wellsAndTanks.push(`Tank ${i}`);
      }
      return wellsAndTanks;
    } else {
      return areaData.sites;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-margin-mobile mt-lg space-y-gutter pb-24 animate-in fade-in duration-300">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-headline-md font-semibold text-on-surface">
          Activity Logging
        </h2>
        <p className="text-on-surface-variant text-label-md">
          Log a new accomplishment or field activity with exact details.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Selection List for Activity Types */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-4 relative z-20 overflow-hidden flex flex-col">
          <label className="font-headline-md text-headline-md text-on-surface mb-3 block border-b border-outline-variant/30 pb-2">
            Activity Type
          </label>
          <div className="flex overflow-x-auto pb-2 -mx-2 px-2 gap-2 hide-scrollbar snap-x">
            {activityTypes.map((act) => {
              const isSelected = selectedActivity === act.id;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setSelectedActivity(act.id)}
                  className={`snap-start shrink-0 px-4 py-2 rounded-2xl border-2 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/20 text-sm font-semibold whitespace-nowrap ${
                    isSelected
                      ? "bg-primary border-primary text-white shadow-md"
                      : "bg-surface border-transparent hover:bg-surface-variant text-on-surface-variant"
                  }`}
                >
                  {act.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Form Sections */}
        <div
          className={`transition-all space-y-lg ${selectedActivity ? "opacity-100 block" : "opacity-50 grayscale pointer-events-none"}`}
        >
          {/* Manager View Toggle */}
          <div className="flex justify-end relative z-30">
            <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant hover:bg-surface-variant transition-colors">
              <input
                type="checkbox"
                checked={isManagerView}
                onChange={(e) => setIsManagerView(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              Simulate Manager View (Show Calculations)
            </label>
          </div>

          {/* Shared Real-time Context */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between z-20 relative">
            <div className="flex items-center gap-3 text-primary">
              <div className="p-2 bg-primary/10 rounded-full">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm">{currentDate}</div>
                <div className="font-mono text-xs opacity-80">
                  {currentTime}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-primary">
              <button
                type="button"
                onClick={requestLocation}
                disabled={isLocating}
                className="p-2 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50"
                title="Refresh Location"
              >
                <MapPin
                  className={`w-5 h-5 ${isLocating ? "animate-pulse" : ""}`}
                />
              </button>
              <div
                className="font-mono text-sm font-medium leading-none max-w-[200px] sm:max-w-none truncate"
                title={gpsLocation}
              >
                {gpsLocation}
              </div>
            </div>
          </div>

          {/* SECTION 1: General & Location Metadata */}
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-4 relative z-20">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-3 border-b border-outline-variant/30 pb-2">
              Location & General Details
            </h3>
            
            {pendingTasks.length > 0 && (
              <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-md">
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Fill from Pending Task
                </label>
                <select
                  className="w-full rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                  value={selectedTaskId}
                  onChange={(e) => handleTaskSelect(e.target.value)}
                >
                  <option value="">-- Select a Task --</option>
                  {pendingTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} {t.joNumber ? `(JO: ${t.joNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              {/* Job & Account (Mainly for meters) */}
              {isMeterActivity && (
                <>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Job Order ID{" "}
                      {isMeterTest && <span className="text-error">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. JOB0003459"
                      value={jobOrderNumber}
                      onChange={(e) => setJobOrderNumber(e.target.value)}
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required={isMeterTest}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Account Number{" "}
                      {isMeterTest && <span className="text-error">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BARS03041029"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required={isMeterTest}
                    />
                  </div>
                  <div className="flex flex-col gap-xs md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Date Issued
                    </label>
                    <input
                      type="date"
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none w-full md:w-1/2"
                      required={isMeterTest}
                    />
                  </div>
                </>
              )}

              {/* Main Actor & Companions Selection */}
              <div className="flex flex-col gap-xs md:col-span-2 relative">
                <div className="flex flex-col mb-2">
                  <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                    <Users className="w-4 h-4" /> Primary Actor
                  </label>
                  <div className="text-body-md font-medium text-on-surface py-2 bg-surface-container-low px-3 rounded border border-outline-variant italic">
                    {currentUser || "Current User"}
                  </div>
                </div>

                <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                  <Users className="w-4 h-4" /> Companions (Optional)
                </label>
                <div
                  className="min-h-[42px] cursor-pointer rounded bg-white border border-outline-variant focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent text-body-md py-2 px-3 flex flex-wrap gap-2 items-center"
                  onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
                >
                  {selectedStaff.length === 0 ? (
                    <span className="text-outline-variant">
                      Select companions...
                    </span>
                  ) : (
                    selectedStaff.map((staff) => (
                      <span
                        key={staff}
                        className="bg-surface-variant text-on-surface-variant text-label-sm px-2 py-0.5 rounded flex items-center gap-1"
                      >
                        {staff}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStaff(staff);
                          }}
                        />
                      </span>
                    ))
                  )}
                </div>

                {staffDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-outline-variant rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Add new companion..."
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="flex-1 rounded border border-outline-variant py-1 px-2 text-sm focus:ring-primary focus:border-transparent outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (
                              newStaffName.trim() &&
                              !customStaff.includes(newStaffName.trim())
                            ) {
                              setCustomStaff([
                                newStaffName.trim(),
                                ...customStaff,
                              ]);
                              setNewStaffName("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            newStaffName.trim() &&
                            !customStaff.includes(newStaffName.trim())
                          ) {
                            setCustomStaff([
                              newStaffName.trim(),
                              ...customStaff,
                            ]);
                            setNewStaffName("");
                          }
                        }}
                        className="bg-primary/10 text-primary px-3 rounded hover:bg-primary/20 text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {customStaff.map((staff, index) => (
                        <div
                          key={staff}
                          className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded border border-transparent hover:border-outline-variant/30 group"
                        >
                          {editingIndex === index ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (editValue.trim()) {
                                    const newStaff = [...customStaff];
                                    newStaff[index] = editValue.trim();
                                    setCustomStaff(newStaff);
                                    if (selectedStaff.includes(staff)) {
                                      setSelectedStaff(
                                        selectedStaff
                                          .filter((s) => s !== staff)
                                          .concat(editValue.trim()),
                                      );
                                    }
                                    setEditingIndex(null);
                                  }
                                }
                              }}
                              onBlur={() => {
                                if (editValue.trim()) {
                                  const newStaff = [...customStaff];
                                  newStaff[index] = editValue.trim();
                                  setCustomStaff(newStaff);
                                  if (selectedStaff.includes(staff)) {
                                    setSelectedStaff(
                                      selectedStaff
                                        .filter((s) => s !== staff)
                                        .concat(editValue.trim()),
                                    );
                                  }
                                  setEditingIndex(null);
                                } else {
                                  setEditingIndex(null);
                                }
                              }}
                              className="flex-1 border border-primary text-sm px-1 outline-none font-body-md"
                            />
                          ) : (
                            <label className="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden">
                              <input
                                type="checkbox"
                                checked={selectedStaff.includes(staff)}
                                onChange={() => toggleStaff(staff)}
                                className="rounded border-outline-variant text-primary focus:ring-primary flex-shrink-0"
                              />
                              <span className="text-label-md text-on-surface truncate">
                                {staff}
                              </span>
                            </label>
                          )}

                          {editingIndex !== index && (
                            <div className="flex items-center opacity-0 group-[.hover]:opacity-100 sm:group-hover:opacity-100 transition-opacity gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingIndex(index);
                                  setEditValue(staff);
                                }}
                                className="text-outline hover:text-primary p-1"
                                title="Edit"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomStaff(
                                    customStaff.filter((s) => s !== staff),
                                  );
                                  setSelectedStaff(
                                    selectedStaff.filter((s) => s !== staff),
                                  );
                                }}
                                className="text-outline hover:text-error p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-outline-variant/30 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setStaffDropdownOpen(false)}
                        className="text-primary font-label-sm px-4 py-1.5 hover:bg-primary/10 rounded"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-xs">
                <label
                  htmlFor="area-id"
                  className="font-label-md text-label-md text-on-surface-variant"
                >
                  Project Area <span className="text-error">*</span>
                </label>
                <select
                  id="area-id"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="rounded bg-white border border-outline-variant focus:ring-2 focus:border-transparent focus:ring-primary text-body-md py-2 px-3 outline-none"
                  required
                >
                  <option value="">Select an Area</option>
                  {allAreasAndSites.map((a) => (
                    <option key={a.area} value={a.area}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-xs">
                <label
                  htmlFor="site-id"
                  className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1"
                >
                  {needsWellOrTank
                    ? "Well / Tank"
                    : selectedArea === "PAVIA" || selectedArea === "WAKEBOARD"
                      ? "Facility / Location"
                      : "Site / Phase / Village"}{" "}
                  <span className="text-error">*</span>
                </label>
                <select
                  id="site-id"
                  value={selectedSiteOrWell}
                  onChange={(e) => setSelectedSiteOrWell(e.target.value)}
                  disabled={!selectedArea}
                  className="rounded bg-white border border-outline-variant focus:ring-2 focus:border-transparent focus:ring-primary text-body-md py-2 px-3 outline-none disabled:bg-surface-container disabled:text-outline"
                  required
                >
                  <option value="">
                    Select{" "}
                    {selectedArea === "PAVIA" || selectedArea === "WAKEBOARD"
                      ? "Location"
                      : needsWellOrTank
                        ? "Well/Tank"
                        : "Site"}
                  </option>
                  {siteOptions().map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-xs md:col-span-2">
                <label
                  htmlFor="block-lot-id"
                  className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1"
                >
                  Specific Area{" "}
                  {["meter_inst", "meter_rep"].includes(selectedActivity) ? (
                    <span className="text-error">*</span>
                  ) : (
                    ""
                  )}
                </label>
                <input
                  type="text"
                  id="block-lot-id"
                  value={blockLot}
                  onChange={(e) => setBlockLot(e.target.value)}
                  placeholder="e.g. Block 4 Lot 2, Well 4, Tank 1, or DMA #"
                  className="rounded bg-white border border-outline-variant focus:ring-2 focus:border-transparent focus:ring-primary text-body-md py-2 px-3 outline-none"
                  required={["meter_inst", "meter_rep"].includes(
                    selectedActivity,
                  )}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Hardware & Diagnostics */}
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-4 relative z-10">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-3 border-b border-outline-variant/30 pb-2">
              {isMeterActivity
                ? "Hardware Specifications & Data"
                : isPumpOrGenset
                  ? "Operational Diagnostics"
                  : "Activity Specifications"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Meter Operations */}
              {isMeterActivity && (
                <>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Meter Brand
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sensus, Itron"
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required={isMeterTest}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Meter/Serial Number
                    </label>
                    <input
                      type="text"
                      placeholder="Factory stamped serial number"
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required={isMeterTest}
                    />
                  </div>

                  {/* Meter Check Bulk/Individual specific reading data */}
                  {isMeterCheck && (
                    <>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Is Meter Running?
                        </label>
                        <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              checked={isMeterRunning === "Yes"}
                              onChange={() => setIsMeterRunning("Yes")}
                              className="text-primary focus:ring-primary"
                            />{" "}
                            Yes
                          </label>
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              checked={isMeterRunning === "No"}
                              onChange={() => setIsMeterRunning("No")}
                              className="text-primary focus:ring-primary"
                            />{" "}
                            No
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Needs Declogging?
                        </label>
                        <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              checked={needsDeclogging === "Yes"}
                              onChange={() => setNeedsDeclogging("Yes")}
                              className="text-primary focus:ring-primary"
                            />{" "}
                            Yes
                          </label>
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              checked={needsDeclogging === "No"}
                              onChange={() => setNeedsDeclogging("No")}
                              className="text-primary focus:ring-primary"
                            />{" "}
                            No
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Needs Replacement?
                        </label>
                        <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              checked={needsReplacement === "Yes"}
                              onChange={() => setNeedsReplacement("Yes")}
                              className="text-primary focus:ring-primary"
                            />{" "}
                            Yes
                          </label>
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              checked={needsReplacement === "No"}
                              onChange={() => setNeedsReplacement("No")}
                              className="text-primary focus:ring-primary"
                            />{" "}
                            No
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Meter Replacement specific reading data */}
                  {isMeterReplacement && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border border-outline-variant/50 p-4 rounded-lg bg-surface-container-lowest mt-2">
                      <h4 className="md:col-span-2 font-headline-sm text-on-surface pb-1 text-primary">
                        Previous Meter Details
                      </h4>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Size
                        </label>
                        <input
                          type="text"
                          value={prevMeterSize}
                          onChange={(e) => setPrevMeterSize(e.target.value)}
                          placeholder="e.g. 1/2"
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required={isMeterReplacement}
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Brand
                        </label>
                        <input
                          type="text"
                          value={prevMeterBrand}
                          onChange={(e) => setPrevMeterBrand(e.target.value)}
                          placeholder="e.g. Itron"
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required={isMeterReplacement}
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Serial Number
                        </label>
                        <input
                          type="text"
                          value={prevMeterSerial}
                          onChange={(e) => setPrevMeterSerial(e.target.value)}
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required={isMeterReplacement}
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Last Reading
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={prevMeterReading}
                          onChange={(e) =>
                            setPrevMeterReading(
                              e.target.value ? Number(e.target.value) : "",
                            )
                          }
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none font-mono"
                          required={isMeterReplacement}
                        />
                      </div>

                      <h4 className="md:col-span-2 font-headline-sm text-on-surface mt-4 border-t border-outline-variant/30 pt-4 pb-1 text-secondary">
                        New Meter Details
                      </h4>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Size
                        </label>
                        <input
                          type="text"
                          value={newMeterSize}
                          onChange={(e) => setNewMeterSize(e.target.value)}
                          placeholder="e.g. 1/2"
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-secondary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required={isMeterReplacement}
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Brand
                        </label>
                        <input
                          type="text"
                          value={newMeterBrand}
                          onChange={(e) => setNewMeterBrand(e.target.value)}
                          placeholder="e.g. Itron"
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-secondary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required={isMeterReplacement}
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Serial Number
                        </label>
                        <input
                          type="text"
                          value={newMeterSerial}
                          onChange={(e) => setNewMeterSerial(e.target.value)}
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-secondary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required={isMeterReplacement}
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Initial Reading
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={newMeterInitialReading}
                          onChange={(e) =>
                            setNewMeterInitialReading(
                              e.target.value ? Number(e.target.value) : "",
                            )
                          }
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-secondary focus:border-transparent text-body-md py-2 px-3 outline-none font-mono"
                          required={isMeterReplacement}
                        />
                      </div>
                    </div>
                  )}

                  {/* Test specific reading data */}
                  {isMeterTest && (
                    <>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Nature of Meter
                        </label>
                        <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              name="meter_nature"
                              value="Old"
                              className="text-primary focus:ring-primary"
                              required
                            />{" "}
                            Old
                          </label>
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              name="meter_nature"
                              value="New"
                              className="text-primary focus:ring-primary"
                              required
                            />{" "}
                            New
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Nature of Test
                        </label>
                        <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              name="test_nature"
                              value="Re-testing"
                              className="text-primary focus:ring-primary"
                              required
                            />{" "}
                            Re-testing
                          </label>
                          <label className="flex items-center gap-2 text-body-md cursor-pointer">
                            <input
                              type="radio"
                              name="test_nature"
                              value="Initial Calibration"
                              className="text-primary focus:ring-primary"
                              required
                            />{" "}
                            Initial
                          </label>
                        </div>
                      </div>
                      <div className="md:col-span-2 border-t border-outline-variant/30 mt-sm pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-xs">
                          <label className="font-label-md text-label-md text-on-surface-variant">
                            Representative Present
                          </label>
                          <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                            <label className="flex items-center gap-2 text-body-md cursor-pointer">
                              <input
                                type="radio"
                                checked={repPresent === "Y"}
                                onChange={() => setRepPresent("Y")}
                                className="text-primary focus:ring-primary"
                                required
                              />{" "}
                              Yes
                            </label>
                            <label className="flex items-center gap-2 text-body-md cursor-pointer">
                              <input
                                type="radio"
                                checked={repPresent === "N"}
                                onChange={() => setRepPresent("N")}
                                className="text-primary focus:ring-primary"
                                required
                              />{" "}
                              No
                            </label>
                          </div>
                        </div>

                        {repPresent === "N" && (
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              Visit Count
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={visitCount}
                              onChange={(e) =>
                                setVisitCount(Number(e.target.value))
                              }
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                              required
                            />
                            {visitCount > 4 && (
                              <div className="text-error bg-error/10 p-2 rounded text-sm mt-1 border border-error/20">
                                Recommendation: Forfeit test due to excessive
                                visits ({visitCount}).
                              </div>
                            )}
                          </div>
                        )}

                        {repPresent === "Y" && (
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              Indication of Leak?
                            </label>
                            <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                              <label className="flex items-center gap-2 text-body-md cursor-pointer">
                                <input
                                  type="radio"
                                  checked={leakIndication === "Y"}
                                  onChange={() => setLeakIndication("Y")}
                                  className="text-primary focus:ring-primary"
                                />{" "}
                                Yes
                              </label>
                              <label className="flex items-center gap-2 text-body-md cursor-pointer">
                                <input
                                  type="radio"
                                  checked={leakIndication === "N"}
                                  onChange={() => setLeakIndication("N")}
                                  className="text-primary focus:ring-primary"
                                />{" "}
                                No
                              </label>
                            </div>
                            {leakIndication === "Y" && (
                              <div className="text-[#854d0e] bg-warning-container/30 p-2 rounded text-sm mt-1 border border-[#854d0e]/20">
                                Warning: Leak indicated. You may proceed with
                                testing, but it is recommended to cancel due to
                                leakage.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {repPresent === "Y" && (
                        <div className="md:col-span-2 border-t border-outline-variant/30 mt-sm pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <h4 className="md:col-span-2 font-headline-sm text-on-surface border-b border-outline-variant/30 pb-2">
                            Volume Sampling (20L per sample)
                          </h4>

                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              Account Name (for PDF)
                            </label>
                            <input
                              type="text"
                              value={testAccountName}
                              onChange={(e) =>
                                setTestAccountName(e.target.value)
                              }
                              placeholder="e.g. DHP002018014 / John Doe"
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              Witnessed By (Client Side)
                            </label>
                            <input
                              type="text"
                              value={witnessedBy}
                              onChange={(e) => setWitnessedBy(e.target.value)}
                              placeholder="Name & Signature"
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              Current Read (Initial)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              value={currentReading}
                              onChange={(e) =>
                                setCurrentReading(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              placeholder="e.g. 607.4831"
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none font-mono"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              1st Reading (after 20L)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              value={reading1}
                              onChange={(e) =>
                                setReading1(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              placeholder="e.g. 627.4831"
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none font-mono"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              2nd Reading (after 20L)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              value={reading2}
                              onChange={(e) =>
                                setReading2(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              placeholder="e.g. 647.4831"
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none font-mono"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              3rd Read/Final (after 20L)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              value={reading3}
                              onChange={(e) =>
                                setReading3(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              placeholder="e.g. 667.4831"
                              className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none font-mono"
                              required
                            />
                          </div>

                          {isManagerView &&
                            currentReading !== "" &&
                            reading1 !== "" &&
                            reading2 !== "" &&
                            reading3 !== "" && (
                              <div className="md:col-span-2 mt-4 p-4 bg-surface-container border border-outline-variant rounded-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] px-2 py-1 rounded-bl shadow font-bold uppercase tracking-widest">
                                  Manager View
                                </div>
                                <h4 className="font-label-lg text-primary mb-3">
                                  Diagnostic Calculations
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-outline-variant/30 mb-4">
                                  <div className="space-y-1 text-sm font-mono text-on-surface-variant">
                                    {(() => {
                                      const err1 =
                                        ((reading1 - currentReading - 20) /
                                          20) *
                                        100;
                                      return (
                                        <div className="flex justify-between">
                                          <span>Sample 1 Error:</span>{" "}
                                          <span
                                            className={
                                              Math.abs(err1) > 5
                                                ? "text-error font-bold"
                                                : ""
                                            }
                                          >
                                            {err1.toFixed(2)}%
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    {(() => {
                                      const err2 =
                                        ((reading2 - reading1 - 20) / 20) * 100;
                                      return (
                                        <div className="flex justify-between">
                                          <span>Sample 2 Error:</span>{" "}
                                          <span
                                            className={
                                              Math.abs(err2) > 5
                                                ? "text-error font-bold"
                                                : ""
                                            }
                                          >
                                            {err2.toFixed(2)}%
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    {(() => {
                                      const err3 =
                                        ((reading3 - reading2 - 20) / 20) * 100;
                                      return (
                                        <div className="flex justify-between">
                                          <span>Sample 3 Error:</span>{" "}
                                          <span
                                            className={
                                              Math.abs(err3) > 5
                                                ? "text-error font-bold"
                                                : ""
                                            }
                                          >
                                            {err3.toFixed(2)}%
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="bg-white p-3 rounded border border-outline-variant flex flex-col justify-center items-center">
                                    {(() => {
                                      const totalErr =
                                        ((reading3 - currentReading - 60) /
                                          60) *
                                        100;
                                      const hasErr = Math.abs(totalErr) > 5;
                                      return (
                                        <>
                                          <div className="text-xs text-on-surface-variant mb-1 uppercase tracking-wider">
                                            Overall Error
                                          </div>
                                          <div
                                            className={`text-2xl font-mono font-medium ${hasErr ? "text-error" : "text-primary"}`}
                                          >
                                            {totalErr > 0 ? "+" : ""}
                                            {totalErr.toFixed(2)}%
                                          </div>
                                          {hasErr ? (
                                            <div className="text-error text-center text-xs mt-2 font-bold px-2 py-1 bg-error/10 rounded">
                                              RECOMMENDATION:
                                              <br />
                                              Replace (
                                              {totalErr > 0
                                                ? "Fast Moving"
                                                : "Slow Moving"}
                                              )
                                            </div>
                                          ) : (
                                            <div className="text-primary text-center text-xs mt-2 font-bold px-2 py-1 bg-primary/10 rounded">
                                              RECOMMENDATION:
                                              <br />
                                              Passed / Retain
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                        </div>
                      )}{" "}
                    </>
                  )}
                </>
              )}

              {/* Leak Repair Drill Down */}
              {selectedActivity === "leak_repair" && (
                <>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Leak Location
                    </label>
                    <select
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required
                    >
                      <option value="">Select Leak Location</option>
                      <option value="Mainline">Mainline</option>
                      <option value="Standpipe">Standpipe</option>
                      <option value="Service Connection">
                        Service Connection
                      </option>
                      <option value="After Meter">
                        After Meter (Customer Responsibility)
                      </option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Cause of Leak
                    </label>
                    <select
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required
                    >
                      <option value="">Select Cause</option>
                      <option value="Incident/Vehicles">
                        Incident caused by vehicles / 3rd party
                      </option>
                      <option value="Old Age">Old Age / Deterioration</option>
                      <option value="High Pressure">
                        High Pressure Incident
                      </option>
                      <option value="Root Intrusion">
                        Tree Root Intrusion
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </>
              )}

              {/* Pump/Genset Diagnostics */}
              {isPumpOrGenset && (
                <>
                  {selectedActivity === "pump_mon" &&
                    selectedArea === "WAKEBOARD" && (
                      <div className="md:col-span-2 text-[#854d0e] bg-warning-container/30 border border-[#854d0e]/20 p-3 rounded-lg flex gap-2 items-start mb-2">
                        <ShieldAlert className="w-5 h-5 shrink-0" />
                        <div className="text-sm">
                          <strong>Wakeboard Plant Notice:</strong>
                          <br />
                          Ensure Chlorine levels, added granules/liquid, and
                          power consumption are accurately logged during this
                          visit.
                        </div>
                      </div>
                    )}
                  {selectedActivity === "pump_mon" &&
                    selectedArea !== "WAKEBOARD" &&
                    needsWellOrTank && (
                      <div className="md:col-span-2 text-primary bg-primary/10 border border-primary/20 p-3 rounded-lg flex gap-2 items-start mb-2">
                        <Clock className="w-5 h-5 shrink-0" />
                        <div className="text-sm">
                          <strong>Pump House Monitoring:</strong>
                          <br />
                          If this facility has not been visited recently, please
                          ensure a complete diagnostic check, including
                          Controller (VFD, Soft starter) settings.
                        </div>
                      </div>
                    )}
                  {selectedActivity !== "genset_mon" && (
                    <div className="flex flex-col gap-xs md:col-span-2">
                      <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                        Controller Settings (VFD Hz, Soft Starter, etc)
                      </label>
                      <textarea
                        placeholder="e.g. VFD running at 50Hz, Soft starter OK"
                        className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                        rows={2}
                      ></textarea>
                    </div>
                  )}
                  {selectedActivity === "pump_mon" && (
                    <>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                          Voltage Reading (V)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                          Amperage Reading (A)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                          required
                        />
                      </div>
                    </>
                  )}
                  {selectedActivity === "pump_mon" && (
                    <>
                      <div className="flex flex-col gap-xs mt-2 md:col-span-2">
                        <h4 className="font-label-lg text-primary border-b border-outline-variant pb-1">
                          Chlorine & Dosing Logs
                        </h4>
                      </div>
                      <div className="flex flex-col gap-xs md:col-span-2">
                        <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                          Chlorine Level (ppm)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 1.5"
                          className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                          Added Granules (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                          Added Liquid (Liters)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                        />
                      </div>
                    </>
                  )}
                  {selectedActivity === "genset_mon" && (
                    <>
                      {/* Genset History / Trend Widget */}
                      {(fuelChartData.length > 0 || lastPmsDate) && selectedSiteOrWell && (
                         <div className="flex flex-col gap-sm md:col-span-2 mb-4 p-4 border border-outline-variant bg-surface-container-lowest rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                               <h4 className="font-label-lg text-primary flex items-center gap-2">
                                 <History className="w-5 h-5 text-primary" />
                                 Historical Insights - {selectedSiteOrWell}
                               </h4>
                               {lastPmsDate && (
                                 <span className="text-sm font-medium bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full border border-secondary/20">
                                   Last PMS: {lastPmsDate}
                                 </span>
                               )}
                            </div>
                            
                            {fuelChartData.length > 0 && (
                              <div className="w-full h-48 mt-2">
                                <span className="text-xs font-semibold text-on-surface-variant block mb-2">Fuel Level Trend (%)</span>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={fuelChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" tick={{fontSize: 10}} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{fontSize: 10}} width={30} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="fuel" stroke="#00A8A8" strokeWidth={2} activeDot={{ r: 6 }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                         </div>
                      )}
                      
                      <div className="flex flex-col gap-xs md:col-span-2 mt-2">
                        <h4 className="font-label-lg text-primary border-b border-outline-variant pb-1">
                          Generator Operation & Fuel Log
                        </h4>
                      </div>
                      <div className="flex flex-col gap-xs md:col-span-2">
                        <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                          Activity / Cause
                        </label>
                        <select
                          className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                          required
                          value={gensetCause}
                          onChange={(e) => setGensetCause(e.target.value)}
                        >
                          <option value="">Select Cause</option>
                          <option value="power_outage">Grid Outage (Brownout)</option>
                          <option value="pms">Preventive Maintenance (PMS)</option>
                          <option value="emergency">Emergency Testing</option>
                          <option value="refill">Refilling Fuel Only</option>
                        </select>
                      </div>

                      {gensetCause === "refill" && (
                        <>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                              Refill Date/Time
                            </label>
                            <input
                              type="datetime-local"
                              className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                              Refill Volume (Liters)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="e.g. 50"
                              className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs md:col-span-2">
                            <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                              Estimated Fuel Level After Refill
                            </label>
                            <select
                               className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 outline-none"
                               value={gensetRefillLevel}
                               onChange={(e) => setGensetRefillLevel(e.target.value)}
                               required
                            >
                               <option value="">Select Level</option>
                               <option value="100">Full (100%)</option>
                               <option value="75">75%</option>
                               <option value="50">Half (50%)</option>
                               <option value="25">25%</option>
                               <option value="low">Low (Needs another refill soon)</option>
                            </select>
                          </div>
                        </>
                      )}

                      {(gensetCause === "power_outage" || gensetCause === "pms" || gensetCause === "emergency") && (
                        <>
                           <div className="flex flex-col gap-xs">
                             <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                               Date/Time Started
                             </label>
                             <input
                               type="datetime-local"
                               className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                               required
                             />
                           </div>
                           <div className="flex flex-col gap-xs">
                             <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                               Date/Time Ended
                             </label>
                             <input
                               type="datetime-local"
                               className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                               required
                             />
                           </div>
                           <div className="flex flex-col gap-xs">
                             <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                               Initial Fuel Level (%)
                             </label>
                             <input
                               type="number"
                               min="0"
                               max="100"
                               placeholder="e.g. 80"
                               value={gensetInitialFuel}
                               onChange={(e) => setGensetInitialFuel(e.target.value === "" ? "" : Number(e.target.value))}
                               className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                               required
                             />
                           </div>
                           <div className="flex flex-col gap-xs">
                             <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                               Final Fuel Level (%)
                             </label>
                             <input
                               type="number"
                               min="0"
                               max="100"
                               placeholder="e.g. 65"
                               value={gensetFinalFuel}
                               onChange={(e) => setGensetFinalFuel(e.target.value === "" ? "" : Number(e.target.value))}
                               className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                               required
                             />
                           </div>
                           
                           {/* Moved Voltage and Amperage down here for Genset running causes */}
                           <div className="flex flex-col gap-xs">
                             <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                               Voltage Reading (V)
                             </label>
                             <input
                               type="number"
                               placeholder="0"
                               className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                               required
                             />
                           </div>
                           <div className="flex flex-col gap-xs">
                             <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                               Amperage Reading (A)
                             </label>
                             <input
                               type="number"
                               placeholder="0"
                               className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                               required
                             />
                           </div>

                           {gensetCause === "pms" && (
                             <>
                               <div className="flex flex-col gap-xs md:col-span-2">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                   Noise Level
                                 </label>
                                 <select
                                   className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                                   required
                                 >
                                    <option value="">Select Level</option>
                                    <option value="normal">Normal</option>
                                    <option value="abnormal">Abnormal / Loud (Requires attention)</option>
                                 </select>
                               </div>
                               <div className="flex flex-col gap-xs md:col-span-2">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                   Standard PMS Checks Completed?
                                 </label>
                                 <label className="flex items-start gap-2 cursor-pointer font-body-sm text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                                   <input type="checkbox" className="mt-1 rounded text-primary focus:ring-primary" required />
                                   <span>I have checked fluid levels (engine oil, coolant, fuel), and visually inspected for leaks and battery corrosion/terminals.</span>
                                 </label>
                               </div>
                               <div className="flex flex-col gap-xs md:col-span-2">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                   Additional PMS Tasks Performed & Remarks
                                 </label>
                                 <textarea
                                   placeholder="e.g. Changed oil, replaced filters"
                                   className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                                   rows={3}
                                   required
                                 ></textarea>
                               </div>
                             </>
                           )}

                           {gensetCause === "emergency" && (
                             <>
                               <div className="flex flex-col gap-xs md:col-span-2">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                   What was tested?
                                 </label>
                                 <input
                                   type="text"
                                   placeholder="e.g. Auto Transfer Switch, Load Test"
                                   className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                                   required
                                 />
                               </div>
                               <div className="flex flex-col gap-xs md:col-span-2">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                   Result of testing
                                 </label>
                                 <textarea
                                   placeholder="e.g. ATS functioned normally, held 80% load for 30 minutes without issue"
                                   className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                                   rows={3}
                                   required
                                 ></textarea>
                               </div>
                             </>
                           )}

                           {/* Keep the Did you refill fuel logic as an option for running causes */}
                           <div className="flex flex-col gap-xs md:col-span-2 mt-2">
                             <label className="flex items-center gap-2 cursor-pointer font-label-md text-on-surface-variant">
                               <input
                                 type="checkbox"
                                 checked={didRefillFuel}
                                 onChange={(e) => setDidRefillFuel(e.target.checked)}
                                 className="rounded text-primary focus:ring-primary"
                               />{" "}
                               Did you also refill fuel after running?
                             </label>
                           </div>

                           {didRefillFuel && (
                             <>
                               <div className="flex flex-col gap-xs">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                                   Refill Date/Time
                                 </label>
                                 <input
                                   type="datetime-local"
                                   className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                                   required
                                 />
                               </div>
                               <div className="flex flex-col gap-xs">
                                 <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                                   Refill Volume (Liters)
                                 </label>
                                 <input
                                   type="number"
                                   min="0"
                                   step="0.1"
                                   placeholder="e.g. 50"
                                   className="rounded bg-white focus:ring-2 focus:ring-[#00A8A8] focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                                   required
                                 />
                               </div>
                             </>
                           )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Tank Analytics */}
              {isTankActivity && (
                <div className="flex flex-col gap-xs md:col-span-2">
                  <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                    Cleaning Chemical Used (Liters)
                  </label>
                  <input
                    type="number"
                    placeholder="Amount used in liters"
                    className="rounded bg-white focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 border border-outline-variant outline-none"
                  />
                </div>
              )}

              <div className="flex flex-col gap-xs md:col-span-2 mt-4">
                <label
                  htmlFor="location-notes"
                  className="font-label-md text-label-md text-on-surface-variant"
                >
                  Remarks And Notes
                </label>
                <textarea
                  id="location-notes"
                  rows={3}
                  placeholder="Additional details..."
                  className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md p-3 outline-none"
                ></textarea>
              </div>
            </div>
          </div>

          {/* SECTION 3: Meter Verification & Workflow (meter_test specific history & signoff) */}
          {isMeterTest && (
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-4">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-3 border-b border-outline-variant/30 pb-2">
                Workflow Verification & Sign-off
              </h3>

              {/* No Representative Logging Table */}
              {repPresent === "N" ? (
                <div className="md:col-span-2 bg-surface-variant/30 border border-outline-variant rounded-lg p-md">
                  <h4 className="font-label-lg text-on-surface mb-3 flex items-center gap-2 text-error">
                    <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>{" "}
                    No representative logged for your visitation
                  </h4>
                  <p className="text-body-sm text-on-surface-variant mb-4">
                    The visitation date and GPS coordinates will be captured
                    securely upon submission. Historical visits for this
                    account:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-body-sm text-on-surface">
                      <thead>
                        <tr className="border-b border-outline-variant text-on-surface-variant">
                          <th className="py-2 px-2 font-medium">
                            Account_Number
                          </th>
                          <th className="py-2 px-2 font-medium">Timestamp</th>
                          <th className="py-2 px-2 font-medium">
                            GPS Coordinates
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-outline-variant/30">
                          <td className="py-2 px-2 font-mono">BARS03041029</td>
                          <td className="py-2 px-2">1/14/2026 7:59:21 AM</td>
                          <td className="py-2 px-2 text-primary font-mono text-xs">
                            10.768164, 122.504320
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2 font-mono">BARS03041029</td>
                          <td className="py-2 px-2">1/21/2026 1:20:25 PM</td>
                          <td className="py-2 px-2 text-primary font-mono text-xs">
                            10.768288, 122.504330
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Status
                    </label>
                    <select
                      value={meterTestStatus}
                      onChange={(e) => setMeterTestStatus(e.target.value)}
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                      <option value="Forfeited">Forfeited</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Test Forfeited No Activity
                    </label>
                    <div className="flex gap-6 mt-1 p-2 bg-surface-container-lowest border border-outline-variant rounded">
                      <label className="flex items-center gap-2 text-body-md cursor-pointer">
                        <input
                          type="radio"
                          name="forfeited"
                          value="Yes"
                          className="text-primary focus:ring-primary"
                          required
                        />{" "}
                        Yes
                      </label>
                      <label className="flex items-center gap-2 text-body-md cursor-pointer">
                        <input
                          type="radio"
                          name="forfeited"
                          value="No"
                          defaultChecked
                          className="text-primary focus:ring-primary"
                          required
                        />{" "}
                        No
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-xs md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Tested By (Signature/Name)
                    </label>
                    <input
                      type="text"
                      placeholder="Sign or type technician name"
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-xs md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Checked By
                    </label>
                    <select
                      className="rounded bg-white border border-outline-variant focus:ring-2 focus:ring-primary focus:border-transparent text-body-md py-2 px-3 outline-none"
                      required
                    >
                      <option value="">Select Supervisor</option>
                      <option value="Kevin Vilbar">
                        Kevin Vilbar - Tech Head
                      </option>
                      <option value="Hernan Talavera">Hernan Talavera</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: Photo Attachments */}
          {!(isMeterTest && repPresent === "N") && (
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-4">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-3 pb-2 border-b border-outline-variant/30 flex justify-between items-center">
                Photo Requirements
                {photoDataSaved > 0 && (
                  <span className="text-label-sm font-semibold text-secondary bg-secondary/10 px-2 py-1 rounded">
                    Data Saved: {(photoDataSaved / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
              </h3>

              {selectedActivity === "meter_test" ? (
                <div className="flex flex-wrap gap-4">
                  <div className="w-40 flex-shrink-0">
                    <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                      Current Reading
                    </span>
                    <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all">
                      <Camera className="text-outline w-5 h-5 mb-1" />
                      <span className="text-label-sm text-outline-variant">
                        Add Photo
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  </div>
                </div>
              ) : selectedActivity === "flushing" ? (
                <div className="space-y-4">
                  {blowOffs.map((bo, index) => (
                    <div
                      key={bo.id}
                      className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <input
                          type="text"
                          value={bo.name}
                          onChange={(e) => {
                            const newBo = [...blowOffs];
                            newBo[index].name = e.target.value;
                            setBlowOffs(newBo);
                          }}
                          className="bg-transparent font-label-md text-on-surface outline-none border-b border-dashed border-outline-variant focus:border-primary max-w-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeBlowOff(bo.id)}
                          className="text-error hover:bg-error/10 p-1 rounded transition-colors"
                          title="Remove Blow-off"
                          disabled={blowOffs.length === 1}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="w-full">
                          <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                            Initial Water Photo
                          </span>
                          <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all overflow-hidden relative">
                            {bo.initialPhoto ? (
                              <img src={bo.initialPhoto} className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <Camera className="text-outline w-5 h-5 mb-1" />
                                <span className="text-[10px] text-outline-variant uppercase font-bold tracking-wider">
                                  Initial Photo
                                </span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleBlowOffPhoto(bo.id, 'initial', e)}
                            />
                          </label>
                        </div>
                        <div className="w-full">
                          <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                            Final Water Photo
                          </span>
                          <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all overflow-hidden relative">
                            {bo.finalPhoto ? (
                              <img src={bo.finalPhoto} className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <Camera className="text-outline w-5 h-5 mb-1" />
                                <span className="text-[10px] text-outline-variant uppercase font-bold tracking-wider">
                                  Final Photo
                                </span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleBlowOffPhoto(bo.id, 'final', e)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addBlowOff}
                    className="text-primary font-label-md flex items-center gap-1 hover:bg-primary/5 rounded px-3 py-2 border border-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add another Blow-off point
                  </button>
                </div>
              ) : selectedActivity === "tank_clean" ? (
                <div className="flex flex-wrap gap-4">
                  <div className="w-28 flex-shrink-0">
                    <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                      1. Before
                    </span>
                    <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all">
                      <Camera className="text-outline w-5 h-5 mb-1" />
                      <span className="text-[10px] uppercase font-bold text-outline-variant">
                        Add
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                      2. During
                    </span>
                    <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all">
                      <Camera className="text-outline w-5 h-5 mb-1" />
                      <span className="text-[10px] uppercase font-bold text-outline-variant">
                        Add
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                      3. After
                    </span>
                    <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all">
                      <Camera className="text-outline w-5 h-5 mb-1" />
                      <span className="text-[10px] uppercase font-bold text-outline-variant">
                        Add
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-sm">
                  <label className="w-28 h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all">
                    <Camera className="text-outline w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase text-outline-variant">
                      Add Photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      multiple
                      onChange={handlePhotoSelect}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-sm pb-lg relative z-0">
          <button
            type="submit"
            disabled={!selectedActivity || isSubmitting}
            className="w-full btn-primary py-4 text-lg"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <CheckSquare className="w-5 h-5 mr-2" />
            )}
            {isSubmitting ? "Submitting..." : "Submit Accomplishment"}
          </button>
        </div>
      </form>

      {/* Hidden PDF Printable Test Area */}
      {isMeterTest && testAccountName && (
        <div className="hidden print:block">
          <PrintableMeterTest
            data={{
              account: testAccountName,
              date: currentDate
                ? new Date(currentDate).toLocaleDateString()
                : new Date().toLocaleDateString(),
              projectAddress: `${selectedSiteOrWell} ${blockLot ? "- " + blockLot : ""}`,
              natureOfTest: "Re-testing", // simplify for prototype
              paymentDetails: "",
              meterBrand: "",
              volumeOfWater: 60, // 3 x 20
              natureOfMeter: "Old",
              reading1_init: Number(currentReading),
              reading1_final: Number(reading1),
              reading2_init: Number(reading1),
              reading2_final: Number(reading2),
              reading3_init: Number(reading2),
              reading3_final: Number(reading3),
              error1:
                ((Number(reading1) - Number(currentReading) - 20) / 20) * 100,
              error2: ((Number(reading2) - Number(reading1) - 20) / 20) * 100,
              error3: ((Number(reading3) - Number(reading2) - 20) / 20) * 100,
              avgError:
                ((Number(reading3) - Number(currentReading) - 60) / 60) * 100,
              testingResults:
                ((Number(reading3) - Number(currentReading) - 60) / 60) * 100 >
                5
                  ? "Fast Moving"
                  : ((Number(reading3) - Number(currentReading) - 60) / 60) *
                        100 <
                      -5
                    ? "Slow Moving"
                    : "Passed",
              recommendation:
                Math.abs(
                  ((Number(reading3) - Number(currentReading) - 60) / 60) * 100,
                ) > 5
                  ? "Replace"
                  : "Retain",
              testedBy: selectedStaff.join(", "),
              witnessedBy: witnessedBy,
              checkedBy: "HERNAN TALAVERA",
              finalDecision: "",
            }}
            ref={printRef}
          />
        </div>
      )}
    </div>
  );
}
