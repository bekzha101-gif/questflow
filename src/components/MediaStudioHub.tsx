import React from 'react';
import { ContentProductionBoard } from './ContentProductionBoard';

interface MediaStudioHubProps {
  onPublishReward: (exp: number, gold: number) => void;
}

// Видео каналов: канбан Монтаж → Проверка → Опубликовано. Flow Shorts, Идеи и AI-сценарист удалены.
export function MediaStudioHub({ onPublishReward }: MediaStudioHubProps) {
  return (
    <div className="space-y-4 select-none">
      <ContentProductionBoard onPublishReward={onPublishReward} />
    </div>
  );
}
