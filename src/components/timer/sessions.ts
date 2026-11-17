// Какой блок ждёт отметки «готово / процент / бросил». Считается по focus_sessions,
// поэтому окно возвращается после перезагрузки и для блока, истёкшего при закрытом сайте.
import type { FocusSession } from '@shared/types';

export function pendingResultSession(sessions: FocusSession[], today: string): FocusSession | null {
  const open = sessions
    .filter((s) => s.date === today && s.mode !== 'break' && !s.deleted)
    .filter((s) => typeof s.blockIndex === 'number' && !s.result && !s.resultSkipped)
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  return open.at(-1) ?? null;
}
