import React, { useState, useEffect, useMemo, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
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
  AlertTriangle,
  FileClock,
  Pencil,
} from "lucide-react";
import { openDB } from "idb";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { areasAndSites, defaultStaff } from "../lib/dataStore";
import { facilityEquipment } from "../lib/facilityData";
import { useNetworkInfo } from "../utils/useNetworkInfo";
import { compressImage } from "../utils/imageProcessor";
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
  writeBatch,
} from "firebase/firestore";
import {
  PrintableMeterTest,
  MeterTestData,
} from "../components/PrintableMeterTest";
import { ACTIVITY_TYPES } from "../lib/activityTypes";

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

// NOTE: activityTypes now sourced from shared lib/activityTypes.ts
// ID aliases (icon not in shared lib — add here for ActivityView UI)
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  meter_inst: Square,
  meter_replacement: Square,
  meter_test: Square,
  meter_check_bulk: Square,
  meter_check_indiv: Square,
  reconnection: Power,
  leak_repair: Wrench,
  leak_detection: Wrench,
  flushing: Droplet,
  tank_cleaning: Brush,
  tank_opening: Settings2,
  pump_monitoring: Settings2,
  genset_monitoring: Power,
  backwash: Waves,
  hydro_testing: Droplet,
  well_pull_out: Wrench,
  garbage_collection: Trash2,
  plant_watering: Droplet,
};
const activityTypes = ACTIVITY_TYPES.map((a) => ({
  ...a,
  icon: ICON_MAP[a.id] ?? Square,
}));

interface ActivityViewProps {
  isOnline?: boolean;
  currentUser?: string | null;
  currentUid?: string | null;
  setActiveTab?: (tab: any) => void;
}

export function ActivityView({
  isOnline = true,
  currentUser,
  currentUid,
  setActiveTab,
}: ActivityViewProps) {
  const { isLowDataMode } = useNetworkInfo();
  const { showToast } = useToast();
  const [photoDataSaved, setPhotoDataSaved] = useState(0); // Track MB saved
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
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
  const [linkToBilling, setLinkToBilling] = useState(false);

  // Specific state for Flushing
  const [blowOffs, setBlowOffs] = useState<
    {
      id: number;
      name: string;
      initialPhoto?: string;
      finalPhoto?: string;
      initialMeterRead?: number;
      finalMeterRead?: number;
    }[]
  >([{ id: Date.now(), name: "Blow-off 1" }]);

  const [flushingInitialRead, setFlushingInitialRead] = useState<number | "">(
    "",
  );
  const [flushingFinalRead, setFlushingFinalRead] = useState<number | "">("");

  const handleBlowOffPhoto = (
    id: number,
    type: "initial" | "final",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBlowOffs((prev) =>
        prev.map((bo) => {
          if (bo.id === id) {
            return {
              ...bo,
              [type === "initial" ? "initialPhoto" : "finalPhoto"]: dataUrl,
            };
          }
          return bo;
        }),
      );
    };
    reader.readAsDataURL(file);
  };

  // Form State
  const [inventoryItems, setInventoryItems] = useState<
    { id: string; name: string; unit: string; currentStock: number }[]
  >([]);
  const [usedMaterials, setUsedMaterials] = useState<
    { inventoryItem: string; quantity: number }[]
  >([]);

  useEffect(() => {
    if (!currentUid || selectedActivity !== "leak_repair") return;
    const q = query(collection(db, `users/${currentUid}/inventory`));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          unit: d.data().unit,
          currentStock: d.data().currentStock,
          cost: d.data().cost || 0,
        }));
        setInventoryItems(items);
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
      },
    );
    return () => unsub();
  }, [currentUid, selectedActivity]);

  const [selectedArea, setSelectedArea] = useState("");
  const [selectedSiteOrWell, setSelectedSiteOrWell] = useState("");
  const [blockLot, setBlockLot] = useState("");
  const [specificComponent, setSpecificComponent] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
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
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
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

  const [meterBrand, setMeterBrand] = useState("");
  const [meterSerialNumber, setMeterSerialNumber] = useState("");
  const [meterNature, setMeterNature] = useState<"Old" | "New">("Old");
  const [testNature, setTestNature] = useState<"Re-testing" | "Initial">("Re-testing");
  const [pastMeterBrands, setPastMeterBrands] = useState<string[]>([]);

  const [truckPlateNo, setTruckPlateNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [tankeringTimeStart, setTankeringTimeStart] = useState("");
  const [tankeringTimeEnd, setTankeringTimeEnd] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [volumeDelivered, setVolumeDelivered] = useState("");

  const [customActivityTypes, setCustomActivityTypes] = useState<{id: string, label: string}[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/activities`));
    const unsub = onSnapshot(q, (snap) => {
      const brands = new Set<string>();
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.details?.meterBrand) {
          brands.add(data.details.meterBrand);
        }
      });
      setPastMeterBrands(Array.from(brands));
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error(error);
    });
    
    // Fetch custom activity types
    const qCustom = query(collection(db, `users/${currentUid}/activityTypes`));
    const unsubCustom = onSnapshot(qCustom, (snap) => {
      setCustomActivityTypes(snap.docs.map(d => ({id: d.id, label: d.data().label})));
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error(error);
    });
    
    return () => {
      unsub();
      unsubCustom();
    };
  }, [currentUid]);

  const [isManagerView, setIsManagerView] = useState(false);
  const [meterTestStatus, setMeterTestStatus] = useState("Pending");

  const [gensetInitialFuel, setGensetInitialFuel] = useState<number | "">("");
  const [gensetFinalFuel, setGensetFinalFuel] = useState<number | "">("");

  const [siteHistory, setSiteHistory] = useState<any[]>([]);

  const { fuelChartData, lastPmsDate } = useMemo(() => {
    const gensetHistory = siteHistory
      .filter((h) => h.type === "genset_mon")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const fuelChartData = gensetHistory
      .map((h) => {
        const p = h.details;
        let level = null;
        if (p?.gensetFinalFuel != null && p?.gensetFinalFuel !== "") {
          level = Number(p.gensetFinalFuel);
        } else if (
          p?.gensetRefillLevel &&
          p.gensetRefillLevel !== "" &&
          p.gensetRefillLevel !== "low"
        ) {
          level = Number(p.gensetRefillLevel);
        } else if (
          p?.gensetInitialFuel != null &&
          p?.gensetInitialFuel !== ""
        ) {
          level = Number(p.gensetInitialFuel);
        }
        return {
          date: new Date(h.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          fuel: level,
        };
      })
      .filter((d) => d.fuel !== null);

    // Find last PMS date
    const lastPms = gensetHistory
      .slice()
      .reverse()
      .find((h) => h.details?.gensetCause === "pms");

    return {
      fuelChartData,
      lastPmsDate: lastPms ? new Date(lastPms.date).toLocaleDateString() : null,
    };
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
          where("status", "==", "pending"), // Could also check assignedTo here, but doing it in memory is fine given no complex index needed
        );
        const snap = await getDocs(q);
        const tasks = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (t: any) =>
              t.linkedActivity === selectedActivity &&
              (t.assignedTo === currentUser || t.assignedTo === "Unassigned"),
          ); // Filter for current activity and assignee
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
    const task = pendingTasks.find((t) => t.id === taskId);
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
            where("siteOrWell", "==", selectedSiteOrWell),
          );
          const snap = await getDocs(q);
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          docs.forEach((d) => dbIdb.put("activities", d));
          setSiteHistory(
            docs.sort(
              (a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime(),
            ),
          );
        } else {
          const tx = dbIdb.transaction("activities", "readonly");
          const index = tx.store.index("site");
          let offlineDocs = await index.getAll(selectedSiteOrWell);
          setSiteHistory(
            offlineDocs.sort(
              (a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime(),
            ),
          );
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    };
    fetchHistory();
  }, [selectedSiteOrWell, isOnline, currentUid]);

  const [accountHistory, setAccountHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!accountNumber || !currentUid) {
      setAccountHistory([]);
      setVisitCount(1);
      return;
    }
    const fetchAccHistory = async () => {
      try {
        if (isOnline) {
          const q = query(
            collection(db, `users/${currentUid}/activities`),
            where("type", "==", selectedActivity)
          );
          const snap = await getDocs(q);
          const docs = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.details?.accountNumber === accountNumber);

          docs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAccountHistory(docs);
          setVisitCount(docs.length + 1);
        } else {
          const dbIdb = await initHistoryDB();
          const tx = dbIdb.transaction("activities", "readonly");
          const index = tx.store.index("type");
          let offlineDocs = await index.getAll(selectedActivity);
          offlineDocs = offlineDocs.filter((d: any) => d.details?.accountNumber === accountNumber);
          offlineDocs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAccountHistory(offlineDocs);
          setVisitCount(offlineDocs.length + 1);
        }
      } catch (err) {
        console.error("Failed to fetch account history:", err);
      }
    };
    fetchAccHistory();
  }, [accountNumber, isOnline, currentUid, selectedActivity]);

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
      setCustomStaff(parsed);
    } else {
      setCustomStaff(defaultStaff);
    }
  }, []);

  const saveStaffList = async (updated: string[]) => {
    setCustomStaff(updated);
    localStorage.setItem("watsanStaff", JSON.stringify(updated));
    if (currentUid) {
      try {
        const batch = writeBatch(db);
        updated.forEach((name) => {
          const ref = doc(
            db,
            `users/${currentUid}/staff`,
            name.replace(/\s+/g, "_").toLowerCase(),
          );
          batch.set(
            ref,
            { name, createdAt: serverTimestamp() },
            { merge: true },
          );
        });
        await batch.commit();
      } catch (err) {
        console.error("Failed to sync staff to DB:", err);
      }
    }
  };

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

  const submitForm = (
    e: React.FormEvent | React.MouseEvent,
    targetStatus: "completed" | "in_progress" = "completed",
  ) => {
    e.preventDefault();

    // Validation (Offline-First) - only validate strict requirements if completing
    if (targetStatus === "completed") {
      // If it's an activity that requires photos and no photo has been captured yet
      if (
        (selectedActivity === "meter_test" ||
          selectedActivity === "flushing" ||
          selectedActivity === "leak_repair") &&
        photoDataSaved === 0
      ) {
        showToast(
          "Photo proof is required before logging this activity offline.",
          "warning",
        );
        return;
      }

      // Also require witness/signature for water sampling
      if (selectedActivity === "water_sampling" && !witnessedBy.trim()) {
        showToast(
          "Witness signature is required for water sampling.",
          "warning",
        );
        return;
      }
    }

    if (targetStatus === "completed") {
      setIsSubmitting(true);
    } else {
      setIsSavingDraft(true);
    }

    // Silently capture GPS in background
    let capturedGps: { lat: number; lng: number } | null = null;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          capturedGps = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          finalizeSubmit(capturedGps, targetStatus);
        },
        (error) => {
          console.warn("Geolocation failed:", error.message);
          finalizeSubmit(null, targetStatus);
        },
        { timeout: 5000 },
      );
    } else {
      finalizeSubmit(null, targetStatus);
    }
  };

  const finalizeSubmit = async (
    gpsLocation: { lat: number; lng: number } | null,
    targetStatus: "completed" | "in_progress",
  ) => {
    let linkedMsg = "";

    if (!currentUid) {
      showToast("Error: User not authenticated", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      if (selectedActivity === "meter_test" && meterTestStatus === "Failed") {
        const taskId = `task-${Date.now()}`;
        setDoc(doc(db, `users/${currentUid}/tasks`, taskId), {
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
        }).catch(console.warn);
        linkedMsg +=
          '\n✓ Automatically created "Pending Meter Replacement" task.';
      }

      if (selectedActivity === "leak_detect" || leakIndication === "Y") {
        const taskId = `task-${Date.now() + 1}`;
        setDoc(doc(db, `users/${currentUid}/tasks`, taskId), {
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
        }).catch(console.warn);
        linkedMsg += '\n✓ Automatically created "Pending Leak Repair" task.';
      }

      // Explicitly complete the selected task if there is one
      if (selectedTaskId) {
        updateDoc(doc(db, `users/${currentUid}/tasks`, selectedTaskId), {
          status: "completed",
          updatedAt: serverTimestamp(),
        }).catch(console.warn);
        linkedMsg += `\n✓ Marked associated task as completed.`;
      }

      // Instead of sweeping all tasks iteratively like localStorage, we just query ones that match.
      if (
        selectedActivity === "meter_replacement" ||
        selectedActivity === "meter_rep" ||
        selectedActivity === "leak_repair"
      ) {
        const q = query(collection(db, `users/${currentUid}/tasks`));
        getDocs(q).then((snapshots) => {
          let closedCount = 0;
          snapshots.forEach((taskDoc) => {
            const taskData = taskDoc.data();
            if (taskData.status !== "completed") {
              let matches = false;
              if (
                (selectedActivity === "meter_replacement" || selectedActivity === "meter_rep") &&
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
                    `\n[Resolved by activity]`,
                  updatedAt: serverTimestamp(),
                });
                closedCount++;
              }
            }
          });
        }).catch(console.warn);
      }

      // --- Save Activity ---
      const actId = `act-${Date.now()}`;

      const activityData = {
        userId: currentUid,
        type: selectedActivity,
        area: selectedArea,
        siteOrWell: selectedSiteOrWell,
        blockLot: blockLot,
        specificComponent: specificComponent,
        subCategory: selectedSubCategory,
        staff: selectedStaff,
        date: new Date().toISOString(),
        status: targetStatus,
        isSynced: isOnline,
        location: gpsLocation
          ? {
              latitude: gpsLocation.lat,
              longitude: gpsLocation.lng,
              accuracy: "high",
            }
          : null,
        systemTimestamp: new Date().toISOString(), // non-editable timestamp for audit
        blowOffs: selectedActivity === "flushing" ? blowOffs : [],
        details: {
          accountNumber,
          meterTestStatus,
          leakIndication,
          witnessedBy,
          witnessSignature,
          testAccountName,
          currentReading,
          reading1,
          reading2,
          reading3,
          meterBrand,
          meterSerialNumber,
          meterNature,
          testNature,
          repPresent,
          visitCount,
          ...(selectedActivity === "flushing"
            ? {
                flushingInitialRead,
                flushingFinalRead,
              }
            : {}),
          ...(isMeterCheck
            ? { isMeterRunning, needsDeclogging, needsReplacement }
            : {}),
          ...(isMeterReplacement || isMeterInstallation
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
          ...(selectedActivity === "genset_mon"
            ? {
                gensetCause,
                gensetRefillLevel,
                didRefillFuel,
                gensetInitialFuel,
                gensetFinalFuel,
              }
            : {}),
          ...(isTankering
            ? {
                truckPlateNo,
                driverName,
                tankeringTimeStart,
                tankeringTimeEnd,
                sourceLocation,
                deliveryLocation,
                volumeDelivered,
              }
            : {}),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      setDoc(
        doc(db, `users/${currentUid}/activities`, actId),
        activityData,
      ).catch(console.warn);

      // Save locally if offline
      if (!isOnline) {
        const rawActivities = localStorage.getItem("watsanActivities");
        const activitiesQueue = rawActivities ? JSON.parse(rawActivities) : [];
        activitiesQueue.push({
          id: actId,
          ...activityData,
          isSynced: false,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(
          "watsanActivities",
          JSON.stringify(activitiesQueue),
        );
      }

      let baseMsg =
        targetStatus === "in_progress"
          ? "Progress saved successfully!"
          : "Accomplishment report submitted successfully!";
      if (!isOnline) {
        baseMsg =
          targetStatus === "in_progress"
            ? "Offline mode: Progress saved locally."
            : "Offline mode: Report saved locally. Will sync when online.";
      }
      const msg = baseMsg + linkedMsg;
      showToast(msg, "success");

      if (selectedActivity === "meter_test" && testAccountName) {
        // Trigger print after save
        setTimeout(() => {
          window.print();
        }, 500);
      }

      if (
        targetStatus === "completed" &&
        selectedActivity === "leak_repair" &&
        linkToBilling
      ) {
        const billingRecord = {
          formData: {
            area: selectedArea,
            location:
              `${selectedSiteOrWell} ${blockLot} ${specificComponent}`.trim(),
            chargeTo: "", // to be filled
            dateReported: new Date().toISOString().split("T")[0],
            pipeSizeMm: 50,
            pressurePsi: 25,
            timeStarted: "", // to be filled
            timeEnded: "", // to be filled
            waterRate: 94.816,
            laborCost: 1000,
            remarks: `Linked from Activity ID: ${actId}`,
          },
          materials: usedMaterials.map((m) => ({
            inventoryId: m.inventoryItem,
            quantity: m.quantity,
          })),
        };
        localStorage.setItem("billingDraft", JSON.stringify(billingRecord));
        localStorage.setItem("incidentReportMode", "billing");
        if (setActiveTab) {
          setTimeout(() => {
            setActiveTab("incidents");
          }, 600);
        }
      }

      // Facility Profile: "Golden Thread" auto update
      if (targetStatus === "completed" && selectedArea) {
        const matchingArea = customAreas.find(a => a.name === selectedArea);
        if (matchingArea?.id) {
          const areaRef = doc(db, `users/${currentUid}/areas`, matchingArea.id);
          const updates: Record<string, any> = {
            lastServiced: new Date().toISOString()
          };
          if (selectedSiteOrWell) {
            updates[`lastServicedByFacility.${selectedSiteOrWell}`] = new Date().toISOString();
          }
          if (specificComponent) {
            updates[`lastServicedByFacility.${selectedSiteOrWell}::${specificComponent}`] = new Date().toISOString();
          }
          updateDoc(areaRef, updates).catch(console.warn);
        }
      }
    } catch (e) {
      console.error("Error saving activity to Firebase:", e);
      showToast("Error saving report", "error");
    }

    if (targetStatus === "completed") {
      setSelectedActivity(null);
      setSelectedArea("");
      setSelectedSiteOrWell("");
      setBlockLot("");
      setSpecificComponent("");
      setSelectedStaff([]);
      setBlowOffs([{ id: Date.now(), name: "Blow-off 1" }]);
      setFlushingInitialRead("");
      setFlushingFinalRead("");
      setUsedMaterials([]);
      setLinkToBilling(false);

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

      setTruckPlateNo("");
      setDriverName("");
      setTankeringTimeStart("");
      setTankeringTimeEnd("");
      setSourceLocation("");
      setDeliveryLocation("");
      setVolumeDelivered("");
    }

    setIsSubmitting(false);
    setIsSavingDraft(false);
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
    "meter_installation",
    "meter_replacement",
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
  const isTankering = 
    selectedActivity === "tankering" || 
    selectedActivity?.includes("tankering") || 
    selectedActivity?.includes("water_delivery") ||
    selectedActivity?.includes("delivery") ||
    selectedActivity?.includes("tanker") ||
    customActivityTypes.find(c => c.id === selectedActivity)?.label.toLowerCase().includes("tanker") ||
    customActivityTypes.find(c => c.id === selectedActivity)?.label.toLowerCase().includes("delivery") ||
    ACTIVITY_TYPES.find(a => a.id === selectedActivity)?.label.toLowerCase().includes("tanker") ||
    ACTIVITY_TYPES.find(a => a.id === selectedActivity)?.label.toLowerCase().includes("delivery");
  const isMeterTest = selectedActivity === "meter_test";
  const isMeterCheck =
    selectedActivity === "meter_check_bulk" ||
    selectedActivity === "meter_check_indiv";
  const isMeterReplacement = selectedActivity === "meter_replacement" || selectedActivity === "meter_rep";
  const isMeterInstallation = selectedActivity === "meter_inst" || selectedActivity === "meter_installation";

  const [isAddingActivityType, setIsAddingActivityType] = useState(false);
  const [newActivityTypeName, setNewActivityTypeName] = useState("");
  const newActivityInputRef = useRef<HTMLInputElement>(null);

  const handleAddNewActivityType = async () => {
    if (!newActivityTypeName.trim() || !currentUid) return;
    const cleanId = newActivityTypeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const newId = `custom_${cleanId}`;
    await setDoc(doc(db, `users/${currentUid}/activityTypes`, newId), {
      label: newActivityTypeName.trim()
    });
    setNewActivityTypeName("");
    setIsAddingActivityType(false);
    setSelectedActivity(newId);
  };

  const combinedActivityTypes = [
    ...activityTypes,
    ...customActivityTypes.map(c => ({ id: c.id, label: c.label, icon: Square }))
  ];

  const [customAreas, setCustomAreas] = useState<{ 
    id: string; 
    name: string; 
    type?: "area" | "plant"; 
    sites: string[]; 
    wellsBySite?: Record<string, string[]>;
    subCategoriesByWell?: Record<string, string[]>;
  }[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/areas`));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        setCustomAreas(fetched);
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
        console.error("Area listener error:", error);
      },
    );
    return () => unsubscribe();
  }, [currentUid]);

  const allAreasAndSites = [...areasAndSites, ...customAreas]; // areasAndSites is empty, fallback

  const getSelectedAreaObj = () => customAreas.find(a => a.name === selectedArea);

  const siteOptions = () => {
    const area = getSelectedAreaObj();
    return area ? (area.sites || []) : [];
  };

  const equipmentOptions = () => {
    const area = getSelectedAreaObj();
    if (!area || !selectedSiteOrWell) return [];
    return area.wellsBySite?.[selectedSiteOrWell] || [];
  };

  const subCategoryOptions = () => {
    const area = getSelectedAreaObj();
    if (!area || !selectedSiteOrWell || !specificComponent) return [];
    const key = `${selectedSiteOrWell}::${specificComponent}`;
    return area.subCategoriesByWell?.[key] || [];
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

      <form
        onSubmit={(e) => submitForm(e, "completed")}
        className="flex flex-col gap-4"
      >
        {/* Selection List for Activity Types */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-4 relative z-20 overflow-hidden flex flex-col">
          <label className="font-headline-md text-headline-md text-on-surface mb-3 block border-b border-outline-variant/30 pb-2">
            Activity Type
          </label>
          <div className="flex overflow-x-auto pb-2 -mx-2 px-2 gap-2 hide-scrollbar snap-x">
            {combinedActivityTypes.map((act) => {
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

            {isAddingActivityType ? (
              <div className="flex items-center gap-2 pr-2 shrink-0">
                <input
                  ref={newActivityInputRef}
                  autoFocus
                  className="px-3 py-1.5 text-sm border-2 border-primary rounded-xl focus:outline-none bg-surface"
                  value={newActivityTypeName}
                  onChange={(e) => setNewActivityTypeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewActivityType()}
                  placeholder="New type..."
                />
                <button
                  type="button"
                  onClick={handleAddNewActivityType}
                  className="bg-primary hover:bg-primary-dark text-white rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <Plus className="w-4 h-4"/>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingActivityType(false)}
                  className="bg-surface-variant hover:bg-outline-variant text-on-surface rounded-lg p-1.5 focus:outline-none"
                >
                  <X className="w-4 h-4"/>
                </button>
              </div>
            ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingActivityType(true);
                    setTimeout(() => newActivityInputRef.current?.focus(), 50);
                  }}
                  className="snap-start shrink-0 px-4 py-2 rounded-2xl border-2 border-dashed border-outline-variant transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/20 text-sm font-semibold whitespace-nowrap bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Custom
                </button>
            )}
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
                      required={isMeterTest}
                    />
                  </div>
                  <div className="flex flex-col gap-xs md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Date Issued
                    </label>
                    <input
                      type="date"
                      required={isMeterTest}
                    />
                  </div>
                </>
              )}

              {/* Main Actor & Companions Selection */}
              <div className="flex flex-col gap-xs relative md:col-span-1">
                <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                  <Users className="w-4 h-4" /> Primary Actor
                </label>
                <div className="text-body-md font-medium text-on-surface py-2 bg-surface-container-low px-3 rounded border border-outline-variant italic min-h-[42px] flex items-center">
                  {(currentUser || "Current User").split(" - ")[0]}
                </div>
              </div>

              <div className="flex flex-col gap-xs relative md:col-span-1">
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
                        {staff.split(" - ")[0]}
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
                              saveStaffList([
                                newStaffName.trim(),
                                ...customStaff,
                              ]);
                              setSelectedStaff([
                                ...selectedStaff,
                                newStaffName.trim(),
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
                            saveStaffList([
                              newStaffName.trim(),
                              ...customStaff,
                            ]);
                            setSelectedStaff([
                              ...selectedStaff,
                              newStaffName.trim(),
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
                                    saveStaffList(newStaff);
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
                                  saveStaffList(newStaff);
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
                                {staff.split(" - ")[0]}
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
                                <Pencil className="w-[14px] h-[14px]" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveStaffList(
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

              {/* Hierarchical Location Mapping */}
              <div className="flex flex-col gap-xs">
                <label htmlFor="area-id" className="font-label-md text-label-md text-on-surface-variant">
                  Facility (Area/Plant) <span className="text-secondary">*</span>
                </label>
                <input
                  type="text"
                  id="area-id"
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                    setSelectedSiteOrWell("");
                    setSpecificComponent("");
                    setSelectedSubCategory("");
                  }}
                  placeholder="Select Facility/Area..."
                  list="saved-areas"
                  required
                />
                <datalist id="saved-areas">
                  {customAreas.map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="site-id" className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                  Site / Phase / Section <span className="text-secondary">*</span>
                </label>
                <input
                  type="text"
                  id="site-id"
                  value={selectedSiteOrWell}
                  onChange={(e) => {
                    setSelectedSiteOrWell(e.target.value);
                    setSpecificComponent("");
                    setSelectedSubCategory("");
                  }}
                  placeholder="Select Site or Phase..."
                  list="saved-sites"
                  required
                />
                <datalist id="saved-sites">
                  {siteOptions().map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {!isTankering && (
                <>
                  <div className="flex flex-col gap-xs md:col-span-1">
                    <label htmlFor="specific-component-id" className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                      Pump House / Well / Equipment
                    </label>
                    <input
                      type="text"
                      id="specific-component-id"
                      value={specificComponent}
                      onChange={(e) => {
                        setSpecificComponent(e.target.value);
                        setSelectedSubCategory("");
                      }}
                      placeholder="Select Equipment..."
                      list="component-options"
                    />
                    <datalist id="component-options">
                      {equipmentOptions().map((comp) => (
                        <option key={comp} value={comp} />
                      ))}
                    </datalist>
                  </div>

                  <div className="flex flex-col gap-xs md:col-span-1">
                    <label htmlFor="sub-category-id" className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                      Sub-Category / Part
                    </label>
                    <input
                      type="text"
                      id="sub-category-id"
                      value={selectedSubCategory}
                      onChange={(e) => setSelectedSubCategory(e.target.value)}
                      placeholder="Select Sub-Category..."
                      list="sub-options"
                    />
                    <datalist id="sub-options">
                      {subCategoryOptions().map((sub) => (
                        <option key={sub} value={sub} />
                      ))}
                    </datalist>
                  </div>

                  <div className="flex flex-col gap-xs md:col-span-2 mt-2">
                    <label htmlFor="block-lot-id" className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                      Block & Lots / Custom Location Details
                    </label>
                    <input
                      type="text"
                      id="block-lot-id"
                      value={blockLot}
                      onChange={(e) => setBlockLot(e.target.value)}
                      placeholder="e.g. Block 4 Lot 2"
                    />
                  </div>
                </>
              )}

              {/* Tankering Operations */}
              {isTankering && (
                <>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Truck Plate No.</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ABC 1234"
                      value={truckPlateNo}
                      onChange={(e) => setTruckPlateNo(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Driver Name</label>
                    <input 
                      type="text" 
                      placeholder="Name of driver"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Time IN (Start Loading)</label>
                    <input 
                      type="datetime-local" 
                      value={tankeringTimeStart}
                      onChange={(e) => setTankeringTimeStart(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant text-primary font-bold">
                      Time OUT (Finish Loading)
                      {tankeringTimeStart && tankeringTimeEnd && (
                         <span className="ml-2 text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                           Duration: {(
                             (new Date(tankeringTimeEnd).getTime() - new Date(tankeringTimeStart).getTime()) /
                             (1000 * 60)
                           ).toFixed(0)} min
                         </span>
                      )}
                    </label>
                    <input 
                      type="datetime-local" 
                      value={tankeringTimeEnd}
                      onChange={(e) => setTankeringTimeEnd(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Source Location</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Pump Station 1"
                      value={sourceLocation}
                      onChange={(e) => setSourceLocation(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Delivery Location</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Phase 2 Reservoir"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-xs md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                      Volume Delivered (m³)
                    </label>
                    <input 
                      type="number" 
                      placeholder="e.g. 10"
                      value={volumeDelivered}
                      onChange={(e) => setVolumeDelivered(e.target.value)}
                    />
                  </div>
                </>
              )}
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
                  {!(isMeterReplacement || isMeterInstallation) && (
                    <>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Meter Brand
                        </label>
                        <input
                          type="text"
                          value={meterBrand}
                          onChange={(e) => setMeterBrand(e.target.value)}
                          placeholder="e.g. Sensus, Itron"
                          list="meter-brands"
                          required={isMeterTest}
                        />
                        <datalist id="meter-brands">
                          {pastMeterBrands.map(b => (
                            <option key={b} value={b} />
                          ))}
                        </datalist>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">
                          Meter/Serial Number
                        </label>
                        <input
                          type="text"
                          value={meterSerialNumber}
                          onChange={(e) => setMeterSerialNumber(e.target.value)}
                          placeholder="Factory stamped serial number"
                          required={isMeterTest}
                        />
                      </div>
                    </>
                  )}

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

                  {/* Meter Replacement / Installation specific reading data */}
                  {(isMeterReplacement || isMeterInstallation) && (
                    <div className={`md:col-span-2 grid grid-cols-1 gap-6 border border-outline-variant/50 p-4 rounded-lg bg-surface-container-lowest mt-2 ${isMeterReplacement ? 'md:grid-cols-2' : ''}`}>
                      {isMeterReplacement && (
                        <div className="flex flex-col gap-4">
                          <h4 className="font-headline-sm text-on-surface pb-1 text-primary border-b border-outline-variant/30">
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
                              required={isMeterReplacement}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-4">
                        <h4 className="font-headline-sm text-on-surface pb-1 text-secondary border-b border-outline-variant/30">
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
                            required={isMeterReplacement || isMeterInstallation}
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
                            required={isMeterReplacement || isMeterInstallation}
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
                            required={isMeterReplacement || isMeterInstallation}
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
                            required={isMeterReplacement || isMeterInstallation}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test specific reading data */}
                  {isMeterTest && (
                    <>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">Nature of Meter</label>
                        <div className="flex rounded-md shadow-sm mt-1 w-full">
                          <button
                            type="button"
                            onClick={() => setMeterNature('Old')}
                            className={`flex-1 px-4 py-3 text-sm font-bold border rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${meterNature === 'Old' ? 'bg-primary text-white border-primary shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                          >
                            Old
                          </button>
                          <button
                            type="button"
                            onClick={() => setMeterNature('New')}
                            className={`flex-1 px-4 py-3 text-sm font-bold border border-l-0 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${meterNature === 'New' ? 'bg-primary text-white border-primary shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                          >
                            New
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant">Nature of Test</label>
                        <div className="flex rounded-md shadow-sm mt-1 w-full">
                          <button
                            type="button"
                            onClick={() => setTestNature('Re-testing')}
                            className={`flex-1 px-4 py-3 text-sm font-bold border rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${testNature === 'Re-testing' ? 'bg-primary text-white border-primary shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                          >
                            Re-testing
                          </button>
                          <button
                            type="button"
                            onClick={() => setTestNature('Initial')}
                            className={`flex-1 px-4 py-3 text-sm font-bold border border-l-0 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${testNature === 'Initial' ? 'bg-primary text-white border-primary shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                          >
                            Initial
                          </button>
                        </div>
                      </div>
                      <div className="md:col-span-2 border-t border-outline-variant/30 mt-sm pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">Representative Present</label>
                            <div className="flex rounded-md shadow-sm mt-1 w-full">
                              <button
                                type="button"
                                onClick={() => setRepPresent('Y')}
                                className={`flex-1 px-4 py-3 text-sm font-bold border rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${repPresent === 'Y' ? 'bg-primary text-white border-primary shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                              >
                                ✓ Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setRepPresent('N')}
                                className={`flex-1 px-4 py-3 text-sm font-bold border border-l-0 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${repPresent === 'N' ? 'bg-error text-white border-error shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                              >
                                ✕ No
                              </button>
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
                              readOnly
                              className="bg-surface-variant opacity-70 cursor-not-allowed"
                            />
                            {visitCount >= 4 && (
                              <div className="text-error bg-error/10 p-2 rounded text-sm mt-1 border border-error/20">
                                Recommendation: Forfeit test due to excessive
                                visits ({visitCount}).
                              </div>
                            )}
                          </div>
                        )}

                        {repPresent === "Y" && (
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">Indication of Leak?</label>
                            <div className="flex rounded-md shadow-sm mt-1 w-full">
                              <button
                                type="button"
                                onClick={() => setLeakIndication('Y')}
                                className={`flex-1 px-4 py-3 text-sm font-bold border rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${leakIndication === 'Y' ? 'bg-primary text-white border-primary shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                              >
                                ✓ Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setLeakIndication('N')}
                                className={`flex-1 px-4 py-3 text-sm font-bold border border-l-0 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary transition-all ${leakIndication === 'N' ? 'bg-error text-white border-error shadow-inner' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                              >
                                ✕ No
                              </button>
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
                            Volume Sampling (10L per sample)
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
                              placeholder="e.g. ACC002018014 / John Doe"
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
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              1st Reading (after 10L)
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
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              2nd Reading (after 10L)
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
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant">
                              3rd Read/Final (after 10L)
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
                              required
                            />
                          </div>
                          
                          <div className="flex flex-col gap-xs md:col-span-2 pt-4 border-t border-outline-variant/30 mt-2">
                            <label className="font-label-md text-label-md text-on-surface-variant flex justify-between">
                              <span>Witnessed By (Client Side)</span>
                              {witnessSignature && <span className="text-primary text-xs font-bold">Signed ✓</span>}
                            </label>
                            <input
                              type="text"
                              value={witnessedBy}
                              onChange={(e) => setWitnessedBy(e.target.value)}
                              placeholder="Name of Witness"
                              required
                            />
                            
                            <div className="mt-2 border-2 border-dashed border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden flex-1 h-[200px] relative">
                              {!witnessSignature ? (
                                <>
                                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                                    <span className="text-on-surface-variant text-sm select-none">Client Signature</span>
                                  </div>
                                  <SignatureCanvas 
                                    ref={sigCanvas}
                                    canvasProps={{
                                      className: 'w-full h-full cursor-crosshair relative z-10',
                                      style: { width: '100%', height: '200px' }
                                    }}
                                    onEnd={() => setWitnessSignature(sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || null)}
                                    backgroundColor="rgba(255, 255, 255, 0)"
                                    penColor="blue"
                                  />
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
                                  <img src={witnessSignature} alt="Witness Signature" className="max-h-[160px]" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sigCanvas.current?.clear();
                                      setWitnessSignature(null);
                                    }}
                                    className="mt-2 text-error text-xs font-bold uppercase tracking-wider hover:underline"
                                  >
                                    Clear & Resign
                                  </button>
                                </div>
                              )}
                            </div>
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
                                        (((reading1 - currentReading) / 0.01) - 1) * 100;
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
                                        (((reading2 - reading1) / 0.01) - 1) * 100;
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
                                        (((reading3 - reading2) / 0.01) - 1) * 100;
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
                                        (((reading3 - currentReading) / 0.03) - 1) * 100;
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

                  <div className="flex flex-col gap-xs md:col-span-2 mt-4 bg-surface-container-lowest p-4 border border-outline-variant rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-headline-sm text-on-surface">
                        Materials Used
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setUsedMaterials([
                            ...usedMaterials,
                            { inventoryItem: "", quantity: 1 },
                          ])
                        }
                        className="text-primary font-label-md flex items-center gap-1 hover:bg-primary/5 rounded px-2 py-1 transition-colors border border-primary/20"
                      >
                        <Plus className="w-4 h-4" /> Add Material
                      </button>
                    </div>
                    {usedMaterials.length === 0 ? (
                      <p className="text-sm text-on-surface-variant italic py-2">
                        No materials recorded.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {usedMaterials.map((um, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <select
                              value={um.inventoryItem}
                              onChange={(e) => {
                                const newM = [...usedMaterials];
                                newM[i].inventoryItem = e.target.value;
                                setUsedMaterials(newM);
                              }}
                            >
                              <option value="">Select Material...</option>
                              {inventoryItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} (Stock: {item.currentStock}{" "}
                                  {item.unit})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={um.quantity || ""}
                              onChange={(e) => {
                                const newM = [...usedMaterials];
                                newM[i].quantity = Number(e.target.value);
                                setUsedMaterials(newM);
                              }}
                              placeholder="Qty"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setUsedMaterials(
                                  usedMaterials.filter((_, idx) => idx !== i),
                                )
                              }
                              className="p-2 text-error hover:bg-error/10 rounded transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-xs md:col-span-2 mt-2">
                    <label className="flex items-center gap-3 cursor-pointer p-3 border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
                      <input
                        type="checkbox"
                        checked={linkToBilling}
                        onChange={(e) => setLinkToBilling(e.target.checked)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col">
                        <span className="font-label-lg text-on-surface">
                          Link to Damage Billing?
                        </span>
                        <span className="font-body-sm text-on-surface-variant">
                          Automatically drafts a Cost Recovery Report using
                          these details and materials upon submission.
                        </span>
                      </div>
                    </label>
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
                        />
                      </div>
                    </>
                  )}
                  {selectedActivity === "genset_mon" && (
                    <>
                      {/* Genset History / Trend Widget */}
                      {(fuelChartData.length > 0 || lastPmsDate) &&
                        selectedSiteOrWell && (
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
                                <span className="text-xs font-semibold text-on-surface-variant block mb-2">
                                  Fuel Level Trend (%)
                                </span>
                                <ResponsiveContainer
                                  width="100%"
                                  height="100%"
                                  minWidth={0}
                                  minHeight={0}
                                >
                                  <LineChart data={fuelChartData}>
                                    <CartesianGrid
                                      strokeDasharray="3 3"
                                      vertical={false}
                                      stroke="#e5e7eb"
                                    />
                                    <XAxis
                                      dataKey="date"
                                      tick={{ fontSize: 10 }}
                                      tickMargin={10}
                                      axisLine={false}
                                      tickLine={false}
                                    />
                                    <YAxis
                                      domain={[0, 100]}
                                      tick={{ fontSize: 10 }}
                                      width={30}
                                      axisLine={false}
                                      tickLine={false}
                                    />
                                    <Tooltip
                                      contentStyle={{
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="fuel"
                                      stroke="#00A8A8"
                                      strokeWidth={2}
                                      activeDot={{ r: 6 }}
                                    />
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
                          required
                          value={gensetCause}
                          onChange={(e) => setGensetCause(e.target.value)}
                        >
                          <option value="">Select Cause</option>
                          <option value="power_outage">
                            Grid Outage (Brownout)
                          </option>
                          <option value="pms">
                            Preventive Maintenance (PMS)
                          </option>
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
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs md:col-span-2">
                            <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-[#00A8A8] pl-2">
                              Estimated Fuel Level After Refill
                            </label>
                            <select
                              value={gensetRefillLevel}
                              onChange={(e) =>
                                setGensetRefillLevel(e.target.value)
                              }
                              required
                            >
                              <option value="">Select Level</option>
                              <option value="100">Full (100%)</option>
                              <option value="75">75%</option>
                              <option value="50">Half (50%)</option>
                              <option value="25">25%</option>
                              <option value="low">
                                Low (Needs another refill soon)
                              </option>
                            </select>
                          </div>
                        </>
                      )}

                      {(gensetCause === "power_outage" ||
                        gensetCause === "pms" ||
                        gensetCause === "emergency") && (
                        <>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                              Date/Time Started
                            </label>
                            <input
                              type="datetime-local"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                              Date/Time Ended
                            </label>
                            <input
                              type="datetime-local"
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
                              onChange={(e) =>
                                setGensetInitialFuel(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
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
                              onChange={(e) =>
                                setGensetFinalFuel(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
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
                                  required
                                >
                                  <option value="">Select Level</option>
                                  <option value="normal">Normal</option>
                                  <option value="abnormal">
                                    Abnormal / Loud (Requires attention)
                                  </option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-xs md:col-span-2">
                                <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                  Standard PMS Checks Completed?
                                </label>
                                <label className="flex items-start gap-2 cursor-pointer font-body-sm text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                                  <input
                                    type="checkbox"
                                    className="mt-1 rounded text-primary focus:ring-primary"
                                    required
                                  />
                                  <span>
                                    I have checked fluid levels (engine oil,
                                    coolant, fuel), and visually inspected for
                                    leaks and battery corrosion/terminals.
                                  </span>
                                </label>
                              </div>
                              <div className="flex flex-col gap-xs md:col-span-2">
                                <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                  Additional PMS Tasks Performed & Remarks
                                </label>
                                <textarea
                                  placeholder="e.g. Changed oil, replaced filters"
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
                                  required
                                />
                              </div>
                              <div className="flex flex-col gap-xs md:col-span-2">
                                <label className="font-label-md text-label-md text-on-surface-variant border-l-2 border-primary pl-2">
                                  Result of testing
                                </label>
                                <textarea
                                  placeholder="e.g. ATS functioned normally, held 80% load for 30 minutes without issue"
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
                                onChange={(e) =>
                                  setDidRefillFuel(e.target.checked)
                                }
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
                        {accountHistory.length > 0 ? (
                          accountHistory.map((h, i) => (
                            <tr key={i} className="border-b border-outline-variant/30 last:border-0">
                              <td className="py-2 px-2 font-mono">{h.details?.accountNumber || "N/A"}</td>
                              <td className="py-2 px-2">{new Date(h.date).toLocaleString()}</td>
                              <td className="py-2 px-2 text-primary font-mono text-xs">
                                {h.location ? `${h.location.latitude.toFixed(6)}, ${h.location.longitude.toFixed(6)}` : "No GPS data"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-4 px-2 text-center text-on-surface-variant">
                              No previous visits found for this account.
                            </td>
                          </tr>
                        )}
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
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-xs md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">
                      Checked By
                    </label>
                    <select
                      required
                    >
                      <option value="">Select Supervisor</option>
                      {customStaff.map((staff) => (
                        <option key={staff} value={staff}>
                          {staff.split(" - ")[0]}
                        </option>
                      ))}
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
                          className="bg-transparent font-headline-sm font-semibold text-on-surface outline-none border-b border-dashed border-outline-variant focus:border-primary flex-1 min-w-[150px] max-w-[300px] mr-4 py-1 truncate"
                          placeholder="Enter Blow-off name"
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
                              <img
                                src={bo.initialPhoto}
                                className="w-full h-full object-cover"
                              />
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
                              onChange={(e) =>
                                handleBlowOffPhoto(bo.id, "initial", e)
                              }
                            />
                          </label>
                        </div>
                        <div className="w-full">
                          <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                            Final Water Photo
                          </span>
                          <label className="h-24 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-all overflow-hidden relative">
                            {bo.finalPhoto ? (
                              <img
                                src={bo.finalPhoto}
                                className="w-full h-full object-cover"
                              />
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
                              onChange={(e) =>
                                handleBlowOffPhoto(bo.id, "final", e)
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addBlowOff}
                    className="text-primary font-label-md flex items-center gap-1 hover:bg-primary/5 rounded px-3 py-2 border border-primary/20 transition-colors w-max"
                  >
                    <Plus className="w-4 h-4" /> Add another Blow-off point
                  </button>

                  <div className="mt-8 pt-4 border-t border-outline-variant">
                    <h4 className="font-headline-sm text-on-surface mb-4">
                      Total Flushed Volume Configuration
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant flex items-center justify-between">
                          <span>Initial Meter Read</span>
                          <span className="text-[10px] text-outline font-normal">
                            ISO 5667-3:2018 NRW
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={flushingInitialRead}
                            onChange={(e) =>
                              setFlushingInitialRead(
                                Number(e.target.value) || "",
                              )
                            }
                            placeholder="0.00"
                          />
                          <span className="text-on-surface-variant text-sm font-medium">
                            m³
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="font-label-md text-label-md text-on-surface-variant flex items-center justify-between">
                          <span>Final Meter Read</span>
                          <span className="text-[10px] text-outline font-normal">
                            ISO 5667-3:2018 NRW
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={flushingFinalRead}
                            onChange={(e) =>
                              setFlushingFinalRead(Number(e.target.value) || "")
                            }
                            placeholder="0.00"
                          />
                          <span className="text-on-surface-variant text-sm font-medium">
                            m³
                          </span>
                        </div>
                      </div>
                    </div>

                    {typeof flushingInitialRead === "number" &&
                    typeof flushingFinalRead === "number" &&
                    flushingFinalRead >= flushingInitialRead ? (
                      <div className="mt-4 bg-secondary/10 text-secondary-dark px-4 py-3 rounded-lg text-sm font-semibold border border-secondary/20 flex justify-between items-center shadow-sm">
                        <span>Total Flushed Volume (NRW KPI):</span>
                        <span className="text-lg">
                          {(flushingFinalRead - flushingInitialRead).toFixed(2)}{" "}
                          m³
                        </span>
                      </div>
                    ) : null}
                  </div>
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
        <div className="pt-sm pb-lg relative z-0 flex flex-col sm:flex-row gap-3">
          {[
            "flushing",
            "tank_cleaning",
            "leak_repair",
            "tank_opening",
          ].includes(selectedActivity || "") && (
            <button
              type="button"
              onClick={(e) => submitForm(e, "in_progress")}
              disabled={!selectedActivity || isSubmitting || isSavingDraft}
              className="w-full sm:w-1/3 py-4 text-base rounded-full font-label-lg transition-all active:scale-[0.98] border border-outline bg-surface hover:bg-surface-variant text-on-surface flex items-center justify-center -mb-2 sm:mb-0"
            >
              {isSavingDraft ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <FileClock className="w-5 h-5 mr-2 text-on-surface-variant" />
              )}
              {isSavingDraft ? "Saving..." : "Save Progress"}
            </button>
          )}
          <button
            type="submit"
            disabled={!selectedActivity || isSubmitting || isSavingDraft}
            className={`w-full py-4 text-lg btn-primary ${["flushing", "tank_cleaning", "leak_repair", "tank_opening"].includes(selectedActivity || "") ? "sm:w-2/3" : ""}`}
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
              natureOfTest: testNature,
              paymentDetails: "",
              meterBrand: meterBrand,
              meterSerialNumber: meterSerialNumber,
              volumeOfWater: 30, // 3 x 10
              natureOfMeter: meterNature,
              reading1_init: Number(currentReading),
              reading1_final: Number(reading1),
              reading2_init: Number(reading1),
              reading2_final: Number(reading2),
              reading3_init: Number(reading2),
              reading3_final: Number(reading3),
              error1: (((Number(reading1) - Number(currentReading)) / 0.01) - 1) * 100,
              error2: (((Number(reading2) - Number(reading1)) / 0.01) - 1) * 100,
              error3: (((Number(reading3) - Number(reading2)) / 0.01) - 1) * 100,
              avgError: (((Number(reading3) - Number(currentReading)) / 0.03) - 1) * 100,
              testingResults:
                (((Number(reading3) - Number(currentReading)) / 0.03) - 1) * 100 >
                5
                  ? "Fast Moving"
                  : (((Number(reading3) - Number(currentReading)) / 0.03) - 1) *
                        100 <
                      -5
                    ? "Slow Moving"
                    : "Passed",
              recommendation:
                Math.abs(
                  (((Number(reading3) - Number(currentReading)) / 0.03) - 1) * 100,
                ) > 5
                  ? "Replace"
                  : "Retain",
              testedBy: selectedStaff.join(", "),
              witnessedBy: witnessedBy,
              witnessSignatureImg: witnessSignature || undefined,
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
