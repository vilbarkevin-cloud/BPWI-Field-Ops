import Papa from 'papaparse';

export const pmsCsvData = `PUMP STATION,WELL CODE,Activity,REMARKS,SCHED,ACTUAL PM
Pavia Plant,PV-01,Tank Cleaning,Residue build-up,2026-04-15,
PR2 Reservoir,PR-02,Filter Replacement,Slow flow,2026-05-10,
BAR Water Treatment,BAR-01,Pump Overhaul,High vibration,2026-06-25,
Wakeboard Pump Station,WK-01,Flushing,Clear,2026-06-15,`;

export function getParsedPmsData() {
  const parsed = Papa.parse(pmsCsvData, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data as Array<{
    'PUMP STATION': string;
    'WELL CODE': string;
    'Activity': string;
    'REMARKS': string;
    'SCHED': string;
    'ACTUAL PM': string;
  }>;
}
