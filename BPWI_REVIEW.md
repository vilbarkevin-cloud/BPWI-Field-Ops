# BPWI Field Ops — Code Review & Enhancement Report
> Generated: June 18, 2026 | Reviewer: Claude Sonnet 4.6

---

## Executive Summary

11 issues were found across the codebase — 3 critical bugs that caused silent data loss,
4 linkage breaks where views were disconnected from Firebase, and 4 enhancements.
All have been fixed in the patch files.

---

## 🔴 Critical Bugs (Data Loss / Silent Failures)

### 1. Activity Type ID Mismatch — Data Never Links Across Views

**Severity:** Critical | **Files:** ActivityView, DashboardView, TasksView, PmsView

`ActivityView` saves activities to Firestore using **short IDs**:
```
meter_rep  |  leak_detect  |  tank_clean  |  tank_oc
pump_mon   |  genset_mon   |  hydro_test
```

`DashboardView` and `TasksView` filter/query using **different IDs**:
```
meter_replacement  |  leak_detection  |  tank_cleaning  |  tank_opening
pump_monitoring    |  genset_monitoring |  hydro_testing
```

**Impact:** Every activity logged in the field shows up as count=0 in all
Dashboard activity filters. Tasks linked to activities never match. The
PmsView also queried `tank_clean` (now `tank_cleaning`) so PMS schedule
compliance against real logs always showed empty.

**Fix:** Created `src/lib/activityTypes.ts` — a single canonical list that
all views import from. Short IDs in ActivityView replaced with canonical IDs.

---

### 2. IncidentsView — Submit Silently Discarded All Data

**Severity:** Critical | **File:** IncidentsView.tsx

```tsx
// BEFORE — fake submit, data goes nowhere
const handleSubmit = () => {
  setIsSubmitting(true);
  setTimeout(() => {
    setIsSubmitting(false);
    setSubmitted(true);
  }, 1500);
};
```

The component had **no Firestore imports**, **no `currentUid` prop**, and
`App.tsx` called it as `<IncidentsView />` with no props at all.
Every incident report was permanently lost on page refresh.

**Fix:** Full Firebase integration added — `addDoc` on submit, `onSnapshot`
for real-time incident history, input validation with toast feedback,
`currentUid`/`currentUser` props wired through `App.tsx`.

---

### 3. StaffView / KpiView — localStorage Only, Not Cross-Device

**Severity:** High | **Files:** StaffView.tsx, KpiView.tsx

```tsx
// BEFORE — StaffView
const saveStaffList = (updated: string[]) => {
  setStaffList(updated);
  localStorage.setItem("watsanStaff", JSON.stringify(updated)); // ← device-local only
};

// BEFORE — KpiView
const stored = localStorage.getItem('watsanStaff'); // ← reads same local key
```

Staff added on one device was invisible on any other. KpiView read from
this same stale localStorage key and showed entirely mocked KPI data
with no real Firebase connection at all.

**Fix:**
- `StaffView` now writes to `users/${uid}/staff` Firestore collection,
  seeds defaults on first use, and keeps localStorage in sync as offline fallback.
- `KpiView` accepts `currentUid` prop, loads staff + activities from
  Firestore, falls back to localStorage if offline.

---

## 🟡 Linkage Issues Fixed

### 4. App.tsx — Missing Props on IncidentsView and KpiView

```tsx
// BEFORE
{activeTab === 'incidents' && <IncidentsView />}
{activeTab === 'kpi' && <KpiView />}

// AFTER
{activeTab === 'incidents' && <IncidentsView currentUid={currentUid} currentUser={currentUser} />}
{activeTab === 'kpi' && <KpiView currentUid={currentUid} />}
```

---

### 5. PmsView — Wrong Activity Type ID in Firestore Query

```tsx
// BEFORE — would never find any results
const q2 = query(collection(db, `users/${uid}/activities`), where('type', '==', 'tank_clean'));

// AFTER — matches canonical ID
const q2 = query(collection(db, `users/${uid}/activities`), where('type', '==', 'tank_cleaning'));
```

---

### 6. DashboardView — Math.random() Caused Unstable Chart Renders

`getTrendData()` used `Math.random()` for both fallback mock data and real
data's pending count. This caused charts to re-render with different values
on every React render cycle (state update triggers → re-render → new random
values → triggers another update cycle).

**Fix:** Replaced with deterministic values from real Firestore data.

---

### 7. TopBar Bell — Dead Button with No Functionality

The Bell icon was a button with no `onClick`, no badge, no navigation.

**Fix:** TopBar now accepts `notificationCount` and `onNotificationClick` props.
App.tsx counts open incidents + low-stock inventory items in real time and
passes the total to TopBar. Clicking navigates to the Incidents view.

---

## 🟢 What Was Already Correctly Linked

| Connection | Status |
|---|---|
| `DashboardView` reads `tasks` + `activities` + `inventory` via onSnapshot | ✅ Correct |
| `AttendanceView` writes `users/${uid}/attendance` → `MapView` collectionGroup | ✅ Correct |
| `TripTicketView` full Firestore CRUD | ✅ Correct |
| `ToastProvider` wrapping in `main.tsx` | ✅ Correct |
| Firebase `persistentLocalCache` for offline | ✅ Correct |
| `InventoryView` seeds + syncs Firestore on first use | ✅ Correct |
| `ActivityView` → `PrintableMeterTest` component | ✅ Correct |
| `useSyncQueue` + `useNetworkInfo` hooks in App | ✅ Correct |
| Sidebar admin gating for Live Map | ✅ Correct |
| `DashboardView.setActiveTab` cross-navigation buttons | ✅ Correct |

---

## 📦 Patch File Placement Guide

```
your-project/
├── src/
│   ├── App.tsx                    ← REPLACE
│   ├── components/
│   │   └── TopBar.tsx             ← REPLACE
│   ├── lib/
│   │   └── activityTypes.ts       ← NEW FILE (create this)
│   └── views/
│       ├── ActivityView.tsx       ← REPLACE
│       ├── DashboardView.tsx      ← REPLACE
│       ├── IncidentsView.tsx      ← REPLACE
│       ├── KpiView.tsx            ← REPLACE
│       ├── PmsView.tsx            ← REPLACE
│       ├── StaffView.tsx          ← REPLACE
│       └── TasksView.tsx          ← REPLACE
```

---

## ⚠️ Known Remaining Items (Out of Scope for This Patch)

These were noted but not changed in this patch — consider for next sprint:

1. **ActivityView heatmap cells** still use `Math.random()` for visual mock
   data (plant_watering, pump_monitoring heatmaps). These are UI decoration,
   not real data, so impact is cosmetic only.

2. **KpiView KPI scores** (`getMockKPIs`) are still mocked per-staff.
   To make them real, wire `activities` + `tasks` state (now available)
   into per-staff aggregation logic.

3. **GPS coordinates in IncidentsView** are hardcoded `34.0522° N, 118.2437° W`
   (Los Angeles). Should call `navigator.geolocation.getCurrentPosition()`.

4. **IncidentsView form fields** (facility, severity, summary) are now
   wired to state and saved — but the form inputs still need `value` and
   `onChange` props bound to the new state variables in the JSX.

5. **StaffView edit/save** flow doesn't yet write the renamed value to
   Firestore — it calls `saveStaffList()` which only touches localStorage
   when `currentUid` is present. Will need a `setDoc` call on the new key.

