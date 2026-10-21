// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import App from "../src/App";

const state = vi.hoisted(() => ({ items: [] }));
vi.mock("../src/lib/supabase", () => ({ isSupabaseConfigured: true }));
vi.mock("../src/lib/data", () => ({
  getSession: async () => ({ user: { id: "user", email: "owner@example.com" } }),
  signOut: vi.fn(),
  watchAuth: () => () => {},
  loadWorkspace: async () => ({ id: "workspace" }),
  loadProperties: async () => [{ id: "property", name: "Test property" }],
  loadUnits: async () => [],
  loadWorkspaceMembers: async () => [],
  loadPropertyVisibilityPreferences: async () => [],
  loadPublicListings: async () => [],
}));
vi.mock("../src/lib/routing", async (original) => ({
  ...await original(),
  getScopeFromCurrentPath: () => ({ propertyId: "property", unitId: "" }),
}));
vi.mock("../src/hooks/useScopeItems", () => ({ useScopeItems: () => ({ items: state.items, activityLog: [], busy: false }) }));
vi.mock("../src/hooks/usePortfolioOverview", () => ({ usePortfolioOverview: () => ({ items: [], activityLog: [] }) }));
vi.mock("../src/hooks/useAudioRecorder", () => ({ useAudioRecorder: () => ({ state: "idle", recordings: [] }) }));

let root, container;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});
it("counts only approved shopping items while keeping completed items visible", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.items = ["approved", "done", "pending-review"].map((status) => ({
    id: status, title: `${status} supply`, kind: "material", material_type: "shopping", status, attachments: [],
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
  const column = [...container.querySelectorAll(".item-column")].find((element) => element.textContent.includes("Shopping List"));
  const badge = column.querySelector(".item-column-count");
  expect(badge.textContent).toBe("1");
  expect(badge.getAttribute("aria-label")).toBe("1 approved shopping items");
  await act(async () => column.querySelector(".panel-toggle").click());
  expect(column.textContent).toContain("approved supply");
  expect(column.textContent).toContain("done supply");
  expect(column.textContent).not.toContain("pending-review supply");
  state.items = state.items.map((item) => ({ ...item, status: "done" }));
  await act(async () => root.render(<App />));
  expect(badge.textContent).toBe("0");
  expect(badge.getAttribute("aria-label")).toBe("0 approved shopping items");
  expect(column.textContent).toContain("done supply");
});
