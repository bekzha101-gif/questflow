// Одноразовая чистка демо-данных раздела «Медиа» из localStorage.
// Раньше приложение само подкладывало демо-каналы, демо-видео и демо-команду
// (и возвращало их после удаления). Удаляются только записи с известными
// демо-идентификаторами; всё, что пользователь создал сам, остаётся.

const CLEANUP_FLAG = 'questflow_media_demo_cleaned_v1';

const DEMO_VIDEO_IDS = ['vid-bobr-1', 'vid-bobr-2', 'vid-bobr-3', 'vid-1', 'vid-2', 'vid-3', 'vid-4'];
const DEMO_CHANNEL_IDS = ['chan-bobr', 'chan-1', 'chan-2', 'chan-3'];
const DEMO_TEAM_IDS = ['team-1', 'team-2', 'team-3'];

function readList<T>(key: string): T[] | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : null;
}

export function cleanupMediaDemoData(): void {
  try {
    if (localStorage.getItem(CLEANUP_FLAG)) return;

    const videos = readList<{ id: string; channelId: string }>('questflow_videos_v1');
    const keptVideos = videos ? videos.filter((v) => !DEMO_VIDEO_IDS.includes(v.id)) : [];
    if (videos) localStorage.setItem('questflow_videos_v1', JSON.stringify(keptVideos));

    // Демо-канал убираем, только если на нём не осталось видео пользователя
    const channels = readList<{ id: string }>('questflow_channels_v1');
    if (channels) {
      const keptChannels = channels.filter(
        (c) => !DEMO_CHANNEL_IDS.includes(c.id) || keptVideos.some((v) => v.channelId === c.id)
      );
      localStorage.setItem('questflow_channels_v1', JSON.stringify(keptChannels));

      const selected = localStorage.getItem('questflow_selected_channel_id');
      if (selected && selected !== 'all' && !keptChannels.some((c) => c.id === selected)) {
        localStorage.setItem('questflow_selected_channel_id', 'all');
      }
    }

    const team = readList<{ id: string }>('questflow_team_v1');
    if (team) {
      localStorage.setItem(
        'questflow_team_v1',
        JSON.stringify(team.filter((m) => !DEMO_TEAM_IDS.includes(m.id)))
      );
    }

    localStorage.setItem(CLEANUP_FLAG, 'true');
  } catch (e) {
    console.error('Failed to clean up media demo data:', e);
  }
}
