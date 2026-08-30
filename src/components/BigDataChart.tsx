import React, { useState } from 'react';
import { DailyLogEntry } from '../utils/bigDataTracker';

interface BigDataChartProps {
  days: DailyLogEntry[];
}

export function BigDataChart({ days }: BigDataChartProps) {
  const [hoveredDay, setHoveredDay] = useState<DailyLogEntry | null>(null);

  const width = 800;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Max / Min scales
  const maxScore = 10;
  const maxSleep = 12; // hours

  const points = days.map((d, index) => {
    const x = padding.left + (index / (days.length - 1)) * chartWidth;
    const scoreVal = d.score !== null ? d.score : 0;
    const yScore = padding.top + chartHeight - (scoreVal / maxScore) * chartHeight;

    const sleepHours = d.sleepMinutes ? d.sleepMinutes / 60 : 0;
    const ySleep = padding.top + chartHeight - (Math.min(sleepHours, maxSleep) / maxSleep) * chartHeight;

    return { day: d, x, yScore, ySleep, scoreVal, sleepHours };
  });

  // SVG Paths
  const scorePath = points
    .filter((p) => p.scoreVal > 0)
    .reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.yScore}`, '');

  const sleepPath = points
    .filter((p) => p.sleepHours > 0)
    .reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.ySleep}`, '');

  return (
    <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            График Месяца: Сон (ч) vs Оценка Фокуса (1-10)
          </h3>
          <p className="text-[11px] text-zinc-500">Наведите курсор на точку для детального анализа дня</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-300">Оценка дня</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span className="text-zinc-300">Сон (часов)</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 select-none overflow-visible">
          <defs>
            {/* Emerald Line Gradient */}
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </linearGradient>
            {/* Indigo Line Gradient */}
            <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 2.5, 5, 7.5, 10].map((val) => {
            const y = padding.top + chartHeight - (val / 10) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#ffffff"
                  strokeOpacity="0.06"
                  strokeDasharray="4 4"
                />
                <text x={padding.left - 8} y={y + 3} textAnchor="end" fill="#71717a" fontSize="9" fontFamily="monospace">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Sleep Path */}
          {sleepPath && (
            <path
              d={sleepPath}
              fill="none"
              stroke="#818cf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-md"
            />
          )}

          {/* Score Path */}
          {scorePath && (
            <path
              d={scorePath}
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-md"
            />
          )}

          {/* Interactive Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              {/* Vertical Guide when hovered */}
              {hoveredDay?.day === p.day.day && (
                <line
                  x1={p.x}
                  y1={padding.top}
                  x2={p.x}
                  y2={padding.top + chartHeight}
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Day Number X Axis */}
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                fill={hoveredDay?.day === p.day.day ? '#ffffff' : '#52525b'}
                fontSize="9"
                fontFamily="monospace"
                fontWeight={hoveredDay?.day === p.day.day ? 'bold' : 'normal'}
              >
                {p.day.day}
              </text>

              {/* Score dot */}
              {p.scoreVal > 0 && (
                <circle
                  cx={p.x}
                  cy={p.yScore}
                  r={hoveredDay?.day === p.day.day ? 5 : 3}
                  fill="#34d399"
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredDay(p.day)}
                />
              )}

              {/* Sleep dot */}
              {p.sleepHours > 0 && (
                <circle
                  cx={p.x}
                  cy={p.ySleep}
                  r={hoveredDay?.day === p.day.day ? 5 : 3}
                  fill="#818cf8"
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredDay(p.day)}
                />
              )}

              {/* Invisible touch overlay for easier hover */}
              <rect
                x={p.x - 10}
                y={padding.top}
                width={20}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredDay(p.day)}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Hovered Tooltip Card */}
      {hoveredDay && (
        <div className="p-3 rounded-2xl bg-[#181820] border border-purple-500/30 flex items-center justify-between flex-wrap gap-3 animate-fade-in text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white font-mono bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-lg border border-purple-500/40">
              День {hoveredDay.day} ({hoveredDay.dayOfWeek})
            </span>
            <span className="text-zinc-300 font-medium">{hoveredDay.why || 'Без заметок'}</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-emerald-400 font-bold">Оценка: {hoveredDay.score ?? '—'}/10</span>
            <span className="text-indigo-400 font-bold">Сон: {hoveredDay.sleep || '—'}</span>
            {hoveredDay.tags.length > 0 && (
              <span className="text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {hoveredDay.tags.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
