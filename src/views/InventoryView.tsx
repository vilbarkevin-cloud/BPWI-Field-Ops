import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  AlertCircle,
  RefreshCw,
  X,
  Camera,
} from "lucide-react";
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  serverTimestamp,
} from "firebase/firestore";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minThreshold: number;
  lastUpdated: string;
}

const mockInventory: InventoryItem[] = [];

export function InventoryView({
  isOnline = true,
  currentUid,
  setActiveTab,
  globalSearchQuery = "",
}: {
  isOnline?: boolean;
  currentUid?: string | null;
  setActiveTab?: any;
  globalSearchQuery?: string;
}) {
  const [searchTerm, setSearchTerm] = useState(globalSearchQuery);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setSearchTerm(globalSearchQuery);
    setVisibleCount(20);
  }, [globalSearchQuery]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [baseName, setBaseName] = useState("");
  const [dim1, setDim1] = useState("");
  const [dim2, setDim2] = useState("");
  const [dimUnit, setDimUnit] = useState("");
  const [category, setCategory] = useState("Hardware");
  const [currentStock, setCurrentStock] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [minThreshold, setMinThreshold] = useState("");

  useEffect(() => {
    if (!currentUid) return;

    const q = query(collection(db, `users/${currentUid}/inventory`));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          // Seed with defaults
          mockInventory.forEach(async (item) => {
            const docRef = doc(db, `users/${currentUid}/inventory`, item.id);
            try {
              await setDoc(docRef, {
                ...item,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (e) {
              console.error("Failed to seed default inventory item:", e);
            }
          });
        } else {
          const fetchedItems = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name,
              category: data.category,
              currentStock: data.currentStock,
              unit: data.unit,
              minThreshold: data.minThreshold,
              lastUpdated: data.lastUpdated,
            } as InventoryItem;
          });
          setInventory(fetchedItems);
        }
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
        console.error("Inventory listener error:", error);
      },
    );

    return () => unsubscribe();
  }, [currentUid]);

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSync = () => {
    if (!isOnline) {
      alert(
        "Cannot sync while offline. Changes will sync automatically when connection is restored.",
      );
      return;
    }

    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert("Inventory synced successfully!");
    }, 1500);
  };

  const parseDimension = (d: string): number => {
    if (d.includes("/")) {
      const [num, den] = d.split("/");
      if (den && !isNaN(Number(num)) && !isNaN(Number(den))) {
        return Number(num) / Number(den);
      }
    }
    return Number(d) || 0;
  };

  const toTitleCase = (str: string) => {
    return str.replace(
      /\w\S*/g,
      (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    ).replace(/\b(Gi|Pvc|Hdpe|Upvc)\b/ig, (match) => match.toUpperCase());
  };

  const getStandardizedName = () => {
    const dims = [dim1.trim(), dim2.trim()].filter(Boolean);
    dims.sort((a, b) => parseDimension(a) - parseDimension(b));
    let base = toTitleCase(baseName.trim());
    let nameString = base;
    if (dims.length > 0) {
      let unitStr = dimUnit.trim() === 'None' ? '' : dimUnit;
      // Strip leading space if any, standardizing space
      unitStr = unitStr.trim() === '' ? '' : unitStr.startsWith(' ') ? unitStr : (unitStr === '"' ? '"' : ` ${unitStr}`);
      const dimString = dims.join("x") + (dimUnit === '"' ? '"' : unitStr);
      nameString = `${base} ${dimString}`.trim();
    }
    return nameString;
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid) return;

    const stdName = getStandardizedName();
    if (!stdName) return;

    try {
      const newItemId = `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      const docRef = doc(db, `users/${currentUid}/inventory`, newItemId);
      
      const newInvItem: any = {
        id: newItemId,
        name: stdName,
        category,
        currentStock: Number(currentStock) || 0,
        unit,
        minThreshold: Number(minThreshold) || 0,
        lastUpdated: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(docRef, newInvItem);
      
      setIsModalOpen(false);
      setBaseName("");
      setDim1("");
      setDim2("");
      setDimUnit("");
      setCurrentStock("");
      setMinThreshold("");
    } catch (error) {
      console.error("Failed to add inventory item", error);
      alert("Failed to add item.");
    }
  };

  return (
    <>
      <div className="animate-in pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-2.5">
          <div>
            <h1 className="font-display text-display cursor-default text-on-surface">
              Inventory Management
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Track chemicals, hardware, and supplies across all plants.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className={`btn btn-secondary flex items-center gap-2 ${!isOnline ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={handleSync}
              disabled={!isOnline || isSyncing}
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {isOnline ? (isSyncing ? "Syncing..." : "Sync") : "Offline"}
              </span>
            </button>
            <button 
              className="btn btn-primary flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 mb-6">
        <div className="bg-surface border border-outline-variant rounded-lg p-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant">
              Total Items
            </h3>
            <Package className="w-5 h-5 text-primary" />
          </div>
          <p className="font-display text-[2rem] font-bold text-on-surface">
            {inventory.length}
          </p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-lg p-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant">
              Low Stock Alerts
            </h3>
            <AlertCircle className="w-5 h-5 text-error" />
          </div>
          <p className="font-display text-[2rem] font-bold text-error">
            {inventory.filter((i) => i.currentStock <= i.minThreshold).length}
          </p>
        </div>
        <div className="md:col-span-2 bg-surface-variant/30 border border-outline-variant rounded-lg p-2.5 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search items, categories or IDs..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-body-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              className="btn btn-secondary bg-white flex items-center gap-2 justify-center"
              onClick={() => {
                const scannerDiv = document.createElement("div");
                scannerDiv.id = "scanner-container";
                scannerDiv.style.position = "fixed";
                scannerDiv.style.top = "0";
                scannerDiv.style.left = "0";
                scannerDiv.style.width = "100%";
                scannerDiv.style.height = "100%";
                scannerDiv.style.backgroundColor = "rgba(0,0,0,0.8)";
                scannerDiv.style.zIndex = "9999";
                scannerDiv.style.display = "flex";
                scannerDiv.style.flexDirection = "column";
                scannerDiv.style.alignItems = "center";
                scannerDiv.style.justifyContent = "center";
                
                const closeBtn = document.createElement("button");
                closeBtn.innerText = "Close Scanner";
                closeBtn.style.padding = "10px 20px";
                closeBtn.style.marginBottom = "20px";
                closeBtn.style.backgroundColor = "#fff";
                closeBtn.style.borderRadius = "8px";
                
                const reader = document.createElement("div");
                reader.id = "reader";
                reader.style.width = "300px";
                reader.style.backgroundColor = "#fff";
                
                scannerDiv.appendChild(closeBtn);
                scannerDiv.appendChild(reader);
                document.body.appendChild(scannerDiv);
                
                import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
                  const scanner = new Html5QrcodeScanner("reader", { qrbox: { width: 250, height: 250 }, fps: 5 }, false);
                  
                  closeBtn.onclick = () => {
                    scanner.clear().then(() => scannerDiv.remove()).catch(() => scannerDiv.remove());
                  };
                  
                  scanner.render((decodedText) => {
                    setSearchTerm(decodedText);
                    scanner.clear().then(() => scannerDiv.remove()).catch(() => scannerDiv.remove());
                  }, () => {});
                });
              }}
            >
              <Camera className="w-4 h-4" />
              <span>Scan barcode</span>
            </button>
            <button className="btn btn-secondary bg-white flex items-center gap-2 justify-center">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-variant/50 border-b border-outline-variant">
                <th className="p-2.5 font-label-md text-label-md text-on-surface-variant">
                  Item ID
                </th>
                <th className="p-2.5 font-label-md text-label-md text-on-surface-variant">
                  Name
                </th>
                <th className="p-2.5 font-label-md text-label-md text-on-surface-variant">
                  Category
                </th>
                <th className="p-2.5 font-label-md text-label-md text-on-surface-variant">
                  Current Stock
                </th>
                <th className="p-2.5 font-label-md text-label-md text-on-surface-variant">
                  Min. Threshold
                </th>
                <th className="p-2.5 font-label-md text-label-md text-on-surface-variant text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.slice(0, visibleCount).map((item) => {
                const isLowStock = item.currentStock <= item.minThreshold;
                return (
                  <tr
                    key={item.id}
                    className="border-b border-outline-variant/30 hover:bg-surface-variant/20 transition-colors"
                  >
                    <td className="p-2.5 font-mono text-xs text-on-surface-variant">
                      {item.id}
                    </td>
                    <td className="p-2.5">
                      <div className="text-xs font-semibold text-on-surface">
                        {item.name}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1 hidden sm:block">
                        Updated: {item.lastUpdated}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-1 bg-surface-variant/50 rounded text-xs font-medium text-on-surface-variant">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div
                        className={
                          "text-xs font-semibold flex items-center gap-2 " +
                          (isLowStock ? "text-error" : "text-on-surface")
                        }
                      >
                        {isLowStock && <AlertCircle className="w-4 h-4" />}
                        {item.currentStock} {item.unit}
                      </div>
                    </td>
                    <td className="p-2.5 text-xs text-on-surface-variant">
                      {item.minThreshold} {item.unit}
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        className={`btn ${isLowStock ? "btn-danger" : "btn-secondary"} py-1 px-3 text-sm`}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-on-surface-variant"
                  >
                    No inventory items found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredInventory.length > visibleCount && (
            <div className="text-center p-4 border-t border-outline-variant">
              <button 
                onClick={() => setVisibleCount(v => v + 20)}
                className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-full transition-colors text-sm font-semibold"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleAddItem} className="bg-surface rounded-xl shadow-2xl w-full max-w-[500px] sm:min-w-[400px] flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest shrink-0">
              <h2 className="font-display text-title-lg font-bold text-on-surface">Add Inventory Item</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 mb-2">
                <p className="text-sm text-on-surface-variant mb-1 font-medium">Standardized Name Preview:</p>
                <p className="text-lg font-bold text-primary tracking-wide">
                  {getStandardizedName() || "Start typing..."}
                </p>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-sm font-semibold text-on-surface-variant">Base Name <span className="text-error">*</span></label>
                    <input
                      type="text"
                      required
                      value={baseName}
                      onChange={(e) => setBaseName(e.target.value)}
                      placeholder="e.g. GI Pipe, Water Meter, Chlorine"
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-on-surface-variant">Generic specific name without dimensions.</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-on-surface-variant">Dimension 1 (Optional)</label>
                    <input
                      type="text"
                      value={dim1}
                      onChange={(e) => setDim1(e.target.value)}
                      placeholder="e.g. 3/4, 2, 1.5"
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-on-surface-variant">Dimension 2 (Optional)</label>
                    <input
                      type="text"
                      value={dim2}
                      onChange={(e) => setDim2(e.target.value)}
                      placeholder="e.g. 2, 1/2"
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-sm font-semibold text-on-surface-variant">Dimension Unit (If dimensions present)</label>
                    <select
                      value={dimUnit}
                      onChange={(e) => setDimUnit(e.target.value)}
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="">None</option>
                      <option value='"'>Inches (")</option>
                      <option value=" mm">Millimeters (mm)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-outline-variant">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-on-surface-variant">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="Hardware">Hardware</option>
                      <option value="Chemicals">Chemicals</option>
                      <option value="Supplies">Supplies</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-on-surface-variant">Stock Unit</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="rolls">Rolls</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="liters">Liters</option>
                      <option value="boxes">Boxes</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-on-surface-variant">Current Stock</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      placeholder="0"
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-on-surface-variant">Min. Threshold</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={minThreshold}
                      onChange={(e) => setMinThreshold(e.target.value)}
                      placeholder="0"
                      className="p-2.5 bg-surface-container-lowest border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

            <div className="p-4 border-t border-outline-variant bg-surface shrink-0 flex gap-3 justify-end items-center">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-on-surface-variant border border-outline-variant hover:bg-surface-variant transition-colors"
                >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!baseName.trim() || !currentStock || !minThreshold}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
              >
                Add Item
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}
