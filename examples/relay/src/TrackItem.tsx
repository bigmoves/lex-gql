import { graphql, useFragment } from "react-relay";
import type { TrackItem_play$key } from "./__generated__/TrackItem_play.graphql";
import AlbumArt from "./AlbumArt";
import MusicBrainzLink from "./MusicBrainzLink";

function getTimeAgo(date: Date): string | null {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (isNaN(seconds)) return null;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface TrackItemProps {
  play: TrackItem_play$key;
  hideUser?: boolean;
}

export default function TrackItem({ play, hideUser }: TrackItemProps) {
  const data = useFragment(
    graphql`
      fragment TrackItem_play on FmTealAlphaFeedPlay {
        trackName
        playedTime
        artists {
          artistName
        }
        releaseName
        releaseMbId
        actorHandle
        musicServiceBaseDomain
        appBskyActorProfileByDid {
          displayName
          avatar {
            url(preset: "avatar")
          }
        }
      }
    `,
    play,
  );

  const artistText = Array.isArray(data.artists)
    ? data.artists.map((a) => a.artistName).join(", ")
    : "Unknown Artist";

  const timeAgo = data.playedTime ? getTimeAgo(new Date(data.playedTime)) : null;

  return (
    <div className="flex gap-3 py-2 px-2 -mx-2 hover:bg-zinc-900/50 transition-colors">
      {/* Album art */}
      <div className="flex-shrink-0">
        <AlbumArt
          releaseMbId={data.releaseMbId}
          alt={`${data.trackName} album art`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100 truncate">{data.trackName}</p>
        <p className="text-xs text-zinc-500 truncate">
          {artistText}
          {data.releaseName && (
            <>
              {" · "}
              <MusicBrainzLink releaseMbId={data.releaseMbId}>
                <span className="italic">{data.releaseName}</span>
              </MusicBrainzLink>
            </>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {!hideUser && (
            <a
              href={`/profile/${data.actorHandle}`}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              {data.appBskyActorProfileByDid?.avatar?.url && (
                <img
                  src={data.appBskyActorProfileByDid.avatar.url}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span className="text-xs text-violet-500">
                {data.appBskyActorProfileByDid?.displayName || `@${data.actorHandle}`}
              </span>
            </a>
          )}
          {timeAgo && <span className="text-xs text-zinc-600">{timeAgo}</span>}
        </div>
      </div>
    </div>
  );
}
