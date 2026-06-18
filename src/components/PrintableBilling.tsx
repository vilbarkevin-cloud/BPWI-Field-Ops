import React, { forwardRef } from 'react';

export interface BillingData {
  area: string;
  location: string;
  chargeTo: string;
  dateReported: string;
  pipeSizeMm: number;
  pressurePsi: number;
  timeStarted: string;
  timeEnded: string;
  durationHours: number;
  flowRate: number;
  volume: number;
  waterRate: number;
  waterCost: number;
  materials: { id: string; name: string; quantity: number; unit: string; cost: number; total: number }[];
  materialCost: number;
  laborCost: number;
  totalCost: number;
  remarks: string;
}

export const PrintableBilling = forwardRef<HTMLDivElement, { data: BillingData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white text-black max-w-4xl mx-auto font-sans text-sm printable-billing border border-gray-200 print:border-none my-8">
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Billing Statement</h1>
          <h2 className="text-lg font-semibold text-gray-700">Third-Party Damage / Leak Repair</h2>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">INC-{new Date().getFullYear()}-{Math.floor(Math.random() * 1000).toString().padStart(4, '0')}</p>
          <p className="text-gray-600">Date Generated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8">
        <div><span className="font-bold inline-block w-32">Charge To:</span> {data.chargeTo}</div>
        <div><span className="font-bold inline-block w-32">Date Reported:</span> {data.dateReported}</div>
        <div><span className="font-bold inline-block w-32">Area:</span> {data.area}</div>
        <div><span className="font-bold inline-block w-32">Pipe Size:</span> {data.pipeSizeMm} mm</div>
        <div className="col-span-2"><span className="font-bold inline-block w-32">Location Details:</span> {data.location}</div>
        <div className="col-span-2"><span className="font-bold inline-block w-32">Remarks/Cause:</span> {data.remarks}</div>
      </div>

      <div className="border border-black p-4 mb-8 bg-gray-50 print:bg-transparent print:border-gray-500">
        <h3 className="font-bold text-md mb-2 border-b border-gray-300 pb-1">Water Loss Calculation</h3>
        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <p>Q = μ * A * sqrt(2ΔP/ρ)</p>
            <p>V = Q * t</p>
            <p>A = π(d/2)²</p>
          </div>
          <div className="text-right">
            <p>Total Volume:</p>
            <p className="bg-yellow-300 print:bg-transparent print:border inline-block px-2 py-1 font-bold text-sm border-black">{data.volume.toFixed(2)} cubic meters</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs mt-4">
          <div className="space-y-1">
            <p>Q = rate of discharge (m³/sec)</p>
            <p>μ = discharge coefficient (0.6)</p>
            <p>A = area of leak opening (m²)</p>
            <p>t = total time ({data.durationHours.toFixed(2)} hours)</p>
            <p>h = ave. pressure ({data.pressurePsi} psi)</p>
            <p>d = diameter of damage ({data.pipeSizeMm} mm)</p>
          </div>
          <div className="space-y-1 text-right font-mono font-bold bg-yellow-100 print:bg-transparent p-2 border border-yellow-300 print:border-gray-400">
            <p>{data.flowRate.toFixed(4)} m³/sec</p>
            <p>0.6</p>
            <p>{(Math.PI * Math.pow(data.pipeSizeMm / 1000 / 2, 2)).toFixed(4)} m²</p>
            <p>{(data.durationHours * 3600).toFixed(2)} sec</p>
            <p>{(data.pressurePsi * 6894.76).toFixed(4)} Pa (ΔP)</p>
            <p>{(data.pipeSizeMm / 1000).toFixed(3)} m</p>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse border border-black mb-8">
        <thead>
          <tr className="bg-gray-200 print:bg-gray-100">
            <th className="border border-black p-2 text-left">Items</th>
            <th className="border border-black p-2 text-right w-24">Quantity</th>
            <th className="border border-black p-2 text-center w-16">Unit</th>
            <th className="border border-black p-2 text-right w-32">Cost</th>
            <th className="border border-black p-2 text-right w-32">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2">Water Loss (Rate: Php {data.waterRate.toFixed(2)} / m³)</td>
            <td className="border border-black p-2 text-right">{data.volume.toFixed(2)}</td>
            <td className="border border-black p-2 text-center">m³</td>
            <td className="border border-black p-2 text-right">Php {data.waterRate.toFixed(2)}</td>
            <td className="border border-black p-2 text-right font-mono">Php {data.waterCost.toFixed(2)}</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Labor Cost</td>
            <td className="border border-black p-2 text-right">1</td>
            <td className="border border-black p-2 text-center">lot</td>
            <td className="border border-black p-2 text-right">Php {data.laborCost.toFixed(2)}</td>
            <td className="border border-black p-2 text-right font-mono">Php {data.laborCost.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={5} className="font-bold border border-black p-2 bg-gray-50 print:bg-transparent">Materials ({data.materials.length} items)</td>
          </tr>
          {data.materials.map((m, i) => (
             <tr key={i}>
               <td className="border border-black p-2 pl-6">{m.name}</td>
               <td className="border border-black p-2 text-right">{m.quantity}</td>
               <td className="border border-black p-2 text-center">{m.unit}</td>
               <td className="border border-black p-2 text-right">Php {m.cost.toFixed(2)}</td>
               <td className="border border-black p-2 text-right font-mono">Php {m.total.toFixed(2)}</td>
             </tr>
          ))}
          {data.materials.length === 0 && (
             <tr>
               <td colSpan={5} className="border border-black p-2 text-center italic text-gray-500">No materials recorded</td>
             </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 print:bg-gray-100">
            <td colSpan={4} className="border border-black p-2 text-right font-bold text-lg">Total Cost:</td>
            <td className="border border-black p-2 text-right font-bold font-mono text-lg">Php {data.totalCost.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-16 flex justify-between">
        <div className="w-64 text-center">
          <div className="border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Prepared By</p>
          <p className="text-xs text-gray-500 mt-1">Authorized Personnel</p>
        </div>
        <div className="w-64 text-center">
          <div className="border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Received/Acknowledged By</p>
          <p className="text-xs text-gray-500 mt-1">Signature over Printed Name</p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-billing, .printable-billing * {
            visibility: visible;
          }
          .printable-billing {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}} />
    </div>
  );
});
