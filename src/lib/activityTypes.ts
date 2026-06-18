// ============================================================
// CANONICAL ACTIVITY TYPES — single source of truth
// Used by: ActivityView (write), DashboardView (filter/chart),
//          TasksView (link), PmsView (query)
// ============================================================

export interface ActivityType {
  id: string;
  label: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: "meter_inst",        label: "Meter Installation" },
  { id: "meter_replacement", label: "Meter Replacement" },
  { id: "meter_test",        label: "Meter Test" },
  { id: "meter_check_bulk",  label: "Meter Checking (Bulk)" },
  { id: "meter_check_indiv", label: "Meter Checking (Individual)" },
  { id: "reconnection",      label: "Reconnection" },
  { id: "leak_repair",       label: "Leak Repair" },
  { id: "leak_detection",    label: "Leak Detection" },
  { id: "flushing",          label: "Flushing" },
  { id: "tank_cleaning",     label: "Tank Cleaning" },
  { id: "tank_opening",      label: "Tank Opening & Closing" },
  { id: "pump_monitoring",   label: "Pump House Monitoring" },
  { id: "genset_monitoring", label: "Genset Monitoring" },
  { id: "backwash",          label: "Backwash" },
  { id: "hydro_testing",     label: "Hydro Testing" },
  { id: "well_pull_out",     label: "Well Pull-Out" },
  { id: "garbage_collection",label: "Garbage Collection" },
  { id: "plant_watering",    label: "Plant Watering" },
];

/** Map of id → label for quick lookups */
export const ACTIVITY_TYPE_MAP: Record<string, string> =
  Object.fromEntries(ACTIVITY_TYPES.map(a => [a.id, a.label]));
