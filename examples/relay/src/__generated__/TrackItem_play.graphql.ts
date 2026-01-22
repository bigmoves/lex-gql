/**
 * @generated SignedSource<<74280602b52aef4bebd292c749fd184f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type TrackItem_play$data = {
  readonly actorHandle: string | null | undefined;
  readonly appBskyActorProfileByDid:
    | {
        readonly avatar:
          | {
              readonly url: string;
            }
          | null
          | undefined;
        readonly displayName: string | null | undefined;
      }
    | null
    | undefined;
  readonly artists:
    | ReadonlyArray<{
        readonly artistName: string;
      }>
    | null
    | undefined;
  readonly musicServiceBaseDomain: string | null | undefined;
  readonly playedTime: string | null | undefined;
  readonly releaseMbId: string | null | undefined;
  readonly releaseName: string | null | undefined;
  readonly trackName: string | null | undefined;
  readonly ' $fragmentType': 'TrackItem_play';
};
export type TrackItem_play$key = {
  readonly ' $data'?: TrackItem_play$data;
  readonly ' $fragmentSpreads': FragmentRefs<'TrackItem_play'>;
};

const node: ReaderFragment = {
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'TrackItem_play',
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
      ],
      storageKey: null,
    },
  ],
  type: 'FmTealAlphaFeedPlay',
  abstractKey: null,
};

(node as any).hash = '37e9c6f851f478846e3e68ef417d4da4';

export default node;
