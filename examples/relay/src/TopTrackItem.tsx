import AlbumArt from './AlbumArt';
import MusicBrainzLink from './MusicBrainzLink';

interface Artist {
  artistName: string;
}

interface TopTrackItemProps {
  trackName: string;
  releaseMbId: string | null | undefined;
  artists?: string | null | undefined;
  count: number;
  rank: number;
  maxCount: number;
}

export default function TopTrackItem({
  trackName,
  releaseMbId,
  artists,
  count,
  rank,
  maxCount,
}: TopTrackItemProps) {
  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

  // Parse artists JSON
  let artistNames = 'Unknown Artist';
  if (artists) {
    try {
      const parsed = typeof artists === 'string' ? JSON.parse(artists) : artists;
      if (Array.isArray(parsed)) {
        artistNames = parsed.map((a: Artist) => a.artistName).join(', ');
      } else if (typeof parsed === 'string') {
        artistNames = parsed;
      }
    } catch {
      artistNames = String(artists);
    }
  }

  return (
    <div className="group py-3 px-4 hover:bg-zinc-900/50 transition-colors relative overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 bg-violet-500/10 transition-all"
        style={{ width: `${barWidth}%` }}
      />
      <div className="flex items-center gap-4 relative">
        <div className="text-xs text-zinc-600 w-8 text-right flex-shrink-0 font-medium">{rank}</div>

        <div className="flex-shrink-0">
          <AlbumArt releaseMbId={releaseMbId} alt={`${trackName} album art`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-100 truncate">
            <MusicBrainzLink releaseMbId={releaseMbId}>{trackName}</MusicBrainzLink>
          </h3>
          <p className="text-xs text-zinc-500 truncate">{artistNames}</p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-zinc-400 font-medium">{count.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
