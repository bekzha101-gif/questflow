// Переходники между старыми типами приложения и строками новых таблиц.
import type { TimeLogEntry } from '../types';
import type { FocusSession } from '@shared/types';
import { todayStr } from '@shared/time';
import type { Converter } from './index';

/** Запись таймера (TimeLogEntry) ↔ сессия фокуса (focus_sessions); прочие поля — в extra */
export function timeLogToSession(t: TimeLogEntry): FocusSession {
  const { actualMinutes, completedAt, startedAt, ...rest } = t;
  const started = startedAt || completedAt || new Date().toISOString();
  return {
    ...rest,
    date: todayStr(new Date(started)),
    startedAt: started,
    endedAt: completedAt,
    minutes: Number(actualMinutes) || 0,
  };
}

export function sessionToTimeLog(s: FocusSession): TimeLogEntry {
  const { minutes, endedAt, startedAt, date: _date, ...rest } = s;
  return {
    title: '',
    mode: 'work',
    targetMinutes: 0,
    ...(rest as Partial<TimeLogEntry>),
    id: s.id,
    startedAt,
    completedAt: endedAt ?? startedAt,
    actualMinutes: minutes ?? 0,
  } as TimeLogEntry;
}

export const timeLogConverter: Converter<TimeLogEntry, FocusSession> = {
  toApp: sessionToTimeLog,
  fromApp: timeLogToSession,
};
