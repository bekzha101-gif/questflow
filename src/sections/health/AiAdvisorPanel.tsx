// Кнопка «Спросить Claude о месяце»: запрос уходит в kv, компьютер с ботом анализирует месяц
// через Claude, ответ появляется здесь и в Telegram.
import { useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { ADVISOR_QUESTION_MAX, canRequestAdvisor } from '@shared/aiAdvisor';
import { useAiAdvisor } from './aiAdvisor';

function when(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <h4 className={`text-[11px] font-mono uppercase tracking-wider ${color}`}>{title}</h4>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-xs text-zinc-200 leading-relaxed">
            • {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiAdvisorPanel() {
  const { state, view, request } = useAiAdvisor();
  const [question, setQuestion] = useState('');
  const canAsk = canRequestAdvisor(view);
  const last = state?.last;

  const ask = () => {
    if (!canAsk) return;
    request(question);
    setQuestion('');
  };

  return (
    <div className="bg-[#111115] border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center gap-2.5">
        <Bot className="w-5 h-5 text-purple-400" />
        <div>
          <h3 className="text-sm font-bold text-white">Claude — советник по здоровью и жизни</h3>
          <p className="text-[11px] text-zinc-400">
            Компьютер дома разбирает последние 30 дней (сон, еда, БАДы, фокус, привычки, HP). Ответ придёт сюда и в Telegram.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, ADVISOR_QUESTION_MAX))}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Вопрос (необязательно): например, помогает ли магний со сном?"
          className="flex-1 bg-[#16161c] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-purple-500/50"
        />
        <button
          onClick={ask}
          disabled={!canAsk}
          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs cursor-pointer transition-all shadow-md whitespace-nowrap"
        >
          Спросить Claude о месяце
        </button>
      </div>

      {view.kind === 'waiting' && (
        <p className="text-xs text-zinc-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ждёт компьютер с ботом…
        </p>
      )}
      {view.kind === 'processing' && (
        <p className="text-xs text-purple-300 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Claude анализирует месяц (обычно 1–3 минуты)…
        </p>
      )}
      {(view.kind === 'error' || view.kind === 'offline') && (
        <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-900/40 rounded-xl p-2.5">{view.message}</p>
      )}

      {last ? (
        <div className="space-y-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] font-mono text-zinc-500">Ответ от {when(last.at)}</p>
          {last.question && <p className="text-xs text-zinc-400">Вопрос: {last.question}</p>}
          {last.answer && <p className="text-xs text-white leading-relaxed">{last.answer}</p>}
          {last.summary && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200">{last.summary}</div>
          )}
          <List title="Что помогает" items={last.good} color="text-emerald-400" />
          <List title="Что мешает" items={last.better} color="text-rose-400" />
          <List title="Что сделать" items={last.boost} color="text-amber-400" />
        </div>
      ) : (
        view.kind === 'idle' && <p className="text-xs text-zinc-500">Ответов пока нет. Нажмите кнопку, чтобы Claude разобрал месяц.</p>
      )}
    </div>
  );
}
