import { describe, it, expect } from 'vitest';
import type { FocusSession } from '@shared/types';
import { pendingResultSession } from './sessions';

const TODAY = '2026-11-17';
const s = (over: Partial<FocusSession> & Record<string, unknown>): FocusSession =>
  ({ id: 'x', date: TODAY, startedAt: '2026-11-17T03:00:00.000Z', minutes: 120, mode: 'work', ...over }) as FocusSession;

describe('окно отметки блока', () => {
  it('открывается для последнего блока дня без отметки — и после перезагрузки', () => {
    const list = [
      s({ id: 'b1', blockIndex: 1, result: 'done' }),
      s({ id: 'b2', blockIndex: 2, startedAt: '2026-11-17T05:20:00.000Z' }),
    ];
    expect(pendingResultSession(list, TODAY)?.id).toBe('b2');
  });

  it('не открывается: отмечен, пропущен, отдых, вчерашний, старые записи без номера блока', () => {
    expect(pendingResultSession([s({ id: 'a', blockIndex: 1, resultSkipped: true })], TODAY)).toBeNull();
    expect(pendingResultSession([s({ id: 'a', blockIndex: 1, result: 'partial' })], TODAY)).toBeNull();
    expect(pendingResultSession([s({ id: 'a', blockIndex: 1, mode: 'break' })], TODAY)).toBeNull();
    expect(pendingResultSession([s({ id: 'a', blockIndex: 1, date: '2026-11-16' })], TODAY)).toBeNull();
    expect(pendingResultSession([s({ id: 'legacy' })], TODAY)).toBeNull();
  });
});
