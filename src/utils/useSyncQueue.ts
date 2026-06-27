import { useState, useEffect, useCallback, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { sanitizePayload } from "./dataSanitizer";

export interface PendingItem {
  id: string;
  type: "Activity" | "Task" | "Incident";
  title: string;
  autoRetry: boolean;
  status: "pending" | "syncing" | "completed" | "error";
}

export interface SyncProgress {
  current: number;
  total: number;
  message: string;
}

export interface SyncConflict {
  id: string;
  type: "Activity" | "Task" | "Incident";
  title: string;
  localData: any;
  remoteData: any;
}

export function useSyncQueue() {
  const [queueCount, setQueueCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const backoffDelayRef = useRef(2000);

  const calculateQueue = useCallback(() => {
    try {
      const rawActivities = localStorage.getItem("watsanActivities");
      const rawTasks = localStorage.getItem("watsanTasks");
      const rawIncidents = localStorage.getItem("watsanIncidents");
      let count = 0;
      let items: PendingItem[] = [];

      if (rawActivities) {
        const parsed = JSON.parse(rawActivities);
        const pending = parsed.filter((a: any) => !a.isSynced || a.justSynced);
        count += pending.filter((a: any) => !a.isSynced).length;
        items.push(
          ...pending.map((a: any) => ({
            id: a.id || Date.now().toString(),
            type: "Activity" as const,
            title: a.type || "Activity Record",
            autoRetry: a.autoRetry !== false,
            status: a.isSynced ? "completed" : "pending",
          })),
        );
      }
      if (rawTasks) {
        const parsedTasks = JSON.parse(rawTasks);
        const pending = parsedTasks.filter(
          (t: any) => t.status === "completed" && (!t.isSynced || t.justSynced),
        );
        count += pending.filter((t: any) => !t.isSynced).length;
        items.push(
          ...pending.map((t: any) => ({
            id: t.id || Date.now().toString(),
            type: "Task" as const,
            title: t.title || "Task Record",
            autoRetry: t.autoRetry !== false,
            status: t.isSynced ? "completed" : "pending",
          })),
        );
      }
      if (rawIncidents) {
        const parsedIncidents = JSON.parse(rawIncidents);
        const pending = parsedIncidents.filter((i: any) => !i.isSynced || i.justSynced);
        count += pending.filter((i: any) => !i.isSynced).length;
        items.push(
          ...pending.map((i: any) => ({
            id: i.id || Date.now().toString(),
            type: "Incident" as const,
            title: i.type || "Incident Report",
            autoRetry: i.autoRetry !== false,
            status: i.isSynced ? "completed" : "pending",
          })),
        );
      }
      setQueueCount(count);
      setPendingItems(items);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleItemRetry = useCallback(
    (id: string, type: "Activity" | "Task" | "Incident") => {
      try {
        let storageKey = "";
        if (type === "Activity") storageKey = "watsanActivities";
        else if (type === "Task") storageKey = "watsanTasks";
        else if (type === "Incident") storageKey = "watsanIncidents";

        if (!storageKey) return;

        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const updated = parsed.map((item: any) => {
            if (item.id === id) {
              return {
                ...item,
                autoRetry: item.autoRetry === false ? true : false,
              };
            }
            return item;
          });
          localStorage.setItem(storageKey, JSON.stringify(updated));
          calculateQueue();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [calculateQueue],
  );

  const resolveConflict = useCallback(async (id: string, action: 'mine' | 'theirs' | 'merge', mergedData?: any) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const conflictIndex = syncConflicts.findIndex(c => c.id === id);
    if (conflictIndex === -1) return;
    const conflict = syncConflicts[conflictIndex];

    let finalData = conflict.localData;
    if (action === 'theirs') {
      finalData = conflict.remoteData;
    } else if (action === 'merge' && mergedData) {
      finalData = mergedData;
    }

    try {
      let path = "";
      if (conflict.type === "Activity") path = `users/${currentUid}/activities`;
      else if (conflict.type === "Task") path = `users/${currentUid}/tasks`;
      else if (conflict.type === "Incident") path = `users/${currentUid}/incidents`;

      finalData.isSynced = true;
      if (conflict.type === "Incident") {
        const payload = { ...finalData };
        delete payload.isSynced;
        await setDoc(doc(db, path, id), sanitizePayload(payload), { merge: true });
      } else {
        await setDoc(doc(db, path, id), sanitizePayload(finalData), { merge: true });
      }

      // Update local storage
      let storageKey = "";
      if (conflict.type === "Activity") storageKey = "watsanActivities";
      else if (conflict.type === "Task") storageKey = "watsanTasks";
      else if (conflict.type === "Incident") storageKey = "watsanIncidents";

      if (storageKey) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const updated = parsed.map((item: any) => item.id === id ? finalData : item);
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
      }

      setSyncConflicts(prev => prev.filter(c => c.id !== id));
      calculateQueue();
    } catch (e) {
      console.error("Error resolving conflict", e);
    }
  }, [syncConflicts, calculateQueue]);

  const clearCompleted = useCallback(() => {
    ["watsanActivities", "watsanTasks", "watsanIncidents"].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const updated = parsed.map((item: any) => {
          if (item.justSynced) {
            const { justSynced, ...rest } = item;
            return rest;
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(updated));
      }
    });
    calculateQueue();
  }, [calculateQueue]);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: queueCount, message: "Preparing sync..." });
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network wait
    let updated = false;
    let hasError = false;
    let newConflicts: SyncConflict[] = [];

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setIsSyncing(false);
      setSyncProgress(null);
      return;
    }

    const batch = writeBatch(db);
    let batchHasOperations = false;
    let processed = 0;

    // Process Tasks
    const rawTasks = localStorage.getItem("watsanTasks");
    if (rawTasks) {
      const parsed = JSON.parse(rawTasks);
      const toSync = parsed.filter(
        (t: any) =>
          t.status === "completed" && !t.isSynced && t.autoRetry !== false,
      );

      for (let t of toSync) {
        setSyncProgress({ current: processed, total: queueCount, message: `Syncing task: ${t.title || "Task"}` });
        try {
          const docRef = doc(db, `users/${currentUid}/tasks`, t.id);
          const snap = await getDoc(docRef);
          
          if (snap.exists() && snap.data().status === 'completed' && snap.data().completedAt && t.completedAt && snap.data().completedAt !== t.completedAt) {
             newConflicts.push({ id: t.id, type: "Task", title: t.title, localData: t, remoteData: snap.data() });
          } else {
            const deltaPayload: any = {
              status: t.status,
              isSynced: true,
            };
            if (t.updatedAt) deltaPayload.updatedAt = t.updatedAt;
            if (t.completedAt) deltaPayload.completedAt = t.completedAt;
            if (t.photoUrl) deltaPayload.photoUrl = t.photoUrl;
            if (t.notes) deltaPayload.notes = t.notes;
            if (t.usedParts) deltaPayload.usedParts = t.usedParts;

            batch.set(docRef, sanitizePayload(deltaPayload), { merge: true });
            batchHasOperations = true;
            t.isSynced = true;
            t.justSynced = true;
          }
        } catch (e) {
          console.error("Failed to sync task", e);
          hasError = true;
        }
        processed++;
      }

      const synced = parsed.map((t: any) => {
        const corresponding = toSync.find((syncTask: any) => syncTask.id === t.id);
        if (corresponding && corresponding.isSynced) {
          return { ...t, isSynced: true, justSynced: true };
        }
        return t;
      });

      if (toSync.length > 0) {
        localStorage.setItem("watsanTasks", JSON.stringify(synced));
        updated = true;
      }
    }

    // Process Activities
    const rawActivities = localStorage.getItem("watsanActivities");
    if (rawActivities) {
      const parsed = JSON.parse(rawActivities);
      const toSync = parsed.filter(
        (a: any) => !a.isSynced && a.autoRetry !== false,
      );
      
      for (let a of toSync) {
        setSyncProgress({ current: processed, total: queueCount, message: `Syncing activity: ${a.type || "Activity"}` });
        try {
          const docRef = doc(db, `users/${currentUid}/activities`, a.id);
          const snap = await getDoc(docRef);

          if (snap.exists() && snap.data().date !== a.date) {
            newConflicts.push({ id: a.id, type: "Activity", title: a.type || "Activity", localData: a, remoteData: snap.data() });
          } else {
            batch.set(docRef, sanitizePayload(a));
            batchHasOperations = true;
            a.isSynced = true;
            a.justSynced = true;
          }
        } catch (e) {
          console.error("Failed to sync activity", e);
          hasError = true;
        }
        processed++;
      }

      const synced = parsed.map((a: any) => {
         const corresponding = toSync.find((syncAct: any) => syncAct.id === a.id);
         if (corresponding && corresponding.isSynced) {
           return { ...a, isSynced: true, justSynced: true };
         }
         return a;
      });

      if (toSync.length > 0) {
        localStorage.setItem("watsanActivities", JSON.stringify(synced));
        updated = true;
      }
    }

    // Process Incidents
    const rawIncidents = localStorage.getItem("watsanIncidents");
    if (rawIncidents) {
      const parsed = JSON.parse(rawIncidents);
      const toSync = parsed.filter(
        (i: any) => !i.isSynced && i.autoRetry !== false,
      );

      for (let i of toSync) {
        setSyncProgress({ current: processed, total: queueCount, message: `Syncing incident: ${i.type || "Incident"}` });
        try {
          const docRef = doc(db, `users/${currentUid}/incidents`, i.id);
          const snap = await getDoc(docRef);

          if (snap.exists() && snap.data().status !== i.status) {
            newConflicts.push({ id: i.id, type: "Incident", title: i.type || "Incident", localData: i, remoteData: snap.data() });
          } else {
            const payload = { ...i };
            delete payload.isSynced; // Clean payload
            batch.set(docRef, sanitizePayload(payload));
            batchHasOperations = true;
            i.isSynced = true;
            i.justSynced = true;
          }
        } catch (e) {
          console.error("Failed to sync incident", e);
          hasError = true;
        }
        processed++;
      }

      const synced = parsed.map((i: any) => {
         const corresponding = toSync.find((syncInc: any) => syncInc.id === i.id);
         if (corresponding && corresponding.isSynced) {
           return { ...i, isSynced: true, justSynced: true };
         }
         return i;
      });

      if (toSync.length > 0) {
        localStorage.setItem("watsanIncidents", JSON.stringify(synced));
        updated = true;
      }
    }

    if (batchHasOperations) {
      setSyncProgress({ current: processed, total: queueCount, message: "Committing changes..." });
      try {
        await batch.commit();
      } catch (err) {
        console.error("Batch commit failed", err);
        hasError = true;
      }
    }

    if (newConflicts.length > 0) {
      setSyncConflicts((prev) => {
        const map = new Map();
        prev.forEach(c => map.set(c.id, c));
        newConflicts.forEach(c => map.set(c.id, c));
        return Array.from(map.values());
      });
    }

    if (updated) calculateQueue();
    setIsSyncing(false);
    setTimeout(() => setSyncProgress(null), 1000);
    return !hasError;
  }, [calculateQueue, queueCount]);

  useEffect(() => {
    calculateQueue();
    // Re-check periodically or on storage event
    const interval = setInterval(calculateQueue, 2000);
    window.addEventListener("storage", calculateQueue);

    // Auto-sync when coming online
    const handleOnline = () => {
      backoffDelayRef.current = 2000;
      syncData();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", calculateQueue);
      window.removeEventListener("online", handleOnline);
    };
  }, [calculateQueue, syncData]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runSyncLoop = async () => {
      if (queueCount > 0 && navigator.onLine && !isSyncing) {
        const success = await syncData();
        if (success) {
          backoffDelayRef.current = 2000; // Reset on success
        } else {
          backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 60000); // Exponential backoff up to 1 min
        }
      }
      
      // Schedule next attempt only if not currently syncing to avoid multiple triggers
      if (!isSyncing) {
         timeoutId = setTimeout(runSyncLoop, backoffDelayRef.current);
      }
    };

    if (queueCount > 0 && !isSyncing) {
      timeoutId = setTimeout(runSyncLoop, backoffDelayRef.current);
    } else if (queueCount === 0) {
      backoffDelayRef.current = 2000; // Reset when queue is empty
    }

    return () => clearTimeout(timeoutId);
  }, [queueCount, isSyncing, syncData]);

  return {
    queueCount,
    pendingItems,
    syncConflicts,
    setSyncConflicts, // Extracted for mock injection if testing
    refreshQueue: calculateQueue,
    syncData,
    resolveConflict,
    toggleItemRetry,
    isSyncing,
    clearCompleted,
    syncProgress,
  };
}

