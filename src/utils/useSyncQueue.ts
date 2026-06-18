import { useState, useEffect, useCallback } from 'react';

export function useSyncQueue() {
  const [queueCount, setQueueCount] = useState(0);

  const calculateQueue = useCallback(() => {
    try {
      const rawActivities = localStorage.getItem('watsanActivities');
      const rawTasks = localStorage.getItem('watsanTasks');
      let count = 0;
      if (rawActivities) {
        const parsed = JSON.parse(rawActivities);
        count += parsed.filter((a: any) => !a.isSynced).length;
      }
      if (rawTasks) {
        const parsedTasks = JSON.parse(rawTasks);
        count += parsedTasks.filter((t: any) => t.status === 'completed' && !t.isSynced).length;
      }
      setQueueCount(count);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const syncData = useCallback(async () => {
    // Conceptual conflict resolution: "Last Write Wins" (LWW) based on ISO timestamp
    // When syncing two offline nodes that updated the same remote asset/task,
    // the system resolves silently by accepting the payload with the later timestamp.
    
    let updated = false;
    
    // Process Activities
    const rawActivities = localStorage.getItem('watsanActivities');
    if (rawActivities) {
      const parsed = JSON.parse(rawActivities);
      const toSync = parsed.filter((a: any) => !a.isSynced);
      if (toSync.length > 0) {
        const synced = parsed.map((a: any) => ({ ...a, isSynced: true }));
        localStorage.setItem('watsanActivities', JSON.stringify(synced));
        updated = true;
      }
    }

    // Process Tasks
    const rawTasks = localStorage.getItem('watsanTasks');
    if (rawTasks) {
      const parsed = JSON.parse(rawTasks);
      const toSync = parsed.filter((t: any) => t.status === 'completed' && !t.isSynced);
      if (toSync.length > 0) {
        // Here, a backend LWW algorithm would check:
        // if (incomingTask.updatedAt > serverTask.updatedAt) { applyUpdate() }
        const synced = parsed.map((t: any) => ({ ...t, isSynced: true }));
        localStorage.setItem('watsanTasks', JSON.stringify(synced));
        updated = true;
      }
    }
    
    if (updated) calculateQueue();
  }, [calculateQueue]);

  useEffect(() => {
    calculateQueue();
    // Re-check periodically or on storage event
    const interval = setInterval(calculateQueue, 2000);
    window.addEventListener('storage', calculateQueue);
    
    // Auto-sync when coming online
    const handleOnline = () => {
      syncData();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', calculateQueue);
      window.removeEventListener('online', handleOnline);
    };
  }, [calculateQueue, syncData]);

  return { queueCount, refreshQueue: calculateQueue, syncData };
}
