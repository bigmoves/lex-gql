import { useEffect, useMemo, useRef } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import { Link, useParams } from 'react-router-dom';
import type { Profile_plays$key } from './__generated__/Profile_plays.graphql';
import type { ProfileQuery as ProfileQueryType } from './__generated__/ProfileQuery.graphql';
import ScrobbleChart from './ScrobbleChart';
import TrackItem from './TrackItem';

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();

  const queryVariables = useMemo(() => {
    // Round to start of day to keep timestamp stable
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return {
      where: { actorHandle: { eq: handle } },
      chartWhere: {
        actorHandle: { eq: handle },
        playedTime: {
          gte: ninetyDaysAgo.toISOString(),
        },
      },
    };
  }, [handle]);

  const queryData = useLazyLoadQuery<ProfileQueryType>(
    graphql`
      query ProfileQuery($where: FmTealAlphaFeedPlayWhereInput!, $chartWhere: FmTealAlphaFeedPlayWhereInput!) {
        ...Profile_plays @arguments(where: $where)
        ...ScrobbleChart_data
      }
    `,
    queryVariables,
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ProfileQueryType,
    Profile_plays$key
  >(
    graphql`
      fragment Profile_plays on Query
      @refetchable(queryName: "ProfilePaginationQuery")
      @argumentDefinitions(
        cursor: { type: "String" }
        count: { type: "Int", defaultValue: 20 }
        where: { type: "FmTealAlphaFeedPlayWhereInput!" }
      ) {
        fmTealAlphaFeedPlay(
          first: $count
          after: $cursor
          sortBy: [{ field: playedTime, direction: DESC }]
          where: $where
        )
          @connection(
            key: "Profile_fmTealAlphaFeedPlay"
            filters: ["where", "sortBy"]
          ) {
          totalCount
          edges {
            node {
              ...TrackItem_play
              actorHandle
              appBskyActorProfileByDid {
                displayName
                description
                avatar {
                  url(preset: "avatar")
                }
              }
            }
          }
        }
      }
    `,
    queryData,
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const plays = useMemo(
    () => data?.fmTealAlphaFeedPlay?.edges?.map((edge) => edge.node).filter((n) => n != null) || [],
    [data?.fmTealAlphaFeedPlay?.edges],
  );
  const profile = plays?.[0]?.appBskyActorProfileByDid;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [handle]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingNext) {
          loadNext(20);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-block mb-8"
        >
          ← Back
        </Link>

        <div className="mb-12 border-b border-zinc-800 pb-6 relative">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <ScrobbleChart queryRef={queryData} />
          </div>
          <div className="relative flex items-start gap-6">
            {profile?.avatar?.url && (
              <img
                src={profile.avatar.url}
                alt={profile.displayName ?? handle ?? 'User'}
                className="w-16 h-16 flex-shrink-0 object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-lg font-medium mb-1 text-zinc-100">
                {profile?.displayName ?? handle}
              </h1>
              <p className="text-xs text-zinc-500 mb-2">@{handle}</p>
              {profile?.description && (
                <p className="text-xs text-zinc-400">{profile.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400 mb-2">
            Recent Tracks
          </h2>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            {(data?.fmTealAlphaFeedPlay?.totalCount ?? 0).toLocaleString()} scrobbles
          </p>
        </div>

        <div className="space-y-1">
          {plays && plays.length > 0 ? (
            plays.map((play, index) => <TrackItem key={index} play={play} hideUser />)
          ) : (
            <p className="text-zinc-600 text-center py-8 text-xs uppercase tracking-wider">
              No tracks found for this user
            </p>
          )}
        </div>

        {hasNext && (
          <div ref={loadMoreRef} className="py-12 text-center">
            {isLoadingNext ? (
              <p className="text-xs text-zinc-600 uppercase tracking-wider">Loading...</p>
            ) : (
              <p className="text-xs text-zinc-700 uppercase tracking-wider">·</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
