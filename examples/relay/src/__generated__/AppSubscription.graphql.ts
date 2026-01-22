/**
 * @generated SignedSource<<09914b9466e64b998da5c58b69d7a24d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from 'relay-runtime';
export type AppSubscription$variables = Record<PropertyKey, never>;
export type AppSubscription$data = {
  readonly fmTealAlphaFeedPlayCreated: {
    readonly playedTime: string | null | undefined;
    readonly uri: string | null | undefined;
    readonly ' $fragmentSpreads': FragmentRefs<'TrackItem_play'>;
  };
};
export type AppSubscription = {
  response: AppSubscription$data;
  variables: AppSubscription$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'uri',
      storageKey: null,
    },
    v1 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'playedTime',
      storageKey: null,
    };
  return {
    fragment: {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name: 'AppSubscription',
      selections: [
        {
          alias: null,
          args: null,
          concreteType: 'FmTealAlphaFeedPlay',
          kind: 'LinkedField',
          name: 'fmTealAlphaFeedPlayCreated',
          plural: false,
          selections: [
            v0 /*: any*/,
            v1 /*: any*/,
            {
              args: null,
              kind: 'FragmentSpread',
              name: 'TrackItem_play',
            },
          ],
          storageKey: null,
        },
      ],
      type: 'Subscription',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'AppSubscription',
      selections: [
        {
          alias: null,
          args: null,
          concreteType: 'FmTealAlphaFeedPlay',
          kind: 'LinkedField',
          name: 'fmTealAlphaFeedPlayCreated',
          plural: false,
          selections: [
            v0 /*: any*/,
            v1 /*: any*/,
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
              ],
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: 'a7bfd64e3451ccd61303087bd69621ac',
      id: null,
      metadata: {},
      name: 'AppSubscription',
      operationKind: 'subscription',
      text: 'subscription AppSubscription {\n  fmTealAlphaFeedPlayCreated {\n    uri\n    playedTime\n    ...TrackItem_play\n  }\n}\n\nfragment TrackItem_play on FmTealAlphaFeedPlay {\n  trackName\n  playedTime\n  artists {\n    artistName\n  }\n  releaseName\n  releaseMbId\n  actorHandle\n  musicServiceBaseDomain\n  appBskyActorProfileByDid {\n    displayName\n    avatar {\n      url(preset: "avatar")\n    }\n  }\n}\n',
    },
  };
})();

(node as any).hash = '96fa73287dd5ff8b0c3e83b8f663f65e';

export default node;
