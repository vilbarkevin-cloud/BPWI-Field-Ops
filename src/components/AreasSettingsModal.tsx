import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Upload, Download } from "lucide-react";
import { collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import Papa from "papaparse";

interface AreasSettingsModalProps {
  currentUid: string | null;
  onClose: () => void;
}

export function AreasSettingsModal({ currentUid, onClose }: AreasSettingsModalProps) {
  const [areas, setAreas] = useState<{ id: string; name: string; type?: "area" | "plant"; sites: string[]; wellsBySite?: Record<string, string[]>; subCategoriesByWell?: Record<string, string[]> }[]>([]);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaType, setNewAreaType] = useState<"area" | "plant">("area");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [newSiteName, setNewSiteName] = useState("");
  const [newWellNames, setNewWellNames] = useState<Record<string, string>>({});
  const [newSubCategoryNames, setNewSubCategoryNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentUid) return;
    const unsub = onSnapshot(collection(db, `users/${currentUid}/areas`), (snap) => {
      setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error(error);
    });
    return () => unsub();
  }, [currentUid]);

  const handleAddArea = async () => {
    if (!newAreaName.trim() || !currentUid) return;
    const ref = doc(collection(db, `users/${currentUid}/areas`));
    await setDoc(ref, { name: newAreaName.trim(), type: newAreaType, sites: [] });
    setNewAreaName("");
    setNewAreaType("area");
  };

  const handleDeleteArea = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUid) return;
    // Removing window.confirm due to iframe limitations
    await deleteDoc(doc(db, `users/${currentUid}/areas`, id));
    if (selectedAreaId === id) setSelectedAreaId(null);
  };

  const handleAddSite = async () => {
    if (!newSiteName.trim() || !currentUid || !selectedAreaId) return;
    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;
    const siteNameToAdd = newSiteName.trim();
    if ((area.sites || []).includes(siteNameToAdd)) {
      alert("This site already exists in the area.");
      return;
    }
    const updatedSites = [...(area.sites || []), siteNameToAdd];
    await updateDoc(doc(db, `users/${currentUid}/areas`, selectedAreaId), { sites: updatedSites });
    setNewSiteName("");
  };

  const handleDeleteSite = async (siteName: string) => {
    if (!currentUid || !selectedAreaId) return;
    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;
    const updatedSites = area.sites.filter(s => s !== siteName);
    await updateDoc(doc(db, `users/${currentUid}/areas`, selectedAreaId), { sites: updatedSites });
  };

  const handleAddWell = async (siteName: string) => {
    if (!currentUid || !selectedAreaId) return;
    const wellName = newWellNames[siteName]?.trim();
    if (!wellName) return;

    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;

    const currentWells = area.wellsBySite?.[siteName] || [];
    if (currentWells.includes(wellName)) {
      alert("This well/equipment already exists in this site/section.");
      return;
    }
    const updatedWells = [...currentWells, wellName];
    
    await setDoc(doc(db, `users/${currentUid}/areas`, selectedAreaId), { 
      wellsBySite: {
        [siteName]: updatedWells
      }
    }, { merge: true });
    setNewWellNames(prev => ({ ...prev, [siteName]: "" }));
  };

  const handleDeleteWell = async (siteName: string, wellName: string) => {
    if (!currentUid || !selectedAreaId) return;
    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;

    const currentWells = area.wellsBySite?.[siteName] || [];
    const updatedWells = currentWells.filter(w => w !== wellName);

    await setDoc(doc(db, `users/${currentUid}/areas`, selectedAreaId), { 
      wellsBySite: {
        [siteName]: updatedWells
      }
    }, { merge: true });
  };

  const handleAddSubCategory = async (siteName: string, wellName: string) => {
    if (!currentUid || !selectedAreaId) return;
    const key = `${siteName}::${wellName}`;
    const subName = newSubCategoryNames[key]?.trim();
    if (!subName) return;

    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;

    const currentSubs = area.subCategoriesByWell?.[key] || [];
    if (currentSubs.includes(subName)) {
      alert("This sub category already exists in this well/equipment.");
      return;
    }
    const updatedSubs = [...currentSubs, subName];
    
    await setDoc(doc(db, `users/${currentUid}/areas`, selectedAreaId), { 
      subCategoriesByWell: {
        [key]: updatedSubs
      }
    }, { merge: true });
    setNewSubCategoryNames(prev => ({ ...prev, [key]: "" }));
  };

  const handleDeleteSubCategory = async (siteName: string, wellName: string, subName: string) => {
    if (!currentUid || !selectedAreaId) return;
    const key = `${siteName}::${wellName}`;
    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;

    const currentSubs = area.subCategoriesByWell?.[key] || [];
    const updatedSubs = currentSubs.filter(s => s !== subName);

    await setDoc(doc(db, `users/${currentUid}/areas`, selectedAreaId), { 
      subCategoriesByWell: {
        [key]: updatedSubs
      }
    }, { merge: true });
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUid) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          const areaMap = new Map<string, { sites: Set<string>, wellsBySite: Record<string, Set<string>>, subCategoriesByWell: Record<string, Set<string>> }>();

          results.data.forEach((row: any) => {
            const areaName = row["Area"]?.trim();
            const siteName = row["Site"]?.trim() || row["Village"]?.trim() || row["Phase"]?.trim() || row["Pump House"]?.trim();
            const wellName = row["Well"]?.trim() || row["Tank"]?.trim() || row["Equipment"]?.trim();
            const subCategory = row["Sub Category"]?.trim() || row["Component"]?.trim() || row["Parameter"]?.trim();
            
            if (areaName) {
              if (!areaMap.has(areaName)) {
                areaMap.set(areaName, { sites: new Set(), wellsBySite: {}, subCategoriesByWell: {} });
              }
              const areaData = areaMap.get(areaName)!;
              
              if (siteName) {
                areaData.sites.add(siteName);
                if (wellName) {
                  if (!areaData.wellsBySite[siteName]) {
                    areaData.wellsBySite[siteName] = new Set();
                  }
                  areaData.wellsBySite[siteName].add(wellName);
                  if (subCategory) {
                    const subKey = `${siteName}::${wellName}`;
                    if (!areaData.subCategoriesByWell[subKey]) {
                      areaData.subCategoriesByWell[subKey] = new Set();
                    }
                    areaData.subCategoriesByWell[subKey].add(subCategory);
                  }
                }
              }
            }
          });

          areaMap.forEach((data, areaName) => {
            const existing = areas.find(a => a.name.toLowerCase() === areaName.toLowerCase());
            const sitesArray = Array.from(data.sites);
            
            const wellsBySiteObj: Record<string, string[]> = {};
            for (const [site, wells] of Object.entries(data.wellsBySite)) {
               wellsBySiteObj[site] = Array.from(wells);
            }

            const subCategoriesObj: Record<string, string[]> = {};
            for (const [key, subs] of Object.entries(data.subCategoriesByWell)) {
               subCategoriesObj[key] = Array.from(subs);
            }

            if (existing) {
               const combinedSites = Array.from(new Set([...(existing.sites || []), ...sitesArray]));
               const combinedWells = { ...(existing.wellsBySite || {}) };
               
               for (const [site, wells] of Object.entries(wellsBySiteObj)) {
                 combinedWells[site] = Array.from(new Set([...(combinedWells[site] || []), ...wells]));
               }

               const combinedSubs = { ...(existing.subCategoriesByWell || {}) };
               for (const [key, subs] of Object.entries(subCategoriesObj)) {
                 combinedSubs[key] = Array.from(new Set([...(combinedSubs[key] || []), ...subs]));
               }

               const ref = doc(db, `users/${currentUid!}/areas`, existing.id);
               batch.update(ref, { sites: combinedSites, wellsBySite: combinedWells, subCategoriesByWell: combinedSubs });
            } else {
               const ref = doc(collection(db, `users/${currentUid!}/areas`));
               batch.set(ref, { name: areaName, sites: sitesArray, wellsBySite: wellsBySiteObj, subCategoriesByWell: subCategoriesObj });
            }
          });

          await batch.commit();
          alert("Bulk import successful!");
        } catch (error) {
          console.error("Import error:", error);
          alert("Import failed. Please ensure CSV has 'Area', 'Site', and optionally 'Well' headers.");
        }
      }
    });
  };

  const handleExportCSV = () => {
    let csvContent = "Area,Site,Block & Lots / Wells / Tanks / Pumphouse or Plant,Sub Category\n";
    areas.forEach(area => {
      if (!area.sites || area.sites.length === 0) {
        csvContent += `"${area.name}","","",""\n`;
      } else {
        area.sites.forEach(site => {
          const wells = area.wellsBySite?.[site] || [];
          if (wells.length === 0) {
            csvContent += `"${area.name}","${site}","",""\n`;
          } else {
            wells.forEach(well => {
              const subKey = `${site}::${well}`;
              const subCategories = area.subCategoriesByWell?.[subKey] || [];
              if (subCategories.length === 0) {
                csvContent += `"${area.name}","${site}","${well}",""\n`;
              } else {
                subCategories.forEach(sub => {
                  csvContent += `"${area.name}","${site}","${well}","${sub}"\n`;
                });
              }
            });
          }
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "areas_sites_wells.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in">
      <div className="bg-surface w-full max-w-4xl rounded-xl md:rounded-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-4 md:p-6 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-title-lg font-bold text-on-surface">Manage Areas & Sites</h2>
            <p className="text-body-sm text-on-surface-variant">Create areas and assign standard sites/villages to them.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* Areas Sidebar */}
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-outline-variant flex flex-col bg-surface-container-lowest shrink-0 md:shrink md:overflow-hidden">
            <div className="p-4 border-b border-outline-variant space-y-3 shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <select
                    value={newAreaType}
                    onChange={e => setNewAreaType(e.target.value as "area" | "plant")}
                    className="form-input w-full py-1.5 px-3 text-sm h-9 border border-outline-variant rounded-md bg-surface shrink-0"
                  >
                    <option value="area">Area</option>
                    <option value="plant">Plant</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full">
                  <input 
                    type="text" 
                    value={newAreaName}
                    onChange={e => setNewAreaName(e.target.value)}
                    placeholder={newAreaType === "area" ? "New Area Name..." : "New Plant Name..."}
                    className="form-input flex-1 min-w-[100px] py-1.5 px-3 text-sm h-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddArea()}
                  />
                  <button 
                    onClick={handleAddArea}
                    disabled={!newAreaName.trim()}
                    className="flex text-sm h-9 w-9 items-center justify-center bg-primary text-white font-[900] rounded-md shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    title="Add"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <label className="btn-secondary h-9 flex items-center justify-center px-4 text-xs font-semibold cursor-pointer shrink-0">
                    <Upload className="w-4 h-4 mr-1.5" />
                    Import
                    <input type="file" accept=".csv" className="hidden" onChange={handleBulkImport} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-none md:flex-1 overflow-visible md:overflow-y-auto p-2 space-y-1">
              {areas.map(area => (
                <div 
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`flex flex-col p-3 rounded-xl cursor-pointer transition-colors group ${selectedAreaId === area.id ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className={`truncate ${selectedAreaId === area.id ? 'font-bold' : ''}`}>{area.name}</span>
                      {area.type === 'plant' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-secondary/10 text-secondary text-[10px] uppercase font-bold tracking-wider shrink-0">Plant</span>
                      )}
                    </div>
                    <button onClick={(e) => handleDeleteArea(area.id, e)} className="p-1.5 hover:bg-error/10 text-on-surface-variant hover:text-error rounded-md opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                  {(area as any).lastServiced && (
                    <span className="text-[11px] text-primary/80 mt-1">Last Serviced: {new Date((area as any).lastServiced).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
              {areas.length === 0 && (
                <div className="p-4 text-center text-sm text-on-surface-variant italic">No areas defined yet.</div>
              )}
            </div>
          </div>

          {/* Sites Content */}
          <div className="flex-1 flex flex-col bg-surface md:overflow-hidden shrink-0">
            {selectedAreaId ? (
              (() => {
                const selectedAreaObj = areas.find(a => a.id === selectedAreaId);
                const isPlant = selectedAreaObj?.type === 'plant';
                
                const parentLabel = isPlant ? 'Facilities / Sections' : 'Sites';
                const itemPlaceholder = isPlant ? 'Add facility/section...' : 'Add specific site, village, or phase...';
                const emptyItemName = isPlant ? 'sections' : 'sites';

                return (
                  <>
                    <div className="p-6 border-b border-outline-variant bg-surface-container-lowest shrink-0">
                      <h3 className="text-title-md font-bold text-on-surface mb-4">
                        {parentLabel} for {selectedAreaObj?.name}
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <input 
                            type="text" 
                            value={newSiteName}
                            onChange={e => setNewSiteName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                            placeholder={itemPlaceholder} 
                            className="form-input w-full"
                          />
                        </div>
                        <button 
                          onClick={handleAddSite}
                          disabled={!newSiteName.trim()}
                          className="flex items-center justify-center bg-primary text-white font-medium rounded-md px-6 py-2 shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors whitespace-nowrap"
                        >
                          Add {isPlant ? 'Section' : 'Site'}
                        </button>
                      </div>
                    </div>

                <div className="flex-none md:flex-1 overflow-visible md:overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {areas.find(a => a.id === selectedAreaId)?.sites?.map((site, index) => {
                      const area = areas.find(a => a.id === selectedAreaId);
                      const wells = area?.wellsBySite?.[site] || [];
                      const isPlant = area?.type === 'plant';
                      const childPlaceholder = isPlant ? 'Add equipment/unit...' : 'Add pump house/well...';
                      const subPlaceholder = isPlant ? 'Add component/part...' : 'Add sub-category...';
                      const lastServicedSite = (area as any)?.lastServicedByFacility?.[site];
                      return (
                        <div key={`${site}-${index}`} className="flex flex-col p-3 border border-outline-variant bg-surface-container-lowest rounded-xl group hover:border-primary/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-body-md font-medium text-on-surface truncate">{site}</span>
                              {lastServicedSite && (
                                <span className="text-[10px] text-primary/80">Last Serviced: {new Date(lastServicedSite).toLocaleDateString()}</span>
                              )}
                            </div>
                            <button onClick={() => handleDeleteSite(site)} className="p-1.5 hover:bg-error/10 text-on-surface-variant hover:text-error rounded-md transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                          
                          <div className="mt-3 pl-3 border-l-2 border-outline-variant/50 space-y-2">
                              {wells.map((well, wellIndex) => {
                                const subKey = `${site}::${well}`;
                                const subCategories = area?.subCategoriesByWell?.[subKey] || [];
                                const lastServicedWell = (area as any)?.lastServicedByFacility?.[subKey];
                                return (
                                <div key={`${well}-${wellIndex}`} className="flex flex-col text-sm bg-white border border-outline-variant/60 rounded-lg group/well shadow-sm overflow-hidden mb-2">
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-surface hover:bg-surface-container-low transition-colors">
                                    <div className="flex flex-col flex-1 pr-2">
                                      <span className="text-on-surface font-medium truncate">{well}</span>
                                      {lastServicedWell && (
                                        <span className="text-[9px] text-primary/80">Last Serviced: {new Date(lastServicedWell).toLocaleDateString()}</span>
                                      )}
                                    </div>
                                    <button onClick={() => handleDeleteWell(site, well)} className="p-1.5 hover:bg-error/10 text-on-surface-variant hover:text-error rounded-md transition-colors opacity-100 sm:opacity-0 sm:group-hover/well:opacity-100 sm:focus:opacity-100">
                                      <Trash2 className="w-3.5 h-3.5"/>
                                    </button>
                                  </div>
                                  <div className="p-2 pt-0 pl-4 space-y-1">
                                    {subCategories.map((sub, subIndex) => (
                                      <div key={`${sub}-${subIndex}`} className="flex items-center justify-between text-xs py-1 px-2 hover:bg-surface-container-low rounded-md group/sub">
                                        <span className="text-on-surface-variant truncate border-l-2 border-outline-variant/40 pl-2">{sub}</span>
                                        <button onClick={() => handleDeleteSubCategory(site, well, sub)} className="p-1 text-on-surface-variant hover:text-error rounded transition-colors opacity-0 group-hover/sub:opacity-100 focus:opacity-100">
                                          <Trash2 className="w-3 h-3"/>
                                        </button>
                                      </div>
                                    ))}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 mt-1 border-l-2 border-outline-variant/40 pl-2">
                                        <input 
                                        type="text" 
                                        placeholder={subPlaceholder}
                                        value={newSubCategoryNames[subKey] || ""}
                                        onChange={e => setNewSubCategoryNames(prev => ({ ...prev, [subKey]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubCategory(site, well)}
                                        className="form-input flex-1 min-w-0 py-0.5 px-2 text-[11px] h-6"
                                      />
                                      <button 
                                        onClick={() => handleAddSubCategory(site, well)}
                                        disabled={!newSubCategoryNames[subKey]?.trim()}
                                        className="flex text-[11px] h-6 items-center justify-center bg-secondary text-white font-medium rounded px-2 hover:bg-secondary/90 disabled:opacity-50 transition-colors shrink-0"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )})}
                              <div className="flex items-center gap-2 mt-2 w-full">
                                <div className="flex-1 min-w-0">
                                  <input 
                                    type="text" 
                                    placeholder={childPlaceholder} 
                                    value={newWellNames[site] || ""}
                                    onChange={e => setNewWellNames(prev => ({ ...prev, [site]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddWell(site)}
                                    className="form-input w-full min-w-[80px] py-1 px-2 text-xs h-8"
                                  />
                                </div>
                                <button 
                                  onClick={() => handleAddWell(site)}
                                  disabled={!newWellNames[site]?.trim()}
                                  className="flex items-center justify-center bg-primary text-white font-medium rounded-md px-3 py-1 shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors text-xs h-8"
                                  title={isPlant ? "Add Equipment" : "Add Pump House/Well"}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                        </div>
                      );
                    })}
                  </div>
                  {(!areas.find(a => a.id === selectedAreaId)?.sites || areas.find(a => a.id === selectedAreaId)?.sites.length === 0) && (
                    <div className="text-center p-12 text-on-surface-variant flex flex-col items-center">
                       <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                         <Plus className="w-8 h-8 text-outline" />
                       </div>
                        <p>No {emptyItemName} configured for this {isPlant ? 'plant' : 'area'}.</p>
                       <p className="text-sm mt-1">Add {emptyItemName} above to appear in the dropdowns.</p>
                    </div>
                  )}
                </div>
              </>
              );
            })() 
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant flex-col p-8 text-center bg-surface-container-lowest/50">
                 <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 border border-outline-variant/50">
                    <X className="w-8 h-8 text-outline" />
                 </div>
                 <p className="text-title-md font-medium text-on-surface mb-2">Select an Area or Plant</p>
                 <p className="text-body-sm max-w-xs">Click an item on the left to manage its associated sites, facilities, or units.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
