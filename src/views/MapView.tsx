import React, { useState, useEffect } from "react";
import { Navigation, User, Clock, AlertTriangle, CloudOff } from "lucide-react";
import { db } from "../lib/firebase";
import {
  collectionGroup,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default leaflet icons not showing in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function MapView({
  currentUser,
  currentUid,
}: {
  currentUser?: string | null;
  currentUid?: string | null;
}) {
  const isAdmin =
    currentUser?.toLowerCase().includes("kevin vilbar") ||
    currentUser?.toLowerCase().includes("tech head") ||
    currentUser?.toLowerCase().includes("admin");

  const [locations, setLocations] = useState<any[]>([]);
  const [mapError, setMapError] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    // Attempt to fetch latest clock-ins
    const q = query(
      collectionGroup(db, "attendance"),
      orderBy("timestamp", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const locs: any[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          if (d.location) {
            locs.push({
              id: doc.id,
              userId: doc.ref.parent.parent?.id,
              ...d,
            });
          }
        });

        // Deduplicate by user to get "last known"
        const lastKnown = locs.reduce(
          (acc, curr) => {
            if (!acc[curr.userId]) acc[curr.userId] = curr;
            return acc;
          },
          {} as Record<string, any>,
        );

        setLocations(Object.values(lastKnown));
        setMapError(false);
      },
      (err) => {
        console.error(err);
        setMapError(true);
      },
    );

    return () => unsub();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="w-16 h-16 text-outline-variant mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-on-surface-variant max-w-[448px]">
          The live map tracking module is restricted to administrators and
          operations managers.
        </p>
      </div>
    );
  }

  // Fallback map view if no locations
  const centerLat =
    locations.length > 0 ? locations[0].location.latitude : 10.7202;
  const centerLng =
    locations.length > 0 ? locations[0].location.longitude : 122.5621;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-28 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="font-headline-lg text-on-surface mb-2 tracking-tight flex items-center gap-2">
            <Navigation className="text-primary" /> Live Tracking Map
          </h2>
          <p className="text-on-surface-variant max-w-[576px]">
            Real-time GPS coordinates of field technicians based on their last
            logged interaction or attendance clock-in.
          </p>
        </div>
        {isOfflineMode && (
          <div className="flex items-center gap-2 bg-surface-variant/50 text-on-surface-variant px-3 py-1.5 rounded text-sm font-semibold border border-outline-variant">
            <CloudOff className="w-4 h-4" /> Offline map mode
          </div>
        )}
      </div>

      {mapError && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">Index Required</h4>
            <p className="text-sm opacity-90 mt-1">
              To view all field staff locations, a Composite Index for the
              'attendance' collection group must be created in the Firebase
              Console. Until then, the live map query will be denied.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface border border-outline-variant rounded-2xl overflow-hidden h-[500px] shadow-sm relative z-0">
          {locations.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest z-10">
              <p className="text-on-surface-variant flex items-center gap-2">
                <Clock /> Waiting for telemetry data...
              </p>
            </div>
          ) : (
            <MapContainer
              center={[centerLat, centerLng]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {locations.map((loc, idx) => (
                <Marker
                  key={idx}
                  position={[loc.location.latitude, loc.location.longitude]}
                >
                  <Popup>
                    <strong className="text-sm">
                      {loc.staffName || "Unknown Technician"}
                    </strong>
                    <br />
                    <span className="text-xs text-on-surface-variant">
                      Last updated:{" "}
                      {loc.timestamp
                        ? new Date(loc.timestamp.toMillis()).toLocaleString()
                        : "Just now"}
                    </span>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-lg items-center flex gap-2">
            <User /> Field Staff Directory
          </h3>
          {locations.length === 0 && (
            <div className="text-sm text-on-surface-variant p-4 border border-outline-variant border-dashed rounded-xl text-center">
              No active locations acquired.
            </div>
          )}
          {locations.map((loc, idx) => (
            <div
              key={idx}
              className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="font-semibold text-on-surface">
                {loc.staffName || "Unknown Technician"}
              </div>
              <div className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1.5 font-mono bg-surface-container-lowest p-1.5 rounded">
                <Navigation className="w-3 h-3 text-primary" />{" "}
                {loc.location.latitude.toFixed(5)},{" "}
                {loc.location.longitude.toFixed(5)}
              </div>
              <div className="text-xs text-on-surface-variant mt-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-primary" />
                {loc.timestamp
                  ? new Date(loc.timestamp.toMillis()).toLocaleString()
                  : "Just now"}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                Accuracy: ±{Math.round(loc.location.accuracy || 0)}m
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
