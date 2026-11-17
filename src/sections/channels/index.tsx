import { MediaStudioHub } from '../../components/MediaStudioHub';
import type { SectionContext } from '../types';

// «Каналы»: канбан видео. Статусы каналов и расписание добавит таск 06 в эту же папку.
export function ChannelsSection({ ctx }: { ctx: SectionContext }) {
  return <MediaStudioHub onPublishReward={(exp, gold) => ctx.onAwardRewards(exp, gold)} />;
}
