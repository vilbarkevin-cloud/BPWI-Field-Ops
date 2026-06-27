export const cleanUpOldLocalData = () => {
  const MAX_AGE_DAYS = 45;
  const msInDay = 24 * 60 * 60 * 1000;
  const cutoffDate = Date.now() - (MAX_AGE_DAYS * msInDay);

  try {
    // Keys used in localStorage that may contain base64 photos or heavy data
    const storageKeys = ["watsanActivities", "watsanTasks", "watsanIncidents"];
    let removedCount = 0;

    storageKeys.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item: any) => {
            const itemDate = item.createdAt || item.updatedAt || item.date || item.assignedAt || item.timestamp;
            if (itemDate) {
              const timestamp = typeof itemDate === 'number' ? itemDate : new Date(itemDate).getTime();
              if (!isNaN(timestamp) && timestamp < cutoffDate) {
                // If it is older than 45 days, we want to remove it
                removedCount++;
                return false; // Remove
              }
            }
            return true; // Keep
          });

          if (filtered.length < parsed.length) {
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      }
    });

    console.log(`Cleanup complete: Removed ${removedCount} items older than 45 days.`);
  } catch (error) {
    console.error("Failed to run local photo cleanup:", error);
  }
};
