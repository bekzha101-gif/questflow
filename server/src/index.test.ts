import { describe, expect, it } from 'vitest';
import { crashLine } from './index';

const config = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'TESTSERVICEKEY-abcdef',
  ownerUserId: 'owner',
};

describe('crashLine (лог падения сервера)', () => {
  it('секреты из конфига в тексте ошибки скрыты', () => {
    const line = crashLine(new Error('fetch failed key=TESTSERVICEKEY-abcdef'), config, new Date('2026-11-17T00:00:00Z'));
    expect(line).not.toContain('TESTSERVICEKEY-abcdef');
    expect(line).toContain('[скрыто]');
    expect(line).toContain('Сервер упал');
  });

  it('конфиг ещё не прочитан — текст как есть', () => {
    expect(crashLine(new Error('нет server/.env'), null)).toContain('нет server/.env');
  });
});
