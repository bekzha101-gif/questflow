// Заглушка вечернего разговора и отчётов. Настоящую реализацию делает таск 09
// в server/src/conversation/ — тогда index.ts подключает её вместо этой.
import type { ConversationApi } from './scheduler';

export const STUB_TEXT = {
  evening: 'Вечерний разговор в боте скоро появится. Пока отметь день на сайте: задачи, привычки, оценку дня.',
  reply: 'Принял. Разговор с ботом скоро появится — пока всё отмечается на сайте.',
};

export function createConversationStub(send: (text: string) => Promise<boolean>): ConversationApi {
  return {
    startEvening: async () => void (await send(STUB_TEXT.evening)),
    // Без настоящего разговора нечего напоминать и не о чем отчитываться — молчим
    eveningReminder: async () => {},
    weeklyReport: async () => {},
    monthlyReport: async () => {},
    handleUpdate: async () => void (await send(STUB_TEXT.reply)),
  };
}
