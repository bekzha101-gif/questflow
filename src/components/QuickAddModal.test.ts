import { describe, expect, it } from 'vitest';
import { quickAddLabels } from './QuickAddModal';

describe('окно быстрого добавления: подписи', () => {
  it('в режиме покупки озаглавлено «Добавить покупку», кнопка тоже про покупку', () => {
    expect(quickAddLabels('shopping')).toEqual({ title: 'Добавить покупку', submit: 'Добавить покупку' });
  });
  it('обычный режим не говорит о покупке', () => {
    const l = quickAddLabels('task');
    expect(l.title).not.toMatch(/покупк/i);
    expect(l.submit).not.toMatch(/покупк/i);
  });
});
