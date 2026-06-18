import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, Filter, ArrowUpDown, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minThreshold: number;
  lastUpdated: string;
}

const mockInventory: InventoryItem[] = [
  { id: 'INV-001', name: 'Chlorine Granules', category: 'Chemicals', currentStock: 45.5, unit: 'kg', minThreshold: 50, lastUpdated: '2026-06-14' },
  { id: 'INV-002', name: 'Chlorine Liquid', category: 'Chemicals', currentStock: 120.0, unit: 'liters', minThreshold: 100, lastUpdated: '2026-06-15' },
  { id: 'INV-003', name: 'Water Meter (1/2")', category: 'Hardware', currentStock: 24, unit: 'pcs', minThreshold: 10, lastUpdated: '2026-06-10' },
  { id: 'INV-004', name: 'Teflon Tape', category: 'Supplies', currentStock: 50, unit: 'rolls', minThreshold: 20, lastUpdated: '2026-06-01' },
  { id: 'INV-005', name: 'PVC Pipe 1"', category: 'Hardware', currentStock: 8, unit: 'pcs', minThreshold: 15, lastUpdated: '2026-06-12' },
  { id: 'INV-006', name: 'Pressure Gauge', category: 'Hardware', currentStock: 3, unit: 'pcs', minThreshold: 5, lastUpdated: '2026-06-05' },
];

export function InventoryView({ isOnline = true, currentUid }: { isOnline?: boolean; currentUid?: string | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!currentUid) return;

    const q = query(collection(db, `users/${currentUid}/inventory`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Seed with defaults
        mockInventory.forEach(async (item) => {
          const docRef = doc(db, `users/${currentUid}/inventory`, item.id);
          try {
            await setDoc(docRef, {
              ...item,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            console.error('Failed to seed default inventory item:', e);
          }
        });
      } else {
        const fetchedItems = snapshot.docs.map(docSnap => {
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
    }, (error) => {
      console.error("Inventory listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUid]);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSync = () => {
    if (!isOnline) {
      alert("Cannot sync while offline. Changes will sync automatically when connection is restored.");
      return;
    }
    
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert("Inventory synced successfully!");
    }, 1500);
  };

  return (
    <div className="animate-in pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-display cursor-default text-on-surface">Inventory Management</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Track chemicals, hardware, and supplies across all plants.</p>
        </div>
        <div className="flex gap-3">
          <button 
            className={`btn btn-secondary flex items-center gap-2 ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleSync}
            disabled={!isOnline || isSyncing}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isOnline ? (isSyncing ? 'Syncing...' : 'Sync') : 'Offline'}</span>
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-outline-variant rounded-lg p-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant">Total Items</h3>
            <Package className="w-5 h-5 text-primary" />
          </div>
          <p className="font-display text-[2rem] font-bold text-on-surface">{inventory.length}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-lg p-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant">Low Stock Alerts</h3>
            <AlertCircle className="w-5 h-5 text-error" />
          </div>
          <p className="font-display text-[2rem] font-bold text-error">
            {inventory.filter(i => i.currentStock <= i.minThreshold).length}
          </p>
        </div>
        <div className="md:col-span-2 bg-surface-variant/30 border border-outline-variant rounded-lg p-4 flex flex-col justify-center">
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
                <th className="p-4 font-label-md text-label-md text-on-surface-variant">Item ID</th>
                <th className="p-4 font-label-md text-label-md text-on-surface-variant">Name</th>
                <th className="p-4 font-label-md text-label-md text-on-surface-variant">Category</th>
                <th className="p-4 font-label-md text-label-md text-on-surface-variant">Current Stock</th>
                <th className="p-4 font-label-md text-label-md text-on-surface-variant">Min. Threshold</th>
                <th className="p-4 font-label-md text-label-md text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const isLowStock = item.currentStock <= item.minThreshold;
                return (
                  <tr key={item.id} className="border-b border-outline-variant/30 hover:bg-surface-variant/20 transition-colors">
                    <td className="p-4 font-mono text-sm text-on-surface-variant">{item.id}</td>
                    <td className="p-4">
                      <div className="font-body-md font-medium text-on-surface">{item.name}</div>
                      <div className="font-body-sm text-on-surface-variant mt-1 hidden sm:block">Updated: {item.lastUpdated}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-surface-variant/50 rounded text-xs font-medium text-on-surface-variant">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className={"font-body-md font-semibold flex items-center gap-2 " + (isLowStock ? "text-error" : "text-on-surface")}>
                        {isLowStock && <AlertCircle className="w-4 h-4" />}
                        {item.currentStock} {item.unit}
                      </div>
                    </td>
                    <td className="p-4 font-body-md text-on-surface-variant">
                      {item.minThreshold} {item.unit}
                    </td>
                    <td className="p-4 text-right">
                      <button className="btn btn-secondary py-1 px-3 text-sm">Update</button>
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                    No inventory items found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
