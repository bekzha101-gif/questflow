import { useMemo } from 'react';
import { Coins, Flame, Heart, Lock, Trophy } from 'lucide-react';
import type { AchievementRow, BigDataDay, FocusSession, GameEvent, GameStats } from '@shared/types';
import { ACHIEVEMENTS, RULES, levelProgress, shopLocked } from '@shared/gamification';
import { todayStr } from '@shared/time';
import { useCollection } from '../../store';
import { focusSeries, lastDates, scoreSeries } from './series';

// «Прогресс» → «Обзор»: уровень, серия, графики фокуса и оценки дня, ачивки, правила штрафов, журнал.

const DAYS = 30;

const KIND_LABEL: Record<string, string> = {
  focus_block: 'Блок фокуса',
  habit: 'Привычка',
  daily: 'Ежедневное',
  task: 'Задача',
  bad_habit: 'Вредная привычка',
  video_published: 'Публикация видео',
  goal_week: 'Цель недели',
  goal_month: 'Цель месяца',
  recovery_activity: 'Восстановление',
  bigdata_fill: 'День Big Data',
  health_penalty: 'Здоровье: штраф',
  health_recovery: 'Здоровье: восстановление',
  income: 'Доход',
  day_close: 'Итог дня',
  evening_missed: 'Пропущен вечерний разговор',
  purchase: 'Покупка',
  bonus: 'Награда',
  level_up: 'Новый уровень',
  hp_zero: 'HP 0',
  achievement: 'Ачивка',
};

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-200">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Столбики по дням (SVG); горизонтальная линия — норма */
function Bars({ values, max, norm, color, label }: { values: (number | null)[]; max: number; norm?: number; color: string; label: (v: number) => string }) {
  const w = 600;
  const h = 120;
  const bw = w / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28" preserveAspectRatio="none" role="img">
      {norm !== undefined && <line x1={0} x2={w} y1={h - (norm / max) * h} y2={h - (norm / max) * h} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />}
      {values.map((v, i) =>
        v === null || v <= 0 ? null : (
          <rect key={i} x={i * bw + 1.5} width={Math.max(1, bw - 3)} y={h - (Math.min(v, max) / max) * h} height={(Math.min(v, max) / max) * h} rx={2} fill={color}>
            <title>{label(v)}</title>
          </rect>
        ),
      )}
    </svg>
  );
}

export function ProgressOverview({ stats }: { stats: GameStats }) {
  const today = todayStr();
  const { items: sessions } = useCollection<FocusSession>('focus_sessions');
  const { items: days } = useCollection<BigDataDay>('bigdata_days');
  const { items: unlocked } = useCollection<AchievementRow>('achievements');
  const { items: journal } = useCollection<GameEvent>('game_events');

  const dates = useMemo(() => lastDates(today, DAYS), [today]);
  const focus = useMemo(() => focusSeries(sessions, dates).map((m) => Math.round((m / 60) * 10) / 10), [sessions, dates]);
  const scores = useMemo(() => scoreSeries(days, dates), [days, dates]);
  const recent = useMemo(() => [...journal].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 15), [journal]);

  const avgFocus = focus.length ? Math.round((focus.reduce((a, b) => a + b, 0) / focus.length) * 10) / 10 : 0;
  const scored = scores.filter((s): s is number => s !== null);
  const avgScore = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;
  const pct = levelProgress(stats);
  const locked = shopLocked(stats);
  const unlockedAt = new Map(unlocked.map((a) => [a.id, a.unlockedAt]));

  return (
    <div className="space-y-3">
      {/* Уровень и ресурсы */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="col-span-2 bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-zinc-500">Уровень</span>
            <span className="text-[11px] font-mono text-zinc-500">
              {stats.exp} / {stats.maxExp} EXP
            </span>
          </div>
          <div className="text-3xl font-semibold text-zinc-100 font-mono mt-1">{stats.level}</div>
          <div className="h-1.5 rounded-full bg-white/[0.06] mt-3 overflow-hidden">
            <div className="h-full bg-purple-400/80" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Доход тоже поднимает уровень: каждые $100 — {RULES.incomeExpPer100} EXP. Всего: ${Number(stats.incomeUsdTotal ?? 0)}.
          </p>
        </div>
        <div className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Серия
          </div>
          <div className="text-2xl font-semibold font-mono text-zinc-100 mt-1">{stats.streak}</div>
          <div className="text-[11px] text-zinc-500">лучшая: {Number(stats.bestStreak ?? stats.streak)}</div>
        </div>
        <div className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> HP
            </span>
            <span className="font-mono text-zinc-200">
              {stats.hp}/{stats.maxHp}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Золото
            </span>
            <span className="font-mono text-zinc-200">{stats.gold}</span>
          </div>
          {locked && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-300 pt-1">
              <Lock className="w-3 h-3" /> магазин закрыт до полного дня
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title={`Часы фокуса, ${DAYS} дней`} right={<span className="text-[11px] font-mono text-zinc-500">в среднем {avgFocus} ч</span>}>
          <Bars values={focus} max={8} norm={RULES.norm.focusMin / 60} color="rgba(168,85,247,0.75)" label={(v) => `${v} ч`} />
          <div className="flex justify-between text-[10px] font-mono text-zinc-600 mt-1">
            <span>{dates[0].slice(5)}</span>
            <span>норма {RULES.norm.focusMin / 60} ч</span>
            <span>{dates[dates.length - 1].slice(5)}</span>
          </div>
        </Card>
        <Card title={`Оценка дня, ${DAYS} дней`} right={<span className="text-[11px] font-mono text-zinc-500">{avgScore === null ? 'нет оценок' : `в среднем ${avgScore}`}</span>}>
          <Bars values={scores} max={10} color="rgba(52,211,153,0.7)" label={(v) => `${v} / 10`} />
          <div className="flex justify-between text-[10px] font-mono text-zinc-600 mt-1">
            <span>{dates[0].slice(5)}</span>
            <span>{dates[dates.length - 1].slice(5)}</span>
          </div>
        </Card>
      </div>

      <Card title="Ачивки" right={<span className="text-[11px] font-mono text-zinc-500">{unlockedAt.size} / {ACHIEVEMENTS.length}</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const at = unlockedAt.get(a.id);
            return (
              <div key={a.id} className={`p-3 rounded-xl border ${at ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-white/[0.06] opacity-60'}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                  <Trophy className={`w-3.5 h-3.5 ${at ? 'text-amber-300' : 'text-zinc-600'}`} />
                  {a.title}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{a.description}</div>
                <div className="text-[10px] font-mono text-zinc-600 mt-1">{at ? `открыта ${String(at).slice(0, 10)}` : 'закрыта'}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Правила">
          <ul className="space-y-1.5 text-[11px] text-zinc-400">
            <li>Полный блок фокуса 120 мин: +{Math.round(120 * RULES.focus.expPerMin) + RULES.focus.fullBlockExp} EXP, +{Math.round(120 * RULES.focus.goldPerMin) + RULES.focus.fullBlockGold} золота</li>
            <li>Привычка +{RULES.habit.exp} EXP / +{RULES.habit.gold}; публикация видео +{RULES.videoPublished.exp} / +{RULES.videoPublished.gold}</li>
            <li>Цель недели +{RULES.goalWeek.exp} / +{RULES.goalWeek.gold}; цель месяца +{RULES.goalMonth.exp} / +{RULES.goalMonth.gold}</li>
            <li>Пятница с восстановлением: +{RULES.recoveryDay.hp} HP, +{RULES.recoveryDay.exp} EXP, +{RULES.recoveryDay.gold} золота</li>
            <li>Серия +1: день с 3 блоками и всеми привычками. Пятница серию не рвёт</li>
            <li className="text-rose-300/90">Норма не выполнена (кроме пятницы): {RULES.missedNorm.hp} HP, {RULES.missedNorm.gold} золота, серия 0</li>
            <li className="text-rose-300/90">Пропущена привычка: серия 0</li>
            <li className="text-rose-300/90">Нет ответа на вечерний разговор после напоминания в 22:00: {RULES.eveningMissed.hp} HP</li>
            <li className="text-rose-300/90">HP 0: сгорает {Math.round(RULES.hpZero.goldBurnPct * 100)}% золота, прогресс уровня в 0 (уровень остаётся), серия 0, магазин закрыт до полного дня</li>
          </ul>
        </Card>
        <Card title="Журнал">
          {recent.length === 0 ? (
            <p className="text-[11px] text-zinc-600">Событий пока нет</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-zinc-400 truncate">
                    <span className="font-mono text-zinc-600 mr-1.5">{String(e.at).slice(5, 10)}</span>
                    {KIND_LABEL[e.kind] ?? e.kind}
                  </span>
                  <span className="font-mono shrink-0 space-x-1.5">
                    {!!e.deltaExp && <span className="text-purple-300">{e.deltaExp > 0 ? '+' : ''}{e.deltaExp} EXP</span>}
                    {!!e.deltaGold && <span className={e.deltaGold > 0 ? 'text-amber-300' : 'text-rose-300'}>{e.deltaGold > 0 ? '+' : ''}{e.deltaGold}</span>}
                    {!!e.deltaHp && <span className={e.deltaHp > 0 ? 'text-emerald-300' : 'text-rose-300'}>{e.deltaHp > 0 ? '+' : ''}{e.deltaHp} HP</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
