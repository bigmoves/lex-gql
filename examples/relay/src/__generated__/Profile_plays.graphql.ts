/**
 * @generated SignedSource<<dd5c51e8d12e525e872610af67d9f2d9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type Profile_plays$data = {
  readonly fmTealAlphaFeedPlay: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly actorHandle: string | null | undefined;
        readonly appBskyActorProfileByDid: {
          readonly avatar: {
            readonly url: string;
          } | null | undefined;
          readonly description: string | null | undefined;
          readonly displayName: string | null | undefined;
        } | null | undefined;
        readonly " $fragmentSpreads": FragmentRefs<"TrackItem_play">;
      } | null | undefined;
    } | null | undefined> | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
  readonly " $fragmentType": "Profile_plays";
};
export type Profile_plays$key = {
  readonly " $data"?: Profile_plays$data;
  readonly " $fragmentSpreads": FragmentRefs<"Profile_plays">;
};

import ProfilePaginationQuery_graphql from './ProfilePaginationQuery.graphql';

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
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "where"
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
      "operation": ProfilePaginationQuery_graphql
    }
  },
  "name": "Profile_plays",
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
        },
        {
          "kind": "Variable",
          "name": "where",
          "variableName": "where"
        }
      ],
      "concreteType": "FmTealAlphaFeedPlayConnection",
      "kind": "LinkedField",
      "name": "__Profile_fmTealAlphaFeedPlay_connection",
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "TrackItem_play"
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
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "description",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "Blob",
                      "kind": "LinkedField",
                      "name": "avatar",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": [
                            {
                              "kind": "Literal",
                              "name": "preset",
                              "value": "avatar"
                            }
                          ],
                          "kind": "ScalarField",
                          "name": "url",
                          "storageKey": "url(preset:\"avatar\")"
                        }
                      ],
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
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "06ba557474df22684f61a32da8aec20a";

export default node;
