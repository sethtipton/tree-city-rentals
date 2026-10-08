// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { normalizeProjectPath } from "../src/lib/projectPaths.js";
import { restoreAuthReturnPath } from "../src/lib/routing.js";

afterEach(() => window.history.replaceState({}, "", "/"));

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

it("restores an old bookmarked destination after signing in", () => {
  const next = "/turnover-tracker/maintenance/?property=test-only#request";
  window.history.replaceState({}, "", `/?next=${encodeURIComponent(next)}`);
  expect(restoreAuthReturnPath()).toBe(true);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/maintenance/?property=test-only#request");
});

it("continues rejecting sign-in return paths to another origin", () => {
  window.history.replaceState({}, "", `/?next=${encodeURIComponent("https://example.invalid/tree-city-rentals/")}`);
  expect(restoreAuthReturnPath()).toBe(false);
  expect(window.location.pathname).toBe("/");
});
