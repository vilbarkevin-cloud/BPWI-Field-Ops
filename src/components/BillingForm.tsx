import React, { useState, useRef, useMemo, useEffect } from "react";
import { PrintableBilling, BillingData } from "./PrintableBilling";
import { Camera, Map, Printer, Plus, Trash } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

export function BillingForm({ currentUid }: { currentUid?: string | null }) {
  const [formData, setFormData] = useState({
    area: "",
    location: "",
    chargeTo: "",
    dateReported: new Date().toISOString().split("T")[0],
    pipeSizeMm: 50,
    pressurePsi: 25,
    timeStarted: "08:00",
    timeEnded: "14:00",
    waterRate: 94.816,
    laborCost: 1000,
    remarks: "Cause: Hit by Car",
  });

  const [usedMaterials, setUsedMaterials] = useState<
    { inventoryId: string; quantity: number }[]
  >([]);
  const [inventoryItems, setInventoryItems] = useState<
    {
      id: string;
      name: string;
      unit: string;
      currentStock: number;
      cost: number;
    }[]
  >([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const draftStr = localStorage.getItem("billingDraft");
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.formData) {
          setFormData(prev => ({ ...prev, ...draft.formData }));
        }
        if (draft.materials) {
          setUsedMaterials(draft.materials);
        }
        localStorage.removeItem("billingDraft");
      } catch (e) {
        console.error("Failed to parse billing draft:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/inventory`));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedItems = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name,
            unit: data.unit,
            currentStock: data.currentStock,
            cost: data.cost || Math.floor(Math.random() * 500) + 50, // Mocking cost if it doesn't exist
          };
        });
        if (fetchedItems.length > 0) {
          setInventoryItems(fetchedItems);
        }
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
        console.error("Inventory listener error:", error);
      },
    );

    return () => unsubscribe();
  }, [currentUid]);

  // Fallback to mock data if empty
  const availableMaterials =
    inventoryItems.length > 0
      ? inventoryItems
      : [
          {
            id: "INV-101",
            name: 'Gibault 2"',
            unit: "pcs",
            currentStock: 50,
            cost: 1260.0,
          },
          {
            id: "INV-102",
            name: 'PVC Pipe 2"',
            unit: "m",
            currentStock: 200,
            cost: 250.0,
          },
          {
            id: "INV-103",
            name: "Teflon Tape",
            unit: "rolls",
            currentStock: 100,
            cost: 25.0,
          },
          {
            id: "INV-104",
            name: "Solvent Cement 1/4L",
            unit: "cans",
            currentStock: 30,
            cost: 150.0,
          },
          {
            id: "INV-105",
            name: 'Union Patente 2"',
            unit: "pcs",
            currentStock: 20,
            cost: 350.0,
          },
          {
            id: "INV-106",
            name: 'Gate Valve 2"',
            unit: "pcs",
            currentStock: 15,
            cost: 1800.0,
          },
        ];

  const calculateBillingData = (): BillingData => {
    // Volume Calculation
    const d_m = formData.pipeSizeMm / 1000;
    const A = Math.PI * Math.pow(d_m / 2, 2);
    const P_pa = formData.pressurePsi * 6894.76;
    const u = 0.6;
    const rho = 1000;
    const Q = u * A * Math.sqrt((2 * P_pa) / rho); // m3/sec

    const [startH, startM] = formData.timeStarted.split(":").map(Number);
    const [endH, endM] = formData.timeEnded.split(":").map(Number);

    let durationHours = endH + endM / 60 - (startH + startM / 60);
    if (durationHours < 0) durationHours += 24; // Handle passing midnight, roughly

    const durationSecs = durationHours * 3600;
    const volume = Q * durationSecs;
    const waterCost = volume * formData.waterRate;

    // Materials Calculation
    const materialsList = usedMaterials
      .map((um) => {
        const item = availableMaterials.find((m) => m.id === um.inventoryId);
        if (!item)
          return {
            id: "",
            name: "Unknown",
            quantity: 0,
            unit: "",
            cost: 0,
            total: 0,
          };
        return {
          id: item.id,
          name: item.name,
          quantity: um.quantity,
          unit: item.unit,
          cost: item.cost,
          total: item.cost * um.quantity,
        };
      })
      .filter((m) => m.id !== "");

    const materialCost = materialsList.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    const totalCost = waterCost + materialCost + formData.laborCost;

    return {
      ...formData,
      durationHours,
      flowRate: Q,
      volume,
      waterCost,
      materials: materialsList,
      materialCost,
      totalCost,
    };
  };

  const currentData = useMemo(
    () => calculateBillingData(),
    [formData, usedMaterials],
  );

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ["pipeSizeMm", "pressurePsi", "waterRate", "laborCost"].includes(
        name,
      )
        ? Number(value) || 0
        : value,
    }));
  };

  const addMaterial = () => {
    if (availableMaterials.length > 0) {
      setUsedMaterials([
        ...usedMaterials,
        { inventoryId: availableMaterials[0].id, quantity: 1 },
      ]);
    }
  };

  const updateMaterial = (index: number, field: string, value: any) => {
    const newM = [...usedMaterials];
    newM[index] = { ...newM[index], [field]: value };
    setUsedMaterials(newM);
  };

  const removeMaterial = (index: number) => {
    const newM = [...usedMaterials];
    newM.splice(index, 1);
    setUsedMaterials(newM);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-lg print:m-0">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm print:hidden">
        <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="font-label-md text-label-md uppercase tracking-wider text-outline">
            Third-Party Damage Billing Form
          </h3>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Cost Recovery
          </span>
        </div>

        <div className="p-lg grid grid-cols-1 md:grid-cols-2 gap-lg">
          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Charge To / Responsible Party *
            </label>
            <input
              name="chargeTo"
              value={formData.chargeTo}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
              placeholder="e.g. Blk 20 Lot 25 / 8990 Contractor"
            />
          </div>
          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Date Reported
            </label>
            <input
              type="date"
              name="dateReported"
              value={formData.dateReported}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
            />
          </div>

          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Area / Project Site
            </label>
            <input
              name="area"
              value={formData.area}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
              placeholder="e.g. LEG"
            />
          </div>
          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Exact Location / Coordinates
            </label>
            <input
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
              placeholder="e.g. Blk 2 Lot 157 Site 2"
            />
          </div>

          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Pipe Size (mm)
            </label>
            <input
              type="number"
              name="pipeSizeMm"
              value={formData.pipeSizeMm}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
            />
          </div>
          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Average Pressure (psi)
            </label>
            <input
              type="number"
              name="pressurePsi"
              value={formData.pressurePsi}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
            />
          </div>

          <div className="space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Time Started (Leak)
            </label>
            <input
              type="time"
              name="timeStarted"
              value={formData.timeStarted}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
            />
          </div>
          <div className="space-y-sm">
            <label
              className="font-label-md text-label-md text-on-surface-variant"
              title="Time when water flow was stopped (e.g., valve shut off), not necessarily the repair completion time."
            >
              Time Leak Stopped (Valve Isolated)
            </label>
            <input
              type="time"
              name="timeEnded"
              value={formData.timeEnded}
              onChange={handleChange}
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
            />
          </div>

          <div className="space-y-sm md:col-span-2">
            <div className="p-4 bg-tertiary-container/30 border border-tertiary-container rounded-lg grid grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <div>
                <label className="font-label-sm text-on-surface-variant text-xs mb-1 block">
                  Calculated Volume
                </label>
                <div className="font-display-sm text-xl font-bold">
                  {currentData.volume.toFixed(2)} m³
                </div>
              </div>
              <div>
                <label className="font-label-sm text-on-surface-variant text-xs mb-1 block">
                  Water Rate (Php/m³)
                </label>
                <input
                  type="number"
                  name="waterRate"
                  value={formData.waterRate}
                  onChange={handleChange}
                  className="w-full bg-white border border-outline-variant rounded p-1 text-sm outline-none"
                />
              </div>
              <div>
                <label className="font-label-sm text-on-surface-variant text-xs mb-1 block">
                  Labor Cost (Php)
                </label>
                <input
                  type="number"
                  name="laborCost"
                  value={formData.laborCost}
                  onChange={handleChange}
                  className="w-full bg-white border border-outline-variant rounded p-1 text-sm outline-none"
                />
              </div>
              <div className="text-right">
                <label className="font-label-sm text-on-surface-variant text-xs mb-1 block">
                  Water + Labor Subtotal
                </label>
                <div className="font-semibold text-lg text-primary">
                  Php{" "}
                  {(currentData.waterCost + currentData.laborCost).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 mt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Materials Used (from Inventory)
              </label>
              <button
                onClick={addMaterial}
                className="flex items-center gap-1 text-sm text-primary hover:underline font-semibold bg-primary/10 px-3 py-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add Material
              </button>
            </div>

            {usedMaterials.length > 0 ? (
              <div className="space-y-2 border border-outline-variant/50 rounded-lg p-3 bg-surface-container-low/50">
                {usedMaterials.map((um, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap md:flex-nowrap gap-3 items-center bg-white p-2 border border-outline-variant rounded shadow-sm"
                  >
                    <select
                      className="flex-grow bg-surface border border-outline-variant rounded p-2 text-sm outline-none"
                      value={um.inventoryId}
                      onChange={(e) =>
                        updateMaterial(i, "inventoryId", e.target.value)
                      }
                    >
                      {availableMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Php {m.cost.toFixed(2)}/{m.unit})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 w-32 shrink-0">
                      <span className="text-sm">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={um.quantity}
                        onChange={(e) =>
                          updateMaterial(i, "quantity", Number(e.target.value))
                        }
                        className="w-full bg-surface border border-outline-variant rounded p-2 text-sm outline-none"
                      />
                    </div>
                    <div className="w-24 text-right font-medium text-sm hidden md:block">
                      Php{" "}
                      {(availableMaterials.find((m) => m.id === um.inventoryId)
                        ?.cost || 0) * um.quantity}
                    </div>
                    <button
                      onClick={() => removeMaterial(i)}
                      className="p-2 text-error hover:bg-error-container rounded transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-on-surface-variant italic p-4 text-center border border-dashed border-outline-variant rounded-lg">
                No materials added. Click "Add Material" above.
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-sm">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Remarks / Cause
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full h-24 bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none resize-none"
              placeholder="e.g. Mainline was hit with Backhoe of 8990 Contractor..."
            ></textarea>
          </div>

          <div className="md:col-span-2 bg-primary/5 border border-primary/20 rounded-lg p-6 mt-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-primary font-bold uppercase tracking-widest mb-1">
                Total Estimated Cost
              </div>
              <div className="text-3xl font-display font-medium text-on-surface">
                Php{" "}
                {currentData.totalCost.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                Water Loss + Labor + Materials
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="bg-primary text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 hover:bg-primary/90 shadow-md transition-transform active:scale-95"
            >
              <Printer className="w-5 h-5" /> Generate Billing PDF
            </button>
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <PrintableBilling ref={printRef} data={currentData} />
      </div>
    </div>
  );
}
