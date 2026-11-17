import { describe, it, expect } from 'vitest';
import { APP_TZ, todayStr, dayOfWeek, isRecoveryDay, bishkekHM, addDays, weekStart, monthKey } from './time';

describe('shared/time — Бишкек (UTC+6)', () => {
  it('часовой пояс — Asia/Bishkek', () => {
    expect(APP_TZ).toBe('Asia/Bishkek');
  });

  it('сутки в Бишкеке меняются в 18:00 UTC', () => {
    // 17:59:59 UTC = 23:59:59 в Бишкеке — ещё 16 ноября
    expect(todayStr(new Date('2026-11-16T17:59:59Z'))).toBe('2026-11-16');
    // 18:00:00 UTC = 00:00 в Бишкеке — уже 17 ноября, хотя в UTC ещё 16-е
    expect(todayStr(new Date('2026-11-16T18:00:00Z'))).toBe('2026-11-17');
  });

  it('конец месяца и года по Бишкеку', () => {
    expect(todayStr(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });

  it('часы и минуты по Бишкеку', () => {
    expect(bishkekHM(new Date('2026-11-17T02:05:00Z'))).toEqual({ h: 8, m: 5 });
    expect(bishkekHM(new Date('2026-11-16T18:00:00Z'))).toEqual({ h: 0, m: 0 });
  });

  it('пятница — день восстановления', () => {
    // 20 ноября 2026 — пятница, 17 ноября — вторник
    expect(dayOfWeek('2026-11-20')).toBe(5);
    expect(dayOfWeek('2026-11-17')).toBe(2);
    expect(dayOfWeek('2026-11-22')).toBe(0);
    expect(isRecoveryDay('2026-11-20')).toBe(true);
    expect(isRecoveryDay('2026-11-19')).toBe(false);
    expect(isRecoveryDay('2026-11-21')).toBe(false);
  });

  it('пятница по Бишкеку, когда в UTC ещё четверг', () => {
    // 19 ноября 19:00 UTC = 20 ноября 01:00 в Бишкеке
    expect(isRecoveryDay(todayStr(new Date('2026-11-19T19:00:00Z')))).toBe(true);
  });

  it('сдвиг дат, неделя с понедельника, ключ месяца', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekStart('2026-11-17')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(monthKey('2026-11-17')).toBe('2026-11');
  });
});
