import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams } from 'react-router-dom';
import type { TopAlbumsQuery } from './__generated__/TopAlbumsQuery.graphql';
import AlbumItem from './AlbumItem';
import Layout from './Layout';
import { useDateRangeFilter } from './useDateRangeFilter';

export default function TopAlbums() {
  const { period } = useParams<{ period?: string }>();
  const queryVariables = useDateRangeFilter(period);

  const data = useLazyLoadQuery<TopAlbumsQuery>(
    graphql`
      query TopAlbumsQuery($where: FmTealAlphaFeedPlayWhereInput) {
        fmTealAlphaFeedPlayAggregate(
          groupBy: [releaseMbId, releaseName]
          orderBy: COUNT_DESC
          limit: 100
          where: $where
        ) {
          groups {
            releaseMbId
            releaseName
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

  const albums = [...(data.fmTealAlphaFeedPlayAggregate?.groups || [])];

  // Deduplicate by release name, keeping the one with highest count
  const seenNames = new Set<string>();
  const dedupedAlbums = albums
    .filter((album) => {
      const name = album.releaseName || 'Unknown Album';
      if (seenNames.has(name)) {
        return false;
      }
      seenNames.add(name);
      return true;
    })
    .slice(0, 50);

  const maxCount = dedupedAlbums.length > 0 ? dedupedAlbums[0].count : 0;

  return (
    <Layout>
      <div className="space-y-1">
        {dedupedAlbums.map((album, index) => (
          <AlbumItem
            key={album.releaseMbId || index}
            releaseName={album.releaseName || 'Unknown Album'}
            releaseMbId={album.releaseMbId}
            artists={album.artists ? JSON.stringify(album.artists) : undefined}
            count={album.count}
            rank={index + 1}
            maxCount={maxCount}
          />
        ))}
      </div>
    </Layout>
  );
}
