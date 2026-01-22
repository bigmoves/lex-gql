/**
 * @generated SignedSource<<13a59aa21ca3d021dce3ba6ea105ed77>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from 'relay-runtime';
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
export type ProfilePaginationQuery$variables = {
  count?: number | null | undefined;
  cursor?: string | null | undefined;
  where: FmTealAlphaFeedPlayWhereInput;
};
export type ProfilePaginationQuery$data = {
  readonly ' $fragmentSpreads': FragmentRefs<'Profile_plays'>;
};
export type ProfilePaginationQuery = {
  response: ProfilePaginationQuery$data;
  variables: ProfilePaginationQuery$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = [
      {
        defaultValue: 20,
        kind: 'LocalArgument',
        name: 'count',
      },
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'cursor',
      },
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'where',
      },
    ],
    v1 = {
      kind: 'Variable',
      name: 'where',
      variableName: 'where',
    },
    v2 = [
      {
        kind: 'Variable',
        name: 'after',
        variableName: 'cursor',
      },
      {
        kind: 'Variable',
        name: 'first',
        variableName: 'count',
      },
      {
        kind: 'Literal',
        name: 'sortBy',
        value: [
          {
            direction: 'DESC',
            field: 'playedTime',
          },
        ],
      },
      v1 /*: any*/,
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Fragment',
      metadata: null,
      name: 'ProfilePaginationQuery',
      selections: [
        {
          args: [
            {
              kind: 'Variable',
              name: 'count',
              variableName: 'count',
            },
            {
              kind: 'Variable',
              name: 'cursor',
              variableName: 'cursor',
            },
            v1 /*: any*/,
          ],
          kind: 'FragmentSpread',
          name: 'Profile_plays',
        },
      ],
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Operation',
      name: 'ProfilePaginationQuery',
      selections: [
        {
          alias: null,
          args: v2 /*: any*/,
          concreteType: 'FmTealAlphaFeedPlayConnection',
          kind: 'LinkedField',
          name: 'fmTealAlphaFeedPlay',
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              kind: 'ScalarField',
              name: 'totalCount',
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              concreteType: 'FmTealAlphaFeedPlayEdge',
              kind: 'LinkedField',
              name: 'edges',
              plural: true,
              selections: [
                {
                  alias: null,
                  args: null,
                  concreteType: 'FmTealAlphaFeedPlay',
                  kind: 'LinkedField',
                  name: 'node',
                  plural: false,
                  selections: [
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'trackName',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'playedTime',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'FmTealAlphaFeedDefsArtist',
                      kind: 'LinkedField',
                      name: 'artists',
                      plural: true,
                      selections: [
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'artistName',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'releaseName',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'releaseMbId',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'actorHandle',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'musicServiceBaseDomain',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'AppBskyActorProfile',
                      kind: 'LinkedField',
                      name: 'appBskyActorProfileByDid',
                      plural: false,
                      selections: [
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'displayName',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          concreteType: 'Blob',
                          kind: 'LinkedField',
                          name: 'avatar',
                          plural: false,
                          selections: [
                            {
                              alias: null,
                              args: [
                                {
                                  kind: 'Literal',
                                  name: 'preset',
                                  value: 'avatar',
                                },
                              ],
                              kind: 'ScalarField',
                              name: 'url',
                              storageKey: 'url(preset:"avatar")',
                            },
                          ],
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'description',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: '__typename',
                      storageKey: null,
                    },
                  ],
                  storageKey: null,
                },
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: 'cursor',
                  storageKey: null,
                },
              ],
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              concreteType: 'PageInfo',
              kind: 'LinkedField',
              name: 'pageInfo',
              plural: false,
              selections: [
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: 'endCursor',
                  storageKey: null,
                },
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: 'hasNextPage',
                  storageKey: null,
                },
              ],
              storageKey: null,
            },
          ],
          storageKey: null,
        },
        {
          alias: null,
          args: v2 /*: any*/,
          filters: ['where', 'sortBy'],
          handle: 'connection',
          key: 'Profile_fmTealAlphaFeedPlay',
          kind: 'LinkedHandle',
          name: 'fmTealAlphaFeedPlay',
        },
      ],
    },
    params: {
      cacheID: '8b11e8a86ba408e56b78598469a6e2a5',
      id: null,
      metadata: {},
      name: 'ProfilePaginationQuery',
      operationKind: 'query',
      text: 'query ProfilePaginationQuery(\n  $count: Int = 20\n  $cursor: String\n  $where: FmTealAlphaFeedPlayWhereInput!\n) {\n  ...Profile_plays_mjR8k\n}\n\nfragment Profile_plays_mjR8k on Query {\n  fmTealAlphaFeedPlay(first: $count, after: $cursor, sortBy: [{field: playedTime, direction: DESC}], where: $where) {\n    totalCount\n    edges {\n      node {\n        ...TrackItem_play\n        actorHandle\n        appBskyActorProfileByDid {\n          displayName\n          description\n          avatar {\n            url(preset: "avatar")\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment TrackItem_play on FmTealAlphaFeedPlay {\n  trackName\n  playedTime\n  artists {\n    artistName\n  }\n  releaseName\n  releaseMbId\n  actorHandle\n  musicServiceBaseDomain\n  appBskyActorProfileByDid {\n    displayName\n    avatar {\n      url(preset: "avatar")\n    }\n  }\n}\n',
    },
  };
})();

(node as any).hash = '06ba557474df22684f61a32da8aec20a';

export default node;
