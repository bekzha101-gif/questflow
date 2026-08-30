import { DailyLogEntry } from './bigDataTracker';

export interface SleepCycleCsvRow {
  startDate: string;
  endDate: string;
  sleepQuality: number; // e.g. 85
  timeInBedMinutes: number; // e.g. 455
  sleepDurationStr: string; // e.g. "7ч 35м"
}

export function parseSleepCycleCsv(csvText: string): SleepCycleCsvRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Determine delimiter: comma or semicolon
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const startIndex = headers.findIndex(h => h.includes('start'));
  const endIndex = headers.findIndex(h => h.includes('end'));
  const qualityIndex = headers.findIndex(h => h.includes('quality') || h.includes('качество'));
  const timeInBedIndex = headers.findIndex(h => h.includes('time in bed') || h.includes('время в постели') || h.includes('duration'));

  const results: SleepCycleCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawRow = lines[i];
    const cols = rawRow.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    const start = startIndex >= 0 ? cols[startIndex] : cols[0];
    const end = endIndex >= 0 ? cols[endIndex] : cols[1];
    
    // Parse quality %
    let quality = 80;
    if (qualityIndex >= 0 && cols[qualityIndex]) {
      const parsedQ = parseInt(cols[qualityIndex].replace('%', ''), 10);
      if (!isNaN(parsedQ)) quality = parsedQ;
    }

    // Calculate duration
    let minutes = 450;
    if (timeInBedIndex >= 0 && cols[timeInBedIndex]) {
      const val = cols[timeInBedIndex];
      if (val.includes(':')) {
        const parts = val.split(':');
        minutes = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      } else {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          // If seconds (e.g. 27000)
          if (num > 1000) minutes = Math.round(num / 60);
          else if (num <= 24) minutes = Math.round(num * 60); // If hours
          else minutes = Math.round(num); // If minutes
        }
      }
    } else if (start && end) {
      const dStart = new Date(start.replace(' ', 'T'));
      const dEnd = new Date(end.replace(' ', 'T'));
      if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
        minutes = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60));
      }
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const sleepDurationStr = `${hours}ч ${mins < 10 ? '0' : ''}${mins}м`;

    results.push({
      startDate: start,
      endDate: end,
      sleepQuality: quality,
      timeInBedMinutes: minutes,
      sleepDurationStr,
    });
  }

  return results;
}

export function mergeSleepCycleDataIntoDays(
  days: DailyLogEntry[], 
  records: SleepCycleCsvRow[], 
  currentMonth: number = 8, // August
  currentYear: number = 2026
): DailyLogEntry[] {
  return days.map(d => {
    // Find matching record by day of month
    const matching = records.find(r => {
      if (!r.endDate && !r.startDate) return false;
      const date = new Date((r.endDate || r.startDate).replace(' ', 'T'));
      if (isNaN(date.getTime())) {
        // Fallback simple day string match
        return (r.endDate || r.startDate).includes(`-${d.day < 10 ? '0' : ''}${d.day}`);
      }
      return date.getDate() === d.day;
    });

    if (matching) {
      return {
        ...d,
        sleep: matching.sleepDurationStr,
        sleepMinutes: matching.timeInBedMinutes,
        sleepQualityPercent: matching.sleepQuality,
        isAutoSynced: true,
      };
    }
    return d;
  });
}
