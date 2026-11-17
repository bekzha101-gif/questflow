// Типы вечернего разговора. Состояние целиком лежит в bot_settings.conversation (jsonb),
// поэтому перезапуск сервера посреди разговора продолжает с того же шага.
import type { Ai } from '../ai';
import type { Stt } from '../stt';
import type { ConversationStore } from './store';

/** Кнопка под сообщением: data уходит обратно как callbackData (до 64 байт) */
export interface Button {
  text: string;
  data: string;
}
export type Keyboard = Button[][];

export interface TelegramFiles {
  /** Скачать файл Telegram во временную папку; null — не вышло */
  download(fileId: string, kind: 'voice' | 'photo'): Promise<string | null>;
  /** Удалить временный файл после разбора */
  release?(filePath: string): Promise<void>;
}

export interface ConversationDeps {
  store: ConversationStore;
  send(text: string, keyboard?: Keyboard): Promise<boolean>;
  ai: Ai;
  stt: Stt;
  files?: TelegramFiles;
  now?: () => Date;
  log?(message: string): void;
}

export type StepId =
  | 'sleep'
  | 'supplements'
  | 'score'
  | 'good_better'
  | 'habits'
  | 'items'
  | 'goals'
  | 'channels'
  | 'recovery'
  | 'new_channels'
  | 'week_channels'
  | 'income'
  | 'wishes'
  | 'plan_main'
  | 'plan_videos'
  | 'final';

export interface Step {
  id: StepId;
  /** За какой день вопрос (YYYY-MM-DD) */
  date: string;
}

/** Курсор текущего шага: выбранные пункты, номер пункта в списке, режим подвопроса */
export interface Cursor {
  init?: boolean;
  sel?: string[];
  list?: { id: string; title: string; kind?: string }[];
  index?: number;
  mode?: string;
  [extra: string]: unknown;
}

export interface PendingAi {
  kind: 'day' | 'week' | 'month';
  date: string;
  tries: number;
  nextAt: string;
}

export interface ConvState {
  v: 1;
  /** День разговора (вечер этой даты) */
  date: string;
  /** Все дни, о которых спрашиваем (пропущенный вчера, пятница в субботу, сегодня) */
  dates: string[];
  startedAt: string;
  /** Был хоть один ответ */
  answered: boolean;
  /** Напоминание 22:00 уже было */
  reminded: boolean;
  finished: boolean;
  queue: Step[];
  /** Номер вопроса: кнопки старых вопросов не путают текущий */
  seq: number;
  cur: Cursor;
  /** month — отчёт месяца в конце разговора; monthDate — дата внутри этого месяца (если месяц кончился вчера в пятницу) */
  flags: { week?: boolean; month?: boolean; monthDate?: string };
  /** Анализы, которые не удались (Claude недоступен) — повтор позже */
  pendingAi: PendingAi[];
}

export interface Input {
  text?: string;
  /** Действие кнопки без префикса и номера вопроса */
  action?: string;
  photoPath?: string;
}
