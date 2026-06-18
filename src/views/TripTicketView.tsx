import React, { useState, useEffect, useRef } from 'react';
import { Car, Plus, Search, Calendar, ChevronDown, Check, X, MapPin, Map, RefreshCw, Trash2, Edit3 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query, serverTimestamp, deleteDoc, collectionGroup, getDoc, updateDoc } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';

export interface TripLeg {
  id: string;
  date: string;
  passengers: string;
  purpose: string;
  departureTimeOffice: string;
  destination: string;
  arrivalTimeDest: string;
  departureTimeDest: string;
  returnTimeOffice: string;
  gasBalance: string;
  gasPurchased: string;
  gasTotal: string;
  speedoBeg: string;
  speedoEnd: string;
  distance: string;
}

export interface TripTicket {
  id: string;
  driver: string;
  vehicle: string;
  date: string;
  legs: TripLeg[];
  checklist: {
    brakes: boolean;
    turnSignals: boolean;
    flashers: boolean;
    wipers: boolean;
    horn: boolean;
    tires: boolean;
    checkEngine: boolean;
    doors: boolean;
    cleanliness: boolean;
    headlights: boolean;
    others: string;
  };
  comments: string;
  signature?: string | null;
  status: 'draft' | 'submitted';
  createdAt?: any;
  updatedAt?: any;
}

const emptyLeg = (): TripLeg => ({
  id: `leg-${Date.now()}`,
  date: new Date().toISOString().split('T')[0],
  passengers: '',
  purpose: '',
  departureTimeOffice: '',
  destination: '',
  arrivalTimeDest: '',
  departureTimeDest: '',
  returnTimeOffice: '',
  gasBalance: '',
  gasPurchased: '',
  gasTotal: '',
  speedoBeg: '',
  speedoEnd: '',
  distance: ''
});

const defaultChecklist = {
  brakes: false,
  turnSignals: false,
  flashers: false,
  wipers: false,
  horn: false,
  tires: false,
  checkEngine: false,
  doors: false,
  cleanliness: false,
  headlights: false,
  others: ''
};

export function TripTicketView({ isOnline = true, currentUid, currentUser }: { isOnline?: boolean; currentUid?: string | null; currentUser?: string | null }) {
  const isAdmin = currentUser?.toLowerCase().includes('kevin vilbar') || currentUser?.toLowerCase().includes('tech head') || currentUser?.toLowerCase().includes('admin');
  const [tickets, setTickets] = useState<TripTicket[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null); // track whose ticket it is
  
  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [savedVehicles, setSavedVehicles] = useState<string[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [legs, setLegs] = useState<TripLeg[]>([emptyLeg()]);
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [comments, setComments] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!currentUid) return;
    // Fetch shared vehicles
    const vq = query(collection(db, 'shared'));
    const unsubV = onSnapshot(vq, (snap) => {
      let v: string[] = [];
      snap.forEach(d => {
        if (d.id === 'vehicles') v = d.data().list || [];
      });
      setSavedVehicles(v);
    }, (error) => {
      console.error("Vehicles listener error:", error);
    });
    return () => unsubV();
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;

    let q;
    if (isAdmin) {
       q = query(collectionGroup(db, 'tripTickets'));
    } else {
       q = query(collection(db, `users/${currentUid}/tripTickets`));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          userId: docSnap.ref.parent.parent?.id,
          ...docSnap.data()
      })) as (TripTicket & {userId: string})[];
      
      // sort by date descending
      fetchedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTickets(fetchedItems);
    }, (err) => {
       console.error("Error fetching trip tickets:", err);
    });

    return () => unsubscribe();
  }, [currentUid, isAdmin]);

  const handleOpenForm = (ticket?: TripTicket & {userId?: string}) => {
    if (ticket) {
      setEditingId(ticket.id);
      setEditingUserId(ticket.userId || currentUid);
      setDriver(ticket.driver || '');
      setVehicle(ticket.vehicle || '');
      setDate(ticket.date || new Date().toISOString().split('T')[0]);
      setLegs(ticket.legs && ticket.legs.length > 0 ? ticket.legs : [emptyLeg()]);
      setChecklist(ticket.checklist || defaultChecklist);
      setComments(ticket.comments || '');
      setSignature(ticket.signature || null);
    } else {
      setEditingId(null);
      setDriver('');
      setVehicle('');
      setDate(new Date().toISOString().split('T')[0]);
      setLegs([emptyLeg()]);
      setChecklist(defaultChecklist);
      setComments('');
      setSignature(null);
    }
    setIsFormOpen(true);
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setSignature(null);
  };

  const handleSave = async () => {
    if (!currentUid) return;
    if (!driver || !vehicle) {
      alert('Driver and Vehicle are required');
      return;
    }

    const targetUserId = editingId && editingUserId ? editingUserId : currentUid;
    const id = editingId || `tt-${Date.now()}`;
    const docRef = doc(db, `users/${targetUserId}/tripTickets`, id);
    
    // Save signature if not empty
    let finalSignature = signature;
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
       finalSignature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    }
    
    const newTicket: any = {
      driver,
      vehicle,
      date,
      legs,
      checklist,
      comments,
      signature: finalSignature,
      status: 'submitted',
      updatedAt: serverTimestamp()
    };

    if (!editingId) {
      newTicket.createdAt = serverTimestamp();
    }

    try {
      await setDoc(docRef, newTicket, { merge: true });
      setIsFormOpen(false);
    } catch (e) {
      console.error('Error saving trip ticket:', e);
      alert('Failed to save trip ticket. Try again.');
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicleType.trim() || !newVehiclePlate.trim()) return;
    const trimmed = `${newVehicleType.trim()} - ${newVehiclePlate.trim()}`;
    if (!savedVehicles.includes(trimmed)) {
      const updated = [...savedVehicles, trimmed];
      try {
        await setDoc(doc(db, 'shared/vehicles'), { list: updated }, { merge: true });
        setVehicle(trimmed);
        setNewVehicleType('');
        setNewVehiclePlate('');
        setIsAddingVehicle(false);
      } catch (err) {
        console.error("Failed to add vehicle:", err);
      }
    } else {
      setVehicle(trimmed);
      setNewVehicleType('');
      setNewVehiclePlate('');
      setIsAddingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (v: string) => {
    if (!isAdmin) return;
    if (window.confirm(`Delete vehicle ${v}?`)) {
      const updated = savedVehicles.filter(sv => sv !== v);
      try {
        await setDoc(doc(db, 'shared/vehicles'), { list: updated }, { merge: true });
        if (vehicle === v) setVehicle('');
      } catch (err) {
        console.error("Failed to delete vehicle:", err);
      }
    }
  };

  const handleDelete = async (id: string, authorId?: string) => {
    if (!currentUid) return;
    if (window.confirm('Are you sure you want to delete this trip ticket?')) {
      const targetUser = isAdmin && authorId ? authorId : currentUid;
      await deleteDoc(doc(db, `users/${targetUser}/tripTickets`, id));
    }
  };

  const addLeg = () => setLegs([...legs, emptyLeg()]);
  
  const updateLeg = (index: number, field: keyof TripLeg, value: string) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], [field]: value };
    setLegs(updated);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 1) {
      setLegs(legs.filter((_, i) => i !== index));
    }
  };

  if (isFormOpen) {
    return (
      <div className="p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-[896px] mx-auto pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline-sm text-on-surface font-bold">
            {editingId ? 'Edit Trip Ticket' : 'New Trip Ticket'}
          </h2>
          <div className="flex items-center gap-2">
            {editingId && isAdmin && (
               <button onClick={() => window.print()} className="btn-secondary px-3 py-1.5 text-sm hide-on-print">
                 Print
               </button>
            )}
            <button 
              onClick={() => setIsFormOpen(false)}
              className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors hide-on-print"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="space-y-6 printable-area">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-on-surface mb-4">General Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-md font-semibold text-on-surface-variant mb-1">Driver</label>
                <input 
                  type="text" 
                  value={driver} 
                  onChange={e => setDriver(e.target.value)} 
                  className="form-input" 
                  placeholder="Driver Name"
                />
              </div>
              <div className="relative">
                <label className="block text-label-md font-semibold text-on-surface-variant mb-1">Vehicle / Plate No.</label>
                {isAddingVehicle ? (
                   <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newVehicleType} 
                          onChange={e => setNewVehicleType(e.target.value)} 
                          className="form-input flex-1" 
                          placeholder="Type (e.g., Boom Truck, Hilux)"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newVehiclePlate} 
                          onChange={e => setNewVehiclePlate(e.target.value)} 
                          className="form-input flex-1" 
                          placeholder="Plate No."
                        />
                        <button onClick={handleAddVehicle} disabled={!newVehicleType.trim() || !newVehiclePlate.trim()} className="btn-primary px-3 py-1 text-sm disabled:opacity-50"><Check className="w-4 h-4"/></button>
                        <button onClick={() => setIsAddingVehicle(false)} className="btn-secondary px-3 py-1 text-sm"><X className="w-4 h-4"/></button>
                      </div>
                   </div>
                ) : (
                   <select 
                     value={vehicle} 
                     onChange={e => {
                        if (e.target.value === 'ADD_NEW') {
                           setIsAddingVehicle(true);
                        } else if (e.target.value.startsWith('DEL_')) {
                           handleDeleteVehicle(e.target.value.replace('DEL_', ''));
                        } else {
                           setVehicle(e.target.value);
                        }
                     }} 
                     className="form-input w-full"
                   >
                     <option value="">Select a Vehicle</option>
                     {savedVehicles.map(v => (
                        <option key={v} value={v}>{v}</option>
                     ))}
                     <option value="ADD_NEW">+ Add New Vehicle...</option>
                     {isAdmin && savedVehicles.length > 0 && (
                        <optgroup label="Admin: Delete Vehicle">
                          {savedVehicles.map(v => (
                            <option key={`del-${v}`} value={`DEL_${v}`}>DELETE: {v}</option>
                          ))}
                        </optgroup>
                     )}
                   </select>
                )}
              </div>
              <div>
                <label className="block text-label-md font-semibold text-on-surface-variant mb-1">Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="form-input" 
                />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-on-surface">Trip Legs / Destinations</h3>
              <button onClick={addLeg} className="btn-secondary py-1.5 px-3 text-sm">
                <Plus className="w-4 h-4 mr-1" /> Add Leg
              </button>
            </div>
            
            <div className="space-y-8">
              {legs.map((leg, index) => (
                <div key={leg.id} className="relative border border-outline-variant rounded-lg p-4 bg-surface-variant/30">
                  {legs.length > 1 && (
                    <button 
                      onClick={() => removeLeg(index)}
                      className="absolute top-2 right-2 p-1.5 text-error hover:bg-error/10 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <h4 className="font-semibold mb-3 text-primary">Stop #{index + 1}</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div className="sm:col-span-2 lg:col-span-3">
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Purpose / Activity / Materials to Transport</label>
                       <input type="text" value={leg.purpose || ''} placeholder="e.g., Transporting chlorine to Pump House..." onChange={e => updateLeg(index, 'purpose', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Passengers / Personnel</label>
                       <input type="text" value={leg.passengers} placeholder="e.g., John Doe, Jane Smith" onChange={e => updateLeg(index, 'passengers', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Destination</label>
                       <input type="text" value={leg.destination} onChange={e => updateLeg(index, 'destination', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Departure Time (Office)</label>
                       <input type="time" value={leg.departureTimeOffice} onChange={e => updateLeg(index, 'departureTimeOffice', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Arrival Time (Dest)</label>
                       <input type="time" value={leg.arrivalTimeDest} onChange={e => updateLeg(index, 'arrivalTimeDest', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Departure Time (Dest)</label>
                       <input type="time" value={leg.departureTimeDest} onChange={e => updateLeg(index, 'departureTimeDest', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-on-surface-variant mb-1">Return Time (Office)</label>
                       <input type="time" value={leg.returnTimeOffice} onChange={e => updateLeg(index, 'returnTimeOffice', e.target.value)} className="form-input py-1.5 text-sm" />
                     </div>
                     
                     <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-3 gap-2 mt-2">
                       <div>
                         <label className="block text-xs font-semibold text-on-surface-variant mb-1">Gas Balance</label>
                         <input type="text" value={leg.gasBalance} onChange={e => updateLeg(index, 'gasBalance', e.target.value)} className="form-input py-1 text-xs" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-on-surface-variant mb-1">Gas Purchased</label>
                         <input type="text" value={leg.gasPurchased} onChange={e => updateLeg(index, 'gasPurchased', e.target.value)} className="form-input py-1 text-xs" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-on-surface-variant mb-1">Gas Total</label>
                         <input type="text" value={leg.gasTotal} onChange={e => updateLeg(index, 'gasTotal', e.target.value)} className="form-input py-1 text-xs" />
                       </div>
                     </div>

                     <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-3 gap-2 mt-2">
                       <div>
                         <label className="block text-xs font-semibold text-on-surface-variant mb-1">Speedo Beg.</label>
                         <input type="number" value={leg.speedoBeg} onChange={e => updateLeg(index, 'speedoBeg', e.target.value)} className="form-input py-1 text-xs" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-on-surface-variant mb-1">Speedo End</label>
                         <input type="number" value={leg.speedoEnd} onChange={e => updateLeg(index, 'speedoEnd', e.target.value)} className="form-input py-1 text-xs" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-on-surface-variant mb-1">Distance Travel</label>
                         <input type="number" value={leg.distance} onChange={e => updateLeg(index, 'distance', e.target.value)} className="form-input py-1 text-xs bg-primary-container/20" />
                       </div>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-on-surface mb-4">Vehicle Checklist (Check if needs work)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {Object.keys(defaultChecklist).filter(k => k !== 'others').map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-variant transition-colors border border-outline-variant">
                  <input 
                    type="checkbox" 
                    checked={(checklist as any)[key]} 
                    onChange={e => setChecklist({...checklist, [key]: e.target.checked})}
                    className="w-4 h-4 text-primary rounded border-outline"
                  />
                  <span className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-md font-semibold text-on-surface-variant mb-1">Others (please specify)</label>
                <input 
                  type="text" 
                  value={checklist.others} 
                  onChange={e => setChecklist({...checklist, others: e.target.value})} 
                  className="form-input" 
                />
              </div>
              <div>
                <label className="block text-label-md font-semibold text-on-surface-variant mb-1">Comments/Problems</label>
                <textarea 
                  value={comments} 
                  onChange={e => setComments(e.target.value)} 
                  className="form-input" 
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-on-surface mb-4">Official E-Signature</h3>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-on-surface-variant">Please sign below to confirm the trip details.</p>
              
              <div className="border-2 border-dashed border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
                <SignatureCanvas 
                  ref={sigCanvas}
                  canvasProps={{
                    className: 'w-full h-40 cursor-crosshair',
                    style: { width: '100%', height: '160px' }
                  }}
                  backgroundColor="rgb(255, 255, 255)"
                  penColor="blue"
                />
              </div>
              
              {signature && (
                <div className="mt-2">
                  <p className="text-xs text-primary mb-1 font-semibold">Previously Saved Signature:</p>
                  <img src={signature} alt="Saved signature" className="h-16 border border-outline-variant bg-white rounded" />
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={clearSignature} className="text-sm text-error font-medium hover:underline hide-on-print">
                  Clear Signature
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 hide-on-print">
            <button onClick={() => setIsFormOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              Save Trip Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline-lg text-on-surface font-bold flex items-center justify-center md:justify-start gap-3">
            <div className="w-12 h-12 bg-primary-container text-primary rounded-xl flex items-center justify-center">
              <Car className="w-7 h-7" />
            </div>
            Trip Tickets
          </h1>
          <p className="text-on-surface-variant font-body-lg mt-2 text-center md:text-left">
            Manage company vehicle trip logs
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => handleOpenForm()}
            className="btn-primary px-5 py-2.5 shadow-sm shadow-primary/20"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Trip Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tickets.map(ticket => (
          <div key={ticket.id} className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-primary mb-1">{ticket.date}</div>
                <h3 className="font-headline-sm font-bold text-on-surface">{ticket.vehicle}</h3>
                <p className="text-on-surface-variant text-sm mt-1">Driver: {ticket.driver}</p>
              </div>
              <div className="bg-secondary-container text-on-secondary-container text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {ticket.legs.length} Stop{ticket.legs.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {ticket.legs.slice(0, 2).map((leg, i) => (
                <div key={leg.id} className="text-sm flex flex-col gap-0.5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" />
                    <span className="truncate font-medium">{leg.destination || 'Unknown destination'}</span>
                  </div>
                  {leg.purpose && (
                    <div className="text-xs text-on-surface-variant pl-6 truncate">
                      {leg.purpose}
                    </div>
                  )}
                </div>
              ))}
              {ticket.legs.length > 2 && (
                <div className="text-sm text-on-surface-variant italic pl-6">
                  + {ticket.legs.length - 2} more stops
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-outline-variant">
              <button onClick={() => handleOpenForm(ticket)} className="btn-secondary flex-1 py-1.5 text-sm">
                View / Edit
              </button>
              <button 
                onClick={() => handleDelete(ticket.id)}
                className="p-1.5 text-error border border-error/20 hover:bg-error/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {tickets.length === 0 && (
          <div className="col-span-full bg-surface border border-outline-variant rounded-2xl p-12 text-center">
             <div className="w-16 h-16 bg-surface-variant text-on-surface-variant rounded-full flex items-center justify-center mx-auto mb-4">
               <Car className="w-8 h-8 opacity-50" />
             </div>
             <h3 className="text-xl font-bold text-on-surface mb-2">No Trip Tickets</h3>
             <p className="text-on-surface-variant max-w-[448px] mx-auto mb-6">
               There are no trip tickets logged yet. Click 'New Trip Ticket' to get started.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
