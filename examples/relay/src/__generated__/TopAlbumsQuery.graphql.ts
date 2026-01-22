/**
 * @generated SignedSource<<1b81656c6db24b39a22b529d418f49e6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
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
export type TopAlbumsQuery$variables = {
  where?: FmTealAlphaFeedPlayWhereInput | null | undefined;
};
export type TopAlbumsQuery$data = {
  readonly fmTealAlphaFeedPlayAggregate:
    | {
        readonly groups:
          | ReadonlyArray<
              | {
                  readonly artists:
                    | ReadonlyArray<{
                        readonly artistName: string;
                      }>
                    | null
                    | undefined;
                  readonly count: number | null | undefined;
                  readonly releaseMbId: string | null | undefined;
                  readonly releaseName: string | null | undefined;
                }
              | null
              | undefined
            >
          | null
          | undefined;
      }
    | null
    | undefined;
};
export type TopAlbumsQuery = {
  response: TopAlbumsQuery$data;
  variables: TopAlbumsQuery$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = [
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'where',
      },
    ],
    v1 = [
      {
        alias: null,
        args: [
          {
            kind: 'Literal',
            name: 'groupBy',
            value: ['releaseMbId', 'releaseName'],
          },
          {
            kind: 'Literal',
            name: 'limit',
            value: 100,
          },
          {
            kind: 'Literal',
            name: 'orderBy',
            value: 'COUNT_DESC',
          },
          {
            kind: 'Variable',
            name: 'where',
            variableName: 'where',
          },
        ],
        concreteType: 'FmTealAlphaFeedPlayAggregated',
        kind: 'LinkedField',
        name: 'fmTealAlphaFeedPlayAggregate',
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            concreteType: 'FmTealAlphaFeedPlayAggregateGroup',
            kind: 'LinkedField',
            name: 'groups',
            plural: true,
            selections: [
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
                name: 'releaseName',
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
                name: 'count',
                storageKey: null,
              },
            ],
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Fragment',
      metadata: null,
      name: 'TopAlbumsQuery',
      selections: v1 /*: any*/,
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Operation',
      name: 'TopAlbumsQuery',
      selections: v1 /*: any*/,
    },
    params: {
      cacheID: '00322f1a34966fd1783abedfedfca5d6',
      id: null,
      metadata: {},
      name: 'TopAlbumsQuery',
      operationKind: 'query',
      text: 'query TopAlbumsQuery(\n  $where: FmTealAlphaFeedPlayWhereInput\n) {\n  fmTealAlphaFeedPlayAggregate(groupBy: [releaseMbId, releaseName], orderBy: COUNT_DESC, limit: 100, where: $where) {\n    groups {\n      releaseMbId\n      releaseName\n      artists {\n        artistName\n      }\n      count\n    }\n  }\n}\n',
    },
  };
})();

(node as any).hash = '0000884d2ccc349b667556f5456472f1';

export default node;
