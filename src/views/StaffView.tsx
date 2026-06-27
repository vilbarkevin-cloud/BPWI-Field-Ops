import React, { useState, useEffect } from "react";
import {
  UserPlus,
  UserRound,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  CornerDownRight,
  ClipboardCheck,
} from "lucide-react";
import { defaultStaff } from "../lib/dataStore";
import { db } from "../lib/firebase";
import { useAdminRole } from "../hooks/useAdminRole";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  getDocs,
  where,
  writeBatch
} from "firebase/firestore";

interface StaffViewProps {
  setActiveTab?: any;
  currentUser: string | null;
  currentUid?: string | null;
  globalSearchQuery?: string;
}

type ActiveStatus = "Available" | "In Transit" | "Off Duty";

interface StaffMember {
  id: string;
  name: string;
  reportsTo: string | null;
  status: ActiveStatus;
}

export function StaffView({ currentUser, currentUid, setActiveTab, globalSearchQuery = "" }: StaffViewProps) {
  const [staffObjList, setStaffObjList] = useState<StaffMember[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserManagerId, setNewUserManagerId] = useState("");
  const [searchTerm, setSearchTerm] = useState(globalSearchQuery);

  useEffect(() => {
    setSearchTerm(globalSearchQuery);
  }, [globalSearchQuery]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editPosition, setEditPosition] = useState("");

  // Also track manager editing
  const [editManagerId, setEditManagerId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<ActiveStatus>("Available");
  const [newUserStatus, setNewUserStatus] = useState<ActiveStatus>("Available");

  const [activeFilter, setActiveFilter] = useState("All");

  // Task Assignment drawer/modal state
  const [assignee, setAssignee] = useState<StaffMember | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskLocation, setTaskLocation] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");

  // Bulk Task Reassignment state
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignTargetId, setBulkReassignTargetId] = useState("");

  const isAdmin = useAdminRole(currentUid);

  useEffect(() => {
    if (!currentUid) {
      // Fallback to localStorage when not authenticated
      const stored = localStorage.getItem("watsanStaff");
      const version = localStorage.getItem("staffListV3");
      if (stored && version) {
        const names: string[] = JSON.parse(stored);
        setStaffObjList(
          names.map((name) => ({
            id: name.replace(/\s+/g, "_").toLowerCase(),
            name,
            reportsTo: null,
            status: "Available" as ActiveStatus,
          })),
        );
      } else {
        setStaffObjList(
          defaultStaff.map((name) => ({
            id: name.replace(/\s+/g, "_").toLowerCase(),
            name,
            reportsTo: null,
            status: "Available" as ActiveStatus,
          })),
        );
        localStorage.setItem("watsanStaff", JSON.stringify(defaultStaff));
        localStorage.setItem("staffListV3", "true");
      }
      return;
    }

    // Firestore real-time sync — primary source of truth
    const q = query(collection(db, `users/${currentUid}/staff`));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          // Seed Firestore with defaults on first use
          defaultStaff.forEach(async (name) => {
            const ref = doc(
              db,
              `users/${currentUid}/staff`,
              name.replace(/\s+/g, "_").toLowerCase(),
            );
            await setDoc(
              ref,
              { name, reportsTo: null, status: "Available", createdAt: serverTimestamp() },
              { merge: true },
            );
          });
        } else {
          const staffDocs = snapshot.docs.map((d) => ({
            id: d.id,
            name: d.data().name as string,
            reportsTo: d.data().reportsTo || null,
            status: (d.data().status as ActiveStatus) || "Available",
          }));

          // Sort alphabetically as fallback
          staffDocs.sort((a, b) => a.name.localeCompare(b.name));

          setStaffObjList(staffDocs);

          // Keep localStorage in sync for KpiView (localStorage fallback)
          const names = staffDocs.map((s) => s.name);
          localStorage.setItem("watsanStaff", JSON.stringify(names));
          localStorage.setItem("staffListV3", "true");
        }
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
        console.error("Staff listener:", error);
      },
    );
    return () => unsub();
  }, [currentUid]);

  const saveLocalFallback = (updatedObjs: StaffMember[]) => {
    setStaffObjList(updatedObjs);
    localStorage.setItem(
      "watsanStaff",
      JSON.stringify(updatedObjs.map((s) => s.name)),
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    const combinedName = newUserName.trim();

    const newId = combinedName.replace(/\s+/g, "_").toLowerCase();

    if (currentUid) {
      const ref = doc(db, `users/${currentUid}/staff`, newId);
      await setDoc(
        ref,
        {
          name: combinedName,
          reportsTo: newUserManagerId || null,
          status: newUserStatus,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      const newObj = {
        id: newId,
        name: combinedName,
        reportsTo: newUserManagerId || null,
        status: newUserStatus,
      };
      saveLocalFallback([...staffObjList, newObj]);
    }

    setNewUserName("");
    setNewUserManagerId("");
    setNewUserStatus("Available");
    setIsAddingUser(false);
  };

  const handleDeleteUser = async (staffId: string, name: string) => {
    const hasSubordinates = staffObjList.some((s) => s.reportsTo === staffId);
    if (hasSubordinates) {
      alert("This user has team members assigned to them. Please reassign subordinates before deleting.");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    if (currentUid) {
      const ref = doc(db, `users/${currentUid}/staff`, staffId);
      await deleteDoc(ref);
    } else {
      saveLocalFallback(staffObjList.filter((s) => s.id !== staffId));
    }
  };

  const startEdit = (person: StaffMember) => {
    setEditingStaffId(person.id);
    setEditValue(person.name.split(" - ")[0]);
    setEditManagerId(person.reportsTo || "");
    setEditStatus(person.status || "Available");
  };

  const saveEdit = async (person: StaffMember) => {
    const finalName = editValue.trim() || person.name.split(" - ")[0];
    const finalReportsTo = editManagerId || null;
    const finalStatus = editStatus;

    if (currentUid) {
      const ref = doc(db, `users/${currentUid}/staff`, person.id);
      await setDoc(
        ref,
        {
          name: finalName,
          reportsTo: finalReportsTo,
          status: finalStatus,
        },
        { merge: true },
      );
    } else {
      const updated = staffObjList.map((s) =>
        s.id === person.id
          ? { ...s, name: finalName, reportsTo: finalReportsTo, status: finalStatus }
          : s,
      );
      saveLocalFallback(updated);
    }
    setEditingStaffId(null);
  };

  const handleAssignTaskSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignee || !taskTitle || !taskLocation) return;
    
    if (currentUid) {
      const taskId = `task-${Date.now()}`;
      const taskDocRef = doc(db, `users/${currentUid}/tasks`, taskId);
      await setDoc(taskDocRef, {
        userId: currentUid,
        title: taskTitle,
        priority: taskPriority,
        location: taskLocation,
        deadline: "",
        description: "",
        assignedTo: assignee.name,
        status: "pending",
        isSynced: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert(`Task assigned to ${assignee.name}`);
    } else {
      alert("Local task assignment requires a logged in user in this prototype.");
    }
    setAssignee(null);
    setTaskTitle("");
    setTaskLocation("");
    setTaskPriority("medium");
  };

  const handleBulkReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkReassignTargetId || selectedStaffIds.length === 0) return;
    
    const targetStaff = staffObjList.find(s => s.id === bulkReassignTargetId);
    if (!targetStaff) return;

    if (currentUid) {
      try {
        const tasksRef = collection(db, `users/${currentUid}/tasks`);
        const q = query(tasksRef, where("status", "==", "pending"));
        const snap = await getDocs(q);
        
        const batch = writeBatch(db);
        let count = 0;
        
        const sourceNames = selectedStaffIds.map(id => staffObjList.find(s => s.id === id)?.name).filter(Boolean);
        
        snap.forEach(docSnap => {
          const taskData = docSnap.data();
          if (sourceNames.includes(taskData.assignedTo)) {
            batch.update(docSnap.ref, { assignedTo: targetStaff.name, updatedAt: serverTimestamp() });
            count++;
          }
        });
        
        if (count > 0) {
          await batch.commit();
          alert(`Successfully reassigned ${count} pending task(s) to ${targetStaff.name}.`);
        } else {
          alert('No pending tasks found for the selected staff members.');
        }
      } catch (error) {
        console.error("Error reassigning tasks:", error);
        alert("Failed to reassign tasks.");
      }
    } else {
      alert("Local task reassignment requires a logged in user in this prototype.");
    }
    
    setShowBulkReassignModal(false);
    setSelectedStaffIds([]);
    setBulkReassignTargetId("");
  };

  const filteredStaff = staffObjList.filter((s) => {
    const matchesSearch = s.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      activeFilter === "All" ||
      s.name.toLowerCase().includes(activeFilter.toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const getManagerOptions = (excludeId: string) => {
    return staffObjList.filter((s) => s.id !== excludeId);
  };

  const renderStaffCard = (person: StaffMember, depth: number) => {
    const isEditing = editingStaffId === person.id;
    const statusColor = person.status === "Available" ? "bg-[#16a34a]" : person.status === "In Transit" ? "bg-[#eab308]" : "bg-outline-variant";

    return (
      <div
        key={person.id}
        className="relative group transition-all"
        style={{
          marginLeft: `${depth > 0 ? (depth > 2 ? 2 * 24 : depth * 24) : 0}px`,
        }}
      >
        {depth > 0 && (
          <div className="absolute -left-6 top-6 bottom-0 w-6">
            <CornerDownRight className="w-5 h-5 text-outline-variant absolute top-0 -left-1" />
          </div>
        )}
        <div className="bg-surface border border-outline-variant p-4 rounded-xl flex items-center gap-4 hover:border-primary/50 hover:shadow-sm transition-all mb-3 relative z-10 w-full md:w-auto overflow-hidden">
          <input 
            type="checkbox" 
            checked={selectedStaffIds.includes(person.id)} 
            onChange={(e) => {
              if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, person.id]);
              else setSelectedStaffIds(selectedStaffIds.filter(id => id !== person.id));
            }}
            className="mr-1 w-4 h-4 rounded appearance-none checked:bg-primary border border-outline-variant relative
              after:content-[''] after:absolute after:top-[2px] after:left-[5px] after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:opacity-0 checked:after:opacity-100 cursor-pointer"
          />
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-primary-container text-primary rounded-full flex items-center justify-center shrink-0">
              <UserRound className="w-5 h-5" />
            </div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${statusColor}`} title={person.status || "Off Duty"}></div>
          </div>

          {isEditing ? (
            <div className="flex-1 min-w-0 pr-16 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full sm:w-1/3 px-2 py-1.5 border border-primary focus:ring-1 focus:ring-primary outline-none rounded text-sm font-medium text-on-surface"
                autoFocus
                placeholder="Name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(person);
                  if (e.key === "Escape") setEditingStaffId(null);
                }}
              />
              <select
                value={editManagerId}
                onChange={(e) => setEditManagerId(e.target.value)}
                className="w-full sm:w-48 px-2 py-1.5 border border-outline-variant focus:ring-1 focus:ring-primary outline-none rounded text-xs text-on-surface bg-surface"
              >
                <option value="">No Manager</option>
                {getManagerOptions(person.id).map((mgr) => (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.name}
                  </option>
                ))}
              </select>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ActiveStatus)}
                className="w-full sm:w-32 px-2 py-1.5 border border-outline-variant focus:ring-1 focus:ring-primary outline-none rounded text-xs text-on-surface bg-surface"
              >
                <option value="Available">Available</option>
                <option value="In Transit">In Transit</option>
                <option value="Off Duty">Off Duty</option>
              </select>
            </div>
          ) : (
            <div className="flex-col min-w-0 flex-1">
              <div
                className="text-sm font-semibold text-on-surface truncate"
                title={person.name.split(" - ")[0]}
              >
                {person.name.split(" - ")[0]}
              </div>
            </div>
          )}

          <div
            className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 transition-opacity bg-surface px-1`}
          >
            {isEditing ? (
              <>
                <button
                  onClick={() => saveEdit(person)}
                  className="p-1.5 text-success hover:bg-success/10 rounded transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingStaffId(null)}
                  className="p-1.5 text-on-surface-variant hover:bg-surface-variant rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <button
                    onClick={() => setAssignee(person)}
                    className="p-1.5 text-outline-variant hover:text-secondary hover:bg-secondary/10 rounded transition-colors"
                    title="Assign Task"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => startEdit(person)}
                  className="p-1.5 text-outline-variant hover:text-primary hover:bg-primary/10 rounded transition-colors"
                  title="Edit User"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteUser(person.id, person.name)}
                  className="p-1.5 text-outline-variant hover:text-error hover:bg-error/10 rounded transition-colors"
                  title="Remove User"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTree = (
    managerId: string | null,
    depth = 0,
  ): React.ReactNode[] => {
    const directReports = staffObjList.filter(
      (s) => (s.reportsTo || null) === managerId,
    );
    return directReports.map((person) => (
      <div key={`tree-${person.id}`}>
        {renderStaffCard(person, depth)}
        {/* Render children recursively */}
        {renderTree(person.id, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="p-4 max-w-7xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Team Management
            </h2>
            <p className="text-on-surface-variant mt-1">
              Manage field staff and organizational hierarchy.
            </p>
          </div>
          <button
            onClick={() => setIsAddingUser(true)}
            className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-lg transition-all shadow-sm font-label-md flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Add User</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              "All",
              "Technical",
              "Maintenance",
              "Leak Detection",
              "Operator",
              "Survey",
            ].map((filterValue) => (
              <button
                key={filterValue}
                onClick={() => setActiveFilter(filterValue)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${
                  activeFilter === filterValue
                    ? "bg-primary text-white border-primary"
                    : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
                }`}
              >
                {filterValue}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedStaffIds.length > 0 && isAdmin && (
          <div className="bg-primary-container text-on-primary-container px-4 py-3 rounded-lg flex items-center justify-between border border-primary/20">
            <span className="font-label-md">{selectedStaffIds.length} team member(s) selected</span>
            <button
              onClick={() => setShowBulkReassignModal(true)}
              className="bg-primary text-on-primary px-3 py-1.5 rounded-md font-label-md flex items-center gap-2 transition-colors hover:bg-primary/90"
            >
              <ClipboardCheck className="w-4 h-4" />
              Reassign Tasks
            </button>
          </div>
        )}

        {/* Staff List / Tree */}
        <div className="w-full max-w-3xl overflow-hidden">
          {searchTerm.length > 0 || activeFilter !== "All" ? (
            // Flat list when searching or filtering
            <div className="flex flex-col">
              {filteredStaff.map((person) => renderStaffCard(person, 0))}
              {filteredStaff.length === 0 && (
                <div className="py-10 text-center text-on-surface-variant bg-surface-variant/50 rounded-xl border border-outline-variant border-dashed">
                  No team members found matching "{searchTerm || activeFilter}"
                </div>
              )}
            </div>
          ) : (
            // Hierarchy Tree
            <div className="flex flex-col relative pl-2 sm:pl-4">
              <div className="absolute left-6 top-8 bottom-8 w-px bg-outline-variant/30 hidden sm:block"></div>
              {renderTree(null, 0)}
              {staffObjList.length === 0 && (
                <div className="py-10 text-center text-on-surface-variant bg-surface-variant/50 rounded-xl border border-outline-variant border-dashed">
                  No team members mapped.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isAddingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-surface rounded-xl shadow-lg w-[90%] max-w-[448px] min-w-[280px] p-6 animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="font-headline-md text-on-surface mb-2">
              Add New User
            </h3>
            <p className="text-on-surface-variant text-body-sm mb-6">
              Enter the details of the new team member.
            </p>
            <form onSubmit={handleAddUser}>
              <div className="mb-4">
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Juan De La Cruz"
                  className="w-full px-3 py-2 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Reports To
                </label>
                <select
                  value={newUserManagerId}
                  onChange={(e) => setNewUserManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                >
                  <option value="">No Manager (Top Level)</option>
                  {staffObjList.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Status
                </label>
                <select
                  value={newUserStatus}
                  onChange={(e) => setNewUserStatus(e.target.value as ActiveStatus)}
                  className="w-full px-3 py-2 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                >
                  <option value="Available">Available</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Off Duty">Off Duty</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-4 py-2 text-on-surface hover:bg-surface-variant rounded-md font-label-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newUserName.trim()}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-md font-label-md transition-colors disabled:opacity-50"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {assignee && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end animate-in slide-in-from-right duration-300">
          <div className="bg-surface w-full max-w-md h-full shadow-xl flex flex-col">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between bg-surface">
              <h3 className="font-headline-sm text-on-surface">Assign Task to {assignee.name.split(" - ")[0]}</h3>
              <button
                onClick={() => setAssignee(null)}
                className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form id="assign-task-form" onSubmit={handleAssignTaskSave}>
                <div className="mb-4">
                  <label className="block text-label-md font-semibold text-on-surface mb-1">
                    Task Title <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                    placeholder="e.g. Pump Repair"
                    required
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-label-md font-semibold text-on-surface mb-1">
                    Location/Facility <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={taskLocation}
                    onChange={(e) => setTaskLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                    placeholder="e.g. Site 2"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-label-md font-semibold text-on-surface mb-1">
                    Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["low", "medium", "high"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTaskPriority(p as any)}
                        className={`py-2 rounded-md font-label-md capitalize border transition-colors ${
                          taskPriority === p
                            ? p === "high"
                              ? "bg-error text-white border-error"
                              : p === "medium"
                                ? "bg-secondary text-white border-secondary"
                                : "bg-outline-variant text-on-surface border-outline-variant"
                            : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-outline-variant bg-surface-variant/30 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignee(null)}
                className="px-4 py-2 text-on-surface hover:bg-surface-variant rounded-md font-label-md transition-colors"
                disabled={!assignee}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="assign-task-form"
                disabled={!taskTitle || !taskLocation}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-md font-label-md transition-colors disabled:opacity-50"
              >
                Assign Task
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Task Reassignment Modal */}
      {showBulkReassignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-xl shadow-xl flex flex-col p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline-sm text-on-surface">Bulk Reassign Tasks</h3>
              <button
                onClick={() => setShowBulkReassignModal(false)}
                className="text-on-surface-variant hover:bg-surface-variant p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-body-sm text-on-surface-variant mb-6">
              You are about to reassign all pending tasks from {selectedStaffIds.length} selected team member(s) to a new assignee.
            </p>

            <form id="bulk-reassign-form" onSubmit={handleBulkReassignSubmit}>
              <div className="mb-6">
                <label className="block text-label-md font-semibold text-on-surface mb-2">
                  Target Assignee <span className="text-secondary">*</span>
                </label>
                <select
                  value={bulkReassignTargetId}
                  onChange={(e) => setBulkReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                  required
                >
                  <option value="">Select target team member...</option>
                  {staffObjList
                    .filter(s => !selectedStaffIds.includes(s.id)) // Shouldn't reassign to themselves if selected
                    .map(mgr => (
                    <option key={mgr.id} value={mgr.id}>{mgr.name}</option>
                  ))}
                </select>
              </div>
            </form>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowBulkReassignModal(false)}
                className="px-4 py-2 bg-surface hover:bg-surface-variant text-on-surface font-label-md rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulk-reassign-form"
                disabled={!bulkReassignTargetId}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-label-md rounded-md transition-colors disabled:opacity-50"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
