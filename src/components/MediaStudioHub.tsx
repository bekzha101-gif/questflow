import React from 'react';
import { ContentProductionBoard } from './ContentProductionBoard';

// Видео каналов: канбан Монтаж → Проверка → Опубликовано. Flow Shorts, Идеи и AI-сценарист удалены.
export function MediaStudioHub({ channelIds = [] }: { channelIds?: string[] }) {
  return (
    <div className="space-y-4 select-none">
      <ContentProductionBoard channelIds={channelIds} />
    </div>
  );
}
