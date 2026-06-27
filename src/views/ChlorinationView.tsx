import React, { useState, useMemo, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useToast } from "../utils/ToastContext";
import { Droplet, Activity, Save, Calculator, AlertTriangle, CheckCircle2, FlaskConical, Map, Beaker, FileText, Database, TrendingDown, Plus, Trash2, ArrowRight, X, Undo2, Mountain } from "lucide-react";
import { ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area } from 'recharts';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
// @ts-ignore
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";

// Fix for default leaflet icons not showing in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MATERIALS = {
  pvc: { name: 'PVC / uPVC', min: 0.30, max: 0.80 },
  hdpe: { name: 'HDPE', min: 0.20, max: 0.60 },
  ductile: { name: 'Ductile Iron (DI)', min: 0.40, max: 1.20 },
  steel: { name: 'Steel (Carbon/Welded)', min: 0.50, max: 1.50 },
  gi: { name: 'Galvanized Iron', min: 1.00, max: 3.00 },
  ci: { name: 'Cast Iron (old/unlined)', min: 0.80, max: 2.00 },
  ac: { name: 'Asbestos Cement', min: 0.80, max: 1.50 },
};

export function ChlorinationView({ currentUid, currentUser, setActiveTab }: { currentUid?: string | null; currentUser?: string | null; setActiveTab?: any }) {
  const { showToast } = useToast();
  
  // Project Details
  const [pjArea, setPjArea] = useState("");
  const [pjWell, setPjWell] = useState("");
  const [pjAddr, setPjAddr] = useState("");
  const [pjEng, setPjEng] = useState("");

  // System & Target Inputs
  const [flow, setFlow] = useState(91);
  const [diaIn, setDiaIn] = useState(4);
  const [dist, setDist] = useState(800);
  const [srcRes, setSrcRes] = useState(0.8);
  const [demand, setDemand] = useState(0.2);
  const [decay, setDecay] = useState(1.137);
  const [material, setMaterial] = useState("");

  // EWT
  const [ewtOn, setEwtOn] = useState(false);
  const [ewtVolGal, setEwtVolGal] = useState(87000);
  const [ewtLvl, setEwtLvl] = useState(50);

  // Chemical Properties
  const [chemState, setChemState] = useState("Liquid");
  const [conc, setConc] = useState(0.06);
  const [sg, setSg] = useState(1.1);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapTargetId, setMapTargetId] = useState<number | 'max'>('max');
  const [drawnDist, setDrawnDist] = useState(0);
  const [mapPoints, setMapPoints] = useState<L.LatLng[]>([]);
  const [elevationData, setElevationData] = useState<{distance: number, elevation: number}[]>([]);
  const [isFetchingElevation, setIsFetchingElevation] = useState(false);

  const fetchElevationProfile = async () => {
     if (mapPoints.length < 2) {
        showToast("Please draw a route with at least 2 points first.", "warning");
        return;
     }

     setIsFetchingElevation(true);
     try {
        const maxPoints = 100;
        let sampledPoints: L.LatLng[] = [];
        
        if (mapPoints.length <= maxPoints) {
           sampledPoints = [...mapPoints];
        } else {
           const step = mapPoints.length / maxPoints;
           for (let i = 0; i < maxPoints; i++) {
              sampledPoints.push(mapPoints[Math.floor(i * step)]);
           }
        }

        const lats = sampledPoints.map(p => p.lat).join(',');
        const lngs = sampledPoints.map(p => p.lng).join(',');

        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
        const data = await res.json();

        if (data && data.elevation) {
           let cumulativeDist = 0;
           const newElevData = data.elevation.map((elev: number, idx: number) => {
              if (idx > 0) {
                 cumulativeDist += sampledPoints[idx - 1].distanceTo(sampledPoints[idx]);
              }
              return {
                 distance: Math.round(cumulativeDist),
                 elevation: elev
              };
           });
           setElevationData(newElevData);
        } else {
           showToast("Failed to fetch elevation data.", "error");
        }
     } catch (err) {
        console.error(err);
        showToast("Error fetching elevation.", "error");
     } finally {
        setIsFetchingElevation(false);
     }
  };

  useEffect(() => {
     setElevationData([]);
  }, [mapPoints]);

  useEffect(() => {
     if (chemState === "Liquid") {
        setConc(0.06);
        setSg(1.1);
     } else if (chemState === "Granules") {
        setConc(0.70);
     } else if (chemState === "Gas") {
        setConc(1.00);
     }
  }, [chemState]);

  const handleMaterialChange = (v: string) => {
    setMaterial(v);
    if (v && MATERIALS[v as keyof typeof MATERIALS]) {
       const m = MATERIALS[v as keyof typeof MATERIALS];
       setDecay(Number(((m.min + m.max) / 2).toFixed(3)));
    }
  };

  // Computed
  const velocity = useMemo(() => {
    const area = Math.PI * Math.pow((diaIn * 0.0254) / 2, 2);
    return area > 0 ? (flow / 24) / area : 0;
  }, [flow, diaIn]);

  const travelTime = useMemo(() => {
    return velocity > 0 ? dist / velocity : 0;
  }, [dist, velocity]);

  const ewtTime = useMemo(() => {
    if (ewtOn && flow > 0) {
       const activeM3 = (ewtVolGal * 0.00378541) * (ewtLvl / 100);
       return activeM3 / (flow / 24);
    }
    return 0;
  }, [ewtOn, flow, ewtVolGal, ewtLvl]);

  const dose = useMemo(() => {
    if (ewtOn) {
       const exp = Math.min(decay * ewtTime, 50);
       return srcRes * Math.exp(exp) + demand;
    } else {
       return srcRes + demand;
    }
  }, [ewtOn, decay, ewtTime, srcRes, demand]);

  const endRes = useMemo(() => {
    return srcRes * Math.exp(-decay * travelTime);
  }, [srcRes, decay, travelTime]);

  const massKg = useMemo(() => {
    const pureMassG = dose * flow;
    return (pureMassG / conc) / 1000;
  }, [dose, flow, conc]);

  const ctValue = useMemo(() => {
     return srcRes * travelTime * 60;
  }, [srcRes, travelTime]);

  const dailyVolL = useMemo(() => {
     if (chemState === 'Liquid' && sg > 0) {
        return massKg / sg;
     }
     return 0;
  }, [chemState, massKg, sg]);

  // Dosage Utility
  const [utilVolume, setUtilVolume] = useState(1000);
  const [utilVolumeUnit, setUtilVolumeUnit] = useState<"L" | "m3" | "gal">("L");
  const [utilCurrentRes, setUtilCurrentRes] = useState(0.0);
  const [utilTargetRes, setUtilTargetRes] = useState(0.5);

  const utilWaterVolumeLiters = useMemo(() => {
    if (utilVolumeUnit === "L") return utilVolume;
    if (utilVolumeUnit === "m3") return utilVolume * 1000;
    if (utilVolumeUnit === "gal") return utilVolume * 3.78541;
    return utilVolume;
  }, [utilVolume, utilVolumeUnit]);

  const utilRequiredMassGrams = useMemo(() => {
     const dosePpm = Math.max(0, utilTargetRes - utilCurrentRes);
     const pureChlorineMg = dosePpm * utilWaterVolumeLiters;
     return pureChlorineMg / 1000; // purely grams
  }, [utilTargetRes, utilCurrentRes, utilWaterVolumeLiters]);

  const utilDoseQuantity = useMemo(() => {
     if (conc <= 0) return "—";
     if (chemState === 'Liquid') {
         if (sg <= 0) return "—";
         const gramsProduct = utilRequiredMassGrams / conc;
         const volumeMl = gramsProduct / sg;
         return `${volumeMl.toFixed(2)} mL`;
     } else {
         const gramsProduct = utilRequiredMassGrams / conc;
         return `${gramsProduct.toFixed(2)} g`;
     }
  }, [utilRequiredMassGrams, chemState, conc, sg]);

  // Field Calibration & Sampling Engine
  interface SamplePt {
    id: number;
    name: string;
    distance: number;
    measured: number;
  }
  const [samplePts, setSamplePts] = useState<SamplePt[]>([
    { id: 1, name: 'Nearest Faucet', distance: 100, measured: 0.6 },
    { id: 2, name: 'Farthest Faucet', distance: 800, measured: 0.2 },
  ]);
  const [calibTarget, setCalibTarget] = useState(0.3);
  const [calibRefPtId, setCalibRefPtId] = useState<number>(2);

  const addSamplePt = () => {
    setSamplePts([...samplePts, { id: Date.now(), name: `Point ${samplePts.length + 1}`, distance: 0, measured: 0 }]);
  };

  const removeSamplePt = (id: number) => {
    setSamplePts(samplePts.filter(p => p.id !== id));
    if (calibRefPtId === id) {
      const remaining = samplePts.filter(p => p.id !== id);
      setCalibRefPtId(remaining.length > 0 ? remaining[0].id : 0);
    }
  };

  const updateSamplePt = (id: number, field: keyof SamplePt, value: any) => {
    setSamplePts(samplePts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const currentPumpSettingStr = useMemo(() => {
     if (chemState === 'Liquid' && flow > 0 && sg > 0) {
        return ((massKg / sg * 1000) / (24 * 60)).toFixed(2) + " mL/min";
     }
     return massKg.toFixed(3) + " kg/day";
  }, [chemState, flow, sg, massKg]);

  const currentPumpSettingNum = useMemo(() => {
     if (chemState === 'Liquid' && flow > 0 && sg > 0) {
        return ((massKg / sg * 1000) / (24 * 60)); // mL/min
     }
     return massKg; // kg/day
  }, [chemState, flow, sg, massKg]);

  const calculatePumpAdjustment = (measured: number, target: number, currentSetting: number) => {
     if (measured <= 0 || currentSetting <= 0) return 0;
     const factor = target / measured;
     return currentSetting * factor;
  };

  const refPt = samplePts.find(p => p.id === calibRefPtId);
  const suggestedPumpSettingNum = refPt ? calculatePumpAdjustment(refPt.measured, calibTarget, currentPumpSettingNum) : 0;
  const suggestedPumpSettingStr = chemState === 'Liquid' ? suggestedPumpSettingNum.toFixed(2) + " mL/min" : suggestedPumpSettingNum.toFixed(3) + " kg/day";

  const ksModel = useMemo(() => {
     const pts = [];
     if (srcRes > 0) pts.push({ x: 0, y: Math.log(srcRes) });
     samplePts.forEach(p => {
         if (p.measured > 0 && p.distance > 0) {
             pts.push({ x: p.distance, y: Math.log(p.measured) });
         }
     });
     
     if (pts.length < 2) return { ks: 0, r2: 0 };
     
     const n = pts.length;
     const sx = pts.reduce((s, p) => s + p.x, 0);
     const sy = pts.reduce((s, p) => s + p.y, 0);
     const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
     const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
     const den = n * sxx - sx * sx;
     
     if (den === 0) return { ks: 0, r2: 0 };
     
     const slope = (n * sxy - sx * sy) / den;
     const intercept = (sy - slope * sx) / n;
     const ksVal = Math.max(0, -slope);
     
     // R^2
     const yMean = sy / n;
     const ssTot = pts.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
     const ssRes = pts.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
     const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
     
     return { ks: ksVal, r2 };
  }, [srcRes, samplePts]);

  const estimatedKb = useMemo(() => {
      // k_b (1/hr) = k_s (1/m) * velocity (m/hr)
      return ksModel.ks * velocity;
  }, [ksModel.ks, velocity]);

  const chartData = useMemo(() => {
    if (velocity <= 0 || dist <= 0) return [];
    const data = [];
    const steps = 20;
    const step = dist / steps;
    for (let i = 0; i <= steps; i++) {
        const x = i * step;
        const theoCurve = srcRes * Math.exp(-decay * (x / velocity));
        const calibCurve = ksModel.ks > 0 ? srcRes * Math.exp(-ksModel.ks * x) : null;
        data.push({
            distance: Math.round(x),
            theoretical: Number(theoCurve.toFixed(3)),
            calibrated: calibCurve !== null ? Number(calibCurve.toFixed(3)) : null
        });
    }
    // Add scatter points into the same array or use separate Recharts Scatter component
    return data;
  }, [srcRes, velocity, dist, decay, ksModel.ks]);

  const scatterData = useMemo(() => {
    const spts = [];
    if (srcRes > 0) spts.push({ distance: 0, measured: srcRes, name: 'Source' });
    samplePts.forEach(p => {
       if (p.measured > 0 && p.distance >= 0 && p.distance <= dist) {
           spts.push({ distance: p.distance, measured: p.measured, name: p.name });
       }
    });
    return spts;
  }, [srcRes, samplePts, dist]);

  const handleApplyAdjustment = async () => {
    if (refPt) {
      if (!currentUid) {
        showToast("You must be logged in to log activities.", "error");
        return;
      }
      try {
         await addDoc(collection(db, `users/${currentUid}/activities`), {
            type: 'chlorination',
            title: 'Field Pump Adjustment',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            data: { 
              pjWell,
              measuredPpm: refPt.measured,
              distance: refPt.distance,
              targetPpm: calibTarget,
              oldRate: currentPumpSettingStr,
              newRate: suggestedPumpSettingStr
            },
            status: 'completed',
            isSynced: true
         });
         showToast(`Calibration logged. Adjusted pump to ${suggestedPumpSettingStr}`, "success");
      } catch (e) {
         showToast("Failed to log calibration.", "error");
      }
    }
  };

  const handleSave = async () => {
     if (!currentUid) {
       showToast("You must be logged in to save.", "error");
       return;
     }
     try {
        await addDoc(collection(db, `users/${currentUid}/activities`), {
           type: 'chlorination',
           title: 'Chlorination Calcs',
           date: new Date().toISOString().split('T')[0],
           createdAt: new Date().toISOString(),
           data: { pjArea, pjWell, pjAddr, pjEng, flow, diaIn, dist, srcRes, demand, decay, dose, massKg, dailyVolL, ewtOn, chemState },
           status: 'completed',
           isSynced: true
        });
        showToast("Chlorination report saved successfully", "success");
     } catch (e) {
        showToast("Failed to save report.", "error");
     }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
       <div className="bg-gradient-to-r from-primary to-[#0a5a80] text-white p-6 rounded-xl shadow-md mb-6">
          <div className="flex items-center gap-3 mb-4">
             <Droplet className="w-8 h-8 text-[#90caf9]" />
             <div>
               <h2 className="text-2xl font-bold tracking-tight">Chlorination Dosing & Field Routing System</h2>
               <p className="text-[#90caf9] text-sm mt-1">PNSDW Compliance Analysis · Pipeline Routing · Spatial Decay</p>
             </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/15">
            <div className="flex flex-col gap-1">
               <label className="text-xs uppercase font-semibold text-[#90caf9] tracking-wider">Project Area</label>
               <input type="text" className="bg-white/10 border border-white/20 rounded py-1.5 px-3 text-sm text-white focus:bg-white/20 focus:border-[#0096c7] focus:outline-none transition-colors" value={pjArea} onChange={(e) => setPjArea(e.target.value)} placeholder="e.g. Subdivision" />
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-xs uppercase font-semibold text-[#90caf9] tracking-wider">Well Name / Source</label>
               <input type="text" className="bg-white/10 border border-white/20 rounded py-1.5 px-3 text-sm text-white focus:bg-white/20 focus:border-[#0096c7] focus:outline-none transition-colors" value={pjWell} onChange={(e) => setPjWell(e.target.value)} placeholder="e.g. Well 4" />
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-xs uppercase font-semibold text-[#90caf9] tracking-wider">Address / Location</label>
               <input type="text" className="bg-white/10 border border-white/20 rounded py-1.5 px-3 text-sm text-white focus:bg-white/20 focus:border-[#0096c7] focus:outline-none transition-colors" value={pjAddr} onChange={(e) => setPjAddr(e.target.value)} placeholder="e.g. City" />
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-xs uppercase font-semibold text-[#90caf9] tracking-wider">Engineer / Operator</label>
               <input type="text" className="bg-white/10 border border-white/20 rounded py-1.5 px-3 text-sm text-white focus:bg-white/20 focus:border-[#0096c7] focus:outline-none transition-colors" value={pjEng} onChange={(e) => setPjEng(e.target.value)} placeholder="Name" />
            </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
             {/* 1. System Inputs */}
             <div className="bg-white border-t-4 border-t-secondary border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">1. System & Target Inputs</h3>
                
                <div className="space-y-3">
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Flow Rate (Production)</label>
                      <div className="w-1/3 min-w-[120px] relative">
                        <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-12 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none" value={flow} onChange={(e) => setFlow(Number(e.target.value))} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">CMD</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Pipe Diameter</label>
                      <div className="w-1/3 min-w-[120px] relative">
                        <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-14 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none" value={diaIn} onChange={(e) => setDiaIn(Number(e.target.value))} step="0.5" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">inches</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 flex items-center justify-between">
                         <label className="text-sm font-semibold text-on-surface">Max Distance (Farthest Point)</label>
                         <button onClick={() => { setMapTargetId('max'); setMapPoints([]); setDrawnDist(0); setShowMapModal(true); }} className="text-xs flex items-center gap-1 text-[#0096c7] hover:underline font-bold mr-2"><Map className="w-3 h-3"/> Draw Route</button>
                      </div>
                      <div className="w-1/3 min-w-[120px] relative">
                        <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-16 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none" value={dist} onChange={(e) => setDist(Number(e.target.value))} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">meters</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-error flex-1">{ewtOn ? "Measured Residual (Tank Outlet)" : "Measured Pipeline Source Residual"}</label>
                      <div className="w-1/3 min-w-[120px] relative">
                        <input type="number" className="w-full p-2 border border-error/40 bg-error/5 rounded text-sm font-medium pr-12 focus:border-error outline-none" value={srcRes} onChange={(e) => setSrcRes(Number(e.target.value))} step="0.1" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">ppm</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Raw Water Chlorine Demand</label>
                      <div className="w-1/3 min-w-[120px] relative">
                        <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-12 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none" value={demand} onChange={(e) => setDemand(Number(e.target.value))} step="0.05" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">ppm</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Bulk Decay Constant (k_b)</label>
                      <div className="w-1/3 min-w-[120px] relative">
                        <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-12 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none" value={decay} onChange={(e) => setDecay(Number(e.target.value))} step="0.001" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">1/hr</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* 2. Pipe Material */}
             <div className="bg-white border-t-4 border-t-secondary border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">2. Pipe Material Reference</h3>
                <div className="flex items-center justify-between gap-4 mb-3">
                   <label className="text-sm font-semibold text-on-surface flex-1">Pipe Material</label>
                   <select className="w-1/2 p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm focus:border-secondary outline-none font-medium text-on-surface" value={material} onChange={(e) => handleMaterialChange(e.target.value)}>
                      <option value="">— Select Material —</option>
                      {Object.entries(MATERIALS).map(([key, val]) => (
                         <option key={key} value={key}>{val.name}</option>
                      ))}
                   </select>
                </div>
                {material && MATERIALS[material as keyof typeof MATERIALS] && (
                   <div className="bg-[#e0f4ff] border-l-4 border-[#0096c7] p-3 rounded flex items-center justify-between mt-3 text-sm">
                      <div>
                         <strong>{MATERIALS[material as keyof typeof MATERIALS].name}</strong>
                         <div className="text-xs text-on-surface-variant mt-0.5">Typical field k_b range</div>
                      </div>
                      <div className="font-mono text-[#0096c7] font-bold text-base">
                         {MATERIALS[material as keyof typeof MATERIALS].min.toFixed(2)}–{MATERIALS[material as keyof typeof MATERIALS].max.toFixed(2)} hr⁻¹
                      </div>
                   </div>
                )}
             </div>

             {/* 3. Elevated Water Tank */}
             <div className="bg-white border-t-4 border-t-secondary border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">3. Elevated Water Tank (EWT)</h3>
                <div className="flex items-center justify-between gap-4 mb-3">
                   <label className="text-sm font-semibold text-on-surface flex-1">Water Passes Through EWT?</label>
                   <select className="w-1/2 p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm focus:border-secondary outline-none font-medium text-on-surface" value={ewtOn ? "Yes" : "No"} onChange={(e) => setEwtOn(e.target.value === "Yes")}>
                      <option value="No">No - Direct Injection to Pipe</option>
                      <option value="Yes">Yes - Injects Before Tank</option>
                   </select>
                </div>
                {ewtOn && (
                   <div className="bg-[#fff1e6] border-l-4 border-[#e65100] p-4 rounded mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                         <label className="text-sm font-semibold text-on-surface">Tank Capacity</label>
                         <div className="w-1/2 relative">
                            <input type="number" className="w-full p-2 border border-outline-variant/60 bg-white rounded text-sm font-medium pr-16 outline-none focus:border-[#e65100]" value={ewtVolGal} onChange={(e) => setEwtVolGal(Number(e.target.value))} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">gallons</span>
                         </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                         <label className="text-sm font-semibold text-on-surface">Avg Operating Level</label>
                         <div className="w-1/2 relative">
                            <input type="number" className="w-full p-2 border border-outline-variant/60 bg-white rounded text-sm font-medium pr-12 outline-none focus:border-[#e65100]" value={ewtLvl} onChange={(e) => setEwtLvl(Number(e.target.value))} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">%</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-[#e65100]/20">
                         <span className="text-sm font-semibold text-on-surface-variant">Tank Residence Time</span>
                         <span className="font-mono text-secondary font-bold">{ewtTime.toFixed(1)} hrs</span>
                      </div>
                   </div>
                )}
             </div>

             {/* 4. Chemical Properties */}
             <div className="bg-white border-t-4 border-t-secondary border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">4. Chemical Properties</h3>
                <div className="space-y-3">
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Chemical Type</label>
                      <select className="w-1/2 p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm focus:border-secondary outline-none font-medium text-on-surface" value={chemState} onChange={(e) => setChemState(e.target.value)}>
                         <option value="Liquid">Liquid - Sodium Hypochlorite</option>
                         <option value="Granules">Granules - Calcium Hypochlorite</option>
                         <option value="Gas">Gas - Chlorine Gas</option>
                      </select>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Chemical Concentration</label>
                      <div className="w-1/2 relative">
                         <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-20 outline-none focus:border-secondary" value={conc} onChange={(e) => setConc(Number(e.target.value))} step="0.01" />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">fraction</span>
                      </div>
                   </div>
                   {chemState === 'Liquid' && (
                      <div className="flex items-center justify-between gap-4">
                         <label className="text-sm font-semibold text-on-surface flex-1">Specific Gravity (Liquid)</label>
                         <div className="w-1/2 relative">
                            <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-14 outline-none focus:border-secondary" value={sg} onChange={(e) => setSg(Number(e.target.value))} step="0.05" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">kg/L</span>
                         </div>
                      </div>
                   )}
                </div>
             </div>

             {/* 7. Dosage Utility */}
             <div className="bg-white border-t-4 border-t-[#0096c7] border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm mt-6">
                <h3 className="text-xs font-bold text-[#0096c7] uppercase tracking-widest border-b border-outline-variant pb-2 mb-4 flex items-center gap-2">
                   <FlaskConical className="w-4 h-4" /> Dosage Adjustment Utility
                </h3>
                <div className="space-y-3">
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Water Volume</label>
                      <div className="flex gap-2 w-1/2">
                         <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium outline-none focus:border-[#0096c7]" value={utilVolume} onChange={(e) => setUtilVolume(Number(e.target.value))} />
                         <select className="p-2 border border-outline-variant/60 bg-white rounded text-sm outline-none focus:border-[#0096c7]" value={utilVolumeUnit} onChange={(e) => setUtilVolumeUnit(e.target.value as any)}>
                            <option value="L">L</option>
                            <option value="m3">m³</option>
                            <option value="gal">gal</option>
                         </select>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Current Residual Level</label>
                      <div className="w-1/2 relative">
                         <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-12 outline-none focus:border-[#0096c7]" value={utilCurrentRes} onChange={(e) => setUtilCurrentRes(Number(e.target.value))} step="0.1" />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">ppm</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold text-on-surface flex-1">Target Residual Level</label>
                      <div className="w-1/2 relative">
                         <input type="number" className="w-full p-2 border border-outline-variant/60 bg-surface-container-low rounded text-sm font-medium pr-12 outline-none focus:border-[#0096c7]" value={utilTargetRes} onChange={(e) => setUtilTargetRes(Number(e.target.value))} step="0.1" />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">ppm</span>
                      </div>
                   </div>

                   <div className="pt-4 border-t border-outline-variant mt-2 flex justify-between items-center">
                       <span className="text-sm font-bold text-[#0096c7]">Required Dosage ({chemState})</span>
                       <span className="font-mono text-lg font-bold text-[#0a2540]">{utilDoseQuantity}</span>
                   </div>
                </div>
             </div>
          </div>

          {/* Results Column */}
          <div className="space-y-6">
             {/* 5. Calculation Results */}
             <div className="bg-white border-t-4 border-t-secondary border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">5. Calculation Results</h3>
                
                <div className="space-y-0 divide-y divide-outline-variant/40">
                   <div className="flex justify-between items-center py-3">
                      <span className="text-sm font-semibold text-on-surface-variant">Pipe Flow Velocity</span>
                      <span className="font-mono text-secondary font-bold text-base">{velocity.toFixed(2)} m/hr</span>
                   </div>
                   <div className="flex justify-between items-center py-3">
                      <span className="text-sm font-semibold text-on-surface-variant">Pipeline Travel Time</span>
                      <span className="font-mono text-secondary font-bold text-base">{travelTime.toFixed(2)} hrs</span>
                   </div>
                   <div className="flex justify-between items-center py-3">
                      <span className="text-sm font-semibold text-on-surface-variant">Expected Endpoint Residual</span>
                      <span className={`font-mono font-bold text-base ${endRes >= 0.3 && endRes <= 1.5 ? 'text-success' : 'text-error'}`}>{endRes.toFixed(3)} ppm</span>
                   </div>
                   <div className="flex justify-between items-center py-3">
                      <span className="text-sm font-bold text-error break-words w-1/2">{ewtOn ? "Required Wellhead Dose (Before Tank)" : "Total Required Dose (Pump Setting)"}</span>
                      <span className="font-mono text-error font-bold text-lg">{dose.toFixed(3)} ppm</span>
                   </div>
                </div>

                <div className="bg-[#e0f4ff] border-l-4 border-[#0096c7] p-4 rounded-xl mt-4 flex items-center justify-between gap-4">
                   <div>
                      <div className="text-xs font-bold text-on-surface-variant mb-1">CT Value (C × Travel Time)</div>
                      <div className="text-[11px] text-on-surface-variant leading-tight max-w-[200px]">PNSDW / WHO ref: ≥ 0.2 mg·min/L for disinfection</div>
                   </div>
                   <span className={`font-mono font-bold text-xl ${ctValue >= 0.2 ? 'text-[#0096c7]' : 'text-error'}`}>{ctValue.toFixed(2)}</span>
                </div>

                <div className={`mt-4 p-4 rounded-xl border-2 text-center font-bold tracking-wide transition-colors ${endRes > 1.5 || endRes < 0.3 ? 'bg-[#fce4e4] border-[#ef9a9a] text-[#b71c1c] animate-pulse' : 'bg-[#e6f4ea] border-[#a5d6a7] text-[#1a6e35]'}`}>
                   {endRes > 1.5 ? (
                      <span>⚠ VIOLATION — Endpoint {endRes.toFixed(2)} ppm exceeds PNSDW maximum of 1.5 ppm</span>
                   ) : endRes < 0.3 ? (
                      <span>⚠ VIOLATION — Endpoint {endRes.toFixed(2)} ppm is below PNSDW minimum of 0.3 ppm</span>
                   ) : (
                      <span>✓ COMPLIANT — Endpoint {endRes.toFixed(2)} ppm is within PNSDW range 0.3–1.5 ppm</span>
                   )}
                </div>
             </div>

             {/* 6. Daily Chemical Requirement */}
             <div className="bg-white border-t-4 border-t-secondary border-x border-b border-outline-variant/60 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">6. Daily Chemical Requirement</h3>
                
                <div className="space-y-0 divide-y divide-outline-variant/40">
                   <div className="flex justify-between items-center py-3">
                      <span className="text-sm font-semibold text-on-surface-variant">Daily Mass Required ({chemState})</span>
                      <span className="font-mono text-secondary font-bold text-base">{massKg.toFixed(3)} kg/day</span>
                   </div>
                   {chemState === 'Liquid' && (
                      <div className="flex justify-between items-center py-3">
                         <span className="text-sm font-semibold text-on-surface-variant">Daily Volume Required</span>
                         <span className="font-mono text-secondary font-bold text-base">{dailyVolL.toFixed(3)} L/day</span>
                      </div>
                   )}
                   <div className="flex justify-between items-center py-3">
                      <span className="text-sm font-semibold text-on-surface-variant">Weekly Stock Needed</span>
                      <span className="font-mono text-secondary font-bold text-base">{(massKg * 7).toFixed(2)} kg</span>
                   </div>
                   {chemState === 'Liquid' && (
                      <div className="flex justify-between items-center py-3">
                         <span className="text-sm font-semibold text-on-surface-variant">Dosing Pump Rate</span>
                         <span className="font-mono text-secondary font-bold text-base">
                            {currentPumpSettingStr}
                         </span>
                      </div>
                   )}
                </div>
             </div>

             <button onClick={handleSave} className="w-full py-4 bg-primary hover:bg-[#0d3460] text-white font-bold rounded-xl shadow-md transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> 
                <span>Save Protocol to Activity Logs</span>
             </button>
          </div>
       </div>

       {/* Full Width - Field Calibration Engine */}
       <div className="mt-8 bg-white border border-outline rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-secondary to-[#0a5a80] px-6 py-4 flex items-center justify-between">
             <div className="flex items-center gap-3 text-white">
                <TrendingDown className="w-6 h-6 text-[#90caf9]" />
                <div>
                  <h3 className="font-bold text-lg tracking-tight">8. Field Sampling & Regression Engine</h3>
                  <p className="text-sm opacity-80">Input real-world residuals to automatically reverse-engineer decay constant and adjust pump</p>
                </div>
             </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
             <div className="space-y-6">
                <div>
                   <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-on-surface text-sm">Sample Points</h4>
                      <button onClick={addSamplePt} className="text-secondary text-sm font-semibold hover:text-[#0d3460] flex items-center gap-1">
                         <Plus className="w-4 h-4"/> Add Point
                      </button>
                   </div>
                   
                   <div className="border border-outline-variant rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-surface border-b border-outline-variant">
                            <tr>
                               <th className="p-3 font-semibold text-on-surface-variant">Location</th>
                               <th className="p-3 font-semibold text-on-surface-variant">Distance (m)</th>
                               <th className="p-3 font-semibold text-on-surface-variant">Residual (ppm)</th>
                               <th className="p-3 w-10 text-center"></th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-outline-variant/60">
                            {samplePts.map((pt) => (
                               <tr key={pt.id} className="hover:bg-surface-container-low transition-colors">
                                  <td className="p-2">
                                     <input type="text" className="w-full p-2 bg-transparent border border-transparent hover:border-outline-variant rounded focus:bg-white focus:border-secondary outline-none text-sm" value={pt.name} onChange={(e) => updateSamplePt(pt.id, 'name', e.target.value)} />
                                  </td>
                                  <td className="p-2">
                                     <div className="flex items-center gap-1">
                                        <input type="number" className="w-full p-2 bg-transparent border border-transparent hover:border-outline-variant rounded focus:bg-white focus:border-secondary outline-none text-sm font-mono" value={pt.distance} onChange={(e) => updateSamplePt(pt.id, 'distance', Number(e.target.value))} />
                                        <button onClick={() => { setMapTargetId(pt.id); setMapPoints([]); setDrawnDist(0); setShowMapModal(true); }} className="text-[#0096c7] p-1.5 hover:bg-[#0096c7]/10 rounded" title="Draw Route on Map">
                                           <Map className="w-4 h-4"/>
                                        </button>
                                     </div>
                                  </td>
                                  <td className="p-2">
                                     <input type="number" className="w-full p-2 bg-transparent border border-transparent hover:border-outline-variant rounded focus:bg-white focus:border-secondary outline-none text-sm font-mono" step="0.1" value={pt.measured} onChange={(e) => updateSamplePt(pt.id, 'measured', Number(e.target.value))} />
                                  </td>
                                  <td className="p-2 text-center">
                                     <button onClick={() => removeSamplePt(pt.id)} className="p-1.5 text-error hover:bg-error/10 rounded">
                                        <Trash2 className="w-4 h-4"/>
                                     </button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-surface rounded-xl border border-outline">
                      <div className="text-xs uppercase font-bold text-on-surface-variant mb-1">Spatial Decay (k_s)</div>
                      <div className="font-mono text-2xl font-bold text-secondary">{ksModel.ks.toFixed(5)} <span className="text-sm font-medium text-on-surface-variant">1/m</span></div>
                   </div>
                   <div className="p-4 bg-surface rounded-xl border border-outline">
                      <div className="text-xs uppercase font-bold text-on-surface-variant mb-1">R² Fit Quality</div>
                      <div className={`font-mono text-2xl font-bold ${ksModel.r2 >= 0.8 ? 'text-success' : 'text-warning'}`}>{ksModel.r2.toFixed(3)}</div>
                   </div>
                   <div className="col-span-2 p-4 bg-surface rounded-xl border border-outline border-l-4 border-l-secondary flex items-center justify-between">
                      <div>
                         <div className="text-xs uppercase font-bold text-on-surface-variant mb-1">Implied Bulk Decay (k_b)</div>
                         <div className="text-sm text-on-surface-variant">Derived from velocity & spatial decay</div>
                      </div>
                      <div className="text-right">
                         <div className="font-mono text-2xl font-bold text-secondary">{estimatedKb.toFixed(4)} <span className="text-sm font-medium text-on-surface-variant">1/hr</span></div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="border border-outline rounded-xl p-5">
                   <h4 className="font-semibold text-on-surface text-sm mb-4">Pump Adjustment Logic</h4>
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-semibold text-on-surface-variant block mb-1">Calibration Ref. Point</label>
                            <select className="w-full p-2 border border-outline-variant bg-surface rounded text-sm focus:border-secondary outline-none" value={calibRefPtId} onChange={(e) => setCalibRefPtId(Number(e.target.value))}>
                               {samplePts.map(pt => (
                                  <option key={pt.id} value={pt.id}>{pt.name} ({pt.distance}m) - {pt.measured}ppm</option>
                               ))}
                            </select>
                         </div>
                         <div>
                            <label className="text-xs font-semibold text-on-surface-variant block mb-1">Target Residual</label>
                            <div className="relative">
                               <input type="number" step="0.1" className="w-full p-2 border border-outline-variant bg-surface rounded text-sm focus:border-secondary outline-none pr-10" value={calibTarget} onChange={(e) => setCalibTarget(Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">ppm</span>
                            </div>
                         </div>
                      </div>

                      <div className="bg-[#e6f4ea] p-5 rounded-lg border border-[#a5d6a7]">
                         <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="flex-1">
                               <div className="text-xs font-bold text-on-surface-variant uppercase mb-1">Current Feed</div>
                               <div className="font-mono text-xl font-bold text-on-surface/50 line-through">{currentPumpSettingStr}</div>
                            </div>
                            <ArrowRight className="w-6 h-6 text-success" />
                            <div className="flex-1 text-right">
                               <div className="text-xs font-bold text-success uppercase mb-1">Suggested Feed</div>
                               <div className="font-mono text-2xl font-bold text-success">{suggestedPumpSettingStr}</div>
                            </div>
                         </div>
                         <button onClick={handleApplyAdjustment} className="w-full py-2.5 bg-success hover:bg-[#12512a] text-white font-bold rounded shadow transition-all flex justify-center items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4" /> Apply & Log Adjustment
                         </button>
                      </div>
                   </div>
                </div>

                <div className="h-48 border border-outline rounded-xl p-3 bg-surface hidden sm:block">
                   <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                         <XAxis dataKey="distance" type="number" domain={[0, 'dataMax']} tick={{fontSize: 10}}/>
                         <YAxis yAxisId="left" tick={{fontSize: 10}} domain={[0, 'auto']}/>
                         <RechartsTooltip />
                         <ReferenceLine yAxisId="left" y={calibTarget} stroke="#d97706" strokeDasharray="3 3" label={{ position: 'top', value: 'Target', fill: '#d97706', fontSize: 8 }} />
                         <Line yAxisId="left" type="monotone" dataKey="theoretical" stroke="#0059b3" strokeWidth={2} dot={false} name="Theoretical" />
                         <Line yAxisId="left" type="monotone" dataKey="calibrated" stroke="#e65100" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Calibrated" />
                         <Scatter yAxisId="left" data={scatterData} fill="#1a6e35" name="Samples" />
                         <Legend wrapperStyle={{fontSize: "10px"}}/>
                      </ComposedChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
       </div>

       {showMapModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface">
               <div>
                  <h3 className="font-bold text-lg text-on-surface">Draw Pipe Route</h3>
                  <p className="text-xs text-on-surface-variant">Click on the map to draw path segments.</p>
               </div>
               <button onClick={() => setShowMapModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"><X className="w-5 h-5"/></button>
             </div>
             <div className="flex-1 relative bg-surface-container-low min-h-[400px]">
               <MapContainer center={[13.9392, 121.6152]} zoom={13} style={{ height: "400px", width: "100%", cursor: 'crosshair' }} className="w-full h-full z-0">
                 <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                 />
                 <PolylineMeasureTool points={mapPoints} setPoints={setMapPoints} onDistanceChange={setDrawnDist} />
               </MapContainer>
               
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-lg border border-outline-variant p-3 flex gap-4 items-center">
                  <div className="text-center px-4">
                     <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Total Distance</div>
                     <div className="font-mono text-2xl font-bold text-[#0096c7]">{drawnDist} <span className="text-sm">m</span></div>
                  </div>
                  <div className="w-[1px] h-10 bg-outline-variant"></div>
                  <div className="flex gap-2">
                     <button onClick={() => {
                        const newPts = mapPoints.slice(0, -1);
                        setMapPoints(newPts);
                        let d = 0;
                        for (let i = 0; i < newPts.length - 1; i++) {
                           d += newPts[i].distanceTo(newPts[i+1]);
                        }
                        setDrawnDist(Math.round(d));
                     }} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant font-medium text-sm flex items-center gap-2 transition-colors border border-transparent hover:border-outline-variant">
                        <Undo2 className="w-4 h-4"/> Undo
                     </button>
                     <button onClick={() => {
                        setMapPoints([]);
                        setDrawnDist(0);
                        setElevationData([]);
                     }} className="p-2 hover:bg-error/10 text-error rounded-lg font-medium text-sm flex items-center gap-2 transition-colors border border-transparent hover:border-error/20">
                        <Trash2 className="w-4 h-4"/> Clear
                     </button>
                     <div className="w-[1px] h-6 bg-outline-variant mx-1 self-center"></div>
                     <button 
                        onClick={fetchElevationProfile} 
                        disabled={isFetchingElevation || mapPoints.length < 2}
                        className="p-2 hover:bg-[#8b5cf6]/10 text-[#8b5cf6] rounded-lg font-medium text-sm flex items-center gap-2 transition-colors border border-transparent hover:border-[#8b5cf6]/30 disabled:opacity-50"
                     >
                        <Mountain className="w-4 h-4"/> 
                        {isFetchingElevation ? "Loading..." : "Get Elevation"}
                     </button>
                  </div>
               </div>
             </div>
             {elevationData.length > 0 && (
                <div className="h-[200px] shrink-0 bg-white border-t border-outline-variant p-4 flex flex-col">
                   <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-[#8b5cf6]" />
                      Elevation Profile
                   </h4>
                   <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                         <AreaChart data={elevationData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                               <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="distance" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => `${v}m`} style={{fontSize: '10px'}} />
                            <YAxis dataKey="elevation" domain={[(dataMin: number) => Math.floor(dataMin - 5), (dataMax: number) => Math.ceil(dataMax + 5)]} tickFormatter={(v) => `${v}m`} style={{fontSize: '10px'}} width={40} />
                            <RechartsTooltip formatter={(value: number) => [`${value} m`, 'Elevation']} labelFormatter={(label: number) => `Distance: ${label}m`} />
                            <Area type="monotone" dataKey="elevation" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorElev)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             )}
             <div className="px-6 py-4 bg-surface border-t border-outline-variant flex justify-end">
                <button onClick={() => {
                   if (mapTargetId === 'max') {
                      setDist(drawnDist);
                   } else {
                      updateSamplePt(mapTargetId as number, 'distance', drawnDist);
                   }
                   setShowMapModal(false);
                }} className="px-6 py-2.5 bg-secondary text-white font-bold rounded-lg shadow-sm hover:bg-[#007ba3] transition-colors flex items-center gap-2">
                   <CheckCircle2 className="w-4 h-4"/> Use This Distance
                </button>
             </div>
           </div>
         </div>
       )}

    </div>
  );
}

function PolylineMeasureTool({ points, setPoints, onDistanceChange }: { points: L.LatLng[], setPoints: (p: L.LatLng[]) => void, onDistanceChange: (d: number) => void }) {
  const map = useMapEvents({});

  const polyRef = React.useRef<L.Polyline | null>(null);
  const geomanInitialized = React.useRef(false);

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, [map]);

  // Manage the Polyline directly to avoid React re-render conflicts with Geoman
  useEffect(() => {
    let active = true;

    const setupGeoman = async () => {
       // Ensure L is globally available for Geoman
       if (typeof window !== 'undefined' && !(window as any).L) {
          (window as any).L = L;
       }

       if (!active) return;

       if (!geomanInitialized.current && map.pm) {
          geomanInitialized.current = true;
          map.pm.addControls({
             position: 'topleft',
             drawMarker: false,
             drawCircleMarker: false,
             drawPolyline: true,
             drawRectangle: false,
             drawPolygon: false,
             drawCircle: false,
             drawText: false,
             editMode: true,
             dragMode: false,
             cutPolygon: false,
             removalMode: false
          });

          map.on('pm:create', (e: any) => {
             if (e.shape === 'Line') {
                const layer = e.layer;
                const latlngs = layer.getLatLngs();
                const flat = [latlngs].flat(Infinity) as L.LatLng[];
                
                // Merge with existing points if any, or replace
                let newPts = [...points, ...flat];
                if (points.length === 0) newPts = flat;

                setPoints(newPts);
                let d = 0;
                for (let i = 0; i < newPts.length - 1; i++) {
                   d += newPts[i].distanceTo(newPts[i+1]);
                }
                onDistanceChange(Math.round(d));
                
                // Remove the drawing layer since we will render it via polyRef
                map.removeLayer(layer);
             }
          });
       }

       if (!polyRef.current) {
         polyRef.current = L.polyline(points, { color: '#0096c7', weight: 4 }).addTo(map);

         if (map.pm) {
            polyRef.current.pm.enable({
               allowSelfIntersection: true,
               preventMarkerRemoval: false,
            });

            const handleEdit = () => {
               if (!polyRef.current) return;
               const latlngs = polyRef.current.getLatLngs();
               const flat = [latlngs].flat(Infinity) as L.LatLng[];
               setPoints(flat);
               let d = 0;
               for (let i = 0; i < flat.length - 1; i++) {
                  d += flat[i].distanceTo(flat[i+1]);
               }
               onDistanceChange(Math.round(d));
            };

            polyRef.current.on('pm:edit', handleEdit);
            polyRef.current.on('pm:vertexadded', handleEdit);
            polyRef.current.on('pm:vertexremoved', handleEdit);
            polyRef.current.on('pm:markerdragend', handleEdit);
         }
       } else {
         // Sync from React state (e.g. from Undo/Clear buttons or initial draw)
         polyRef.current.setLatLngs(points);
       }
    };

    setupGeoman();

    return () => {
      active = false;
    };
  }, [points, map]);

  useEffect(() => {
     return () => {
        if (polyRef.current) {
           if (map.pm) polyRef.current.pm.disable();
           map.removeLayer(polyRef.current);
        }
     }
  }, [map]);

  // We don't render React Marker or Polyline components
  return null;
}
