import { describe, expect, it, vi } from 'vitest';
import { runTick, type SchedulerDeps, type ConversationApi, type PublicationReminder } from './scheduler';
import type { BotSettings, HealthAlarm, Task, TimerState } from '../../shared/types';
import type { Db } from './db';

// Бишкек = UTC+6. 2026-11-17 — вторник, 11-19 — четверг, 11-20 — пятница, 11-22 — воскресенье.
const bishkek = (date: string, hm: string) => new Date(`${date}T${hm}:00+06:00`);

interface World {
  settings: BotSettings;
  timer: TimerState | null;
  alarms: HealthAlarm[];
  tasks: Task[];
  kv: Record<string, unknown>;
  sent: string[];
  calls: string[];
  notified: (string | null | undefined)[];
}

function makeWorld(over: Partial<World> = {}): World {
  return {
    settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: {} },
    timer: null,
    alarms: [],
    tasks: [],
    kv: {},
    sent: [],
    calls: [],
    notified: [],
    ...over,
  };
}

function deps(w: World, reminders: PublicationReminder[] = []): SchedulerDeps {
  const db: Db = {
    getBotSettings: async () => w.settings,
    saveBotSettings: async (p) => {
      w.settings = { ...w.settings, ...p };
    },
    getTimerState: async () => w.timer,
    markTimerNotified: async (startedAt) => {
      w.notified.push(startedAt);
      if (w.timer) w.timer = { ...w.timer, notifiedEnd: true };
    },
    listHealthAlarms: async () => w.alarms,
    listTasks: async () => w.tasks,
    listChannels: async () => [],
    listVideos: async () => [],
    listFocusSessions: async () => [],
    getKv: async <T,>(key: string) => (w.kv[key] as T) ?? null,
    dumpAll: async () => ({}),
  };
  const conversation: ConversationApi = {
    startEvening: async (d) => void w.calls.push(`evening:${d}`),
    eveningReminder: async (d) => void w.calls.push(`reminder:${d}`),
    weeklyReport: async (d) => void w.calls.push(`weekly:${d}`),
    monthlyReport: async (d) => void w.calls.push(`monthly:${d}`),
    handleUpdate: async () => {},
  };
  return {
    db,
    send: async (text) => {
      w.sent.push(text);
      return true;
    },
    conversation,
    remindersFor: async () => reminders,
    backup: async () => void w.calls.push('backup'),
  };
}

/** Прогон тиков каждые 30 с в интервале [from, to) */
async function runRange(d: SchedulerDeps, date: string, from: string, to: string) {
  const start = bishkek(date, from).getTime();
  const end = bishkek(date, to).getTime();
  for (let t = start; t < end; t += 30_000) await runTick(d, new Date(t));
}

describe('scheduler: утро по Бишкеку', () => {
  it('во вторник в 8:00 — одно короткое сообщение с главной задачей и первым блоком, без вопросов', async () => {
    const w = makeWorld({ kv: { 'plan:2026-11-17': { mainTask: 'Смонтировать видео AKKDLASA' } } });
    const d = deps(w);
    await runRange(d, '2026-11-17', '07:58', '08:30');
    expect(w.sent).toHaveLength(1);
    const msg = w.sent[0];
    expect(msg).toContain('Смонтировать видео AKKDLASA');
    expect(msg).toContain('Первый блок');
    expect(msg.split('\n').length).toBeLessThanOrEqual(5);
    expect(msg).not.toContain('?');
  });

  it('утро не уходит до 8:00 по Бишкеку (хотя по UTC уже день)', async () => {
    const w = makeWorld();
    await runRange(deps(w), '2026-11-17', '06:00', '07:59');
    expect(w.sent).toHaveLength(0);
  });

  it('без плана берёт задачу дня из tasks2 (не покупку, не выполненную)', async () => {
    const w = makeWorld({
      tasks: [
        { id: 's', title: 'Купить молоко', type: 'todo', kind: 'shopping', dueDate: '2026-11-17' },
        { id: 'd', title: 'Старая готовая', type: 'todo', completed: true, dueDate: '2026-11-17' },
        { id: 't', title: 'Сменить превью AGENT CODE', type: 'todo', dueDate: '2026-11-17', priority: 'p1' },
      ],
    });
    await runRange(deps(w), '2026-11-17', '08:00', '08:01');
    expect(w.sent[0]).toContain('Сменить превью AGENT CODE');
    expect(w.sent[0]).not.toContain('молоко');
  });
});

describe('scheduler: пятница — тишина, четверг — «завтра восстановление»', () => {
  it('в пятницу за все сутки ни одного сообщения и ни одного вызова разговора; бэкап — есть', async () => {
    const w = makeWorld({
      alarms: [{ id: 'm', title: 'Медитация', time: '17:15', enabled: true, type: 'meditation' }],
      timer: {
        phase: 'work', running: true, startedAt: '2026-11-20T03:00:00.000Z', accumulatedSec: 0,
        targetMin: 120, blockIndex: 0, date: '2026-11-20', notifiedEnd: false,
      },
    });
    const d = deps(w, [{ channelId: 'c', text: 'завтра видео на X' }]);
    await runRange(d, '2026-11-20', '00:00', '23:59');
    expect(w.sent).toEqual([]);
    expect(w.calls).toEqual(['backup']);
  });

  it('в четверг вечером — «завтра восстановление» один раз, потом вечерний разговор', async () => {
    const w = makeWorld();
    await runRange(deps(w), '2026-11-19', '20:50', '21:30');
    expect(w.sent.filter((t) => t.includes('восстановлен'))).toHaveLength(1);
    expect(w.calls).toEqual(['evening:2026-11-19']);
  });

  it('во вторник вечером нет «завтра восстановление»', async () => {
    const w = makeWorld();
    await runRange(deps(w), '2026-11-17', '20:50', '21:30');
    expect(w.sent.some((t) => t.includes('восстановлен'))).toBe(false);
  });
});

describe('scheduler: точки вызова разговора и отчётов', () => {
  it('21:00 — startEvening, 22:00 — одно напоминание, по одному разу', async () => {
    const w = makeWorld();
    await runRange(deps(w), '2026-11-17', '20:59', '23:00');
    expect(w.calls).toEqual(['evening:2026-11-17', 'reminder:2026-11-17']);
  });

  it('воскресенье — недельный отчёт; последний день месяца — месячный', async () => {
    const w = makeWorld();
    const d = deps(w);
    await runRange(d, '2026-11-22', '21:00', '21:02');
    await runRange(d, '2026-11-30', '21:00', '21:02');
    expect(w.calls).toEqual([
      'evening:2026-11-22', 'weekly:2026-11-22',
      'evening:2026-11-30', 'monthly:2026-11-30',
    ]);
  });

  it('ночью 03:00 — бэкап один раз', async () => {
    const w = makeWorld();
    await runRange(deps(w), '2026-11-17', '02:50', '04:10');
    expect(w.calls).toEqual(['backup']);
  });
});

describe('scheduler: напоминания о публикациях — не больше 3 в день', () => {
  const five: PublicationReminder[] = [1, 2, 3, 4, 5].map((i) => ({ channelId: `c${i}`, text: `Завтра видео на канале ${i} — запусти монтаж сегодня.` }));

  it('из 5 напоминаний уходит 3, повторные тики не добавляют', async () => {
    const w = makeWorld();
    await runRange(deps(w, five), '2026-11-17', '08:00', '12:00');
    const pubs = w.sent.filter((t) => t.startsWith('Завтра видео'));
    expect(pubs).toHaveLength(3);
  });

  it('счётчик переживает перезапуск (хранится в bot_settings.last_sent)', async () => {
    const w = makeWorld();
    await runRange(deps(w, five), '2026-11-17', '08:00', '08:01');
    // «перезапуск»: новый набор зависимостей, тот же мир
    await runRange(deps(w, five), '2026-11-17', '08:01', '09:00');
    expect(w.sent.filter((t) => t.startsWith('Завтра видео'))).toHaveLength(3);
  });

  it('лимит из настроек меньше 3 соблюдается, больше 3 — режется до 3', async () => {
    const w1 = makeWorld();
    w1.settings.reminderLimit = 1;
    await runRange(deps(w1, five), '2026-11-17', '08:00', '08:05');
    expect(w1.sent.filter((t) => t.startsWith('Завтра видео'))).toHaveLength(1);
    const w2 = makeWorld();
    w2.settings.reminderLimit = 10;
    await runRange(deps(w2, five), '2026-11-17', '08:00', '08:05');
    expect(w2.sent.filter((t) => t.startsWith('Завтра видео'))).toHaveLength(3);
  });
});

describe('scheduler: таймер — сообщение один раз (notified_end)', () => {
  const workStart = bishkek('2026-11-17', '09:00').toISOString();

  it('конец блока работы → «пора на отдых, ты проработал 2ч 00м» ≤ 60 с, ровно один раз', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'work', running: true, startedAt: workStart, accumulatedSec: 0,
        targetMin: 120, blockIndex: 0, date: '2026-11-17', notifiedEnd: false,
      },
    });
    const d = deps(w);
    await runRange(d, '2026-11-17', '10:59', '11:00');
    expect(w.sent).toHaveLength(0);
    await runTick(d, new Date(bishkek('2026-11-17', '11:00').getTime() + 30_000));
    expect(w.sent).toEqual(['Пора на отдых. Ты проработал 2ч 00м.']);
    expect(w.notified).toEqual([workStart]);
    await runRange(d, '2026-11-17', '11:01', '11:30');
    // «пора на отдых» — ровно один раз; сайт закрыт, поэтому в 11:20 бот сам сообщает конец отдыха
    expect(w.sent.filter((t) => t.startsWith('Пора на отдых'))).toHaveLength(1);
    expect(w.sent).toEqual(['Пора на отдых. Ты проработал 2ч 00м.', 'Отдых закончился. Можно начинать блок 1 из 3.']);
  });

  it('если notified_end не сохранился в базе, повторного сообщения всё равно нет', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'work', running: true, startedAt: workStart, accumulatedSec: 0,
        targetMin: 120, blockIndex: 0, date: '2026-11-17', notifiedEnd: false,
      },
    });
    const d = deps(w);
    d.db.markTimerNotified = vi.fn(async () => {});
    await runRange(d, '2026-11-17', '11:00', '11:10');
    expect(w.sent).toHaveLength(1);
  });

  it('конец отдыха → «отдых закончился» один раз', async () => {
    const breakStart = bishkek('2026-11-17', '11:00').toISOString();
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'break', running: true, startedAt: breakStart, accumulatedSec: 0,
        targetMin: 20, blockIndex: 1, date: '2026-11-17', notifiedEnd: false,
      },
    });
    const d = deps(w);
    // начало отдыха уже объявлено (бот сам сообщил о конце работы)
    w.settings.lastSent = { morning: '2026-11-17', timer_work_end: breakStart };
    await runRange(d, '2026-11-17', '11:00', '11:40');
    expect(w.sent).toEqual(['Отдых закончился. Можно начинать блок 2 из 3.']);
  });

  it('сайт сам перевёл таймер в отдых — бот всё равно сообщает «пора на отдых» один раз', async () => {
    const breakStart = bishkek('2026-11-17', '11:00').toISOString();
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'break', running: true, startedAt: breakStart, accumulatedSec: 0,
        targetMin: 20, blockIndex: 1, date: '2026-11-17', notifiedEnd: false,
      },
    });
    await runRange(deps(w), '2026-11-17', '11:00', '11:05');
    expect(w.sent.filter((t) => t.startsWith('Пора на отдых'))).toHaveLength(1);
  });

  it('уже отмеченный notified_end — тишина; таймер на паузе — тишина', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'work', running: true, startedAt: workStart, accumulatedSec: 0,
        targetMin: 120, blockIndex: 0, date: '2026-11-17', notifiedEnd: true,
      },
    });
    await runRange(deps(w), '2026-11-17', '11:00', '11:05');
    w.timer = { phase: 'work', running: false, startedAt: null, accumulatedSec: 9000, targetMin: 120, blockIndex: 0, notifiedEnd: false };
    await runRange(deps(w), '2026-11-17', '11:05', '11:10');
    expect(w.sent).toEqual([]);
  });
});

describe('scheduler: будильники здоровья', () => {
  it('включённый будильник — одно сообщение в его время; выключенный — нет', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      alarms: [
        { id: 'm', title: 'Медитация', time: '17:15', enabled: true, type: 'meditation' },
        { id: 'w', title: 'Прогулка', time: '17:20', enabled: false, type: 'walk' },
      ],
    });
    await runRange(deps(w), '2026-11-17', '17:00', '18:00');
    expect(w.sent).toEqual(['Напоминание: Медитация.']);
  });
});

describe('scheduler: без привязанного чата ничего не шлёт', () => {
  it('chatId пуст — сообщений нет', async () => {
    const w = makeWorld();
    w.settings.chatId = undefined;
    await runRange(deps(w), '2026-11-17', '08:00', '08:05');
    expect(w.sent).toEqual([]);
  });
});

describe('scheduler: сбой отправки — отметка снимается, следующий тик повторяет', () => {
  /** send, который не доставляет первые n сообщений (Telegram недоступен) */
  function flaky(d: SchedulerDeps, w: World, n: number) {
    let fails = n;
    d.send = async (text) => {
      if (fails > 0) {
        fails--;
        return false;
      }
      w.sent.push(text);
      return true;
    };
  }

  it('утро: send() === false → через тик уходит, один раз', async () => {
    const w = makeWorld({ kv: { 'plan:2026-11-17': { mainTask: 'Монтаж' } } });
    const d = deps(w);
    flaky(d, w, 1);
    await runTick(d, bishkek('2026-11-17', '08:00'));
    expect(w.sent).toHaveLength(0);
    expect(w.settings.lastSent?.morning).toBeUndefined();
    await runRange(d, '2026-11-17', '08:00', '08:05');
    expect(w.sent.filter((t) => t.includes('Монтаж'))).toHaveLength(1);
    expect(w.settings.lastSent?.morning).toBe('2026-11-17');
  });

  it('утро: ошибка Supabase при чтении плана → следующий тик повторяет', async () => {
    const w = makeWorld({ kv: { 'plan:2026-11-17': { mainTask: 'Монтаж' } } });
    const d = deps(w);
    let broken = true;
    const getKv = d.db.getKv;
    d.db.getKv = (async (key: string) => {
      if (broken) throw new Error('supabase down');
      return getKv(key);
    }) as Db['getKv'];
    await runTick(d, bishkek('2026-11-17', '08:00'));
    expect(w.sent).toHaveLength(0);
    broken = false;
    await runTick(d, new Date(bishkek('2026-11-17', '08:00').getTime() + 30_000));
    expect(w.sent.filter((t) => t.includes('Монтаж'))).toHaveLength(1);
  });

  it('публикации, будильник и четверг: недоставленное уходит следующим тиком', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-19', evening: '2026-11-19' } },
      alarms: [{ id: 'm', title: 'Медитация', time: '21:00', enabled: true, type: 'meditation' }],
    });
    const d = deps(w, [{ channelId: 'c1', text: 'Публикация AKKDLASA' }]);
    flaky(d, w, 2);
    await runTick(d, bishkek('2026-11-19', '21:00')); // четверг: будильник и «завтра восстановление» не ушли
    await runRange(d, '2026-11-19', '21:00', '21:03');
    expect(w.sent.filter((t) => t === 'Напоминание: Медитация.')).toHaveLength(1);
    expect(w.sent.filter((t) => t.startsWith('Завтра пятница'))).toHaveLength(1);

    const w2 = makeWorld({ settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } } });
    const d2 = deps(w2, [{ channelId: 'c1', text: 'Публикация AKKDLASA' }]);
    flaky(d2, w2, 1);
    await runRange(d2, '2026-11-17', '08:10', '08:12');
    expect(w2.sent).toEqual(['Публикация AKKDLASA']);
  });

  it('упавший startEvening → следующий тик в окне начинает разговор снова', async () => {
    const w = makeWorld();
    const d = deps(w);
    let fail = true;
    d.conversation.startEvening = async (day) => {
      if (fail) {
        fail = false;
        throw new Error('supabase down');
      }
      w.calls.push(`evening:${day}`);
    };
    await runTick(d, bishkek('2026-11-17', '21:00'));
    expect(w.calls).toEqual([]);
    await runRange(d, '2026-11-17', '21:00', '21:05');
    expect(w.calls.filter((c) => c.startsWith('evening:'))).toEqual(['evening:2026-11-17']);
  });
});

describe('scheduler: таймер без сайта и долгий разговор', () => {
  it('сайт закрыт → «пора на отдых», через 20 мин одно «Отдых закончился»', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'work', running: true, startedAt: bishkek('2026-11-17', '09:00').toISOString(), accumulatedSec: 0,
        targetMin: 120, blockIndex: 1, date: '2026-11-17', notifiedEnd: false,
      },
    });
    // timer_state в базе так и остаётся «work»: сайт не открывали
    await runRange(deps(w), '2026-11-17', '10:59', '11:40');
    expect(w.sent.filter((t) => t.startsWith('Пора на отдых'))).toHaveLength(1);
    expect(w.sent.filter((t) => t.startsWith('Отдых закончился'))).toEqual(['Отдых закончился. Можно начинать блок 2 из 3.']);
    const breakOverAt = w.sent.findIndex((t) => t.startsWith('Отдых закончился'));
    expect(breakOverAt).toBe(1);
  });

  it('разговор занят долгим анализом → тик не ждёт дольше предела, таймер-уведомление выходит', async () => {
    const w = makeWorld({
      settings: { chatId: '100', morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, lastSent: { morning: '2026-11-17' } },
      timer: {
        phase: 'work', running: true, startedAt: new Date(bishkek('2026-11-17', '19:00').getTime() + 30_000).toISOString(), accumulatedSec: 0,
        targetMin: 120, blockIndex: 1, date: '2026-11-17', notifiedEnd: false,
      },
    });
    const d: SchedulerDeps = { ...deps(w), conversationWaitMs: 30 };
    d.conversation.startEvening = () => new Promise<void>(() => {}); // анализ Claude не кончается
    const started = Date.now();
    await runTick(d, bishkek('2026-11-17', '20:59'));
    await runTick(d, bishkek('2026-11-17', '21:00'));
    expect(Date.now() - started).toBeLessThan(2_000);
    await runTick(d, new Date(bishkek('2026-11-17', '21:00').getTime() + 30_000));
    expect(w.sent.filter((t) => t.startsWith('Пора на отдых'))).toHaveLength(1);
  });
});
