// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AppLoadBoundary } from "../src/components/AppLoadBoundary";
it("shows a recovery action when a lazy workspace fails to load", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div"); const visibleRoot = createRoot(container);
  function BrokenChunk() { throw new Error("Failed to fetch dynamically imported module"); }
  try {
    await act(async () => visibleRoot.render(<AppLoadBoundary><BrokenChunk /></AppLoadBoundary>));
    expect(container.querySelector("[role=alert]").textContent).toContain("Refresh to try again");
    expect(container.querySelector("button").textContent).toBe("Refresh app");
  } finally { await act(async () => { visibleRoot.unmount(); }); errorLog.mockRestore(); }
});
