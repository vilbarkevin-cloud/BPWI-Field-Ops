import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useAdminRole(uid: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!uid) {
      setIsAdmin(false);
      return;
    }

    const checkRole = async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid, "profile", "info"));
        if (snap.exists() && snap.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error checking role:", err);
      }
    };

    checkRole();
  }, [uid]);

  return isAdmin;
}
