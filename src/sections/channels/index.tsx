import type { SectionContext } from '../types';
import { MediaStudioHub } from '../../components/MediaStudioHub';

// «Каналы»: старая Медиа-Студия — Канбан Монтажа и Идеи.
// Каналы и видео хранятся в облаке (channels2/videos2), бот напоминает по ним как раньше.
export function ChannelsSection({ ctx }: { ctx: SectionContext }) {
  return <MediaStudioHub projects={ctx.projects} onAddTask={(task) => ctx.onAddTask(task)} />;
}
