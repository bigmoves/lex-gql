/**
 * @generated SignedSource<<a5849508e44970ba4970151b0e7633ea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ScrobbleChart_data$data = {
  readonly chartData: {
    readonly groups: ReadonlyArray<{
      readonly count: number | null | undefined;
      readonly playedTime: string | null | undefined;
    } | null | undefined> | null | undefined;
  } | null | undefined;
  readonly " $fragmentType": "ScrobbleChart_data";
};
export type ScrobbleChart_data$key = {
  readonly " $data"?: ScrobbleChart_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"ScrobbleChart_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "chartWhere"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ScrobbleChart_data",
  "selections": [
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
              "name": "playedTime",
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
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "04c7e5f0de6d84e09de76b2e56361c44";

export default node;
