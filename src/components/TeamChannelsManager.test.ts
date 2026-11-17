import { describe, expect, it } from 'vitest';
import { DEFAULT_CHANNEL_AVATAR, channelAvatarLabel } from './TeamChannelsManager';

describe('иконка канала', () => {
  it('по умолчанию без эмодзи', () => {
    expect(DEFAULT_CHANNEL_AVATAR).toBe('');
  });
  it('пустая иконка — первая буква названия', () => {
    expect(channelAvatarLabel('', 'akkdlasa')).toBe('A');
    expect(channelAvatarLabel(undefined, '')).toBe('');
    expect(channelAvatarLabel('AK', 'akkdlasa')).toBe('AK');
  });
});
