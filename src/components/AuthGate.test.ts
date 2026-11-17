import { describe, expect, it } from 'vitest';
import { canMountApp } from './AuthGate';

// Рендер AuthGate: что показывать — приложение или «Загружаю данные…»
describe('canMountApp', () => {
  it('вход проверен, сессия A пришла, а облако ещё не начали читать — приложение не монтируется', () => {
    // Тот самый рендер: setSession и setAuthResolved уже сработали, cloudState ещё 'none'
    expect(canMountApp(true, 'user-a', { userId: null, state: 'none' })).toBe(false);
  });

  it('пока облако читается — не монтируется', () => {
    expect(canMountApp(true, 'user-a', { userId: 'user-a', state: 'connecting' })).toBe(false);
  });

  it('облако пользователя прочитано или чтение не удалось — монтируется', () => {
    expect(canMountApp(true, 'user-a', { userId: 'user-a', state: 'ready' })).toBe(true);
    expect(canMountApp(true, 'user-a', { userId: 'user-a', state: 'failed' })).toBe(true);
  });

  it('облако прочитано для пользователя A, вошёл B — не монтируется', () => {
    expect(canMountApp(true, 'user-b', { userId: 'user-a', state: 'ready' })).toBe(false);
  });

  it('вход не проверен — не монтируется', () => {
    expect(canMountApp(false, null, { userId: null, state: 'none' })).toBe(false);
  });

  it('без входа — монтируется только когда облако прошлого пользователя отключено', () => {
    expect(canMountApp(true, null, { userId: null, state: 'none' })).toBe(true);
    expect(canMountApp(true, null, { userId: 'user-a', state: 'ready' })).toBe(false);
  });
});
