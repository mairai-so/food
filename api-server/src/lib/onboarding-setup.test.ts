import assert from "node:assert/strict";
import test from "node:test";
import { buildInitialSetupBlueprint } from "./onboarding-setup.ts";

test("buildInitialSetupBlueprint creates a practical default config", () => {
  const result = buildInitialSetupBlueprint({
    segmentId: "restaurant",
    businessModel: "salon",
    modules: ["orders", "tables", "cashier", "delivery"],
    features: [{ id: "delivery", value: "true" }],
  });

  assert.equal(result.segmentId, "restaurant");
  assert.equal(result.businessModel, "salon");
  assert.ok(result.modules.includes("orders"));
  assert.ok(result.modules.includes("tables"));
  assert.ok(result.modules.includes("cashier"));
  assert.ok(result.modules.includes("delivery"));
  assert.equal(result.summary.status, "configured");
  assert.equal(result.summary.requiredSteps.length, 4);
});
