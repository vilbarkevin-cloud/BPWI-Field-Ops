import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  MapPin, 
  Activity, 
  Wrench, 
  CalendarCheck, 
  Clock, 
  Search,
  ChevronLeft,
  Settings2,
  Droplet,
  Download
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "../lib/firebase";
import { collection, query, getDocs, orderBy, onSnapshot, doc } from "firebase/firestore";
import { generateActivityPDF } from "../lib/pdfGenerator";

interface FacilityViewProps {
  currentUid: string | null;
  setActiveTab: (t: any) => void;
  globalSearchQuery?: string;
}

export function FacilityView({ currentUid, setActiveTab, globalSearchQuery = "" }: FacilityViewProps) {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState(globalSearchQuery);

  useEffect(() => {
    setSearchQuery(globalSearchQuery);
  }, [globalSearchQuery]);
  const [facilityActivities, setFacilityActivities] = useState<any[]>([]);
  const [visibleActivities, setVisibleActivities] = useState(20);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const unsubAreas = onSnapshot(collection(db, `users/${currentUid}/areas`), (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFacilities(fetched);
    });
    
    const unsubInv = onSnapshot(collection(db, `users/${currentUid}/inventory`), (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventoryItems(fetched);
    });

    return () => {
      unsubAreas();
      unsubInv();
    };
  }, [currentUid]);

  const handleSelectFacility = async (fac: any) => {
    setSelectedFacility(fac);
    if (!currentUid) return;
    
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, `users/${currentUid}/activities`)
      );
      const snap = await getDocs(q);
      const acts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      // Filter for this facility
      const matched = acts.filter(a => a.area === fac.name).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setFacilityActivities(matched);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredFacs = facilities.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const chartData = useMemo(() => {
    // Generate last 6 months
    const now = new Date();
    // Default to June 2026 based on mock context, but use Date object normally
    const result = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = d.toLocaleString('default', { month: 'short' });
        
        let count = 0;
        facilityActivities.forEach(act => {
             const actDate = new Date(act.date);
             if (actDate.getMonth() === d.getMonth() && actDate.getFullYear() === d.getFullYear()) {
                 count++;
             }
        });
        
        result.push({ name: monthName, logs: count });
    }
    return result;
  }, [facilityActivities]);

  if (selectedFacility) {
    const assets: any[] = [];
    if (selectedFacility.sites) {
        selectedFacility.sites.forEach((site: string) => {
            assets.push({ type: 'site', name: site, parent: null, key: site });
            if (selectedFacility.wellsBySite && selectedFacility.wellsBySite[site]) {
                selectedFacility.wellsBySite[site].forEach((well: string) => {
                    const equipmentKey = `${site}::${well}`;
                    assets.push({ type: 'equipment', name: well, parent: site, key: equipmentKey });
                    
                    if (selectedFacility.subCategoriesByWell && selectedFacility.subCategoriesByWell[equipmentKey]) {
                        selectedFacility.subCategoriesByWell[equipmentKey].forEach((sub: string) => {
                            assets.push({ type: 'sub-category', name: sub, parent: well, parentSite: site, key: `${equipmentKey}::${sub}` });
                        });
                    }
                });
            }
        });
    }

    return (
      <div className="flex flex-col h-full bg-surface">
        <header className="bg-white border-b border-outline-variant px-4 py-4 flex items-center gap-3 sticky top-0 z-20">
          <button 
            onClick={() => setSelectedFacility(null)}
            className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-headline-md text-headline-sm font-bold text-on-surface">{selectedFacility.name}</h1>
            <p className="text-label-md text-on-surface-variant flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              {selectedFacility.type === 'plant' ? 'Treatment Plant' : 'Service Area / System'}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:max-w-6xl mx-auto w-full space-y-6 pb-24">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Map & Component Grid */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Mini Map representation */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden shadow-sm h-48 relative flex items-center justify-center group cursor-crosshair">
                <div className="absolute inset-0 opacity-20 pointer-events-none transition-transform group-hover:scale-105 duration-700" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.2) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                <div className="text-center z-10 flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <span className="font-label-md text-on-surface-variant mb-1">Location Mapping Active</span>
                  <span className="font-mono text-[10px] text-outline px-2 py-0.5 rounded bg-white">10°{(Math.random() * 5 + 40).toFixed(4)}' N, 122°{(Math.random() * 2 + 30).toFixed(4)}' E</span>
                </div>
                <div className="absolute top-3 right-3 text-[10px] uppercase font-bold tracking-wider text-outline bg-white px-2 py-0.5 rounded-md shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">GPS Signal Locked</div>
              </div>

              {/* Component Grid */}
              <div>
                <h2 className="font-headline-sm text-title-md font-bold text-on-surface mb-4 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Installed Assets
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {assets.map((asset, idx) => {
                    // Find last serviced date for this specific asset
                    let lastServiced = selectedFacility.lastServicedByFacility?.[asset.key];

                    // Check if this matches anything in inventory (fuzzy match on name)
                    const matchedInventory = inventoryItems.find(inv => 
                        inv.name.toLowerCase().includes(asset.name.toLowerCase()) || 
                        asset.name.toLowerCase().includes(inv.name.toLowerCase())
                    );

                    let pulseColor = 'bg-outline';
                    let badgeBg = 'bg-surface-container-high';
                    let badgeTextClass = 'text-on-surface-variant';
                    let urgencyText = 'Unscheduled';

                    if (lastServiced) {
                      const daysSince = Math.floor((new Date().getTime() - new Date(lastServiced).getTime()) / (1000 * 3600 * 24));
                      if (daysSince > 90) {
                        pulseColor = 'bg-error';
                        badgeBg = 'bg-error/10';
                        badgeTextClass = 'text-error';
                        urgencyText = 'Critical';
                      } else if (daysSince > 45) {
                        pulseColor = 'bg-amber-500';
                        badgeBg = 'bg-amber-100';
                        badgeTextClass = 'text-amber-800';
                        urgencyText = 'Upcoming';
                      } else {
                        pulseColor = 'bg-emerald-500';
                        badgeBg = 'bg-emerald-100';
                        badgeTextClass = 'text-emerald-800';
                        urgencyText = 'Healthy';
                      }
                    }

                    return (
                      <div key={idx} className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${asset.type === 'site' ? 'bg-primary-container text-primary' : asset.type === 'equipment' ? 'bg-secondary-container text-secondary' : 'bg-tertiary-container text-tertiary'}`}>
                            {asset.type === 'site' ? <Building2 className="w-5 h-5" /> : asset.type === 'equipment' ? <Wrench className="w-5 h-5"/> : <Settings2 className="w-5 h-5" />}
                          </div>
                          
                          <div className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${badgeBg} ${badgeTextClass}`}>
                            <span className="relative flex h-2 w-2">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColor}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`}></span>
                            </span>
                            {urgencyText}
                          </div>
                        </div>
                        <h3 className="font-title-md font-bold text-on-surface truncate">{asset.name}</h3>
                        <p className="text-label-sm text-outline capitalize mb-3">
                            {asset.parent ? `${asset.parent} - ` : ''}{asset.type}
                        </p>
                        
                        <div className="mt-auto space-y-1.5 pt-3 border-t border-outline-variant/50">
                          <div className="flex justify-between text-label-sm">
                            <span className="text-on-surface-variant">Linked Inventory</span>
                            <span className={`font-medium truncate pl-2 ${matchedInventory ? 'text-primary' : 'text-outline italic'}`}>
                                {matchedInventory ? `${matchedInventory.currentStock} ${matchedInventory.unit} in stock` : 'Unlinked'}
                            </span>
                          </div>
                          <div className="flex justify-between text-label-sm">
                            <span className="text-on-surface-variant">Last Action</span>
                            <span className="text-on-surface font-medium">
                                {lastServiced ? new Date(lastServiced).toLocaleDateString() : 'No data'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {assets.length === 0 && (
                      <div className="col-span-full py-8 text-center text-on-surface-variant">
                          <Activity className="w-10 h-10 mx-auto text-outline mb-2 opacity-50" />
                          <p className="font-medium">No assets registered</p>
                          <p className="text-sm mt-1">Configure components in Settings.</p>
                      </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: PMS History Timeline */}
            <div className="md:col-span-1">
              <div className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                <div className="p-4 border-b border-outline-variant bg-surface-container-lowest">
                  <h2 className="font-headline-sm text-title-md font-bold text-on-surface flex items-center gap-2">
                    <Clock className="w-5 h-5 text-secondary" />
                    Maintenance History
                  </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Maintenance Trend Chart */}
                  <div className="mb-6 bg-surface-container-lowest border border-outline-variant p-4 rounded-xl shadow-sm">
                    <h3 className="text-label-md font-bold text-on-surface-variant mb-4 uppercase tracking-wider">6-Month Trend</h3>
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dy={10} />
                          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                            itemStyle={{ color: '#0F172A', fontWeight: 500 }}
                            labelStyle={{ color: '#64748B', fontWeight: 600, marginBottom: '2px' }}
                          />
                          <Line type="monotone" dataKey="logs" name="Logs" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 3, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {loadingHistory ? (
                    <div className="py-10 text-center text-on-surface-variant animate-pulse">Loading history...</div>
                  ) : facilityActivities.length > 0 ? (
                    <div className="relative border-l-2 border-outline-variant/50 ml-3 space-y-6 pb-6">
                      {facilityActivities.slice(0, visibleActivities).map((act) => (
                        <div key={act.id} className="relative pl-6">
                          <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${act.status === 'completed' ? 'bg-primary' : 'bg-secondary'}`} />
                          <div className="bg-surface-container-lowest border border-outline-variant p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group">
                            <button 
                              onClick={() => generateActivityPDF(act)}
                              className="absolute top-3 right-3 p-2 bg-surface-container-high hover:bg-primary hover:text-white rounded-full text-on-surface-variant transition-colors opacity-0 group-hover:opacity-100"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <div className="text-[10px] uppercase font-bold text-outline tracking-wider mb-1 pr-10">
                              {new Date(act.date).toLocaleDateString()}
                            </div>
                            <h4 className="font-label-md font-bold text-on-surface mb-0.5">{act.activity}</h4>
                            <p className="text-body-sm text-on-surface-variant line-clamp-2">{act.notes || 'No remarks provided.'}</p>
                            
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-on-surface-variant">
                                <span>{act.siteOrWell || "General Facility"}</span>
                                {act.specificComponent && <span>• {act.specificComponent}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                      {facilityActivities.length > visibleActivities && (
                        <div className="text-center pt-4">
                          <button 
                            onClick={() => setVisibleActivities(v => v + 20)}
                            className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-full transition-colors text-sm font-semibold"
                          >
                            Load More
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-10 flex flex-col items-center text-center text-on-surface-variant">
                      <CalendarCheck className="w-10 h-10 text-outline mb-2 opacity-50" />
                      <p className="font-medium text-sm">No maintenance history</p>
                      <p className="text-xs mt-1">Logs associated with this facility will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-full bg-surface">
        <header className="bg-white border-b border-outline-variant px-4 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="font-headline-md text-headline-sm font-bold text-on-surface mb-1">Facilities</h1>
            <p className="text-body-md text-on-surface-variant">View profiles and assets by facility.</p>
          </div>
        </header>
        
        <div className="p-4 bg-white border-b border-outline-variant sticky top-[73px] z-10 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
                type="text"
                placeholder="Search facilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body-lg"
            />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredFacs.map(f => (
                    <div 
                        key={f.id} 
                        onClick={() => handleSelectFacility(f)}
                        className="bg-white border border-outline-variant p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/40 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-primary-container text-primary rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-title-md font-bold text-on-surface truncate pr-2 group-hover:text-primary transition-colors">{f.name}</h3>
                                <p className="text-label-sm text-outline capitalize mb-1">{f.type === 'plant' ? 'Treatment Plant' : 'Area / System'}</p>
                                
                                <div className="flex items-center gap-1 text-[11px] text-on-surface-variant font-medium mt-2">
                                    <Droplet className="w-3.5 h-3.5" />
                                    {f.sites?.length || 0} Sites registered
                                </div>
                                {f.lastServiced && (
                                    <div className="flex items-center gap-1 text-[11px] text-primary/80 font-medium mt-0.5">
                                        <CalendarCheck className="w-3.5 h-3.5" />
                                        Updated {new Date(f.lastServiced).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                
                {filteredFacs.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center text-center text-on-surface-variant">
                         <Building2 className="w-12 h-12 text-outline mb-3 opacity-50" />
                         <p className="font-bold text-title-md">No facilities found</p>
                         <p className="text-body-sm mt-1 max-w-sm">
                             {searchQuery ? "Try adjusting your search criteria." : "Configure your operational areas and facilities in Settings."}
                         </p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
