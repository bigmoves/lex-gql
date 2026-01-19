import {
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useSubscription,
} from "react-relay";
import { useEffect, useMemo, useRef } from "react";
import type { AppQuery } from "./__generated__/AppQuery.graphql";
import type { App_plays$key } from "./__generated__/App_plays.graphql";
import type { AppSubscription } from "./__generated__/AppSubscription.graphql";
import TrackItem from "./TrackItem";
import Layout from "./Layout";
import ScrobbleChart from "./ScrobbleChart";
import {
  ConnectionHandler,
  type GraphQLSubscriptionConfig,
} from "relay-runtime";

const SUBSCRIPTIONS_ENABLED = true;

function PlaySubscription() {
  const subscriptionConfig: GraphQLSubscriptionConfig<AppSubscription> =
    useMemo(() => ({
      subscription: graphql`
        subscription AppSubscription {
          fmTealAlphaFeedPlayCreated {
            uri
            playedTime
            ...TrackItem_play
          }
        }
      `,
      variables: {},
      updater: (store) => {
        const newPlay = store.getRootField("fmTealAlphaFeedPlayCreated");
        if (!newPlay) return;

        // Only add plays from the last 24 hours
        const playedTime = newPlay.getValue("playedTime") as string | null;
        if (!playedTime) return;

        const playDate = new Date(playedTime);
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (playDate < cutoff) {
          return;
        }

        const root = store.getRoot();
        const connection = ConnectionHandler.getConnection(
          root,
          "App_fmTealAlphaFeedPlay",
          { sortBy: [{ field: "playedTime", direction: "DESC" }] },
        );

        if (!connection) return;

        // Check if this play already exists
        const newUri = newPlay.getValue("uri");
        const existingEdges = connection.getLinkedRecords("edges") || [];
        const alreadyExists = existingEdges.some((edge) => {
          const node = edge?.getLinkedRecord("node");
          return node?.getValue("uri") === newUri;
        });

        if (alreadyExists) return;

        const edge = ConnectionHandler.createEdge(
          store,
          connection,
          newPlay,
          "FmTealAlphaFeedPlayEdge",
        );

        ConnectionHandler.insertEdgeBefore(connection, edge);

        // Update totalCount
        const totalCountRecord = root.getLinkedRecord("fmTealAlphaFeedPlay", {
          sortBy: [{ field: "playedTime", direction: "DESC" }],
        });
        if (totalCountRecord) {
          const currentCount = totalCountRecord.getValue("totalCount") as number;
          if (typeof currentCount === "number") {
            totalCountRecord.setValue(currentCount + 1, "totalCount");
          }
        }
      },
    }), []);

  useSubscription(subscriptionConfig);
  return null;
}

export default function App() {
  const queryVariables = useMemo(() => {
    // Round to start of day to keep timestamp stable
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return {
      chartWhere: {
        playedTime: {
          gte: ninetyDaysAgo.toISOString(),
        },
      },
    };
  }, []);

  const queryData = useLazyLoadQuery<AppQuery>(
    graphql`
      query AppQuery($chartWhere: FmTealAlphaFeedPlayWhereInput!) {
        ...App_plays
        ...ScrobbleChart_data
      }
    `,
    queryVariables,
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    AppQuery,
    App_plays$key
  >(
    graphql`
      fragment App_plays on Query
      @refetchable(queryName: "AppPaginationQuery")
      @argumentDefinitions(
        cursor: { type: "String" }
        count: { type: "Int", defaultValue: 20 }
      ) {
        fmTealAlphaFeedPlay(
          first: $count
          after: $cursor
          sortBy: [{ field: playedTime, direction: DESC }]
        ) @connection(key: "App_fmTealAlphaFeedPlay", filters: ["sortBy"]) {
          totalCount
          edges {
            node {
              uri
              playedTime
              ...TrackItem_play
            }
          }
        }
      }
    `,
    queryData,
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadNextRef = useRef(loadNext);
  const isLoadingRef = useRef(false);
  loadNextRef.current = loadNext;


  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const plays = (data?.fmTealAlphaFeedPlay?.edges
    ?.map((edge) => edge?.node)
    .filter((n) => n != null) || [])
    .sort((a, b) => {
      if (!a.playedTime || !b.playedTime) return 0;
      return new Date(b.playedTime).getTime() - new Date(a.playedTime).getTime();
    });

  // Sync the loading ref with isLoadingNext
  useEffect(() => {
    isLoadingRef.current = isLoadingNext;
  }, [isLoadingNext]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNext) return;

    const element = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingRef.current) {
          isLoadingRef.current = true;
          loadNextRef.current(20);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasNext]);

  // Group plays by date
  const groupedPlays: { date: string; plays: typeof plays }[] = [];
  let currentDate = "";

  plays.forEach((play) => {
    if (!play?.playedTime) return;

    const playDate = new Date(play.playedTime).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (playDate !== currentDate) {
      currentDate = playDate;
      groupedPlays.push({ date: playDate, plays: [play] });
    } else {
      groupedPlays[groupedPlays.length - 1].plays.push(play);
    }
  });

  return (
    <Layout headerChart={<ScrobbleChart queryRef={queryData} />}>
      {SUBSCRIPTIONS_ENABLED && <PlaySubscription />}
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">
          {data?.fmTealAlphaFeedPlay?.totalCount?.toLocaleString()} scrobbles
        </p>
      </div>

      <div>
        {groupedPlays.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-12">
            <h2 className="text-xs text-zinc-600 font-medium mb-6 uppercase tracking-wider">
              {group.date}
            </h2>
            <div className="space-y-2">
              {group.plays.map((play) => (
                <TrackItem key={play.uri} play={play} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasNext && (
        <div ref={loadMoreRef} className="py-12 text-center">
          {isLoadingNext
            ? (
              <p className="text-xs text-zinc-600 uppercase tracking-wider">
                Loading...
              </p>
            )
            : (
              <p className="text-xs text-zinc-700 uppercase tracking-wider">
                ·
              </p>
            )}
        </div>
      )}
    </Layout>
  );
}
