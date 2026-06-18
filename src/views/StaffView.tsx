import React, { useState, useEffect } from "react";
import {
  UserPlus,
  UserRound,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { defaultStaff } from "../lib/dataStore";

interface StaffViewProps {
  currentUser: string | null;
  currentUid?: string | null;
}

export function StaffView({ currentUser, currentUid }: StaffViewProps) {
  const [staffList, setStaffList] = useState<string[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const isAdmin = currentUser?.includes("Kevin Vilbar");

  useEffect(() => {
    // Load from local storage or default
    const stored = localStorage.getItem("watsanStaff");
    const version = localStorage.getItem("staffListV3");
    
    if (stored && version) {
      let parsed = JSON.parse(stored);
      const deduplicated = Array.from(new Set<string>(parsed));
      setStaffList(deduplicated);
    } else {
      setStaffList(defaultStaff);
      localStorage.setItem("watsanStaff", JSON.stringify(defaultStaff));
      localStorage.setItem("staffListV3", "true");
    }
  }, []);

  const saveStaffList = (updated: string[]) => {
    setStaffList(updated);
    localStorage.setItem("watsanStaff", JSON.stringify(updated));
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    const combinedName = newUserPosition.trim()
      ? `${newUserName.trim()} - ${newUserPosition.trim()}`
      : newUserName.trim();
    const updated = [...staffList, combinedName];
    updated.sort();
    saveStaffList(updated);
    setNewUserName("");
    setNewUserPosition("");
    setIsAddingUser(false);
  };

  const handleDeleteUser = (staff: string) => {
    if (confirm(`Are you sure you want to remove ${staff}?`)) {
      saveStaffList(staffList.filter((s) => s !== staff));
    }
  };

  const startEdit = (staff: string) => {
    setEditingStaff(staff);
    setEditValue(staff);
  };

  const saveEdit = (oldName: string) => {
    if (!editValue.trim() || editValue === oldName) {
      setEditingStaff(null);
      return;
    }
    const updated = staffList.map((s) =>
      s === oldName ? editValue.trim() : s,
    );
    saveStaffList(updated);
    setEditingStaff(null);
  };

  const filteredStaff = staffList.filter((s) =>
    s.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-4 max-w-7xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="flex flex-col gap-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Team Management
            </h2>
            <p className="text-on-surface-variant mt-1">
              Manage field staff and user accounts.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsAddingUser(true)}
              className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-lg transition-all shadow-sm font-label-md flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              <span className="hidden sm:inline">Add User</span>
            </button>
          )}
        </div>

        {/* Search */}
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

        {/* Staff List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((person, idx) => (
            <div
              key={idx}
              className="bg-surface border border-outline-variant p-4 rounded-xl flex items-center gap-4 hover:shadow-md transition-shadow relative group"
            >
              <div className="w-12 h-12 bg-primary-container text-primary rounded-full flex items-center justify-center shrink-0">
                <UserRound className="w-6 h-6" />
              </div>

              {editingStaff === person ? (
                <div className="flex-1 min-w-0 pr-16">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-2 py-1 border border-primary focus:ring-1 focus:ring-primary outline-none rounded font-label-md text-on-surface"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(person);
                      if (e.key === "Escape") setEditingStaff(null);
                    }}
                  />
                </div>
              ) : (
                <div className="flex-col min-w-0 flex-1">
                  <div className="font-label-md text-on-surface truncate" title={person.split(" - ")[0]}>
                    {person.split(" - ")[0]}
                  </div>
                  <div className="text-label-sm text-on-surface-variant mt-0.5 truncate" title={person.split(" - ")[1] || (person.includes("Kevin Vilbar") ? "Head/Admin" : "Field Technician")}>
                    {person.split(" - ")[1] || (person.includes("Kevin Vilbar") ? "Head/Admin" : "Field Technician")}
                  </div>
                </div>
              )}

              {isAdmin && !person.includes("Kevin Vilbar") && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {editingStaff === person ? (
                    <>
                      <button
                        onClick={() => saveEdit(person)}
                        className="p-1.5 text-[#166534] bg-[#bbf7d0]/30 hover:bg-[#bbf7d0] rounded transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingStaff(null)}
                        className="p-1.5 text-on-surface-variant bg-surface-variant/50 hover:bg-surface-variant rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(person)}
                        className="p-1.5 text-outline-variant hover:text-primary bg-surface-container hover:bg-primary-container rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(person)}
                        className="p-1.5 text-outline-variant hover:text-error bg-surface-container hover:bg-error/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredStaff.length === 0 && (
            <div className="col-span-full py-10 text-center text-on-surface-variant bg-surface-variant/50 rounded-xl border border-outline-variant border-dashed">
              No team members found matching "{searchTerm}"
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
              Enter the full name of the new technical team member.
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
              <div className="mb-6">
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Position (Optional)
                </label>
                <input
                  type="text"
                  value={newUserPosition}
                  onChange={(e) => setNewUserPosition(e.target.value)}
                  placeholder="e.g. Field Technician"
                  className="w-full px-3 py-2 bg-surface text-on-surface border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-body-md"
                />
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
    </div>
  );
}
