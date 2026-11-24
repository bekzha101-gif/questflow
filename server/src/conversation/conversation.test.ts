import { describe, expect, it } from 'vitest';
import { CONV_TEXT, createConversation, type Conversation } from './index';
const CONV_TEXT_IDLE = CONV_TEXT.idle;
import { createMemoryStore, emptyData, type MemoryData } from './testing';
import type { Ai, AiKind, AiResult } from '../ai';
import type { Keyboard } from './types';

// Бишкек = UTC+6. 2026-11-17 — вторник, 11-21 — суббота, 11-22 — воскресенье, 11-30 — понедельник (конец месяца).
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+06:00`);

interface Sent {
  text: string;
  keyboard?: Keyboard;
}

const aiOk = (over: Partial<AiResult> = {}): AiResult => ({
  source: 'cli',
  summary: 'Ровный день',
  good: ['три блока фокуса'],
  better: ['лечь раньше'],
  boost: ['первый блок сразу после подъёма'],
  facts: ['сон < 6 ч — оценка ниже'],
  steps: [],
  ...over,
});

interface World {
  data: MemoryData;
  sent: Sent[];
  now: Date;
  aiCalls: AiKind[];
  aiUp: boolean;
  heard: string | null;
  conv: Conversation;
  make(): Conversation;
}

function world(over: Partial<MemoryData> = {}, opts: { weekSteps?: AiResult['steps'] } = {}): World {
  const w = {
    data: emptyData({ kv: { 'onboarding:new_channels': { done: true } }, ...over }),
    sent: [] as Sent[],
    now: at('2026-11-17', '21:00'),
    aiCalls: [] as AiKind[],
    aiUp: true,
    heard: 'воду выпил, медитировал' as string | null,
  } as World;
  const ai: Ai = {
    analyze: async (kind) => {
      w.aiCalls.push(kind);
      if (!w.aiUp) return null;
      if (kind === 'sleep_screenshot') return { ...aiOk(), sleep: { sleepMin: 452, quality: 85 } };
      if (kind === 'week') return aiOk({ steps: opts.weekSteps ?? [] });
      return aiOk();
    },
  };
  w.make = () =>
    createConversation({
      store: createMemoryStore(w.data),
      send: async (text, keyboard) => {
        w.sent.push({ text, keyboard });
        return true;
      },
      ai,
      stt: { transcribe: async () => w.heard },
      files: { download: async (id, kind) => `C:/tmp/${kind}-${id}` },
      now: () => w.now,
    });
  w.conv = w.make();
  return w;
}

const last = (w: World) => w.sent[w.sent.length - 1];
const lastAsk = (w: World) => [...w.sent].reverse().find((s) => s.keyboard)!;

/** Нажать кнопку последнего вопроса по началу подписи */
async function press(w: World, label: string) {
  const ask = lastAsk(w);
  const b = ask.keyboard!.flat().find((x) => x.text === label || x.text.startsWith(label) || x.text.includes(`] ${label}`));
  if (!b) throw new Error(`Нет кнопки «${label}» в «${ask.text}»: ${ask.keyboard!.flat().map((x) => x.text).join(' | ')}`);
  await w.conv.handleUpdate({ chatId: '1', callbackData: b.data });
}

const say = (w: World, text: string) => w.conv.handleUpdate({ chatId: '1', text });

const SKIPS = ['Пропустить', 'Ничего', 'Без изменений', 'Как по графику', 'Спроси позже', 'Всё так же', 'Готово', '0'];
/** Отвечать «пропустить» на всё, пока не придёт вопрос с нужным текстом */
async function skipUntil(w: World, needle: string, max = 40) {
  for (let i = 0; i < max; i++) {
    if (lastAsk(w)?.text.includes(needle)) return;
    const ask = lastAsk(w);
    const b = ask.keyboard!.flat().find((x) => SKIPS.includes(x.text));
    if (!b) throw new Error(`Нечем пропустить «${ask.text}»`);
    await w.conv.handleUpdate({ chatId: '1', callbackData: b.data });
  }
  throw new Error(`Не дошли до «${needle}»`);
}

const basics = (): Partial<MemoryData> => ({
  config: { spheres: [], criteria: [], supplements: [{ id: 's1', name: 'Erinamax' }, { id: 's2', name: 'Tiger Milk' }] },
  tasks: [
    { id: 'h-water', title: 'Вода 2 л', type: 'habit' },
    { id: 'h-med', title: 'Медитация 20 мин', type: 'habit' },
    { id: 'h-read', title: 'Чтение', type: 'habit' },
    { id: 't-edit', title: 'Монтаж видео AKKDLASA', type: 'todo', kind: 'task', dueDate: '2026-11-17', priority: 'p1' },
    { id: 't-buy', title: 'Купить молоко', type: 'todo', kind: 'shopping', dueDate: '2026-11-17' },
  ],
  goals: [{ id: 'g-ch', month: '2026-11', title: 'Запустить 40 каналов', kind: 'numeric', target: 40, current: 5, status: 'active' }],
  channels: [{ id: 'ch-a', name: 'AKKDLASA', status: 'active', cadencePerDay: 1 }],
  stats: { level: 1, exp: 0, maxExp: 100, hp: 100, maxHp: 100, gold: 0, streak: 0, rulesSince: '2026-11-17' },
});

describe('вечерний разговор', () => {
  it('проходит все шаги и пишет данные: сон, БАДы, оценка, привычки голосом, задача, цель, публикация, план, анализ', async () => {
    const w = world(basics());
    await w.conv.startEvening('2026-11-17');
    expect(w.sent[0].text).toContain('Вечер');
    expect(last(w).text).toContain('Sleep Cycle');

    await w.conv.handleUpdate({ chatId: '1', photoFileId: 'ph1' });
    expect(w.data.days['2026-11-17']).toMatchObject({ sleepMin: 452, sleepQuality: 85 });
    expect(lastAsk(w).text).toContain('БАДы');

    await press(w, 'Erinamax');
    await press(w, 'Готово');
    expect(w.data.days['2026-11-17'].supplements).toEqual(['Erinamax']);

    await say(w, '8, сделал 3 блока');
    expect(w.data.days['2026-11-17']).toMatchObject({ score: 8, why: 'сделал 3 блока' });

    await say(w, 'хорошо — рано встал; лучше — меньше телефона');
    expect(lastAsk(w).text).toContain('привычки');

    await w.conv.handleUpdate({ chatId: '1', voiceFileId: 'v1' });
    const day = w.data.days['2026-11-17'];
    expect(day.habitsDoneIds).toEqual(['h-water', 'h-med']);
    expect(day).toMatchObject({ habitsDone: 2, habitsTotal: 3, waterOk: true, habitsMissed: ['Чтение'] });
    expect(w.data.events.map((e) => e.id)).toEqual(expect.arrayContaining(['habit:2026-11-17:h-water', 'habit:2026-11-17:h-med']));

    expect(lastAsk(w).text).toContain('«Монтаж видео AKKDLASA»');
    expect(w.sent.some((s) => s.text.includes('Купить молоко'))).toBe(false);
    await press(w, 'Частично');
    await say(w, '60');
    expect(w.data.tasks.find((t) => t.id === 't-edit')!.progressPct).toBe(60);

    expect(lastAsk(w).text).toContain('Запустить 40 каналов');
    await say(w, '3');
    expect(w.data.goals[0].current).toBe(8);

    expect(lastAsk(w).text).toContain('опубликовал');
    await press(w, 'AKKDLASA');
    await press(w, 'Готово');
    expect(w.data.videos).toHaveLength(1);
    expect(w.data.videos[0]).toMatchObject({ channelId: 'ch-a', stage: 'published' });
    expect(w.data.events.some((e) => e.id === `video_published:${w.data.videos[0].id}`)).toBe(true);

    expect(lastAsk(w).text).toContain('План на завтра');
    await press(w, 'Монтаж видео AKKDLASA');
    await say(w, 'AKKDLASA одно видео, в монтаж ARMY ANALITICS');
    expect(w.data.kv['plan:2026-11-18']).toMatchObject({
      mainTask: 'Монтаж видео AKKDLASA',
      mainTaskId: 't-edit',
      videos: 'AKKDLASA одно видео, в монтаж ARMY ANALITICS',
    });

    const texts = w.sent.map((s) => s.text).join('\n');
    expect(texts).toContain('Итог дня');
    expect(texts).toContain('Что хорошо:');
    expect(texts).toContain('Что можно лучше:');
    expect(texts).toContain('Как поднять продуктивность:');
    expect(w.data.days['2026-11-17'].reportStatus).toBe('done');
    expect(w.data.memory.find((m) => m.id === 'day:2026-11-17')).toBeTruthy();
    expect((w.data.conversation as { finished: boolean }).finished).toBe(true);
  });

  it('перезапуск сервера посреди разговора продолжает с того же шага', async () => {
    const w = world(basics());
    await w.conv.startEvening('2026-11-17');
    await say(w, '7ч 10м');
    expect(lastAsk(w).text).toContain('БАДы');

    // «Перезапуск»: новый объект разговора поверх тех же данных базы
    w.conv = w.make();
    await press(w, 'Tiger Milk');
    await press(w, 'Готово');
    expect(w.data.days['2026-11-17']).toMatchObject({ sleepMin: 430, supplements: ['Tiger Milk'] });
    expect(lastAsk(w).text).toContain('Оценка дня');
  });

  it('Whisper недоступен → просит написать текстом и остаётся на том же шаге', async () => {
    const w = world(basics());
    w.heard = null;
    await w.conv.startEvening('2026-11-17');
    await w.conv.handleUpdate({ chatId: '1', voiceFileId: 'v1' });
    expect(last(w).text).toContain('текстом');
    expect(w.sent.some((x) => x.text.includes('Слушаю голосовое'))).toBe(true);
    await say(w, '6:30');
    expect(w.data.days['2026-11-17'].sleepMin).toBe(390);
  });

  it('22:00 — одно напоминание; без ответа день missed, −HP, следующий вечер спрашивает за два дня', async () => {
    const w = world(basics());
    await w.conv.startEvening('2026-11-17');
    w.now = at('2026-11-17', '22:00');
    const before = w.sent.length;
    await w.conv.eveningReminder('2026-11-17');
    await w.conv.eveningReminder('2026-11-17');
    expect(w.sent.slice(before).filter((s) => s.text.includes('Напоминание'))).toHaveLength(1);

    w.now = at('2026-11-18', '21:00');
    await w.conv.startEvening('2026-11-18');
    expect(w.data.days['2026-11-17'].reportStatus).toBe('missed');
    expect(w.data.events.some((e) => e.id === 'evening_missed:2026-11-17')).toBe(true);
    // −30 за невыполненную норму (итог дня 17.11, бот закрывает день сам) и −15 за пропуск вечера
    expect(w.data.events.find((e) => e.id === 'day_close:2026-11-17')).toMatchObject({ note: 'missed', deltaHp: -30 });
    expect(w.data.events.find((e) => e.id === 'evening_missed:2026-11-17')).toMatchObject({ deltaHp: -15 });
    expect(w.data.stats!.hp).toBe(55);
    expect(w.sent.some((s) => s.text.includes('пропущен'))).toBe(true);
    expect(lastAsk(w).text).toContain('За вт 17.11');

    // Повторный запуск того же вечера не штрафует второй раз
    w.conv = w.make();
    await w.conv.startEvening('2026-11-18');
    expect(w.data.events.filter((e) => e.id === 'evening_missed:2026-11-17')).toHaveLength(1);
    expect(w.data.stats!.hp).toBe(55);
  });

  it('штраф не применяется, если сайт уже записал то же событие (дедуп через game_events)', async () => {
    const w = world({
      ...basics(),
      events: [{ id: 'evening_missed:2026-11-17', at: '2026-11-18T00:00:00Z', kind: 'evening_missed', ref: '2026-11-17', deltaHp: -15 }],
      stats: { level: 1, exp: 0, maxExp: 100, hp: 85, maxHp: 100, gold: 0, streak: 0, rulesSince: '2026-11-17', lastClosedDate: '2026-11-17' },
    });
    await w.conv.startEvening('2026-11-17');
    w.now = at('2026-11-18', '21:00');
    await w.conv.startEvening('2026-11-18');
    expect(w.data.stats!.hp).toBe(85);
  });

  it('суббота спрашивает про пятницу (восстановление)', async () => {
    const w = world(basics());
    w.now = at('2026-11-21', '21:00');
    await w.conv.startEvening('2026-11-21');
    expect(lastAsk(w).text).toContain('За пт 20.11');
    expect(lastAsk(w).text).toContain('восстановления');
    await press(w, 'Баня или бассейн');
    await press(w, 'Готово');
    expect(w.data.kv['recovery:2026-11-20']).toMatchObject({ done: ['sauna_pool'] });
    expect(w.data.events.some((e) => e.id === 'recovery_activity:2026-11-20:sauna_pool')).toBe(true);
  });

  it('воскресенье: каналы меняют статусы, доход сохраняется, отчёт недели с шагами и кнопкой «Принять»', async () => {
    const w = world(
      {
        ...basics(),
        channels: [
          { id: 'ch-a', name: 'AKKDLASA', status: 'active', cadencePerDay: 1 },
          { id: 'ch-t', name: 'TRIHGOK', status: 'active', cadencePerDay: 0.5 },
        ],
        videos: [{ id: 'v0', channelId: 'ch-a', title: 'Партия', stage: 'published', publishedAt: '2026-11-21T10:00:00Z', publishDate: '2026-11-21' }],
        goals: [
          { id: 'g-ch', month: '2026-11', title: 'Запустить 40 каналов', kind: 'numeric', target: 40, current: 5, status: 'active' },
        ],
      },
      { weekSteps: [{ goalId: 'g-ch', title: 'Запустить 2 канала' }, { goalId: 'g-ch', title: 'Настроить автовыкладку' }] },
    );
    w.now = at('2026-11-22', '21:00');
    await w.conv.startEvening('2026-11-22');
    await w.conv.weeklyReport('2026-11-22'); // планировщик зовёт сразу после старта — отчёт ждёт конца разговора
    expect(w.sent.some((s) => s.text.startsWith('Отчёт недели'))).toBe(false);

    await skipUntil(w, 'Какие каналы ты сейчас ведёшь');
    await press(w, 'TRIHGOK'); // снять отметку: больше не веду
    await press(w, 'Готово');
    expect(w.data.channels.find((c) => c.id === 'ch-t')!.status).toBe('abandoned');
    expect(lastAsk(w).text).toContain('Почему забросил «TRIHGOK»');
    await say(w, 'нет времени на монтаж');
    expect(w.data.channels.find((c) => c.id === 'ch-t')!.abandonReason).toBe('нет времени на монтаж');

    expect(lastAsk(w).text).toContain('Доход с «AKKDLASA»');
    await say(w, '$25');
    expect(w.data.income).toEqual([expect.objectContaining({ channelId: 'ch-a', amountUsd: 25, date: '2026-11-22' })]);
    expect(w.data.stats!.incomeUsdTotal).toBe(25);

    await skipUntil(w, 'Шаги на следующую неделю');
    const report = w.sent.find((s) => s.text.startsWith('Отчёт недели'));
    expect(report).toBeTruthy();
    expect(w.data.steps.filter((s) => s.proposed)).toHaveLength(2);
    await press(w, 'Принять все');
    expect(w.data.steps.every((s) => s.proposed === false)).toBe(true);
    expect(w.data.steps[0]).toMatchObject({ goalId: 'g-ch', weekIndex: 4 });
    expect(w.data.weeks.find((x) => x.goalId === 'g-ch' && x.weekIndex === 4)?.review).toBe('Ровный день');
  });

  it('конец месяца: вопрос о желаниях, отчёт месяца, итог целей в архив', async () => {
    const w = world({
      ...basics(),
      rewards: [{ id: 'r1', title: 'Шаурма', cost: 50 }],
      goals: [
        { id: 'g-ch', month: '2026-11', title: 'Запустить 40 каналов', kind: 'numeric', target: 40, current: 40, status: 'active' },
        { id: 'g-gm', month: '2026-11', title: 'Геймификация', kind: 'percent', target: 100, current: 30, status: 'active' },
      ],
    });
    w.now = at('2026-11-30', '21:00');
    await w.conv.startEvening('2026-11-30');
    await w.conv.monthlyReport('2026-11-30');
    await skipUntil(w, 'Не поменялись ли желания');
    expect(lastAsk(w).text).toContain('Шаурма');
    await say(w, 'добавить горнолыжку на Иссык-Куле');
    expect(w.data.kv['wishes:2026-11']).toMatchObject({ text: 'добавить горнолыжку на Иссык-Куле' });
    await skipUntil(w, '__конец__', 5).catch(() => {});
    const month = w.sent.find((s) => s.text.startsWith('Отчёт месяца'));
    expect(month?.text).toContain('Не поменялись ли желания');
    expect(w.data.goals.find((g) => g.id === 'g-ch')).toMatchObject({ status: 'done' });
    expect(w.data.goals.find((g) => g.id === 'g-gm')).toMatchObject({ status: 'failed' });
    expect(w.data.goals.find((g) => g.id === 'g-ch')!.summary).toContain('Итог');
    expect(w.data.memory.some((m) => m.id === 'month:2026-11')).toBe(true);
  });

  it('первый вечер спрашивает 4 новых канала и создаёт их с планами', async () => {
    const w = world({ ...basics(), kv: {} });
    await w.conv.startEvening('2026-11-17');
    await skipUntil(w, '4 новых канала');
    await say(w, 'Chess Pulse\nWar Tech\nSpace Lore\nMoney Files');
    for (const plan of ['шахматы, 1 видео в день', 'техника, раз в 2 дня', 'космос', 'финансы']) await say(w, plan);
    const created = w.data.channels.filter((c) => c.planned === true);
    expect(created.map((c) => c.name)).toEqual(['Chess Pulse', 'War Tech', 'Space Lore', 'Money Files']);
    expect(created[0]).toMatchObject({ plan: 'шахматы, 1 видео в день', status: 'paused' });
    expect(w.data.kv['onboarding:new_channels']).toMatchObject({ done: true });
  });

  it('Claude недоступен → отчёт уходит без AI-раздела, повтор запланирован и срабатывает позже', async () => {
    const w = world(basics());
    w.aiUp = false;
    await w.conv.startEvening('2026-11-17');
    await skipUntil(w, '__конец__', 30).catch(() => {});
    const texts = w.sent.map((s) => s.text).join('\n');
    expect(texts).toContain('Итог дня');
    expect(texts).not.toContain('Что хорошо:');
    expect(texts).toContain('пришлю его позже');
    const conv = w.data.conversation as { pendingAi: { kind: string }[] };
    expect(conv.pendingAi.map((p) => p.kind)).toEqual(['day']);

    w.aiUp = true;
    await w.conv.tick(at('2026-11-17', '21:10')); // рано — ещё не время повтора
    expect(w.sent.some((s) => s.text.includes('с опозданием'))).toBe(false);
    await w.conv.tick(at('2026-11-17', '21:45'));
    expect(w.sent.some((s) => s.text.includes('с опозданием') && s.text.includes('Что хорошо:'))).toBe(true);
    expect((w.data.conversation as { pendingAi: unknown[] }).pendingAi).toEqual([]);
  });

  it('повтор отложенного анализа в пятницу ничего не шлёт; в субботу — шлёт', async () => {
    const w = world(basics());
    w.now = at('2026-11-19', '21:00'); // четверг
    w.aiUp = false;
    await w.conv.startEvening('2026-11-19');
    await skipUntil(w, '__конец__', 30).catch(() => {});
    expect((w.data.conversation as { pendingAi: unknown[] }).pendingAi).toHaveLength(1);

    w.aiUp = true;
    const before = w.sent.length;
    await w.conv.tick(at('2026-11-20', '10:00')); // пятница — тишина
    await w.conv.tick(at('2026-11-20', '18:00'));
    expect(w.sent.length).toBe(before);
    expect((w.data.conversation as { pendingAi: unknown[] }).pendingAi).toHaveLength(1);

    await w.conv.tick(at('2026-11-21', '09:00')); // суббота
    expect(w.sent.some((x) => x.text.includes('с опозданием'))).toBe(true);
  });

  it('месяц кончился в пятницу: субботний разговор спрашивает о желаниях и шлёт отчёт прошлого месяца', async () => {
    const w = world({
      ...basics(),
      rewards: [{ id: 'r1', title: 'Шаурма', cost: 50 }],
      goals: [{ id: 'g-apr', month: '2027-04', title: 'Запустить 10 каналов', kind: 'numeric', target: 10, current: 10, status: 'active' }],
      stats: { level: 1, exp: 0, maxExp: 100, hp: 100, maxHp: 100, gold: 0, streak: 0, rulesSince: '2027-05-01' },
    });
    w.now = at('2027-05-01', '21:00'); // суббота; 2027-04-30 — пятница, последний день апреля
    await w.conv.startEvening('2027-05-01');
    expect((w.data.conversation as { flags: { month?: boolean } }).flags.month).toBe(true);
    await skipUntil(w, 'Не поменялись ли желания');
    await say(w, 'добавить поездку на Иссык-Куль');
    expect(w.data.kv['wishes:2027-04']).toMatchObject({ text: 'добавить поездку на Иссык-Куль' });
    await skipUntil(w, '__конец__', 10).catch(() => {});
    const month = w.sent.find((x) => x.text.startsWith('Отчёт месяца'));
    expect(month?.text).toContain('Апрель 2027');
  });
});

describe('голос вне разговора → команда для «Каналов»', () => {
  it('днём голосовое разбирается Claude и ждёт подтверждения', async () => {
    const w = world({
      channels: [{ id: 'c1', name: 'TRIHGOK', status: 'active', cadencePerDay: 1 }],
      videos: [{ id: 'v1', channelId: 'c1', title: 'Танки', stage: 'editing' }],
    });
    w.now = at('2026-11-17', '14:00');
    w.heard = 'танки перенеси в проверку';
    const prompts: string[] = [];
    const conv = createConversation({
      store: createMemoryStore(w.data),
      send: async (text, keyboard) => void w.sent.push({ text, keyboard }) ?? true,
      ai: {
        analyze: async () => null,
        complete: async (p) => {
          prompts.push(p);
          return '{"actions":[{"type":"move_video","videoId":"v1","stage":"review"}]}';
        },
      },
      stt: { transcribe: async () => w.heard },
      files: { download: async (id, kind) => `C:/tmp/${kind}-${id}` },
      now: () => w.now,
    });
    await conv.handleUpdate({ chatId: '1', voiceFileId: 'x' });
    expect(prompts[0]).toContain('«танки перенеси в проверку»');
    const ask = w.sent.at(-1)!;
    expect(ask.text).toContain('«Танки» (TRIHGOK) → Проверка');
    await conv.handleUpdate({ chatId: '1', callbackData: ask.keyboard![0][0].data });
    expect(w.data.videos[0]).toMatchObject({ stage: 'review', legacyStage: 'review' });
  });

  it('без Claude — прежний ответ «разговора нет»', async () => {
    const w = world();
    w.now = at('2026-11-17', '14:00');
    await w.conv.handleUpdate({ chatId: '1', text: 'привет' });
    expect(w.sent.at(-1)!.text).toBe(CONV_TEXT_IDLE);
  });
});
