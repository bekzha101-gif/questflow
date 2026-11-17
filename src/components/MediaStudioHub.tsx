import React from 'react';
import { ContentProductionBoard } from './ContentProductionBoard';

interface MediaStudioHubProps {
  onPublishReward: (exp: number, gold: number) => void;
}

// Раздел «Каналы» (пока): канбан видео. Flow Shorts, Идеи и AI-сценарист удалены.
export function MediaStudioHub({ onPublishReward }: MediaStudioHubProps) {
  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in select-none">
      <ContentProductionBoard onPublishReward={onPublishReward} />
    </div>
  );
}
