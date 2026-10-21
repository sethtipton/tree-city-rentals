// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import App from "../src/App";
const state = vi.hoisted(() => ({ auth: null, workspaceLoaded: false }));
vi.mock("../src/lib/supabase", () => ({ isSupabaseConfigured: true }));
vi.mock("../src/lib/data", () => ({ getSession: async () => null, loadPublicListings: async () => [], signInWithGoogle: vi.fn(), watchAuth: callback => { state.auth = callback; return () => {}; } }));
vi.mock("../src/WorkspaceApp", () => { state.workspaceLoaded = true; return { default: () => <p>Private workspace loaded</p> }; });
let root, container;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("keeps workspace code unloaded for public visitors and loads it after sign-in", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<App />));
  expect(container.textContent).toContain("No homes are available"); expect(state.workspaceLoaded).toBe(false);
  await act(async () => { state.auth({ user: { id: "admin" } }); });
  expect(state.workspaceLoaded).toBe(true); expect(container.textContent).toContain("Private workspace loaded");
  await act(async () => state.auth(null));
  expect(container.textContent).toContain("No homes are available");
  expect(container.textContent).not.toContain("Private workspace loaded");
});
