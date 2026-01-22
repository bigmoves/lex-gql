import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams } from 'react-router-dom';
import type { TopTracksQuery } from './__generated__/TopTracksQuery.graphql';
import Layout from './Layout';
import TopTrackItem from './TopTrackItem';
import { useDateRangeFilter } from './useDateRangeFilter';

export default function TopTracks() {
  const { period } = useParams<{ period?: string }>();
  const queryVariables = useDateRangeFilter(period);

  const data = useLazyLoadQuery<TopTracksQuery>(
    graphql`
      query TopTracksQuery($where: FmTealAlphaFeedPlayWhereInput) {
        fmTealAlphaFeedPlayAggregate(
          groupBy: [trackName, releaseMbId]
          orderBy: COUNT_DESC
          limit: 50
          where: $where
        ) {
          groups {
            trackName
            releaseMbId
            artists {
              artistName
            }
            count
          }
        }
      }
    `,
    queryVariables,
    { fetchKey: period || 'all', fetchPolicy: 'network-only' },
  );

  const tracks = data.fmTealAlphaFeedPlayAggregate?.groups || [];
  const maxCount = tracks.length > 0 ? tracks[0].count : 0;

  return (
    <Layout>
      <div className="space-y-1">
        {tracks.map((track, index) => (
          <TopTrackItem
            key={`${track.trackName}-${index}`}
            trackName={track.trackName || 'Unknown Track'}
            releaseMbId={track.releaseMbId}
            artists={track.artists ? JSON.stringify(track.artists) : undefined}
            count={track.count}
            rank={index + 1}
            maxCount={maxCount}
          />
        ))}
      </div>
    </Layout>
  );
}
