import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  AlertTriangle,
  Info,
  Paintbrush,
  Users,
  ShieldAlert,
  MapPin,
  Clock,
  Check,
} from "lucide-react";
import { defaultStaff } from "../lib/dataStore";
import { db } from "../lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

interface AttendanceViewProps {
  currentUser: string | null;
  currentUid?: string | null;
}

export type ShiftDefinition = {
  label: string;
  name: string;
  time: string;
  color: string;
  endHour: number;
  startHourDay: number;
};

const DEFAULT_SHIFTS: Record<string, ShiftDefinition> = {
  P_RED: {
    label: "P",
    name: "Pavia Plant",
    time: "7:00 AM - 4:00 PM",
    color: "bg-[#dc2626] text-white",
    endHour: 16,
    startHourDay: 7,
  },
  P_GREEN: {
    label: "P",
    name: "Pavia Plant",
    time: "8:00 AM - 4:00 PM",
    color: "bg-[#65a30d] text-white",
    endHour: 16,
    startHourDay: 8,
  },
  P_BLUE: {
    label: "P",
    name: "Pavia Plant",
    time: "4:00 PM - 12:00 AM",
    color: "bg-[#2563eb] text-white",
    endHour: 24,
    startHourDay: 16,
  },
  P_YELLOW: {
    label: "P",
    name: "Pavia Plant",
    time: "12:00 AM - 8:00 AM",
    color: "bg-[#eab308] text-white",
    endHour: 8,
    startHourDay: 0,
  },
  B_RED: {
    label: "B",
    name: "Pump House & WB",
    time: "7:00 AM - 4:00 PM",
    color: "bg-[#dc2626] text-white",
    endHour: 16,
    startHourDay: 7,
  },
  B_PURPLE: {
    label: "B",
    name: "Pump House & WB",
    time: "3:00 PM - 12:00 AM",
    color: "bg-[#9333ea] text-white",
    endHour: 24,
    startHourDay: 15,
  },
  B_ORANGE: {
    label: "B",
    name: "Pump House & WB",
    time: "10:00 PM - 7:00 AM",
    color: "bg-[#ea580c] text-white",
    endHour: 7 + 24,
    startHourDay: 22,
  },
  W_RED: {
    label: "W",
    name: "Wakeboard",
    time: "7:00 AM - 4:00 PM",
    color: "bg-[#dc2626] text-white",
    endHour: 16,
    startHourDay: 7,
  },
  W_PURPLE: {
    label: "W",
    name: "Wakeboard",
    time: "3:00 PM - 12:00 AM",
    color: "bg-[#9333ea] text-white",
    endHour: 24,
    startHourDay: 15,
  },
  W_ORANGE: {
    label: "W",
    name: "Wakeboard",
    time: "10:00 PM - 7:00 AM",
    color: "bg-[#ea580c] text-white",
    endHour: 7 + 24,
    startHourDay: 22,
  },
  OFF: {
    label: "",
    name: "Rest Day / Off",
    time: "Scheduled Leave",
    color: "bg-[#111827] text-white",
    endHour: -1,
    startHourDay: -1,
  },
  ERASE: {
    label: "✕",
    name: "Clear Cell",
    time: "Remove shift",
    color: "bg-white text-outline border border-dashed border-outline-variant",
    endHour: -1,
    startHourDay: -1,
  },
  "": {
    label: "",
    name: "Unassigned",
    time: "",
    color: "bg-transparent text-transparent",
    endHour: -1,
    startHourDay: -1,
  },
};

const COLOR_PRESETS = [
  { value: "bg-[#dc2626] text-white", label: "Red" },
  { value: "bg-[#65a30d] text-white", label: "Green" },
  { value: "bg-[#2563eb] text-white", label: "Blue" },
  { value: "bg-[#eab308] text-white", label: "Yellow" },
  { value: "bg-[#ea580c] text-white", label: "Orange" },
  { value: "bg-[#9333ea] text-white", label: "Purple" },
  { value: "bg-[#0f766e] text-white", label: "Teal" },
  { value: "bg-[#db2777] text-white", label: "Pink" },
  { value: "bg-[#52525b] text-white", label: "Gray" },
  { value: "bg-[#111827] text-white", label: "Black" },
];

type ScheduleData = {
  [staffName: string]: {
    [dateIso: string]: string;
  };
};

export function AttendanceView({
  currentUser,
  currentUid,
}: AttendanceViewProps) {
  const isAdmin =
    currentUser?.includes("Kevin Vilbar") || currentUser?.includes("Tech Head");
  const [customStaff, setCustomStaff] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [dates, setDates] = useState<any[]>([]);
  const [paintShift, setPaintShift] = useState<string | null>(null);
  const [palette, setPalette] = useState<Record<string, ShiftDefinition>>({});

  // Palette Editing State
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShiftKey, setEditingShiftKey] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftDefinition & { key: string }>(
    {
      key: "",
      label: "",
      name: "",
      time: "",
      color: COLOR_PRESETS[0].value,
      endHour: 16,
      startHourDay: 8,
    },
  );

  const [clockInState, setClockInState] = useState<
    "idle" | "locating" | "clocked"
  >("idle");
  const [locationStr, setLocationStr] = useState<string | null>(null);

  const handleClockIn = () => {
    if (!currentUid) return alert("Session not found.");
    setClockInState("locating");

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const locMap = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)} (±${Math.round(accuracy)}m)`;
          setLocationStr(locMap);

          try {
            // Log to user attendance collection
            const ref = doc(
              db,
              `users/${currentUid}/attendance`,
              `clockin-${Date.now()}`,
            );
            await setDoc(ref, {
              type: "clock-in",
              timestamp: serverTimestamp(),
              location: { latitude, longitude, accuracy },
              staffName: currentUser || "Unknown",
            });
            setClockInState("clocked");
          } catch (e) {
            console.error(e);
            setClockInState("idle");
            alert("Save failed: Network error.");
          }
        },
        (error) => {
          setClockInState("idle");
          if (error.code === error.PERMISSION_DENIED) {
            alert(
              "Location access denied. GPS tracking is required to clock in from the field.",
            );
          } else {
            alert("Unable to retrieve location: " + error.message);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      setClockInState("idle");
      alert("Geolocation is not supported by your browser.");
    }
  };

  useEffect(() => {
    // Generate next 7 days
    const generatedDates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return {
        date: d,
        iso: d.toISOString().split("T")[0],
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      };
    });
    setDates(generatedDates);

    const storedPalette = localStorage.getItem("watsanShiftPalette");
    if (storedPalette) {
      setPalette(JSON.parse(storedPalette));
    } else {
      setPalette(DEFAULT_SHIFTS);
      localStorage.setItem(
        "watsanShiftPalette",
        JSON.stringify(DEFAULT_SHIFTS),
      );
    }

    const storedStaff = localStorage.getItem("watsanStaff");
    let staff: string[] = [];
    if (storedStaff) {
      const parsed = JSON.parse(storedStaff);
      staff = parsed.filter(
        (s: string) => !s.includes("Kevin Vilbar") && s !== "Darwil Fernandez",
      );
      setCustomStaff(staff);
    } else {
      staff = defaultStaff;
      setCustomStaff(defaultStaff);
    }

    const storedSchedule = localStorage.getItem("watsanWeeklySchedule");
    if (storedSchedule) {
      setSchedule(JSON.parse(storedSchedule));
    } else {
      // Seed initial schedule for visual preview based on image
      const initial: ScheduleData = {};
      const hardcodedPat: Record<string, string[]> = {
        "Jose Marie Alipala Jr": [
          "P_BLUE",
          "P_YELLOW",
          "P_YELLOW",
          "P_YELLOW",
          "OFF",
          "P_GREEN",
          "P_GREEN",
        ],
        "Rheynante Toledo": [
          "P_GREEN",
          "P_GREEN",
          "OFF",
          "P_BLUE",
          "P_BLUE",
          "P_BLUE",
          "P_BLUE",
        ],
        "Exo John Rogador": [
          "OFF",
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
        ],
        "Franz Grajo": [
          "W_RED",
          "P_YELLOW",
          "P_YELLOW",
          "P_YELLOW",
          "OFF",
          "OFF",
          "W_RED",
        ],
        "Ghelson Viejo": [
          "B_RED",
          "B_RED",
          "B_RED",
          "B_RED",
          "B_RED",
          "B_PURPLE",
          "B_PURPLE",
        ],
        "Joe Vincent Palacios": [
          "B_ORANGE",
          "B_ORANGE",
          "OFF",
          "B_ORANGE",
          "B_ORANGE",
          "B_PURPLE",
          "B_PURPLE",
        ],
        "John Rey Alabado": [
          "B_PURPLE",
          "B_PURPLE",
          "B_PURPLE",
          "B_PURPLE",
          "B_PURPLE",
          "OFF",
          "B_PURPLE",
        ],
        "Kim John Nequinto": [
          "B_ORANGE",
          "B_ORANGE",
          "B_ORANGE",
          "B_ORANGE",
          "B_ORANGE",
          "OFF",
          "B_ORANGE",
        ],
        "Mark Gil Espinosa": [
          "B_RED",
          "B_RED",
          "OFF",
          "B_RED",
          "B_RED",
          "B_RED",
          "B_RED",
        ],
      };

      staff.forEach((s) => {
        initial[s] = {};
        const pat = hardcodedPat[s] || [
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
          "P_GREEN",
          "OFF",
          "OFF",
        ];
        generatedDates.forEach((d, idx) => {
          initial[s][d.iso] = pat[idx] || "";
        });
      });
      setSchedule(initial);
      localStorage.setItem("watsanWeeklySchedule", JSON.stringify(initial));
    }
  }, []);

  const getStaffWarning = (staff: string) => {
    const conflicts = new Set<string>();
    let noOffDay = true;
    let hasShifts = false;

    if (!dates || dates.length === 0) return { conflicts, noOffDay: false };

    for (let i = 0; i < dates.length; i++) {
      const iso = dates[i].iso;
      const shiftCode = schedule[staff]?.[iso];
      if (
        shiftCode &&
        shiftCode !== "OFF" &&
        shiftCode !== "ERASE" &&
        shiftCode !== ""
      ) {
        hasShifts = true;
      }
      if (shiftCode === "OFF") {
        noOffDay = false;
      }
    }

    if (!hasShifts) noOffDay = false; // Intentionally empty, don't warn.

    for (let i = 0; i < dates.length - 1; i++) {
      const todayIso = dates[i].iso;
      const tmrwIso = dates[i + 1].iso;

      const shift1Code = schedule[staff]?.[todayIso];
      const shift2Code = schedule[staff]?.[tmrwIso];

      if (
        !shift1Code ||
        shift1Code === "OFF" ||
        shift1Code === "ERASE" ||
        shift1Code === ""
      )
        continue;
      if (
        !shift2Code ||
        shift2Code === "OFF" ||
        shift2Code === "ERASE" ||
        shift2Code === ""
      )
        continue;

      const s1 = palette[shift1Code];
      const s2 = palette[shift2Code];

      if (!s1 || !s2 || s1.endHour === -1 || s2.startHourDay === -1) continue;

      const restTime = 24 + s2.startHourDay - s1.endHour;

      if (restTime < 8) {
        conflicts.add(todayIso);
        conflicts.add(tmrwIso);
      }
    }

    return { conflicts, noOffDay };
  };

  const handleCellClick = (staff: string, dateIso: string) => {
    if (!isAdmin || !paintShift) return;

    // Apply shift, handle 'ERASE' as empty string
    const targetShift = paintShift === "ERASE" ? "" : paintShift;

    const newSchedule = {
      ...schedule,
      [staff]: {
        ...(schedule[staff] || {}),
        [dateIso]: targetShift,
      },
    };
    setSchedule(newSchedule);
    localStorage.setItem("watsanWeeklySchedule", JSON.stringify(newSchedule));
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.key) {
      alert("Please provide a unique code for this shift.");
      return;
    }
    const newPalette = {
      ...palette,
      [shiftForm.key]: {
        label: shiftForm.label,
        name: shiftForm.name,
        time: shiftForm.time,
        color: shiftForm.color,
        endHour: shiftForm.endHour,
        startHourDay: shiftForm.startHourDay,
      },
    };
    setPalette(newPalette);
    localStorage.setItem("watsanShiftPalette", JSON.stringify(newPalette));
    setShowShiftModal(false);
  };

  const handleDeleteShift = (key: string) => {
    let inUse = false;
    for (const staff in schedule) {
      if (Object.values(schedule[staff]).includes(key)) {
        inUse = true;
        break;
      }
    }

    if (inUse) {
      if (
        !confirm(
          `Warning: The shift "${palette[key].label}" is currently assigned to some staff. Deleting it will leave those slots orphaned. Are you sure you want to delete it?`,
        )
      )
        return;
    } else {
      if (!confirm("Are you sure you want to delete this shift?")) return;
    }

    const newPalette = { ...palette };
    delete newPalette[key];
    setPalette(newPalette);
    localStorage.setItem("watsanShiftPalette", JSON.stringify(newPalette));

    if (paintShift === key) setPaintShift(null);
    setShowShiftModal(false);
  };

  const handleEditClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setEditingShiftKey(key);
    setShiftForm({
      key: key,
      ...palette[key],
    });
    setShowShiftModal(true);
  };

  const handleNewClick = () => {
    setEditingShiftKey(null);
    setShiftForm({
      key: "",
      label: "",
      name: "",
      time: "",
      color: COLOR_PRESETS[0].value,
      endHour: 16,
      startHourDay: 8,
    });
    setShowShiftModal(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-28 animate-in fade-in duration-300">
      {/* Field Staff Location Clock In Panel */}
      {!isAdmin && (
        <div className="border border-outline-variant bg-surface rounded-2xl p-5 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <MapPin className="text-primary w-5 h-5" /> Live GPS Tracking
            </h3>
            <p className="text-sm text-on-surface-variant mt-1 max-w-[448px]">
              Location is strictly required to log attendance. The device's GPS
              hardware captures coordinates accurately.
            </p>
            {locationStr && (
              <p className="text-xs font-mono bg-surface-container-lowest p-2 rounded mt-2 text-primary">
                {locationStr}
              </p>
            )}
          </div>
          <div>
            {clockInState === "idle" && (
              <button
                onClick={handleClockIn}
                className="btn-primary flex items-center gap-2 max-w-[200px] w-full justify-center"
              >
                <Clock className="w-5 h-5" /> Clock In (GPS)
              </button>
            )}
            {clockInState === "locating" && (
              <button
                disabled
                className="btn-primary opacity-70 flex items-center gap-2 min-w-[200px] justify-center cursor-wait"
              >
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Locating...
              </button>
            )}
            {clockInState === "clocked" && (
              <div className="bg-success/10 text-success border border-success/30 px-6 py-2.5 rounded-lg flex items-center gap-2 font-semibold min-w-[200px] justify-center">
                <Check className="w-5 h-5" /> Logged Success
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="font-headline-lg text-on-surface mb-2 tracking-tight">
            Scheduling Grid
          </h2>
          <p className="text-on-surface-variant flex items-center gap-2">
            7-day lookahead schedule with pattern scanning.
          </p>
        </div>
      </div>

      {/* Editor Palette Legend */}
      <div className="border border-outline-variant bg-surface rounded-2xl p-4 md:p-5 shadow-sm mb-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div>
            <h4 className="font-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <Paintbrush className="w-5 h-5 text-primary" /> Shift Palette
            </h4>
            <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5 mt-1">
              <Info className="w-4 h-4 text-primary" />
              {isAdmin
                ? "Select a shift below, then click cells on the grid to paint."
                : "Shift legend and time references."}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setPaintShift(null)}
                className={`px-4 py-2 rounded-xl text-label-md font-semibold transition-all border shrink-0 ${paintShift === null ? "bg-primary text-white border-primary shadow-sm" : "bg-surface text-on-surface hover:bg-surface-container border-outline-variant"}`}
              >
                Cancel Brush
              </button>
              <button
                onClick={handleNewClick}
                className="px-4 py-2 rounded-xl text-label-md font-semibold transition-all border shrink-0 bg-surface text-primary border-primary/20 hover:bg-primary-container"
              >
                + New Shift
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.keys(palette)
            .filter((k) => k !== "")
            .map((code) => {
              const shift = palette[code];
              const isSelected = paintShift === code;
              return (
                <div
                  key={code}
                  className={`relative flex items-stretch border rounded-xl overflow-hidden group transition-all
                  ${isSelected ? "border-primary ring-1 ring-primary shadow-[0_0_0_2px_rgba(0,102,204,0.1)]" : "border-outline-variant/60 hover:border-outline"}
                `}
                >
                  <button
                    onClick={() => isAdmin && setPaintShift(code)}
                    disabled={!isAdmin}
                    className={`flex-1 flex items-center gap-3 p-2.5 text-left
                      ${isAdmin ? "cursor-pointer hover:bg-surface-container-low active:scale-[0.98]" : "cursor-default opacity-90"} 
                      ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-sm shadow-sm ${shift.color}`}
                    >
                      {shift.label}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div
                        className={`text-label-md font-semibold truncate leading-tight ${isSelected ? "text-primary" : "text-on-surface"}`}
                      >
                        {shift.name}
                      </div>
                      <div className="text-[10px] text-on-surface-variant leading-tight mt-0.5">
                        {shift.time}
                      </div>
                    </div>
                  </button>
                  {isAdmin && code !== "OFF" && code !== "ERASE" && (
                    <div className="flex shrink-0 border-l border-transparent z-10 transition-colors">
                      <button
                        onClick={(e) => handleEditClick(e, code)}
                        className="w-10 flex items-center justify-center hover:bg-surface-variant/40 hover:border-outline-variant text-on-surface-variant transition-colors"
                        title="Edit shift"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShift(code);
                        }}
                        className="w-10 flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                        title="Delete shift"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="bg-surface border border-outline-variant shadow-sm rounded-2xl overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest gap-4 shrink-0">
          <div>
            <h3 className="font-headline-sm font-semibold text-on-surface flex items-center gap-2 mb-1">
              <CalendarDays className="w-5 h-5 text-primary" /> Matrix View
            </h3>
          </div>
          {!isAdmin && (
            <div className="text-label-sm text-primary bg-primary-container px-4 py-1.5 rounded-full font-semibold w-fit">
              View Only
            </div>
          )}
        </div>

        <div className="overflow-auto w-full">
          <table className="w-full border-collapse text-left min-w-max">
            <thead>
              <tr className="bg-surface-variant/20">
                <th className="border-b border-r border-outline-variant py-3 px-4 font-semibold text-on-surface-variant text-label-md bg-surface-container-lowest sticky left-0 z-20 min-w-[180px] shadow-[1px_0_0_0_#e5e7eb]">
                  Operator
                </th>
                {dates.map((d) => (
                  <th
                    key={d.iso}
                    className={`border-b border-r border-outline-variant py-2 px-2 min-w-[70px] text-center ${d.isWeekend ? "bg-error/5" : "bg-surface-container-lowest"}`}
                  >
                    <div
                      className={`font-bold text-label-lg ${d.isWeekend ? "text-error" : "text-on-surface"}`}
                    >
                      {d.dayNum}
                    </div>
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-wider ${d.isWeekend ? "text-error/70" : "text-on-surface-variant"}`}
                    >
                      {d.dayName}
                    </div>
                  </th>
                ))}
                <th className="border-b border-outline-variant py-3 px-3 font-semibold text-center text-on-surface-variant text-label-md bg-surface-container-lowest min-w-[80px]">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40 bg-white">
              {customStaff.map((staff) => {
                const { conflicts, noOffDay } = getStaffWarning(staff);
                const hasWarning = conflicts.size > 0 || noOffDay;

                return (
                  <tr
                    key={staff}
                    className="hover:bg-surface-container-lowest transition-colors group"
                  >
                    <td className="border-r border-outline-variant py-2 px-4 shadow-[1px_0_0_0_#e5e7eb] sticky left-0 z-10 bg-white group-hover:bg-surface-container-lowest">
                      <div className="font-medium text-on-surface text-label-md truncate">
                        {staff.split(" - ")[0]}
                      </div>
                    </td>
                    {dates.map((d) => {
                      const shiftCode = schedule[staff]?.[d.iso] || "";
                      const isConflict = conflicts.has(d.iso);
                      const shift = palette[shiftCode] || palette[""];

                      return (
                        <td
                          key={d.iso}
                          onClick={() => handleCellClick(staff, d.iso)}
                          className={`border-r border-outline-variant p-0 relative transition-all ${isAdmin && paintShift ? "cursor-cell hover:bg-surface-container-low" : ""} ${d.isWeekend && shiftCode === "" ? "bg-error/[0.02]" : ""}`}
                          title={
                            shift.name ? `${shift.name}\n${shift.time}` : ""
                          }
                        >
                          <div className="w-full h-[40px] flex items-center justify-center relative p-1">
                            {shiftCode !== "" && shiftCode !== "ERASE" && (
                              <div
                                className={`w-full h-full rounded shadow-sm flex items-center justify-center font-bold text-xs ${shift.color} border border-black/5`}
                              >
                                {shift.label}
                              </div>
                            )}

                            {/* Warning border overlay */}
                            {isConflict && (
                              <div className="absolute inset-0 border-2 border-error border-dashed pointer-events-none rounded-sm z-10" />
                            )}

                            {/* Paint hover preview */}
                            {isAdmin &&
                              paintShift &&
                              paintShift !== "ERASE" &&
                              shiftCode === "" &&
                              palette[paintShift] && (
                                <div
                                  className={`absolute inset-1 rounded opacity-0 group-hover:opacity-40 flex items-center justify-center font-bold text-xs ${palette[paintShift].color} pointer-events-none`}
                                >
                                  {palette[paintShift].label}
                                </div>
                              )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-center bg-white group-hover:bg-surface-container-lowest">
                      <div className="flex justify-center flex-col items-center gap-1 min-h-[40px]">
                        {conflicts.size > 0 && (
                          <div className="text-error bg-error/10 p-1 rounded group/tt relative cursor-help">
                            <AlertTriangle className="w-4 h-4" />
                            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-surface border border-error/20 text-error text-[10px] whitespace-nowrap px-2 py-1 rounded shadow-lg opacity-0 group-hover/tt:opacity-100 pointer-events-none z-50">
                              Rest conflict (&lt;8h between shifts)
                            </div>
                          </div>
                        )}
                        {noOffDay && (
                          <div className="text-[#ea580c] bg-[#ea580c]/10 p-1 rounded group/tt relative cursor-help">
                            <ShieldAlert className="w-4 h-4" />
                            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-surface border border-[#ea580c]/20 text-[#ea580c] text-[10px] whitespace-nowrap px-2 py-1 rounded shadow-lg opacity-0 group-hover/tt:opacity-100 pointer-events-none z-50">
                              Continuous 7-day pattern (No OFF)
                            </div>
                          </div>
                        )}
                        {!hasWarning && (
                          <div className="text-outline-variant">-</div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {customStaff.length === 0 && (
            <div className="p-12 text-center text-on-surface-variant flex flex-col items-center">
              <Users className="w-16 h-16 text-outline-variant/60 mb-4" />
              <p className="text-body-lg">No operators found in system.</p>
            </div>
          )}
        </div>
      </div>

      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-[448px] rounded-2xl shadow-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-sm font-semibold">
                {editingShiftKey ? "Edit Shift" : "Create Shift"}
              </h3>
              <button
                onClick={() => setShowShiftModal(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleSaveShift}
              className="p-5 overflow-y-auto flex-1 flex flex-col gap-4"
            >
              <div className="form-group flex flex-col gap-1">
                <label className="text-label-md font-semibold">
                  Unique Code (Key) *
                </label>
                <input
                  type="text"
                  value={shiftForm.key}
                  onChange={(e) =>
                    setShiftForm({
                      ...shiftForm,
                      key: e.target.value.toUpperCase().replace(/\s+/g, "_"),
                    })
                  }
                  disabled={editingShiftKey !== null}
                  className="px-3 py-2 border rounded-xl"
                  placeholder="e.g. S_RED"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col gap-1">
                  <label className="text-label-md font-semibold">
                    Label (Short) *
                  </label>
                  <input
                    type="text"
                    value={shiftForm.label}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, label: e.target.value })
                    }
                    className="px-3 py-2 border rounded-xl"
                    placeholder="e.g. P"
                    maxLength={3}
                    required
                  />
                </div>

                <div className="form-group flex flex-col gap-1">
                  <label className="text-label-md font-semibold">
                    Location / Area *
                  </label>
                  <input
                    type="text"
                    value={shiftForm.name}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, name: e.target.value })
                    }
                    className="px-3 py-2 border rounded-xl"
                    placeholder="e.g. Pavia Plant"
                    required
                  />
                </div>
              </div>

              <div className="form-group flex flex-col gap-1">
                <label className="text-label-md font-semibold">
                  Time String *
                </label>
                <input
                  type="text"
                  value={shiftForm.time}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, time: e.target.value })
                  }
                  className="px-3 py-2 border rounded-xl"
                  placeholder="e.g. 7:00 AM - 4:00 PM"
                  required
                />
              </div>

              <div className="form-group flex flex-col gap-1">
                <label className="text-label-md font-semibold">
                  Color Preset *
                </label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() =>
                        setShiftForm({ ...shiftForm, color: preset.value })
                      }
                      className={`h-10 rounded-lg flex items-center justify-center border-2 transition-all ${preset.value} ${shiftForm.color === preset.value ? "border-primary ring-2 ring-primary/20 scale-105" : "border-transparent opacity-80 hover:opacity-100 object-cover"}`}
                      title={preset.label}
                    >
                      {shiftForm.color === preset.value && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col gap-1">
                  <label className="text-label-md font-semibold">
                    Start Hour (0-23)
                  </label>
                  <input
                    type="number"
                    value={shiftForm.startHourDay}
                    onChange={(e) =>
                      setShiftForm({
                        ...shiftForm,
                        startHourDay: parseInt(e.target.value) || 0,
                      })
                    }
                    className="px-3 py-2 border rounded-xl"
                  />
                </div>

                <div className="form-group flex flex-col gap-1">
                  <label className="text-label-md font-semibold">
                    End Hour
                  </label>
                  <input
                    type="number"
                    value={shiftForm.endHour}
                    onChange={(e) =>
                      setShiftForm({
                        ...shiftForm,
                        endHour: parseInt(e.target.value) || 0,
                      })
                    }
                    className="px-3 py-2 border rounded-xl"
                  />
                  <p className="text-[10px] text-on-surface-variant">
                    Value &gt; 24 if shift crosses midnight
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-outline-variant">
                <div>
                  {editingShiftKey && (
                    <button
                      type="button"
                      onClick={() => handleDeleteShift(editingShiftKey)}
                      className="text-error font-semibold px-4 py-2 hover:bg-error/10 rounded-xl transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="px-5 py-2 font-semibold text-on-surface hover:bg-surface-variant rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Save Shift
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
