// Тексты, которые бот отправляет. Без эмодзи, коротко.

/** 7380 → «2ч 03м» */
export function formatDuration(totalSec: number): string {
  const min = Math.max(0, Math.floor(totalSec / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}ч ${String(m).padStart(2, '0')}м`;
}

export const TEXT = {
  privateBot: 'Этот бот приватный.',
  bound: 'Готово: бот привязан к тебе. Утром в 8:00 — главная задача дня, вечером в 21:00 — разговор о дне.',
  alive: 'Бот работает.',
  needStart: 'Отправь /start, чтобы привязать бота.',
  thursday: 'Завтра пятница — день восстановления: без работы и интернета. Баня или бассейн, прогулка, медитация, массаж.',
  breakOver: (nextBlock: number, total: number) =>
    nextBlock <= total
      ? `Отдых закончился. Можно начинать блок ${nextBlock} из ${total}.`
      : 'Отдых закончился.',
  workOver: (workedSec: number) => `Пора на отдых. Ты проработал ${formatDuration(workedSec)}.`,
  healthAlarm: (title: string) => `Напоминание: ${title}.`,
};

export interface MorningInput {
  mainTask?: string | null;
  firstBlockTask?: string | null;
  blocksPerDay: number;
  workMin: number;
}

/** Утро: не больше 5 строк, без вопросов */
export function morningMessage(input: MorningInput): string {
  const lines = ['Доброе утро.'];
  lines.push(input.mainTask ? `Главная задача дня: ${input.mainTask}.` : 'Главная задача дня не выбрана — выбери её на сайте перед первым блоком.');
  const hours = formatDuration(input.workMin * 60);
  const first = input.firstBlockTask && input.firstBlockTask !== input.mainTask ? ` — ${input.firstBlockTask}` : '';
  lines.push(`Первый блок: ${hours} фокуса сразу после подъёма${first}.`);
  lines.push(`Сегодня ${input.blocksPerDay} блока по ${hours}, между ними отдых 20 минут.`);
  return lines.join('\n');
}
