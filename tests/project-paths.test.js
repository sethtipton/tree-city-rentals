import { expect, it } from "vitest";
import { normalizeProjectPath } from "../src/lib/projectPaths.js";

it.each(["/turnover-tracker", "/tree-city-rentals"])("preserves QR tokens and callback data under %s", (prefix) => {
  const token = "A".repeat(43);
  const suffix = `/maintenance/q/${token}/?next=%2Fmaintenance%2F#access_token=test-only`;
  expect(normalizeProjectPath(prefix + suffix)).toBe(suffix);
  expect(normalizeProjectPath(prefix)).toBe("/");
  expect(normalizeProjectPath(`${prefix}?code=test-only#callback`)).toBe("/?code=test-only#callback");
});

it("does not rewrite canonical or similarly named property routes", () => {
  for (const path of ["/", "/maintenance/?request=test-only", "/tree-city-rentals-house/", "/turnover-tracker-house/"]) {
    expect(normalizeProjectPath(path)).toBe(path);
  }
});
