import assert from "node:assert/strict";
import test from "node:test";
import { ensureSelf } from "./lgpd-guard.ts";

test("ensureSelf blocks access to a different user id", () => {
  const req = {
    clientId: "client-a",
    params: { userId: "client-b" },
  } as any;

  let statusCode: number | undefined;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  } as any;

  assert.equal(ensureSelf(req, res), false);
  assert.equal(statusCode, 403);
  assert.deepEqual(payload, { error: "Você só pode acessar os próprios dados" });
});

test("ensureSelf allows access to the same user id", () => {
  const req = {
    clientId: "client-a",
    params: { userId: "client-a" },
  } as any;

  const res = {
    status() {
      throw new Error("status should not be called");
    },
    json() {
      throw new Error("json should not be called");
    },
  } as any;

  assert.equal(ensureSelf(req, res), true);
});
