// График оценки дня (1–10) за месяц: линия оценки, дельта к обычному уровню и подписи у дней-спадов.
// SVG руками, без библиотек. Не ломается при 0 и 1 дне с оценкой.

export interface ScorePoint {
  date: string;
  /** Подпись по оси X — число месяца */
  dayNum: number;
  score: number | null;
  /** Оценка минус среднее прошлых дней (shared/bigdata.dayDelta) */
  delta: number | null;
  isDrop: boolean;
  isRecovery: boolean;
  /** Причины спада (shared/bigdata.explainDrop) */
  reasons: string[];
}

interface BigDataChartProps {
  points: ScorePoint[];
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
}

const W = 800;
const H = 220;
const PAD_L = 28;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 26;

export function BigDataChart({ points, selectedDate, onSelect }: BigDataChartProps) {
  const n = points.length;
  const scored = points.filter((p) => p.score !== null);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  // При одном дне в месяце (или пустом) точка встаёт посередине, деления на ноль нет
  const x = (i: number) => PAD_L + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => PAD_T + innerH - ((Math.min(10, Math.max(0, v)) / 10) * innerH);

  // Линия рвётся на днях без оценки
  const segments: string[] = [];
  let cur = '';
  points.forEach((p, i) => {
    if (p.score === null) {
      if (cur) segments.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)} `;
  });
  if (cur) segments.push(cur);

  const selected = points.find((p) => p.date === selectedDate && p.score !== null) ?? null;
  const drops = points.filter((p) => p.isDrop);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] h-auto" role="img" aria-label="Оценка дня по дням месяца">
          {[2, 4, 6, 8, 10].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.05)" />
              <text x={PAD_L - 8} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#52525b" fontFamily="ui-monospace, monospace">
                {v}
              </text>
            </g>
          ))}

          {points.map((p, i) =>
            p.isRecovery ? (
              <rect
                key={`r-${p.date}`}
                x={x(i) - (n <= 1 ? 10 : innerW / (n - 1) / 2)}
                y={PAD_T}
                width={n <= 1 ? 20 : innerW / (n - 1)}
                height={innerH}
                fill="rgba(52,211,153,0.05)"
              />
            ) : null,
          )}

          {segments.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {points.map((p, i) =>
            p.score === null ? null : (
              <g key={p.date} onClick={() => onSelect?.(p.date)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <circle cx={x(i)} cy={y(p.score)} r="10" fill="transparent" />
                <circle
                  cx={x(i)}
                  cy={y(p.score)}
                  r={p.date === selectedDate ? 5 : p.isDrop ? 4.5 : 3}
                  fill={p.isDrop ? '#fb7185' : '#a78bfa'}
                  stroke="#09090c"
                  strokeWidth="1.5"
                />
                {p.isDrop && p.delta !== null && (
                  <text x={x(i)} y={y(p.score) + 16} textAnchor="middle" fontSize="9" fill="#fb7185" fontFamily="ui-monospace, monospace">
                    {p.delta.toFixed(1)}
                  </text>
                )}
              </g>
            ),
          )}

          {points.map((p, i) =>
            n <= 16 || p.dayNum % 2 === 1 ? (
              <text
                key={`x-${p.date}`}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="9"
                fill={p.isRecovery ? '#34d399' : '#52525b'}
                fontFamily="ui-monospace, monospace"
              >
                {p.dayNum}
              </text>
            ) : null,
          )}
        </svg>

        {scored.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
            В этом месяце ещё нет оценок дня
          </div>
        )}
      </div>

      {selected && (
        <div className="text-xs text-zinc-300 px-1">
          <span className="font-mono text-zinc-100">{selected.dayNum}</span> · оценка{' '}
          <span className="font-mono text-zinc-100">{selected.score}</span>
          {selected.delta !== null && (
            <span className={`font-mono ml-1 ${selected.delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              ({selected.delta > 0 ? '+' : ''}
              {selected.delta.toFixed(1)} к обычному)
            </span>
          )}
        </div>
      )}

      {drops.length > 0 && (
        <div className="space-y-2">
          {drops.map((p) => (
            <div key={p.date} className="p-3 rounded-xl bg-rose-500/[0.05] border border-rose-500/20">
              <div className="text-xs font-medium text-rose-200">
                {p.dayNum}-е: спад до {p.score}
                {p.delta !== null && <span className="font-mono text-rose-400 ml-1">({p.delta.toFixed(1)})</span>}
              </div>
              {p.reasons.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {p.reasons.map((r) => (
                    <li key={r} className="text-[11px] text-zinc-400">
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] text-zinc-500">В данных дня не видно причины — запиши её в «почему».</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
