import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export function usePushNotifications(currentUid: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const notifiedTasks = useRef<Set<string>>(new Set());

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setPermission);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUid || permission !== "granted") return;

    const q = query(
      collection(db, `users/${currentUid}/tasks`),
      where("priority", "==", "high"),
      where("status", "==", "pending") // Only unresolved high priority tasks
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // Only trigger on newly added tasks
        if (change.type === "added") {
          const task = change.doc.data();
          const taskId = change.doc.id;

          if (!notifiedTasks.current.has(taskId)) {
            notifiedTasks.current.add(taskId);

            // Verify if there actually is a service worker to trigger a background push
            // or just trigger a local Notification
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification("Critical Task Assigned", {
                  body: `${task.title} at ${task.location}`,
                  icon: "/icons/icon-192x192.png", // Optional: Path to an icon
                  tag: `task-${taskId}`, // Prevents duplicate notifications
                  data: { url: "/?tab=tasks" }
                });
              }).catch(() => {
                // Fallback if no SW active
                new Notification("Critical Task Assigned", {
                  body: `${task.title} at ${task.location}`,
                });
              });
            } else {
              new Notification("Critical Task Assigned", {
                body: `${task.title} at ${task.location}`,
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [currentUid, permission]);

  return { permission };
}
