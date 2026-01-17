/**
 * @generated SignedSource<<33204e604a301f06d4be2dcee37e62ed>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type App_plays$data = {
  readonly fmTealAlphaFeedPlay: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly playedTime: string | null | undefined;
        readonly " $fragmentSpreads": FragmentRefs<"TrackItem_play">;
      } | null | undefined;
    } | null | undefined> | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
  readonly " $fragmentType": "App_plays";
};
export type App_plays$key = {
  readonly " $data"?: App_plays$data;
  readonly " $fragmentSpreads": FragmentRefs<"App_plays">;
};

import AppPaginationQuery_graphql from './AppPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "fmTealAlphaFeedPlay"
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": 20,
      "kind": "LocalArgument",
      "name": "count"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "cursor"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "count",
        "cursor": "cursor",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "count",
          "cursor": "cursor"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": AppPaginationQuery_graphql
    }
  },
  "name": "App_plays",
  "selections": [
    {
      "alias": "fmTealAlphaFeedPlay",
      "args": [
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
      ],
      "concreteType": "FmTealAlphaFeedPlayConnection",
      "kind": "LinkedField",
      "name": "__App_fmTealAlphaFeedPlay_connection",
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "TrackItem_play"
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
      "storageKey": "__App_fmTealAlphaFeedPlay_connection(sortBy:[{\"direction\":\"DESC\",\"field\":\"playedTime\"}])"
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "b793d066128b9e7d52d3209bd3e14afe";

export default node;
