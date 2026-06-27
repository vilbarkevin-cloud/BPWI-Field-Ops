import { getAccessToken } from './workspaceAuth';
import { getParsedPmsData } from './pmsData';

interface PmsRow {
  'PUMP STATION': string;
  'WELL CODE': string;
  'Activity': string;
  'REMARKS': string;
  'SCHED': string;
  'ACTUAL PM': string;
}

const formatDateStr = (dateStr: string) => {
  // Parses DD-MMM-YY (e.g., 5-Jan-26)
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // returns YYYY-MM-DD
  return d.toISOString().split('T')[0];
};

const getNextDayDateStr = (dateStr: string) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

export const syncToGoogleCalendar = async (
  onProgress?: (current: number, total: number) => void
) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No Google Access Token available. Please sign in first.');
  }

  const rows = getParsedPmsData() as PmsRow[];
  const validRows = rows.filter(r => r.SCHED && r['PUMP STATION'] && r['Activity']);
  
  const total = validRows.length;
  let current = 0;

  for (const row of validRows) {
    const startStr = formatDateStr(row.SCHED);
    if (!startStr) {
      current++;
      if (onProgress) onProgress(current, total);
      continue;
    }
    const endStr = getNextDayDateStr(row.SCHED);

    const activity = row.Activity || 'Activity';
    let summary = `[${activity}] ${row['PUMP STATION']}`;
    if (row.REMARKS) summary += ` - ${row.REMARKS}`;

    const event = {
      summary,
      description: `PMS Schedule imported from WATSAN Monitor. \nWell Code: ${row['WELL CODE']} \nRemarks: ${row.REMARKS}`,
      start: { date: startStr },
      end: { date: endStr },
      colorId: activity.includes('TANK') ? '9' : '7', // 9 = Blueberry, 7 = Peacock
    };

    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
         console.warn('Failed to insert event', await res.text());
      }
    } catch (e) {
      console.error(e);
    }

    current++;
    if (onProgress) onProgress(current, total);
  }
};
