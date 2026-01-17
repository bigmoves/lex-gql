/**
 * @generated SignedSource<<89f51a04654ed0d18537fb36b014bfb8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type FmTealAlphaFeedPlayWhereInput = {
  AND?: ReadonlyArray<FmTealAlphaFeedPlayWhereInput | null | undefined> | null | undefined;
  OR?: ReadonlyArray<FmTealAlphaFeedPlayWhereInput | null | undefined> | null | undefined;
  artistMbIds?: StringFieldCondition | null | undefined;
  artistNames?: StringFieldCondition | null | undefined;
  artists?: StringFieldCondition | null | undefined;
  collection?: StringFieldCondition | null | undefined;
  did?: StringFieldCondition | null | undefined;
  duration?: IntFieldCondition | null | undefined;
  isrc?: StringFieldCondition | null | undefined;
  musicServiceBaseDomain?: StringFieldCondition | null | undefined;
  originUrl?: StringFieldCondition | null | undefined;
  playedTime?: StringFieldCondition | null | undefined;
  recordingMbId?: StringFieldCondition | null | undefined;
  releaseMbId?: StringFieldCondition | null | undefined;
  releaseName?: StringFieldCondition | null | undefined;
  submissionClientAgent?: StringFieldCondition | null | undefined;
  trackMbId?: StringFieldCondition | null | undefined;
  trackName?: StringFieldCondition | null | undefined;
  uri?: StringFieldCondition | null | undefined;
};
export type StringFieldCondition = {
  contains?: string | null | undefined;
  eq?: string | null | undefined;
  gt?: string | null | undefined;
  gte?: string | null | undefined;
  in?: ReadonlyArray<string | null | undefined> | null | undefined;
  lt?: string | null | undefined;
  lte?: string | null | undefined;
};
export type IntFieldCondition = {
  contains?: number | null | undefined;
  eq?: number | null | undefined;
  gt?: number | null | undefined;
  gte?: number | null | undefined;
  in?: ReadonlyArray<number | null | undefined> | null | undefined;
  lt?: number | null | undefined;
  lte?: number | null | undefined;
};
export type AppQuery$variables = {
  chartWhere: FmTealAlphaFeedPlayWhereInput;
};
export type AppQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"App_plays" | "ScrobbleChart_data">;
};
export type AppQuery = {
  response: AppQuery$data;
  variables: AppQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "chartWhere"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 20
  },
  {
    "kind": "Literal",
    "name": "sortBy",
    "value": [
      {
        "direction": "DESC",
        "field": "playedTime"
      }
    ]
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AppQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "App_plays"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ScrobbleChart_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AppQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "FmTealAlphaFeedPlayConnection",
        "kind": "LinkedField",
        "name": "fmTealAlphaFeedPlay",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "FmTealAlphaFeedPlayEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "FmTealAlphaFeedPlay",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "playedTime",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "trackName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "FmTealAlphaFeedDefsArtist",
                    "kind": "LinkedField",
                    "name": "artists",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "artistName",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "releaseName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "releaseMbId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "actorHandle",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "musicServiceBaseDomain",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "AppBskyActorProfile",
                    "kind": "LinkedField",
                    "name": "appBskyActorProfileByDid",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "displayName",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "fmTealAlphaFeedPlay(first:20,sortBy:[{\"direction\":\"DESC\",\"field\":\"playedTime\"}])"
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "sortBy"
        ],
        "handle": "connection",
        "key": "App_fmTealAlphaFeedPlay",
        "kind": "LinkedHandle",
        "name": "fmTealAlphaFeedPlay"
      },
      {
        "alias": "chartData",
        "args": [
          {
            "kind": "Literal",
            "name": "groupBy",
            "value": [
              "playedTime_day"
            ]
          },
          {
            "kind": "Literal",
            "name": "limit",
            "value": 90
          },
          {
            "kind": "Variable",
            "name": "where",
            "variableName": "chartWhere"
          }
        ],
        "concreteType": "FmTealAlphaFeedPlayAggregated",
        "kind": "LinkedField",
        "name": "fmTealAlphaFeedPlayAggregate",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "FmTealAlphaFeedPlayAggregateGroup",
            "kind": "LinkedField",
            "name": "groups",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "playedTime_day",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "count",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dcc7f147a1751d918d0d060a05550e5b",
    "id": null,
    "metadata": {},
    "name": "AppQuery",
    "operationKind": "query",
    "text": "query AppQuery(\n  $chartWhere: FmTealAlphaFeedPlayWhereInput!\n) {\n  ...App_plays\n  ...ScrobbleChart_data\n}\n\nfragment App_plays on Query {\n  fmTealAlphaFeedPlay(first: 20, sortBy: [{field: playedTime, direction: DESC}]) {\n    totalCount\n    edges {\n      node {\n        playedTime\n        ...TrackItem_play\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment ScrobbleChart_data on Query {\n  chartData: fmTealAlphaFeedPlayAggregate(groupBy: [playedTime_day], where: $chartWhere, limit: 90) {\n    groups {\n      playedTime_day\n      count\n    }\n  }\n}\n\nfragment TrackItem_play on FmTealAlphaFeedPlay {\n  trackName\n  playedTime\n  artists {\n    artistName\n  }\n  releaseName\n  releaseMbId\n  actorHandle\n  musicServiceBaseDomain\n  appBskyActorProfileByDid {\n    displayName\n  }\n}\n"
  }
};
})();

(node as any).hash = "7266612861cb55b740623549f1a03f26";

export default node;
