import { useState } from 'react';
import type { TimerSettings } from '@shared/types';
import { BREAK_MIN_RANGE, BREAK_PRESETS, WORK_MIN_RANGE, WORK_PRESETS, normalizeTimerSettings } from '@shared/timer';

interface Props {
  settings: TimerSettings;
  onChange: (next: TimerSettings) => void;
  /** Идёт блок: новые настройки начнут действовать со следующего */
  blockRunning: boolean;
}

/**
 * Поле минут: печатать можно что угодно, в настройки уходит число в пределах — на blur и Enter.
 * Снаружи значение меняется (пресет, другое устройство) — поле пересоздаётся по key.
 */
function MinutesInput({ value, min, max, onCommit, label }: { value: number; min: number; max: number; onCommit: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = parseInt(text, 10);
    if (Number.isFinite(n) && n > 0) onCommit(Math.min(max, Math.max(min, n)));
    else setText(String(value));
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-white/[0.2]"
    />
  );
}

function Presets({ values, current, onPick }: { values: readonly number[]; current: number; onPick: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {values.map((m) => (
        <button
          key={m}
          onClick={() => onPick(m)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
            current === m ? 'bg-zinc-100 text-zinc-950' : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09]'
          }`}
        >
          {m}м
        </button>
      ))}
    </div>
  );
}

// Окно «Настройка таймера» (кнопка Settings2): длительность фокуса и отдыха, отсчёт или секундомер.
// Настройки лежат в kv `timer_settings` и действуют с начала следующего блока.
export function TimerSettingsPanel({ settings, onChange, blockRunning }: Props) {
  const set = (patch: Partial<TimerSettings>) => onChange(normalizeTimerSettings({ ...settings, ...patch }));
  const stopwatch = settings.timerType === 'stopwatch';
  return (
    <div
      role="dialog"
      aria-label="Настройка таймера"
      className="absolute right-0 top-full mt-2 w-72 bg-[#101014] border border-white/[0.08] rounded-2xl shadow-2xl p-3.5 z-50 space-y-3"
    >
      <div className="text-xs font-semibold text-zinc-200 border-b border-white/[0.06] pb-2">Настройка таймера</div>

      <div>
        <div className="text-[11px] text-zinc-400 mb-1.5 font-medium">Тип таймера</div>
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(['countdown', 'stopwatch'] as const).map((t) => (
            <button
              key={t}
              onClick={() => set({ timerType: t })}
              className={`py-1 rounded-lg text-[11px] font-semibold ${
                settings.timerType === t ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'countdown' ? 'Обратный отсчёт' : 'Секундомер'}
            </button>
          ))}
        </div>
        {stopwatch && (
          <p className="mt-1.5 text-[11px] text-zinc-500">Без лимита: сам на отдых не переходит, «Стоп» запишет отработанное.</p>
        )}
      </div>

      {!stopwatch && (
        <div>
          <div className="text-[11px] text-zinc-400 mb-1 font-medium">
            Фокус, мин ({WORK_MIN_RANGE.min}–{WORK_MIN_RANGE.max})
          </div>
          <Presets values={WORK_PRESETS} current={settings.workMin} onPick={(v) => set({ workMin: v })} />
          <MinutesInput
            key={`w${settings.workMin}`}
            label="Фокус, минут"
            value={settings.workMin}
            min={WORK_MIN_RANGE.min}
            max={WORK_MIN_RANGE.max}
            onCommit={(v) => set({ workMin: v })}
          />
        </div>
      )}

      {!stopwatch && (
        <div>
          <div className="text-[11px] text-zinc-400 mb-1 font-medium">
            Отдых, мин ({BREAK_MIN_RANGE.min}–{BREAK_MIN_RANGE.max})
          </div>
          <Presets values={BREAK_PRESETS} current={settings.breakMin} onPick={(v) => set({ breakMin: v })} />
          <MinutesInput
            key={`b${settings.breakMin}`}
            label="Отдых, минут"
            value={settings.breakMin}
            min={BREAK_MIN_RANGE.min}
            max={BREAK_MIN_RANGE.max}
            onCommit={(v) => set({ breakMin: v })}
          />
        </div>
      )}

      <p className="text-[11px] text-zinc-500 border-t border-white/[0.06] pt-2">
        Полный блок для серии и наград — от 2 ч отработанного.
        {blockRunning && ' Новые настройки — со следующего блока.'}
      </p>
    </div>
  );
}
