import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Profile from "./Profile.tsx";
import TopTracks from "./TopTracks.tsx";
import TopAlbums from "./TopAlbums.tsx";
import LoadingFallback from "./LoadingFallback.tsx";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  type FetchFunction,
  type GraphQLResponse,
  Network,
  Observable,
  type SubscribeFunction,
} from "relay-runtime";
import { createClient } from "graphql-ws";

const HTTP_ENDPOINT = "/graphql";

const WS_ENDPOINT = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/graphql`;

const fetchGraphQL: FetchFunction = async (request, variables) => {
  const resp = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: request.text, variables }),
  });
  if (!resp.ok) {
    throw new Error("Response failed.");
  }
  return await resp.json();
};

const wsClient = createClient({
  url: WS_ENDPOINT,
  retryAttempts: 5,
  shouldRetry: () => true,
  on: {
    connected: () => {
      console.log("WebSocket connected!");
    },
    error: (error) => {
      console.error("WebSocket error:", error);
    },
    closed: (event) => {
      console.log("WebSocket closed:", event);
    },
  },
});

const subscribe: SubscribeFunction = (operation, variables) => {
  return Observable.create((sink) => {
    if (!operation.text) {
      sink.error(new Error("Missing operation text"));
      return;
    }

    return wsClient.subscribe(
      {
        operationName: operation.name,
        query: operation.text,
        variables,
      },
      {
        next: (data) => {
          if (data.data !== null && data.data !== undefined) {
            sink.next({ data: data.data } as GraphQLResponse);
          }
        },
        error: (error) => {
          console.error("Subscription error:", error);
          if (error instanceof Error) {
            sink.error(error);
          } else if (error instanceof CloseEvent) {
            sink.error(
              new Error(`WebSocket closed: ${error.code} ${error.reason}`),
            );
          } else {
            sink.error(new Error(JSON.stringify(error)));
          }
        },
        complete: () => sink.complete(),
      },
    );
  });
};

const environment = new Environment({
  network: Network.create(fetchGraphQL, subscribe),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <RelayEnvironmentProvider environment={environment}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/tracks" element={<TopTracks />} />
            <Route path="/tracks/:period" element={<TopTracks />} />
            <Route path="/albums" element={<TopAlbums />} />
            <Route path="/albums/:period" element={<TopAlbums />} />
            <Route path="/profile/:handle" element={<Profile />} />
          </Routes>
        </Suspense>
      </RelayEnvironmentProvider>
    </BrowserRouter>
  </StrictMode>,
);
