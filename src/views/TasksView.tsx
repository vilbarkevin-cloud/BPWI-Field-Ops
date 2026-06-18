import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Play,
  MapPin,
  Info,
  Camera,
  Clock,
  ClipboardX,
  ClipboardCheck,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  Timer,
  Plus,
  User,
  X,
} from "lucide-react";
import { useNetworkInfo } from "../utils/useNetworkInfo";
import { useToast } from "../utils/ToastContext";
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { defaultStaff as dataStoreDefaultStaff } from "../lib/dataStore";
import { ACTIVITY_TYPES } from "../lib/activityTypes";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "pending" | "in-progress" | "completed";

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  location: string;
  deadline: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  isSynced?: boolean;
  linkedActivity?: string;
  joNumber?: string;
  accountNumber?: string;
  accountName?: string;
}

// Sourced from shared lib/activityTypes.ts
const activityTypes = ACTIVITY_TYPES;

const defaultTasks: Task[] = [
  {
    id: "task-1",
    title: "Emergency Generator Repair",
    priority: "high",
    location: "Substation B-12",
    deadline: "Today, 14:00",
    description: "Immediate inspection of generator output.",
    assignedTo: "Unassigned",
    status: "in-progress",
  },
  {
    id: "task-2",
    title: "Cooling System Critical Alert",
    priority: "high",
    location: "Data Center Rack 04-A",
    deadline: "Today, 15:30",
    description:
      "Sensor detected temperatures exceeding 42°C. Immediate inspection of liquid cooling loop required.",
    assignedTo: "Jose Marie Alipala Jr",
    status: "pending",
  },
  {
    id: "task-3",
    title: "Routine Firewall Update",
    priority: "medium",
    location: "Remote Node 09",
    deadline: "Tomorrow, 22:00",
    description:
      "Scheduled maintenance window: 22:00 - 00:00. Requires brief connectivity outage.",
    assignedTo: "Jose Marie Alipala Jr",
    status: "pending",
  },
  {
    id: "task-4",
    title: "Inventory Audit: Spares Rack",
    priority: "low",
    location: "Warehouse A",
    deadline: "Oct 12, 2023",
    description: "All spare parts accounted for.",
    assignedTo: "Unassigned",
    status: "completed",
  },
];

interface TasksViewProps {
  currentUser?: string | null;
  currentUid?: string | null;
}

export function TasksView({ currentUser, currentUid }: TasksViewProps) {
  const isAdmin =
    currentUser?.includes("Kevin Vilbar") ||
    currentUser?.includes("Tech Head") ||
    currentUser?.includes("Admin");

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staffList, setStaffList] = useState<string[]>([]);
  const { showToast } = useToast();
  const { isLowDataMode } = useNetworkInfo();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: "",
    priority: "medium",
    location: "",
    deadline: "",
    description: "",
    assignedTo: "Unassigned",
    status: "pending",
    linkedActivity: "",
    joNumber: "",
    accountNumber: "",
    accountName: "",
  });

  const [taskPhotos, setTaskPhotos] = useState<Record<string, string>>({});
  const [taskParts, setTaskParts] = useState<
    Record<string, { itemId: string; quantity: number }[]>
  >({});
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/inventory`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInventoryItems(fetched);
    }, (error) => {
      console.error("Inventory listener error:", error);
    });
    return () => unsubscribe();
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;

    const q = query(collection(db, `users/${currentUid}/tasks`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If collection is initially empty, seed with defaultTasks
      if (snapshot.empty) {
        defaultTasks.forEach(async (dt) => {
          const taskDocRef = doc(db, `users/${currentUid}/tasks`, dt.id);
          try {
            await setDoc(taskDocRef, {
              userId: currentUid,
              title: dt.title,
              priority: dt.priority,
              location: dt.location,
              deadline: dt.deadline,
              description: dt.description,
              assignedTo: dt.assignedTo,
              status: dt.status,
              isSynced: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.error("Failed to seed default task:", e);
          }
        });
      } else {
        const fetchedTasks = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title,
            priority: data.priority,
            location: data.location,
            deadline: data.deadline,
            description: data.description,
            assignedTo: data.assignedTo,
            status: data.status,
            isSynced: true,
          } as Task;
        });
        setTasks(fetchedTasks);
      }
    }, (error) => {
      console.error("Tasks listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUid]);

  useEffect(() => {
    const storedStaff = localStorage.getItem("watsanStaff");
    if (storedStaff) {
      let parsed = JSON.parse(storedStaff);
      if (parsed.includes("John Santos")) {
        parsed = parsed.filter((name: string) => name !== "John Santos");
        localStorage.setItem("watsanStaff", JSON.stringify(parsed));
      }
      setStaffList(parsed);
    } else {
      setStaffList(dataStoreDefaultStaff);
      localStorage.setItem(
        "watsanStaff",
        JSON.stringify(dataStoreDefaultStaff),
      );
    }
  }, []);

  const toggleDetail = (id: string) => {
    setOpenTaskId(openTaskId === id ? null : id);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.location || !currentUid) {
      alert("Title and Area/Location are required.");
      return;
    }
    const taskId = `task-${Date.now()}`;
    const taskDocRef = doc(db, `users/${currentUid}/tasks`, taskId);

    try {
      await setDoc(taskDocRef, {
        userId: currentUid,
        title: newTask.title,
        priority: newTask.priority,
        location: newTask.location,
        deadline: newTask.deadline || "No deadline",
        description: newTask.description || "",
        assignedTo: newTask.assignedTo || "Unassigned",
        status: "pending",
        linkedActivity: newTask.linkedActivity || "",
        joNumber: newTask.joNumber || "",
        accountNumber: newTask.accountNumber || "",
        accountName: newTask.accountName || "",
        isSynced: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast("Task created successfully", "success");
      setIsModalOpen(false);
      setNewTask({
        title: "",
        priority: "medium",
        location: "",
        deadline: "",
        description: "",
        assignedTo: "Unassigned",
        status: "pending",
        linkedActivity: "",
        joNumber: "",
        accountNumber: "",
        accountName: "",
      });
    } catch (err) {
      console.error(err);
      showToast("Error creating task", "error");
    }
  };

  const handlePhotoUpload = (
    taskId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // compress to 0.7 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setTaskPhotos((prev) => ({ ...prev, [taskId]: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddPart = (taskId: string, itemId: string, quantity: number) => {
    setTaskParts((prev) => {
      const parts = prev[taskId] || [];
      const existing = parts.find((p) => p.itemId === itemId);
      if (existing) {
        return {
          ...prev,
          [taskId]: parts
            .map((p) => (p.itemId === itemId ? { ...p, quantity } : p))
            .filter((p) => p.quantity > 0),
        };
      }
      if (quantity > 0) {
        return { ...prev, [taskId]: [...parts, { itemId, quantity }] };
      }
      return prev;
    });
  };

  const updateTaskStatus = async (id: string, newStatus: TaskStatus) => {
    if (!currentUid) return;
    try {
      const taskRef = doc(db, `users/${currentUid}/tasks`, id);
      const updates: any = {
        status: newStatus,
        isSynced: navigator.onLine,
        updatedAt: serverTimestamp(),
      };

      if (newStatus === "completed") {
        if (taskPhotos[id]) updates.photoUrl = taskPhotos[id];
        if (taskParts[id] && taskParts[id].length > 0) {
          updates.consumedParts = taskParts[id];

          // Deduct from inventory
          for (const part of taskParts[id]) {
            const matchedItem = inventoryItems.find(
              (i) => i.id === part.itemId,
            );
            if (matchedItem) {
              const invRef = doc(
                db,
                `users/${currentUid}/inventory`,
                matchedItem.id,
              );
              await updateDoc(invRef, {
                currentStock: Math.max(
                  0,
                  matchedItem.currentStock - part.quantity,
                ),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      }

      await updateDoc(taskRef, updates);

      if (newStatus === "completed") {
        showToast(
          !navigator.onLine
            ? "Offline: Task completed. Saved in Sync Queue."
            : "Task completed and synced successfully!",
          "success",
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating task status", "error");
    }
  };

  const filteredTasks = tasks.filter((t) => 
    activeTab === 'active' ? t.status !== 'completed' : t.status === 'completed'
  );
  
  const highTasks = filteredTasks.filter((t) => t.priority === "high");
  const mediumTasks = filteredTasks.filter((t) => t.priority === "medium");
  const lowTasks = filteredTasks.filter((t) => t.priority === "low");

  const renderTask = (task: Task) => {
    const priorityColorClass =
      task.priority === "high"
        ? "bg-error text-error"
        : task.priority === "medium"
          ? "bg-tertiary-container text-tertiary"
          : "bg-secondary text-secondary";
    const indicatorColorClass =
      task.priority === "high"
        ? "bg-error"
        : task.priority === "medium"
          ? "bg-tertiary-container"
          : "bg-secondary";

    return (
      <div
        key={task.id}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-shadow"
      >
        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-md cursor-pointer"
          onClick={() => toggleDetail(task.id)}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-1 ${indicatorColorClass} rounded-full self-stretch min-h-[40px] opacity-80`}
            ></div>
            <div>
              <h4 className="font-headline-md text-on-surface">
                {task.linkedActivity && (
                  <span className="inline-flex mr-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary align-middle">
                    {activityTypes.find(a => a.id === task.linkedActivity)?.label || task.linkedActivity}
                  </span>
                )}
                {task.title}
              </h4>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-body-md">{task.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-body-md">Due: {task.deadline}</span>
                </div>
                {task.assignedTo !== "Unassigned" && (
                  <div className="flex items-center gap-1 text-primary">
                    <User className="w-4 h-4" />
                    <span className="text-body-md font-semibold">
                      {task.assignedTo}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-lg">
            <span
              className={`px-3 py-1 rounded-full text-label-md font-label-md uppercase 
              ${
                task.status === "completed"
                  ? "bg-surface-container-high text-on-surface-variant"
                  : task.status === "in-progress"
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "bg-error-container text-on-error-container"
              }
            `}
            >
              {task.status.replace("-", " ")}
            </span>
            <ChevronDown
              className={`text-outline transition-transform duration-200 ${openTaskId === task.id ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {/* Task Detail Drawer */}
        {openTaskId === task.id && (
          <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-1 md:grid-cols-2 gap-lg relative">
            <div>
              {(task.joNumber || task.accountNumber || task.accountName) && (
                <div className="mb-4 bg-surface-variant/30 rounded-lg p-3 text-body-md border border-outline-variant/30">
                  <h5 className="font-semibold text-on-surface mb-2">Job Details</h5>
                  <div className="grid grid-cols-2 gap-2 text-on-surface-variant text-sm">
                    {task.joNumber && <div><span className="opacity-70">JO Number:</span><br/><span className="text-on-surface font-medium">{task.joNumber}</span></div>}
                    {task.accountNumber && <div><span className="opacity-70">Account:</span><br/><span className="text-on-surface font-medium">{task.accountNumber}</span></div>}
                    {task.accountName && <div className="col-span-2"><span className="opacity-70">Account Name:</span><br/><span className="text-on-surface font-medium">{task.accountName}</span></div>}
                  </div>
                </div>
              )}
              <p className="text-body-md text-on-surface mb-4">
                {task.description}
              </p>

              {task.status !== "completed" && (
                <>
                  <label className="font-label-md text-on-surface-variant block mb-2">
                    Accomplishment Report
                  </label>
                  <textarea
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-body-md focus:ring-2 focus:ring-primary focus:outline-none min-h-[120px]"
                    placeholder="Enter detailed technical notes here..."
                  ></textarea>
                </>
              )}
            </div>
            <div className="space-y-4">
              {task.status === "pending" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTaskStatus(task.id, "in-progress");
                  }}
                  className="w-full bg-primary-container text-on-primary-container py-3 rounded-lg font-label-md flex items-center justify-center gap-2 hover:opacity-90 transition-all font-semibold"
                >
                  <Play className="w-[18px] h-[18px]" />
                  Start Task
                </button>
              )}

              {task.status === "in-progress" && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant block">
                        Media Documentation *
                      </label>
                      {taskPhotos[task.id] ? (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-outline-variant">
                          <img
                            src={taskPhotos[task.id]}
                            alt="Task Completion"
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskPhotos((prev) => {
                                const n = { ...prev };
                                delete n[task.id];
                                return n;
                              });
                            }}
                            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full h-32 border-2 border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center text-on-surface-variant bg-surface hover:bg-surface-container-low transition-colors cursor-pointer">
                          <Camera className="w-6 h-6 mb-1" />
                          <span className="text-label-sm">
                            Upload Completion Photo
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoUpload(task.id, e)}
                          />
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant block">
                        Parts / Materials Used
                      </label>
                      {taskParts[task.id]?.map((part, idx) => (
                        <div key={idx} className="flex gap-2 items-center mb-2">
                          <span className="flex-1 text-sm">
                            {inventoryItems.find((i) => i.id === part.itemId)
                              ?.name || "Unknown Part"}
                          </span>
                          <span className="text-sm font-semibold text-on-surface-variant">
                            Qty: {part.quantity}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddPart(task.id, part.itemId, 0);
                            }}
                            className="p-1 text-error hover:bg-error/10 rounded-full"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <select
                          id={`part-select-${task.id}`}
                          className="form-input flex-1 py-1 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Select inventory item...</option>
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.currentStock} {item.unit} left)
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const sel = document.getElementById(
                              `part-select-${task.id}`,
                            ) as HTMLSelectElement;
                            if (sel.value) {
                              const qty = parseInt(
                                prompt("Enter quantity used:", "1") || "0",
                                10,
                              );
                              if (qty > 0)
                                handleAddPart(task.id, sel.value, qty);
                              sel.value = "";
                            }
                          }}
                          className="btn-secondary py-1 px-3 text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end items-center mt-4 pt-4 border-t border-outline-variant">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(task.id, "completed");
                      }}
                      className="bg-primary text-on-primary px-6 py-2 rounded-lg font-label-md hover:bg-primary-container transition-all active:scale-95"
                    >
                      Submit Report
                    </button>
                  </div>
                </>
              )}

              {task.status === "completed" && (
                <div className="bg-surface-container rounded-lg p-4">
                  <p className="text-label-md text-on-surface-variant mb-2">
                    Status:
                  </p>
                  <p className="text-body-md text-on-surface">
                    Marked as completed.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-primary font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    Done
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-margin-mobile pt-lg md:pt-xl mb-24">
      {/* Header Section */}
      <section className="mb-lg flex flex-col md:flex-row md:items-end md:justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Operations Tasks
          </h2>
          <p className="text-on-surface-variant mt-1">
            Manage and report on technical maintenance operations.
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </button>
          )}
          <div className="flex bg-surface-container rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('active')}
              className={`px-4 py-1.5 rounded-md text-label-md font-label-md transition-colors ${activeTab === 'active' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-md text-label-md font-label-md transition-colors ${activeTab === 'history' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              History
            </button>
          </div>
        </div>
      </section>

      {/* Priority Legend */}
      <div className="flex flex-wrap gap-4 mb-lg pb-4 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-error"></span>
          <span className="text-label-md font-label-md uppercase tracking-wider text-on-surface-variant">
            High Priority ({highTasks.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
          <span className="text-label-md font-label-md uppercase tracking-wider text-on-surface-variant">
            Medium Priority ({mediumTasks.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-label-md font-label-md uppercase tracking-wider text-on-surface-variant">
            Low Priority ({lowTasks.length})
          </span>
        </div>
      </div>

      {/* Task List Containers */}
      <div className="space-y-xl">
        {/* HIGH PRIORITY SECTION */}
        {highTasks.length > 0 && (
          <div>
            <h3 className="font-label-md text-label-md text-error flex items-center gap-2 mb-md text-sm font-semibold">
              <AlertTriangle className="w-[18px] h-[18px]" />
              HIGH PRIORITY ({highTasks.length})
            </h3>
            <div className="grid grid-cols-1 gap-md">
              {highTasks.map(renderTask)}
            </div>
          </div>
        )}

        {/* MEDIUM PRIORITY SECTION */}
        {mediumTasks.length > 0 && (
          <div>
            <h3
              className="font-label-md text-label-md text-tertiary-container text-opacity-80 flex items-center gap-2 mb-md text-sm font-semibold"
              style={{ color: "#d97706" }}
            >
              <ClipboardX className="w-[18px] h-[18px]" />
              MEDIUM PRIORITY ({mediumTasks.length})
            </h3>
            <div className="grid grid-cols-1 gap-md">
              {mediumTasks.map(renderTask)}
            </div>
          </div>
        )}

        {/* LOW PRIORITY SECTION */}
        {lowTasks.length > 0 && (
          <div>
            <h3 className="font-label-md text-label-md text-secondary flex items-center gap-2 mb-md text-sm font-semibold">
              <ClipboardCheck className="w-[18px] h-[18px]" />
              LOW PRIORITY ({lowTasks.length})
            </h3>
            <div className="grid grid-cols-1 gap-md">
              {lowTasks.map(renderTask)}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-24 bg-surface border border-outline-variant/50 rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-on-surface mb-2">
              {activeTab === 'active' ? 'Zero Pending Tasks' : 'No Task History'}
            </h3>
            <p className="text-on-surface-variant max-w-[384px] mb-6">
              {activeTab === 'active' ? "You're all caught up! There are no operational tasks currently assigned to you or your area." : "No completed tasks yet."}
            </p>
            {isAdmin && activeTab === 'active' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary py-2 px-6"
              >
                Create New Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Productivity Summary */}
      <section className="mt-xl grid grid-cols-1 md:grid-cols-12 gap-gutter pb-xl">
        <div className="md:col-span-8 bg-primary p-lg rounded-2xl text-on-primary relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="relative z-10">
            <h3 className="font-headline-md text-headline-md font-semibold text-lg">
              Shift Progress
            </h3>
            <p className="text-on-primary-container text-opacity-80">
              You've completed{" "}
              {tasks.filter((t) => t.status === "completed").length} of{" "}
              {tasks.length} assigned tasks today.
            </p>
          </div>
          <div className="relative z-10 w-full bg-on-primary/20 h-2 rounded-full overflow-hidden mt-8">
            <div
              className="bg-on-primary h-full transition-all duration-700"
              style={{
                width: `${tasks.length > 0 ? (tasks.filter((t) => t.status === "completed").length / tasks.length) * 100 : 0}%`,
              }}
            ></div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
        </div>
        <div className="md:col-span-4 bg-surface-container-high p-lg rounded-2xl flex flex-col justify-center items-center text-center">
          <Timer className="text-primary w-10 h-10 mb-2" />
          <p className="text-label-md text-on-surface-variant uppercase font-semibold">
            Response Time
          </p>
          <p className="text-display font-display text-primary flex items-baseline justify-center font-bold text-4xl">
            12<span className="text-headline-md ml-1 text-xl">m</span>
          </p>
          <p className="text-label-sm text-on-surface-variant mt-1 text-xs">
            Avg. for Critical Incidents
          </p>
        </div>
      </section>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[512px] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-white">
              <h3 className="font-headline-sm font-semibold text-lg text-on-surface">
                Create New Task
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateTask}
              className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-white"
            >
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Link to Field Activity (Optional)
                </label>
                <select
                  value={newTask.linkedActivity || ""}
                  onChange={(e) => {
                    const activityId = e.target.value;
                    const activityLabel = activityTypes.find(a => a.id === activityId)?.label || "";
                    setNewTask(prev => ({
                      ...prev,
                      linkedActivity: activityId,
                      title: (!prev.title || activityTypes.some(a => a.label === prev.title)) ? activityLabel : prev.title
                    }));
                  }}
                  className="form-input bg-white appearance-none"
                >
                  <option value="">None / Custom Task</option>
                  {activityTypes.filter(a => a.id !== 'all').map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.label}
                    </option>
                  ))}
                </select>
              </div>

              {newTask.linkedActivity && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-surface-variant/30 p-4 rounded-xl border border-outline-variant/30">
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">
                      Job Order Number
                    </label>
                    <input
                      type="text"
                      value={newTask.joNumber || ""}
                      onChange={(e) =>
                        setNewTask({ ...newTask, joNumber: e.target.value })
                      }
                      className="form-input"
                      placeholder="e.g. JO-10234"
                    />
                  </div>
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={newTask.accountNumber || ""}
                      onChange={(e) =>
                        setNewTask({ ...newTask, accountNumber: e.target.value })
                      }
                      className="form-input"
                      placeholder="Enter account num"
                    />
                  </div>
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={newTask.accountName || ""}
                      onChange={(e) =>
                        setNewTask({ ...newTask, accountName: e.target.value })
                      }
                      className="form-input"
                      placeholder="Enter account name"
                    />
                  </div>
                </div>
              )}

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  className="form-input"
                  placeholder="e.g. Inspect Generator 2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className="form-input bg-white appearance-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Assign To
                  </label>
                  <select
                    value={newTask.assignedTo}
                    onChange={(e) =>
                      setNewTask({ ...newTask, assignedTo: e.target.value })
                    }
                    className="form-input bg-white appearance-none"
                  >
                    <option value="Unassigned">Unassigned</option>
                    {staffList.map((staff) => (
                      <option key={staff} value={staff}>
                        {staff}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Area / Location *
                  </label>
                  <input
                    type="text"
                    value={newTask.location}
                    onChange={(e) =>
                      setNewTask({ ...newTask, location: e.target.value })
                    }
                    className="form-input"
                    placeholder="e.g. Filter Area A"
                    required
                  />
                </div>

                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={newTask.deadline}
                    onChange={(e) =>
                      setNewTask({ ...newTask, deadline: e.target.value })
                    }
                    className="form-input bg-white"
                  />
                </div>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  className="form-input min-h-[100px] resize-y"
                  placeholder="Task instructions..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary px-6"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-6">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
