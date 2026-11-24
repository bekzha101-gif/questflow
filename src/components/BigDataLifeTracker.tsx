// Big Data самоконтроль: дни хранятся по одному в bigdata_days, открывается текущий месяц,
// месяцы листаются стрелками. Сферы, свои критерии и шаблон БАДов — в настройках (bigdata_config).
// Аналитика (дельта, причины спада, «Что на тебя влияет») — shared/bigdata.ts.
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Plus, Trash2, Upload, Moon, Droplet, Timer, ListChecks, StickyNote, Activity, FlaskConical } from 'lucide-react';
import { monthKey, todayStr } from '@shared/time';
import {
  dayDelta,
  explainDrop,
  influenceFactors,
  isDropDay,
  shiftMonth,
  formatSleep,
  MIN_INFLUENCE_DAYS,
  type BigDataDayInput,
  type CriterionType,
} from '@shared/bigdata';
import type { BigDataDay, FocusSession } from '@shared/types';
import { useCollection } from '../store';
import {
  addCriterion,
  addSphere,
  addSupplement,
  buildMonth,
  focusMinutesByDate,
  isDayFilled,
  monthTitle,
  patchDay,
  removeCriterion,
  removeSphere,
  removeSupplement,
  renameSphere,
  sleepFromText,
  toggleSupplement,
  updateCriterion,
  updateSupplement,
  useBigDataDays,
  useBigDataSettings,
  type BigDataSettings,
  type MonthCell,
} from '../utils/bigDataTracker';
import { applySleepImport, parseSleepCycleCsv, planSleepImport } from '../utils/sleepCycleParser';
import { BIO_FIELDS, bioHistory, bioLatest, parseBioValues, useBiometrics, type BioKind } from '../utils/biometrics';
import {
  loadGoogleFitConfig,
  saveGoogleFitConfig,
  fetchGoogleFitSleepData,
  initGoogleFitTokenAuth,
} from '../utils/googleFitApi';
import { BigDataChart, type ScorePoint } from './BigDataChart';
import { rewardBigDataFill } from '../sections/progress/game';

type Tab = 'days' | 'analytics' | 'biometrics' | 'notes' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'days', label: 'Дни' },
  { id: 'analytics', label: 'Аналитика' },
  { id: 'biometrics', label: 'Биометрия' },
  { id: 'notes', label: 'Заметки' },
  { id: 'settings', label: 'Настройки' },
];

const CRITERION_TYPE_LABEL: Record<CriterionType, string> = {
  number: 'Число',
  boolean: 'Да / нет',
  scale: 'Шкала 1–10',
  text: 'Текст',
};

function scoreClass(score: number | null | undefined) {
  if (score === null || score === undefined) return 'text-zinc-600 border-white/[0.06]';
  if (score >= 7.5) return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]';
  if (score >= 6) return 'text-zinc-100 border-white/[0.12]';
  if (score >= 4.5) return 'text-amber-300 border-amber-500/30 bg-amber-500/[0.06]';
  return 'text-rose-300 border-rose-500/30 bg-rose-500/[0.06]';
}

export const BigDataLifeTracker: React.FC = () => {
  const today = todayStr();
  const [month, setMonth] = useState(() => monthKey(today));
  const [tab, setTab] = useState<Tab>('days');
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);

  const storedDays = useBigDataDays();
  const { settings, save: saveSettings } = useBigDataSettings();
  const sessions = useCollection<FocusSession>('focus_sessions').items;

  // Часы фокуса подставляются сами из таймера, если в дне их нет
  const focusByDate = useMemo(() => focusMinutesByDate(sessions as { date?: string; minutes?: number; mode?: string }[]), [sessions]);
  const allDays: BigDataDay[] = useMemo(() => {
    const byDate = new Map(storedDays.map((d) => [d.date, d]));
    for (const [date, min] of focusByDate) {
      const d = byDate.get(date);
      if (!d) byDate.set(date, { date, focusMin: min });
      else if (d.focusMin === undefined) byDate.set(date, { ...d, focusMin: min });
    }
    return [...byDate.values()];
  }, [storedDays, focusByDate]);

  const cells = useMemo(() => buildMonth(month, allDays), [month, allDays]);
  const analysisCfg = useMemo(
    () => ({ supplements: settings.supplements, spheres: settings.spheres, criteria: settings.criteria }),
    [settings],
  );
  const analysisDays = allDays as BigDataDayInput[];

  const points: ScorePoint[] = useMemo(
    () =>
      cells.map((c) => {
        const score = typeof c.day?.score === 'number' ? c.day.score : null;
        const drop = score !== null && isDropDay(analysisDays, c.date);
        return {
          date: c.date,
          dayNum: c.dayNum,
          score,
          delta: score !== null ? dayDelta(analysisDays, c.date) : null,
          isDrop: drop,
          isRecovery: c.isRecovery,
          reasons: drop ? explainDrop(analysisDays, c.date, analysisCfg).map((r) => r.label) : [],
        };
      }),
    [cells, analysisDays, analysisCfg],
  );

  const monthScored = cells.filter((c) => typeof c.day?.score === 'number');
  const monthSleep = cells.filter((c) => (c.day?.sleepMin ?? 0) > 0);
  const avgScore = monthScored.length ? monthScored.reduce((a, c) => a + (c.day!.score as number), 0) / monthScored.length : null;
  const avgSleep = monthSleep.length ? monthSleep.reduce((a, c) => a + (c.day!.sleepMin as number), 0) / monthSleep.length : null;

  const editingCell = editing ? cells.find((c) => c.date === editing) ?? buildMonth(monthKey(editing), allDays).find((c) => c.date === editing) ?? null : null;

  const quickToggleSphere = (cell: MonthCell, label: string) => {
    const tags = cell.day?.tags ?? [];
    patchDay(cell.date, { tags: tags.includes(label) ? tags.filter((t) => t !== label) : [...tags, label] });
  };

  const saveDay = (date: string, patch: Partial<BigDataDay>) => {
    const before = storedDays.find((d) => d.date === date) ?? null;
    const firstFill = !before?.fillRewarded && isDayFilled({ ...(before ?? { date }), ...patch } as BigDataDay);
    patchDay(date, { ...patch, ...(firstFill ? { fillRewarded: true } : {}) });
    // Награда за заполненный день — по правилам (bigdata_fill, ref — дата дня), повтор отклоняет журнал
    if (firstFill) rewardBigDataFill(date);
    setEditing(null);
  };

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4 space-y-4">
      {/* Шапка: месяц и стрелки */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="w-8 h-8 grid place-items-center rounded-xl border border-white/[0.07] bg-[#121218] text-zinc-300 hover:text-white"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-zinc-100 min-w-[150px] text-center">{monthTitle(month)}</h2>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="w-8 h-8 grid place-items-center rounded-xl border border-white/[0.07] bg-[#121218] text-zinc-300 hover:text-white"
            title="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {month !== monthKey(today) && (
            <button onClick={() => setMonth(monthKey(today))} className="text-[11px] text-zinc-400 hover:text-white ml-1">
              Сегодня
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span>
            Оценка <b className="font-mono text-zinc-100 font-medium">{avgScore !== null ? avgScore.toFixed(1) : '—'}</b>
          </span>
          <span>
            Сон <b className="font-mono text-zinc-100 font-medium">{avgSleep !== null ? formatSleep(avgSleep) : '—'}</b>
          </span>
          <span>
            Дней <b className="font-mono text-zinc-100 font-medium">{cells.filter((c) => isDayFilled(c.day)).length}</b>/{cells.length}
          </span>
        </div>
      </div>

      <div className="inline-flex p-[3px] bg-[#101014] border border-white/[0.07] rounded-[10px] gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium ${tab === t.id ? 'bg-[#16161f] text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'days' && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            {settings.spheres.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Сфер дня пока нет — добавь их в «Настройках».</p>
            ) : (
              <span />
            )}
            <SleepCsvButton />
          </div>
          {cells.map((c) => (
            <DayRow
              key={c.date}
              cell={c}
              isToday={c.date === today}
              settings={settings}
              isDrop={points.find((p) => p.date === c.date)?.isDrop ?? false}
              onOpen={() => setEditing(c.date)}
              onToggleSphere={(label) => quickToggleSphere(c, label)}
            />
          ))}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <section className="p-4 rounded-[20px] bg-[#101014] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-zinc-500">Оценка дня и дельта</h3>
              <span className="text-[11px] text-zinc-500">точка спада — красная, ниже причины</span>
            </div>
            <BigDataChart points={points} selectedDate={selectedPoint} onSelect={setSelectedPoint} />
          </section>
          <InfluenceBlock days={analysisDays} cfg={analysisCfg} />
        </div>
      )}

      {tab === 'biometrics' && <BiometricsPanel today={today} />}

      {tab === 'notes' && <NotesList cells={cells} onOpen={setEditing} />}

      {tab === 'settings' && <SettingsPanel settings={settings} onSave={saveSettings} month={month} />}

      {editingCell && (
        <DayEditor
          key={editingCell.date}
          cell={editingCell}
          settings={settings}
          onClose={() => setEditing(null)}
          onSave={(patch) => saveDay(editingCell.date, patch)}
        />
      )}
    </div>
  );
};

// ─── Строка дня ──────────────────────────────────────────────────────────────

function DayRow({
  cell,
  isToday,
  settings,
  isDrop,
  onOpen,
  onToggleSphere,
}: {
  cell: MonthCell;
  isToday: boolean;
  settings: BigDataSettings;
  isDrop: boolean;
  onOpen: () => void;
  onToggleSphere: (label: string) => void;
}) {
  const d = cell.day;
  const sphereLabels = new Set(settings.spheres.map((s) => s.label));
  const oldTags = (d?.tags ?? []).filter((t) => !sphereLabels.has(t));
  return (
    <div
      onClick={onOpen}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
        isToday ? 'border-violet-400/30 bg-violet-500/[0.04]' : 'border-white/[0.06] bg-[#0e0e13] hover:bg-[#121218]'
      }`}
    >
      <div className="w-14 shrink-0">
        <span className="font-mono text-sm text-zinc-100">{cell.dayNum}</span>
        <span className="text-[10px] text-zinc-500 ml-1">{cell.weekday}</span>
      </div>
      {cell.isRecovery && (
        <span className="text-[10px] px-1.5 h-5 inline-flex items-center rounded-md bg-emerald-500/10 text-emerald-300">восстановление</span>
      )}
      <span className={`w-10 h-6 shrink-0 inline-flex items-center justify-center rounded-lg border font-mono text-xs ${scoreClass(d?.score)}`}>
        {typeof d?.score === 'number' ? d.score : '—'}
      </span>
      {isDrop && <span className="text-[10px] text-rose-400">спад</span>}
      <span className="text-[11px] text-zinc-400 font-mono w-24 shrink-0 inline-flex items-center gap-1">
        <Moon className="w-3 h-3 text-zinc-600" />
        {d?.sleepMin ? formatSleep(d.sleepMin) : '—'}
        {typeof d?.sleepQuality === 'number' && <span className="text-zinc-600">{Math.round(d.sleepQuality)}%</span>}
      </span>
      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {settings.spheres.map((s) => {
          const on = d?.tags?.includes(s.label) ?? false;
          return (
            <button
              key={s.id}
              onClick={() => onToggleSphere(s.label)}
              title={s.description}
              className={`h-5 px-1.5 rounded-md text-[11px] font-medium ${on ? 'bg-violet-500/15 text-violet-300' : 'bg-white/[0.03] text-zinc-600 hover:text-zinc-300'}`}
            >
              {s.label}
            </button>
          );
        })}
        {oldTags.map((t) => (
          <span key={t} className="h-5 px-1.5 rounded-md text-[11px] bg-white/[0.04] text-zinc-500" title="Старая метка — хранится как текст">
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto text-[11px] text-zinc-500">
        {(d?.supplements?.length ?? 0) > 0 && <span className="text-amber-300/80">{d!.supplements!.join(', ')}</span>}
        {d?.waterOk && <Droplet className="w-3 h-3 text-sky-400" />}
        {typeof d?.focusMin === 'number' && d.focusMin > 0 && (
          <span className="inline-flex items-center gap-0.5 font-mono">
            <Timer className="w-3 h-3" />
            {formatSleep(d.focusMin)}
          </span>
        )}
        {typeof d?.habitsTotal === 'number' && d.habitsTotal > 0 && (
          <span className="inline-flex items-center gap-0.5 font-mono">
            <ListChecks className="w-3 h-3" />
            {Number(d.habitsDone ?? 0)}/{d.habitsTotal}
          </span>
        )}
        {d?.note?.trim() && <StickyNote className="w-3 h-3 text-zinc-400" />}
      </div>
    </div>
  );
}

// ─── Редактор дня ────────────────────────────────────────────────────────────

function DayEditor({
  cell,
  settings,
  onClose,
  onSave,
}: {
  cell: MonthCell;
  settings: BigDataSettings;
  onClose: () => void;
  onSave: (patch: Partial<BigDataDay>) => void;
}) {
  const d = cell.day;
  const [sleep, setSleep] = useState(d?.sleepMin ? formatSleep(d.sleepMin) : '');
  const [quality, setQuality] = useState(typeof d?.sleepQuality === 'number' ? String(d.sleepQuality) : '');
  const [score, setScore] = useState(typeof d?.score === 'number' ? String(d.score) : '');
  const [why, setWhy] = useState(d?.why ?? '');
  const [supps, setSupps] = useState<string[]>(d?.supplements ?? []);
  const [tags, setTags] = useState<string[]>(d?.tags ?? []);
  const [water, setWater] = useState<boolean | undefined>(typeof d?.waterOk === 'boolean' ? d.waterOk : undefined);
  const [criteria, setCriteria] = useState<Record<string, unknown>>(d?.criteria ?? {});
  const [note, setNote] = useState(d?.note ?? '');

  const sphereLabels = new Set(settings.spheres.map((s) => s.label));
  const templateNames = new Set(settings.supplements.map((s) => s.name));
  const extraSupps = supps.filter((s) => !templateNames.has(s));
  const oldTags = tags.filter((t) => !sphereLabels.has(t));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sc = score.trim() ? Math.min(10, Math.max(1, Number(score.replace(',', '.')))) : undefined;
    const q = quality.trim() ? Math.min(100, Math.max(0, Number(quality))) : undefined;
    onSave({
      sleepMin: sleepFromText(sleep),
      sleepQuality: Number.isFinite(q) ? q : undefined,
      score: Number.isFinite(sc) ? sc : undefined,
      why: why.trim() || undefined,
      supplements: supps,
      tags,
      waterOk: water,
      criteria,
      note: note.trim() || undefined,
      ...(typeof d?.focusMin === 'number' ? { focusMin: d.focusMin } : {}),
    });
  };

  const label = 'text-[11px] font-semibold tracking-[0.06em] uppercase text-zinc-500';
  const input = 'w-full bg-[#09090c] border border-white/[0.08] focus:border-white/20 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none';
  const chip = (on: boolean) => `h-7 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border ${on ? 'bg-violet-500/15 border-violet-400/30 text-violet-200' : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200'}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#101014] border border-white/[0.1] rounded-[20px] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {cell.dayNum} · {cell.weekday}
            </h3>
            {cell.isRecovery && <p className="text-[11px] text-emerald-300">Пятница — день восстановления</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className={label}>Сон</div>
            <input className={input} value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="7ч 40м" />
          </div>
          <div className="space-y-1">
            <div className={label}>Качество, %</div>
            <input className={input} value={quality} onChange={(e) => setQuality(e.target.value)} inputMode="numeric" placeholder="85" />
          </div>
        </div>

        <div className="grid grid-cols-[90px_1fr] gap-3">
          <div className="space-y-1">
            <div className={label}>Оценка</div>
            <input className={input} value={score} onChange={(e) => setScore(e.target.value)} inputMode="decimal" placeholder="1–10" />
          </div>
          <div className="space-y-1">
            <div className={label}>Почему</div>
            <input className={input} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Что повлияло на день" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className={label}>БАДы</div>
          <div className="flex flex-wrap gap-1.5">
            {settings.supplements.map((s) => {
              const on = supps.includes(s.name);
              return (
                <button key={s.id} type="button" className={chip(on)} onClick={() => setSupps((x) => toggleSupplement(x, s.name))}>
                  {on && <Check className="w-3 h-3" />}
                  {s.name}
                  {s.dose && <span className="text-zinc-500">{s.dose}</span>}
                </button>
              );
            })}
            {extraSupps.map((s) => (
              <button key={s} type="button" className={chip(true)} onClick={() => setSupps((x) => toggleSupplement(x, s))} title="Нет в шаблоне — снять">
                <Check className="w-3 h-3" />
                {s}
              </button>
            ))}
            {settings.supplements.length === 0 && extraSupps.length === 0 && (
              <span className="text-[11px] text-zinc-500">Шаблон БАДов пуст — заполни в «Настройках».</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className={label}>Сферы дня</div>
          <div className="flex flex-wrap gap-1.5">
            {settings.spheres.map((s) => {
              const on = tags.includes(s.label);
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.description}
                  className={chip(on)}
                  onClick={() => setTags((x) => (x.includes(s.label) ? x.filter((t) => t !== s.label) : [...x, s.label]))}
                >
                  {s.label}
                </button>
              );
            })}
            {oldTags.map((t) => (
              <button key={t} type="button" className={chip(true)} onClick={() => setTags((x) => x.filter((y) => y !== t))} title="Старая метка — снять">
                {t}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(water === true)} onClick={() => setWater((w) => (w === true ? false : true))}>
            <Droplet className="w-3 h-3" />
            {water === true ? 'Вода 2 л — да' : water === false ? 'Вода 2 л — нет' : 'Вода 2 л'}
          </button>
          {typeof d?.focusMin === 'number' && (
            <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
              <Timer className="w-3 h-3" /> фокус {formatSleep(d.focusMin)} (сам из таймера)
            </span>
          )}
          {typeof d?.habitsTotal === 'number' && d.habitsTotal > 0 && (
            <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
              <ListChecks className="w-3 h-3" /> привычки {Number(d.habitsDone ?? 0)}/{d.habitsTotal} (сами со «Сегодня»)
            </span>
          )}
        </div>

        {settings.criteria.length > 0 && (
          <div className="space-y-2">
            <div className={label}>Свои критерии</div>
            {settings.criteria.map((c) => {
              const v = criteria[c.id];
              const set = (val: unknown) => setCriteria((x) => ({ ...x, [c.id]: val }));
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-300 w-32 shrink-0 truncate">
                    {c.label}
                    {c.unit && <span className="text-zinc-500"> ({c.unit})</span>}
                  </span>
                  {c.type === 'boolean' ? (
                    <div className="flex gap-1.5">
                      <button type="button" className={chip(v === true)} onClick={() => set(v === true ? undefined : true)}>
                        Да
                      </button>
                      <button type="button" className={chip(v === false)} onClick={() => set(v === false ? undefined : false)}>
                        Нет
                      </button>
                    </div>
                  ) : c.type === 'scale' ? (
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" className={`w-6 h-6 rounded-md text-[11px] font-mono ${v === n ? 'bg-violet-500/20 text-violet-200' : 'bg-white/[0.03] text-zinc-500'}`} onClick={() => set(v === n ? undefined : n)}>
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : c.type === 'number' ? (
                    <input
                      className={input}
                      inputMode="decimal"
                      value={typeof v === 'number' ? String(v) : ''}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(',', '.'));
                        set(e.target.value.trim() && Number.isFinite(n) ? n : undefined);
                      }}
                    />
                  ) : (
                    <input className={input} value={typeof v === 'string' ? v : ''} onChange={(e) => set(e.target.value || undefined)} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1">
          <div className={label}>Заметка дня</div>
          <textarea
            className={`${input} min-h-[80px] resize-y`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что было, что понял — попадёт в базу для AI"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 px-3.5 rounded-[10px] text-[13px] text-zinc-400 hover:text-white">
            Отмена
          </button>
          <button type="submit" className="h-8 px-3.5 rounded-[10px] text-[13px] font-medium bg-zinc-100 text-zinc-950">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Что на тебя влияет ──────────────────────────────────────────────────────

function InfluenceBlock({ days, cfg }: { days: BigDataDayInput[]; cfg: Parameters<typeof influenceFactors>[1] }) {
  const res = useMemo(() => influenceFactors(days, cfg), [days, cfg]);
  const scoredCount = days.filter((d) => typeof d.score === 'number').length;
  return (
    <section className="p-4 rounded-[20px] bg-[#101014] border border-white/[0.07] space-y-3">
      <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-zinc-500">Что на тебя влияет</h3>
      {res === 'not_enough_data' ? (
        <p className="text-xs text-zinc-400">
          Мало данных, продолжай отмечать: дней с оценкой <span className="font-mono text-zinc-200">{scoredCount}</span> из{' '}
          <span className="font-mono text-zinc-200">{MIN_INFLUENCE_DAYS}</span>.
        </p>
      ) : res.length === 0 ? (
        <p className="text-xs text-zinc-400">Пока ни один фактор заметно не меняет оценку дня.</p>
      ) : (
        <div className="space-y-2">
          {res.slice(0, 8).map((f) => (
            <div key={f.id} className="flex items-start gap-3">
              <div className="w-24 shrink-0 pt-1">
                <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.effect > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(100, (Math.abs(f.effect) / 3) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  {f.strength === 'strong' ? 'сильно' : f.strength === 'medium' ? 'заметно' : 'слабо'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-zinc-100 font-medium">
                  {f.label}{' '}
                  <span className={`font-mono ${f.effect > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {f.effect > 0 ? '+' : ''}
                    {f.effect.toFixed(1)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Заметки ─────────────────────────────────────────────────────────────────

function NotesList({ cells, onOpen }: { cells: MonthCell[]; onOpen: (date: string) => void }) {
  const withNotes = cells.filter((c) => c.day?.note?.trim() || c.day?.why?.trim());
  if (!withNotes.length) return <p className="text-xs text-zinc-500 px-1">В этом месяце заметок нет. Заметку пишут в карточке дня.</p>;
  return (
    <div className="space-y-2">
      {withNotes.map((c) => (
        <button key={c.date} onClick={() => onOpen(c.date)} className="w-full text-left p-3 rounded-xl bg-[#0e0e13] border border-white/[0.06] hover:bg-[#121218]">
          <div className="text-[11px] text-zinc-500">
            <span className="font-mono text-zinc-300">{c.dayNum}</span> {c.weekday}
            {typeof c.day?.score === 'number' && <span className="font-mono ml-2">оценка {c.day.score}</span>}
          </div>
          {c.day?.why && <div className="text-xs text-zinc-300 mt-1">{c.day.why}</div>}
          {c.day?.note && <div className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{c.day.note}</div>}
        </button>
      ))}
    </div>
  );
}

// ─── Настройки ───────────────────────────────────────────────────────────────

function SettingsPanel({ settings, onSave, month }: { settings: BigDataSettings; onSave: (s: BigDataSettings) => void; month: string }) {
  const [newSphere, setNewSphere] = useState('');
  const [newCrit, setNewCrit] = useState('');
  const [newCritType, setNewCritType] = useState<CriterionType>('number');
  const [newSupp, setNewSupp] = useState('');
  const [newDose, setNewDose] = useState('');

  const card = 'p-4 rounded-[20px] bg-[#101014] border border-white/[0.07] space-y-3';
  const h = 'text-[11px] font-semibold tracking-[0.06em] uppercase text-zinc-500';
  const input = 'bg-[#09090c] border border-white/[0.08] focus:border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none';
  const del = 'p-1.5 rounded-lg text-zinc-600 hover:text-rose-400';
  const add = 'h-8 px-3 rounded-[10px] text-xs font-medium bg-[#16161f] border border-white/[0.12] text-zinc-200 inline-flex items-center gap-1';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}>
        <h3 className={h}>Сферы дня</h3>
        <p className="text-[11px] text-zinc-500">Переименование и удаление не меняют прошлые дни: там метка остаётся текстом.</p>
        {settings.spheres.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <input className={`${input} w-24`} defaultValue={s.label} onBlur={(e) => e.target.value.trim() !== s.label && onSave(renameSphere(settings, s.id, e.target.value))} />
            <input
              className={`${input} flex-1`}
              defaultValue={s.description ?? ''}
              placeholder="Что значит"
              onBlur={(e) => e.target.value !== (s.description ?? '') && onSave(renameSphere(settings, s.id, s.label, e.target.value))}
            />
            <button className={del} onClick={() => onSave(removeSphere(settings, s.id))} title="Удалить сферу">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(addSphere(settings, newSphere));
            setNewSphere('');
          }}
        >
          <input className={`${input} flex-1`} value={newSphere} onChange={(e) => setNewSphere(e.target.value)} placeholder="Новая сфера, например Tr+" />
          <button className={add} disabled={!newSphere.trim()}>
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        </form>
      </section>

      <section className={card}>
        <h3 className={h}>Шаблон БАДов</h3>
        <p className="text-[11px] text-zinc-500">В карточке дня их отмечают галочками.</p>
        {settings.supplements.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <input className={`${input} flex-1`} defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.name && onSave(updateSupplement(settings, s.id, { name: e.target.value.trim() }))} />
            <input className={`${input} w-24`} defaultValue={s.dose ?? ''} placeholder="Доза" onBlur={(e) => e.target.value !== (s.dose ?? '') && onSave(updateSupplement(settings, s.id, { dose: e.target.value }))} />
            <button className={del} onClick={() => onSave(removeSupplement(settings, s.id))} title="Убрать из шаблона">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(addSupplement(settings, newSupp, newDose.trim() || undefined));
            setNewSupp('');
            setNewDose('');
          }}
        >
          <input className={`${input} flex-1`} value={newSupp} onChange={(e) => setNewSupp(e.target.value)} placeholder="Название" />
          <input className={`${input} w-24`} value={newDose} onChange={(e) => setNewDose(e.target.value)} placeholder="Доза" />
          <button className={add} disabled={!newSupp.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      </section>

      <section className={card}>
        <h3 className={h}>Критерии дня</h3>
        <p className="text-[11px] text-zinc-500">
          Всегда есть: сон (ч и качество %), оценка 1–10 и почему, БАДы, вода 2 л, часы фокуса и привычки (сами), заметка. Ниже — свои.
        </p>
        {settings.criteria.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input className={`${input} flex-1`} defaultValue={c.label} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.label && onSave(updateCriterion(settings, c.id, { label: e.target.value.trim() }))} />
            <select className={input} value={c.type} onChange={(e) => onSave(updateCriterion(settings, c.id, { type: e.target.value as CriterionType }))}>
              {(Object.keys(CRITERION_TYPE_LABEL) as CriterionType[]).map((t) => (
                <option key={t} value={t}>
                  {CRITERION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input className={`${input} w-16`} defaultValue={c.unit ?? ''} placeholder="ед." onBlur={(e) => e.target.value !== (c.unit ?? '') && onSave(updateCriterion(settings, c.id, { unit: e.target.value || undefined }))} />
            <button className={del} onClick={() => onSave(removeCriterion(settings, c.id))} title="Удалить критерий">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(addCriterion(settings, newCrit, newCritType));
            setNewCrit('');
          }}
        >
          <input className={`${input} flex-1`} value={newCrit} onChange={(e) => setNewCrit(e.target.value)} placeholder="Новый критерий" />
          <select className={input} value={newCritType} onChange={(e) => setNewCritType(e.target.value as CriterionType)}>
            {(Object.keys(CRITERION_TYPE_LABEL) as CriterionType[]).map((t) => (
              <option key={t} value={t}>
                {CRITERION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <button className={add} disabled={!newCrit.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      </section>

      <SleepImport month={month} />
    </div>
  );
}

// ─── Импорт сна (Sleep Cycle CSV, Google Fit) ────────────────────────────────

function SleepImport({ month }: { month: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchFit = async (token: string) => {
    const [y, m] = month.split('-').map(Number);
    setBusy(true);
    const res = await fetchGoogleFitSleepData(token, y, m);
    setBusy(false);
    if (res.error) return setMsg(res.error);
    for (const s of res.sessions) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s.dateStr)) patchDay(s.dateStr, { sleepMin: s.durationMinutes, sleepQuality: s.sleepQualityPercent });
    }
    setMsg(res.sessions.length ? `Google Fit: ночей ${res.sessions.length}` : 'Google Fit ответил, но ночей за месяц нет');
  };

  const onFit = () => {
    const cfg = loadGoogleFitConfig();
    if (cfg.accessToken && cfg.tokenExpiresAt > Date.now()) return void fetchFit(cfg.accessToken);
    initGoogleFitTokenAuth(
      cfg.clientId,
      (token, expiresIn) => {
        saveGoogleFitConfig({ ...cfg, accessToken: token, tokenExpiresAt: Date.now() + expiresIn * 1000, isConnected: true });
        void fetchFit(token);
      },
      (err) => setMsg(`Google: ${err?.message || err?.error || 'вход не выполнен'}`),
    );
  };

  return (
    <section className="p-4 rounded-[20px] bg-[#101014] border border-white/[0.07] space-y-3">
      <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-zinc-500">Импорт сна</h3>
      <p className="text-[11px] text-zinc-500">Сон из Sleep Cycle: загрузите CSV или впишите вручную.</p>
      <div className="flex flex-wrap gap-2">
        <SleepCsvButton />
        <button onClick={onFit} disabled={busy} className="h-8 px-3 rounded-[10px] text-xs font-medium bg-[#16161f] border border-white/[0.12] text-zinc-200 disabled:opacity-50">
          {busy ? 'Загрузка…' : `Google Fit за ${monthTitle(month).toLowerCase()}`}
        </button>
      </div>
      {msg && <p className="text-[11px] text-zinc-400">{msg}</p>}
    </section>
  );
}

// ─── Загрузка CSV Sleep Cycle ────────────────────────────────────────────────

/** Кнопка «Загрузить CSV Sleep Cycle»: сон и качество по датам; заполненные дни — только после подтверждения */
function SleepCsvButton() {
  const days = useBigDataDays();
  const [msg, setMsg] = useState<string | null>(null);

  const onCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const nights = parseSleepCycleCsv(String(reader.result ?? ''));
      if (!nights.length) return setMsg('В файле не нашлось ночей Sleep Cycle (нужны колонки Start;End;…)');
      const plan = planSleepImport(nights, days);
      const overwrite =
        plan.conflicts.length > 0 &&
        window.confirm(
          `В ${plan.conflicts.length} дн. сон уже заполнен другими значениями (${plan.conflicts
            .slice(0, 5)
            .map((c) => c.date)
            .join(', ')}${plan.conflicts.length > 5 ? '…' : ''}). Перезаписать их данными из файла?`,
        );
      const res = applySleepImport(plan, overwrite);
      for (const w of res.writes) patchDay(w.date, w.patch);
      setMsg(`Sleep Cycle: добавлено ${res.added}, пропущено ${res.skipped}`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="inline-flex items-center gap-2">
      {msg && <span className="text-[11px] text-zinc-400">{msg}</span>}
      <label className="h-8 px-3 rounded-[10px] text-xs font-medium bg-[#16161f] border border-white/[0.12] text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer hover:text-white">
        <Upload className="w-3.5 h-3.5" /> Загрузить CSV Sleep Cycle
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} />
      </label>
    </div>
  );
}

// ─── Биометрия: замеры тела и анализы ────────────────────────────────────────

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function fmtDate(date: string) {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

function BiometricsPanel({ today }: { today: string }) {
  const { state, add, remove } = useBiometrics();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BioCard kind="body" title="Замеры тела" icon={<Activity className="w-3.5 h-3.5" />} today={today} state={state} onAdd={add} onRemove={remove} />
      <BioCard
        kind="labs"
        title="Анализы гормонов"
        icon={<FlaskConical className="w-3.5 h-3.5" />}
        today={today}
        state={state}
        onAdd={add}
        onRemove={remove}
        hint="Анализы обычно раз в 2–3 месяца. Эстрадиол: пг/мл = нг/л."
      />
    </div>
  );
}

function BioCard({
  kind,
  title,
  icon,
  today,
  state,
  onAdd,
  onRemove,
  hint,
}: {
  kind: BioKind;
  title: string;
  icon: React.ReactNode;
  today: string;
  state: ReturnType<typeof useBiometrics>['state'];
  onAdd: (kind: BioKind, date: string, values: Record<string, number>, note?: string) => void;
  onRemove: (id: string) => void;
  hint?: string;
}) {
  const fields = BIO_FIELDS[kind];
  const [date, setDate] = useState(today);
  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const latest = useMemo(() => bioLatest(state, kind), [state, kind]);
  const history = useMemo(() => bioHistory(state, kind), [state, kind]);
  const values = parseBioValues(kind, form);
  const canSave = Object.keys(values).length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const card = 'p-4 rounded-[20px] bg-[#101014] border border-white/[0.07] space-y-3';
  const h = 'text-[11px] font-semibold tracking-[0.06em] uppercase text-zinc-500 inline-flex items-center gap-1.5';
  const input = 'bg-[#09090c] border border-white/[0.08] focus:border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none';

  return (
    <section className={card}>
      <h3 className={h}>
        {icon} {title}
      </h3>
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}

      {latest.length === 0 ? (
        <p className="text-xs text-zinc-500">Записей пока нет — добавь первую ниже.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {latest.map((l) => (
            <div key={l.field.id} className="p-2.5 rounded-xl bg-[#0e0e13] border border-white/[0.06]">
              <div className="text-[10px] text-zinc-500">{l.field.label}</div>
              <div className="text-sm font-mono text-zinc-100">
                {fmtNum(l.value)} <span className="text-[10px] text-zinc-500">{l.field.unit}</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                {fmtDate(l.date)}
                {l.delta !== undefined && l.prev && (
                  <span className={l.delta === 0 ? ' text-zinc-500' : ' text-zinc-300'} title={`к ${fmtDate(l.prev.date)}: ${fmtNum(l.prev.value)} ${l.field.unit}`}>
                    {' '}
                    {l.delta > 0 ? '+' : ''}
                    {fmtNum(l.delta)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="space-y-2 pt-2 border-t border-white/[0.05]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onAdd(kind, date, values, note);
          setForm({});
          setNote('');
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">{kind === 'labs' ? 'Дата анализа' : 'Дата замера'}</span>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fields.map((f) => (
            <label key={f.id} className="space-y-1">
              <span className="block text-[10px] text-zinc-500">
                {f.label}, {f.unit}
              </span>
              <input
                className={`${input} w-full font-mono`}
                inputMode="decimal"
                value={form[f.id] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [f.id]: e.target.value }))}
                placeholder="—"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={`${input} flex-1`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка (необязательно)" />
          <button
            disabled={!canSave}
            className="h-8 px-3 rounded-[10px] text-xs font-medium bg-[#16161f] border border-white/[0.12] text-zinc-200 inline-flex items-center gap-1 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Сохранить
          </button>
        </div>
      </form>

      {history.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-white/[0.05]">
          <div className="text-[10px] uppercase tracking-[0.06em] text-zinc-600">История</div>
          {history.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-[11px]">
              <span className="font-mono text-zinc-400 shrink-0">{fmtDate(e.date)}</span>
              <span className="flex-1 text-zinc-300">
                {fields
                  .filter((f) => typeof e.values[f.id] === 'number')
                  .map((f) => `${f.label} ${fmtNum(e.values[f.id])} ${f.unit}`)
                  .join(' · ')}
                {e.note && <span className="text-zinc-500"> — {e.note}</span>}
              </span>
              <button
                className="p-1 rounded-lg text-zinc-600 hover:text-rose-400"
                title="Удалить запись"
                onClick={() => window.confirm(`Удалить запись от ${fmtDate(e.date)}?`) && onRemove(e.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
