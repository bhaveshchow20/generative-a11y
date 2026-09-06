import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { collectPublicApi } from "./api-inventory.mjs";

it("keeps the reviewed public API inventory aligned with every package entry", () => {
  const reviewed = JSON.parse(readFileSync("docs/api-inventory.json", "utf8"));
  expect(collectPublicApi()).toEqual(reviewed);
  expect(Object.keys(reviewed)).toContain("@generative-a11y/core/messages");
  const rootNames = reviewed["@generative-a11y/core"].map(({ name }) => name);
  expect(rootNames).toContain("createRuntime");
  expect(rootNames).not.toContain("en");
});
