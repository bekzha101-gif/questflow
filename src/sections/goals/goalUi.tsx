// Мелкие общие элементы раздела «Цели»
export const FIELD =
  'bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25';

export function ProgressBar({ pct, tone = 'purple' }: { pct: number; tone?: 'purple' | 'emerald' | 'amber' }) {
  const color = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-purple-500';
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TrackBadge({ onTrack }: { onTrack: boolean }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-md border ${
        onTrack ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      }`}
    >
      {onTrack ? 'в графике' : 'отстаёшь'}
    </span>
  );
}
