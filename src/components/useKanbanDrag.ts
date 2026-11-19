import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Перетаскивание карточек канбана между колонками мышкой и пальцем.
// Мышь: тянуть сразу (после 6 px). Палец: удержать ~0,3 с, потом тянуть — так обычная прокрутка не ломается.
// Колонка-цель помечается атрибутом data-stage="<этап>".

const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 280;
const TOUCH_CANCEL_MOVE = 10;

export interface DragState {
  id: string;
  x: number;
  y: number;
  /** Смещение точки захвата внутри карточки */
  dx: number;
  dy: number;
  width: number;
  overStage: string | null;
}

interface Pending {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  rect: DOMRect;
  touch: boolean;
  timer: number | null;
}

/** Колонка под точкой экрана (по атрибуту data-stage) */
export function stageAtPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return (el?.closest('[data-stage]') as HTMLElement | null)?.dataset.stage ?? null;
}

const INTERACTIVE = 'button, select, input, textarea, a, label, [data-no-drag]';

export function useKanbanDrag(onDrop: (id: string, stage: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<Pending | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const begin = (p: Pending, x: number, y: number) => {
    update({
      id: p.id,
      x,
      y,
      dx: p.startX - p.rect.left,
      dy: p.startY - p.rect.top,
      width: p.rect.width,
      overStage: stageAtPoint(x, y),
    });
    if (p.touch && 'vibrate' in navigator) navigator.vibrate?.(15);
  };

  const clear = () => {
    if (pending.current?.timer) window.clearTimeout(pending.current.timer);
    pending.current = null;
    update(null);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const d = dragRef.current;
      if (d) {
        update({ ...d, x: e.clientX, y: e.clientY, overStage: stageAtPoint(e.clientX, e.clientY) });
        return;
      }
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (p.touch) {
        // Палец поехал раньше удержания — это прокрутка, не перенос
        if (dist > TOUCH_CANCEL_MOVE) clear();
      } else if (dist > MOUSE_THRESHOLD) {
        begin(p, e.clientX, e.clientY);
      }
    };
    const up = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const d = dragRef.current;
      if (d) {
        const stage = stageAtPoint(e.clientX, e.clientY);
        if (stage) onDropRef.current(d.id, stage);
      }
      clear();
    };
    // Во время переноса пальцем страница не должна прокручиваться
    const touchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', clear);
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', clear);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('keydown', key);
    };
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    const touch = e.pointerType !== 'mouse';
    const p: Pending = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      rect: e.currentTarget.getBoundingClientRect(),
      touch,
      timer: null,
    };
    if (touch) {
      p.timer = window.setTimeout(() => {
        if (pending.current === p) begin(p, p.startX, p.startY);
      }, TOUCH_HOLD_MS);
    } else {
      e.preventDefault(); // без выделения текста при перетаскивании
    }
    pending.current = p;
  }, []);

  return { drag, onPointerDown };
}
