// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { setAuthTokenGetter, setAuthTokenSetter, startTokenRefreshLoop } from "./custom-fetch.ts";

test("startTokenRefreshLoop refreshes the token and stores the replacement", async () => {
  const requests: string[] = [];
  let currentToken = "old-token";

  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    requests.push(String(input));
    return new Response(JSON.stringify({ token: "fresh-token" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  setAuthTokenGetter(() => currentToken);
  setAuthTokenSetter((token) => {
    currentToken = token ?? "";
  });

  const stop = startTokenRefreshLoop({
    intervalMs: 100,
    refreshUrl: "/auth/refresh",
    fetchImpl,
  });

  await new Promise((resolve) => setTimeout(resolve, 150));

  stop();
  setAuthTokenGetter(null);
  setAuthTokenSetter(null);

  assert.deepEqual(requests, ["/auth/refresh"]);
  assert.equal(currentToken, "fresh-token");
});
