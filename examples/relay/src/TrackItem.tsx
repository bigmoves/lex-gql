import { graphql, useFragment } from "react-relay";
import type { TrackItem_play$key } from "./__generated__/TrackItem_play.graphql";
import AlbumArt from "./AlbumArt";
import MusicBrainzLink from "./MusicBrainzLink";

interface TrackItemProps {
  play: TrackItem_play$key;
}

export default function TrackItem({ play }: TrackItemProps) {
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
        }
      }
    `,
    play,
  );

  return (
    <div className="group py-3 px-4 hover:bg-zinc-900/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <AlbumArt
            releaseMbId={data.releaseMbId}
            alt={`${data.trackName} album art`}
          />
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-100 truncate flex items-center gap-2">
              <span className="truncate">{data.trackName}</span>
              {data.musicServiceBaseDomain === "nts.live" && (
                <a
                  href={`https://${data.musicServiceBaseDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded flex-shrink-0 hover:bg-violet-500/30 transition-colors"
                >
                  NTS
                </a>
              )}
            </h3>
            <p className="text-xs text-zinc-500 truncate">
              {Array.isArray(data.artists)
                ? data.artists.map((a) => a.artistName).join(", ")
                : "Unknown Artist"}
            </p>
          </div>

          <div className="text-right min-w-0">
            <p className="text-xs text-zinc-400 truncate">
              <MusicBrainzLink releaseMbId={data.releaseMbId}>
                {data.releaseName}
              </MusicBrainzLink>
            </p>
            <div className="flex items-center justify-end gap-2 mt-0.5 min-w-0 overflow-hidden">
              {data.playedTime && (
                <p className="text-xs text-zinc-600 flex-shrink-0">
                  {new Date(data.playedTime).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
              <a
                href={`/profile/${data.actorHandle}`}
                className="text-xs text-violet-500 hover:text-violet-400 transition-colors truncate block max-w-[120px]"
              >
                @{data.actorHandle}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
