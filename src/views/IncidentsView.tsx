import React, { useState } from 'react';
import { 
  Wifi, Droplet, Zap, Headphones, Crosshair, Map, 
  Camera, Check, History, Download, Loader2, MapPin, Clock, FileWarning
} from 'lucide-react';
import { exportToGoogleSheets } from '../lib/workspaceSync';
import { defaultFacilities } from '../lib/dataStore';
import { BillingForm } from '../components/BillingForm';

export function IncidentsView() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [reportMode, setReportMode] = useState<'standard' | 'billing'>('standard');

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = [
        ['Incident ID', 'Type', 'Severity', 'Facility', 'Reported date', 'Status', 'Resolution'],
        ['INC-2023-118', 'Equipment Failure', 'High', 'Well Station 2', '2026-06-14', 'RESOLVED', 'Broken valve seal replaced'],
        ['INC-2023-119', 'Water Interruption', 'Critical', 'Zone B', '2026-06-15', 'OPEN', 'Pending investigation'],
      ];
      const url = await exportToGoogleSheets('Incident Audit Trail', data);
      alert('Successfully exported to Google Sheets! URL: ' + url);
      window.open(url, '_blank');
    } catch (e: any) {
      alert('Failed to export: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-lg pb-24 print:p-0 print:pb-0">
      {/* Quick Report Section */}
      <section className="mb-xl print:hidden">
        <div className="flex items-center justify-between mb-md">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">New Report Entry</h2>
          <span className="bg-error-container text-on-error-container px-3 py-1 rounded-full font-label-md text-label-md flex items-center gap-1">
            <Wifi className="pulse-red w-4 h-4" /> Live Ops
          </span>
        </div>

        {/* Report Type Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-gutter">
          <button onClick={() => setReportMode('standard')} className={`group flex flex-col items-start p-lg bg-surface border rounded-xl transition-all duration-300 text-left ${reportMode === 'standard' ? 'border-primary shadow-md' : 'border-outline-variant hover:bg-primary-container'}`}>
            <div className="bg-primary-fixed-dim p-3 rounded-lg mb-md group-hover:bg-white/20 transition-colors">
              <Droplet className="text-primary group-hover:text-white w-6 h-6" />
            </div>
            <span className="font-headline-md text-headline-md text-on-surface group-hover:text-white mb-xs">Leaking Pipe</span>
            <p className="font-body-md text-body-md text-on-surface-variant group-hover:text-primary-fixed">Report active pipe leaks or structural moisture issues.</p>
          </button>
          
          <button onClick={() => setReportMode('standard')} className="group flex flex-col items-start p-lg bg-surface border border-outline-variant rounded-xl hover:bg-tertiary-container transition-all duration-300 text-left">
            <div className="bg-tertiary-fixed-dim p-3 rounded-lg mb-md group-hover:bg-white/20 transition-colors">
              <Zap className="text-tertiary group-hover:text-white w-6 h-6" />
            </div>
            <span className="font-headline-md text-headline-md text-on-surface group-hover:text-white mb-xs">Service Break</span>
            <p className="font-body-md text-body-md text-on-surface-variant group-hover:text-tertiary-fixed">Log grid failures, outages, or scheduled maintenance gaps.</p>
          </button>
          
          <button onClick={() => setReportMode('standard')} className="group flex flex-col items-start p-lg bg-surface border border-outline-variant rounded-xl hover:bg-secondary-container transition-all duration-300 text-left">
            <div className="bg-secondary-fixed p-3 rounded-lg mb-md group-hover:bg-white/20 transition-colors">
              <Headphones className="text-secondary group-hover:text-white w-6 h-6" />
            </div>
            <span className="font-headline-md text-headline-md text-on-surface group-hover:text-white mb-xs">User Complaint</span>
            <p className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-secondary-fixed">Record incoming customer feedback or direct grievances.</p>
          </button>

          <button onClick={() => setReportMode('billing')} className={`group flex flex-col items-start p-lg bg-surface border rounded-xl transition-all duration-300 text-left ${reportMode === 'billing' ? 'border-primary shadow-md' : 'border-outline-variant hover:bg-error-container/50'}`}>
            <div className="bg-error-container text-error p-3 rounded-lg mb-md group-hover:bg-error group-hover:text-white transition-colors">
              <FileWarning className="w-6 h-6" />
            </div>
            <span className="font-headline-md text-headline-md text-on-surface group-hover:text-error mb-xs">Damage Billing</span>
            <p className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-error-container">Generate cost recovery report for 3rd-party damage.</p>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl print:block print:w-full">
        {/* Input Form Column */}
        <div className="lg:col-span-2 space-y-lg print:w-full print:block">
          {reportMode === 'billing' ? (
            <BillingForm />
          ) : (
            <>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-label-md text-label-md uppercase tracking-wider text-outline">Incident Parameters</h3>
              <span className="font-label-sm text-label-sm text-on-surface-variant">ID: INC-8291-X</span>
            </div>
            <div className="p-lg grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div className="md:col-span-2 space-y-sm">
                <label className="font-label-md text-label-md text-on-surface-variant">Affected Facility / Site</label>
                <select className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none appearance-none">
                  <option value="">Select a facility</option>
                  {defaultFacilities.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface-variant">GPS Coordinates</label>
                <div className="flex items-center gap-base">
                  <div className="relative flex-grow">
                    <input 
                      readOnly 
                      type="text" 
                      value="34.0522° N, 118.2437° W" 
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none"
                    />
                    <Crosshair className="absolute right-3 top-3 text-primary w-5 h-5" />
                  </div>
                  <button className="bg-primary text-on-primary px-4 py-3 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90">
                    <Map className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface-variant">Attachments</label>
                <div className="flex items-center gap-base">
                  <label className="flex-grow flex items-center justify-between bg-surface-container border border-dashed border-outline rounded-lg p-3 cursor-pointer hover:bg-surface-container-high transition-colors">
                    <span className="font-body-md text-body-md text-outline">Upload Site Photo</span>
                    <Camera className="text-outline w-5 h-5" />
                    <input type="file" className="hidden" />
                  </label>
                </div>
              </div>
              
              <div className="md:col-span-2 space-y-sm">
                <label className="font-label-md text-label-md text-on-surface-variant">Situation Summary</label>
                <textarea 
                  className="w-full h-32 bg-surface-container border border-outline-variant rounded-lg p-3 font-body-md text-body-md focus:ring-2 focus:ring-primary-container outline-none resize-none" 
                  placeholder="Describe the findings and immediate hazards..."
                ></textarea>
              </div>
              
              <div className="md:col-span-2 flex flex-wrap justify-end gap-md pt-base border-t border-outline-variant mt-4 pt-4">
                <button className="px-lg py-sm border border-outline text-on-surface-variant font-label-md text-label-md rounded-full hover:bg-surface-variant transition-colors">
                  Discard Draft
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || submitted}
                  className={`px-lg py-sm font-label-md text-label-md rounded-full shadow-md transition-all flex items-center gap-2 ${
                    submitted ? 'bg-emerald-600 text-white' : 'bg-primary text-on-primary hover:bg-primary-container'
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitted ? 'Log Saved Successfully' : 'Submit Incident Log'}
                </button>
              </div>
            </div>
          </div>

          {/* Active Timeline section */}
          <div className="bg-surface border border-outline-variant rounded-xl p-lg">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-lg">Active Resolution Timeline</h3>
            <div className="space-y-lg relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant">
              {/* Step 1 */}
              <div className="relative pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="text-white w-4 h-4" strokeWidth={3} />
                </div>
                <div className="flex flex-col">
                  <div className="flex justify-between items-start">
                    <span className="font-label-md text-label-md text-on-surface">Incident Logged</span>
                    <span className="font-label-sm text-label-sm text-outline">08:45 AM</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">Automatic entry created by field agent via GPS trigger.</p>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="relative pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="text-white w-4 h-4" strokeWidth={3} />
                </div>
                <div className="flex flex-col">
                  <div className="flex justify-between items-start">
                    <span className="font-label-md text-label-md text-on-surface">Staff Dispatched</span>
                    <span className="font-label-sm text-label-sm text-outline">09:12 AM</span>
                  </div>
                  <div className="flex items-center gap-sm mt-2">
                    <div className="w-6 h-6 rounded-full bg-surface-container-highest border border-outline-variant overflow-hidden flex items-center justify-center text-[10px] font-bold text-primary">
                      FG
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Franz Grajo (Lead Engineer)</span>
                  </div>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="relative pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-container-highest border-2 border-primary flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                </div>
                <div className="flex flex-col">
                  <div className="flex justify-between items-start">
                    <span className="font-label-md text-label-md text-primary">On-Site Assessment</span>
                    <span className="font-label-sm text-label-sm text-primary">In Progress</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">Field verification of pipe integrity is currently underway.</p>
                </div>
              </div>
            </div>
            
            {/* Resolution Form */}
            <div className="mt-8 pt-6 border-t border-outline-variant">
               <h4 className="font-headline-md text-on-surface mb-md">Log Resolution</h4>
               <div className="space-y-md">
                 <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Root Cause Identified</label>
                    <input type="text" placeholder="e.g. Broken valve seal due to high pressure" className="rounded bg-white border border-outline-variant focus:ring-primary focus:border-primary p-3 text-body-md outline-none" />
                 </div>
                 <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Action Taken</label>
                    <textarea rows={3} placeholder="Describe the steps taken to resolve the incident..." className="rounded bg-white border border-outline-variant focus:ring-primary focus:border-primary p-3 text-body-md outline-none"></textarea>
                 </div>
                 <div className="flex justify-between items-center mt-sm">
                   <div className="flex items-center gap-2 text-label-sm text-on-surface-variant bg-surface-container px-3 py-2 rounded-lg">
                      <Clock className="w-4 h-4" /> Time spent: <span className="font-bold text-on-surface">2h 45m</span>
                   </div>
                   <button className="px-6 py-2 bg-[#10b981] text-white rounded-lg font-label-md hover:bg-emerald-600 transition-colors flex items-center gap-2">
                     <Check className="w-4 h-4" /> Mark as Resolved
                   </button>
                 </div>
               </div>
            </div>
          </div>
            </>
          )}
        </div>

        {/* Audit Trail & Sidebar */}
        <aside className="space-y-lg print:hidden">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg h-full">
            <div className="flex items-center justify-between mb-lg">
              <h3 className="font-label-md text-label-md uppercase tracking-widest text-outline">Audit Trail</h3>
              <History className="text-outline w-5 h-5" />
            </div>
            
            <div className="space-y-md">
              <div className="p-md bg-white border border-outline-variant rounded-lg">
                <div className="flex items-center justify-between mb-xs">
                  <span className="bg-surface-container-highest text-on-surface px-2 py-0.5 rounded text-label-sm font-label-sm">System</span>
                  <span className="font-label-sm text-label-sm text-outline">Today, 11:20</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface">Automated status update: Escalated to Level 2 Maintenance.</p>
              </div>
              
              <div className="p-md bg-white border border-outline-variant rounded-lg">
                <div className="flex items-center justify-between mb-xs">
                  <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-label-sm font-label-sm">User</span>
                  <span className="font-label-sm text-label-sm text-outline">Today, 10:45</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface"><strong>Darwil Fernandez</strong> attached 3 JPG files to INC-8291-X.</p>
              </div>
              
              <div className="p-md bg-white border border-outline-variant rounded-lg">
                <div className="flex items-center justify-between mb-xs">
                  <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-label-sm font-label-sm">User</span>
                  <span className="font-label-sm text-label-sm text-outline">Today, 10:12</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface"><strong>Darwil Fernandez</strong> opened the ticket.</p>
              </div>
            </div>

            {/* Map Preview Card */}
            <div className="mt-lg rounded-xl overflow-hidden border border-outline-variant relative h-48 group cursor-crosshair">
              <div 
                className="absolute inset-0 bg-cover bg-center" 
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80')" }}
              ></div>
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-label-sm shadow-sm flex items-center gap-1">
                <MapPin className="text-error w-3 h-3" fill="currentColor" /> Incident Hotspot
              </div>
            </div>

            <div className="mt-lg pt-lg border-t border-outline-variant">
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-md py-md bg-inverse-surface text-inverse-on-surface rounded-xl font-label-md text-label-md hover:bg-on-background transition-colors active:scale-95 disabled:opacity-75"
              >
                {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isExporting ? 'Exporting...' : 'Export Incident Resolution Audit Trail'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
