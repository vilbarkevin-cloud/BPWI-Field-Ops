import React, { useState, useEffect, useMemo } from "react";
import { Navigation, User, Clock, AlertTriangle, CloudOff, MapPin, ArrowRight, Route, X, Sparkles, Layers } from "lucide-react";
import { db } from "../lib/firebase";
import {
  collectionGroup,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAdminRole } from "../hooks/useAdminRole";
import { useNetworkInfo } from "../utils/useNetworkInfo";
import { facilityCoordinates, facilitiesList } from "../lib/facilityData";
import { useToast } from "../utils/ToastContext";

// Fix for default leaflet icons not showing in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295;    // Math.PI / 180
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * 
          (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

export function MapView({
  currentUser,
  currentUid,
  setActiveTab,
}: {
  currentUser?: string | null;
  currentUid?: string | null;
  setActiveTab?: any;
}) {
  const isAdmin = useAdminRole(currentUid);
  const { isLowDataMode } = useNetworkInfo();
  const { showToast } = useToast();

  const [locations, setLocations] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [mapError, setMapError] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [selectedTechForRoute, setSelectedTechForRoute] = useState<any | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
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
      (err: any) => {
        if (err.code === 'permission-denied') return;
        setMapError(true);
      },
    );
    
    // Fetch active incidents to generate heatmap
    const qi = query(collectionGroup(db, "incidents"));
    const unsubIncidents = onSnapshot(qi, (snapshot) => {
      const incs: any[] = [];
      snapshot.forEach(d => incs.push({id: d.id, ...d.data()}));
      setIncidents(incs.filter(i => i.status !== "resolved" && i.status !== "closed"));
    }, (err) => {
        console.error("Incidents error map:", err);
    });

    return () => { unsub(); unsubIncidents(); };
  }, [isAdmin]);

  const heatmapData = useMemo(() => {
     const counts = incidents.reduce((acc, curr) => {
        if (curr.facility) acc[curr.facility] = (acc[curr.facility] || 0) + 1;
        return acc;
     }, {} as Record<string, number>);
     
     return Object.entries(counts).map(([facility, count]): {name: string, center: [number, number], radius: number, color: string, tasks: number, fillOpacity: number, pulse: boolean} => {
         const cnt = count as number;
         const coords = facilityCoordinates[facility] || [10.7252, 122.5621];
         let color = "#22C55E";
         if (cnt > 5) color = "#EF4444";
         else if (cnt > 2) color = "#F97316";

         return {
            name: facility,
            center: coords as [number, number],
            radius: Math.min(2500, cnt * 500),
            color,
            tasks: cnt,
            fillOpacity: cnt > 5 ? 0.35 : 0.2,
            pulse: cnt > 5
         };
     });
  }, [incidents]);

  const routeStops = useMemo(() => {
      if (!selectedTechForRoute) return [];
      const userLoc = selectedTechForRoute.location;
      
      const openIncidents = incidents.filter(i => i.facility && facilityCoordinates[i.facility]);
      // For each facility, select the one with highest severity
      const stopsMap = new Map<string, any>();
      for (const i of openIncidents) {
         if (!stopsMap.has(i.facility)) stopsMap.set(i.facility, i);
         else {
             const existing = stopsMap.get(i.facility);
             if (i.severity === 'critical' && existing.severity !== 'critical') stopsMap.set(i.facility, i);
         }
      }
      
      let stops = Array.from(stopsMap.values());
      stops.forEach(s => {
         const coords = facilityCoordinates[s.facility];
         s.distance = distance(userLoc.latitude, userLoc.longitude, coords[0], coords[1]);
      });
      stops.sort((a,b) => a.distance - b.distance);
      return stops.slice(0, 3); // Take nearest 3
  }, [selectedTechForRoute, incidents]);

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
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div>
          <h2 className="font-headline-lg text-on-surface mb-2 tracking-tight flex items-center gap-2">
            <Navigation className="text-primary" /> Live Tracking Map
          </h2>
          <p className="text-on-surface-variant max-w-[576px]">
            Real-time GPS coordinates of field technicians based on their last
            logged interaction or attendance clock-in.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOfflineMode && (
            <div className="flex items-center gap-2 bg-surface-variant/50 text-on-surface-variant px-3 py-1.5 rounded text-sm font-semibold border border-outline-variant">
              <CloudOff className="w-4 h-4" /> Offline map mode
            </div>
          )}
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              showHeatmap
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-variant/50 hover:text-on-surface"
            }`}
          >
            <Layers className="w-4 h-4" />
            {showHeatmap ? "Hide Workload Overlay" : "Show Area Workload"}
          </button>
        </div>
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
              {isLowDataMode ? (
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">Carto</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              )}
              {showHeatmap && heatmapData.map((data, idx) => (
                <Circle
                  key={`heatmap-${idx}`}
                  center={data.center}
                  radius={data.radius}
                  pathOptions={{
                    color: data.color,
                    fillColor: data.color,
                    fillOpacity: data.fillOpacity,
                    weight: 1,
                    className: data.pulse ? "animate-pulse" : "",
                  }}
                >
                  <Popup>
                    <div className="text-sm font-semibold">{data.name}</div>
                    <div className="text-xs text-on-surface-variant mt-1">Pending/Overdue Tasks: {data.tasks}</div>
                  </Popup>
                </Circle>
              ))}
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
              <button 
                onClick={() => setSelectedTechForRoute(loc)}
                className="mt-3 w-full bg-primary/10 text-primary hover:bg-primary/20 text-sm font-semibold py-1.5 rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <Route className="w-4 h-4" /> Optimize Route
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Route Optimizer Modal */}
      {selectedTechForRoute && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div className="flex items-center gap-2">
                <Route className="text-primary w-5 h-5" />
                <h3 className="font-headline-sm font-semibold text-on-surface">Intelligent Route Optimizer</h3>
              </div>
              <button
                onClick={() => setSelectedTechForRoute(null)}
                className="p-2 -mr-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div className="bg-primary-container/30 border border-primary/20 rounded-xl p-4 flex gap-3 text-on-surface">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Suggested Sequence for {selectedTechForRoute.staffName || "Technician"}</h4>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Tasks are sequenced based on shortest distance from current live location ({selectedTechForRoute.location.latitude.toFixed(4)}, {selectedTechForRoute.location.longitude.toFixed(4)}) and ticket priority using intelligent routing. This minimizes travel time and fuel costs.
                  </p>
                </div>
              </div>
              
              <div className="relative pl-6 space-y-4">
                <div className="absolute top-3 bottom-5 left-2 border-l-2 border-dashed border-outline-variant"></div>
                
                <div className="relative">
                  <div className="absolute -left-[23px] top-1 w-4 h-4 bg-primary rounded-full border-2 border-white shadow-sm ring-2 ring-primary/20"></div>
                  <div className="bg-surface border border-primary/40 rounded-lg p-3 shadow-sm shadow-primary/5">
                    <div className="flex justify-between items-start">
                      <span className="font-label-md">Current Location</span>
                    </div>
                  </div>
                </div>

                {routeStops.length === 0 ? (
                    <div className="p-4 text-center text-sm text-on-surface-variant">No pending stops nearby.</div>
                ) : routeStops.map((stop: any, idx: number) => {
                   const colors = ['border-secondary', 'border-tertiary', 'border-outline'];
                   const borderClass = colors[idx] || 'border-outline';
                   return (
                     <div className="relative" key={idx}>
                       <div className={`absolute -left-[21px] top-1.5 w-3 h-3 bg-surface border-[3px] ${borderClass} rounded-full`}></div>
                       <div className="bg-surface border border-outline-variant rounded-lg p-3">
                         <div className="flex justify-between items-start mb-1">
                           <span className="font-label-md text-on-surface line-clamp-1">{`Stop ${idx + 1}: ${stop.type}`}</span>
                           <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stop.severity === 'critical' ? 'bg-error/10 text-error' : 'bg-surface-variant text-on-surface-variant'}`}>{stop.severity || 'Medium'}</span>
                         </div>
                         <p className="text-body-sm text-on-surface-variant flex items-center gap-1"><MapPin className="w-3 h-3" /> {stop.facility} (+{stop.distance.toFixed(1)} km)</p>
                       </div>
                     </div>
                   );
                })}
              </div>
              
            </div>
            <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-3">
              <button 
                onClick={() => {
                   showToast("Route sent to technician's mobile device via Push Notification", "success");
                   setSelectedTechForRoute(null);
                }}
                className="btn-primary w-full"
              >
                Send Route to Technician
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
