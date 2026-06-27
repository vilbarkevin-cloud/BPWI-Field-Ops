import { useState, useEffect } from 'react';
import { getDistanceFromLatLonInM } from './distance';
import { useToast } from './ToastContext';

const LOCATION_COORDS: Record<string, { lat: number, lng: number }> = {
  "Zone A": { lat: 10.7252, lng: 122.5621 },
  "Zone B": { lat: 10.7052, lng: 122.5821 },
  "Zone C": { lat: 10.6902, lng: 122.5321 },
  "Pavia": { lat: 10.7686, lng: 122.5441 },
  "Pavia Service Area": { lat: 10.7686, lng: 122.5441 },
  "PR2": { lat: 10.7202, lng: 122.5621 },
  "BAR": { lat: 10.7100, lng: 122.5700 }
};

// A pseudo-random generator to give consistent "locations" to unknown strings
function getFallbackCoords(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Base around center ~ (10.72, 122.56)
  const latOffset = (hash % 100) / 10000;
  const lngOffset = ((hash >> 2) % 100) / 10000;
  return { lat: 10.72 + latOffset, lng: 122.56 + lngOffset };
}

export function useProximityAlert(tasks: any[]) {
  const { showToast } = useToast();
  const [alertedTasks, setAlertedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!navigator.geolocation) return;

    // Filter for pending unassigned tasks
    const pendingUnassigned = tasks.filter(
      (t) => t.status === "pending" && t.assignedTo === "Unassigned" && t.location
    );

    if (pendingUnassigned.length === 0) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setAlertedTasks((prev) => {
          const nextSet = new Set(prev);
          let showedAnAlert = false;

          for (const task of pendingUnassigned) {
            if (nextSet.has(task.id)) continue;

            const coords = LOCATION_COORDS[task.location] || getFallbackCoords(task.location);
            const dist = getDistanceFromLatLonInM(lat, lng, coords.lat, coords.lng);

            if (dist <= 500) { // Within 500 meters
              showToast(
                `Nearby Task Alert: "${task.title}" is ~${Math.round(dist)}m away at ${task.location}.`,
                "success"
              );
              nextSet.add(task.id);
              showedAnAlert = true;
            }
          }

          return showedAnAlert ? nextSet : prev;
        });
      },
      (err) => {
        console.warn("Geolocation warning in useProximityAlert:", err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [tasks, showToast]);
}
