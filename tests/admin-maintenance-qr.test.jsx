// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MaintenanceQrRoute } from "../src/components/MaintenanceQrRoute";
import { inspectPublicMaintenanceCapability } from "../src/lib/maintenance";
import { resolveAdminMaintenanceQr } from "../src/lib/maintenanceQr";
vi.mock("../src/lib/maintenance", () => ({ inspectPublicMaintenanceCapability: vi.fn(), submitPublicMaintenanceRequest: vi.fn() }));
vi.mock("../src/lib/maintenanceQr", async (original) => ({ ...await original(), resolveAdminMaintenanceQr: vi.fn() }));
vi.mock("../src/hooks/useAudioRecorder", () => ({ useAudioRecorder: () => ({ state: "idle", recordings: [] }) }));
const token = "A".repeat(43);
let root, container, open;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  inspectPublicMaintenanceCapability.mockResolvedValue({ propertyName: "441 Park", unitName: "DOWN" });
  resolveAdminMaintenanceQr.mockResolvedValue(null);
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container); open = vi.fn();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(user, qr = token, onSignIn) {
  await act(async () => root.render(<MaintenanceQrRoute token={qr} user={user} onOpenWorkspace={open} onSignIn={onSignIn} />));
}
it("keeps anonymous intake and uses the existing sign-in action", async () => {
  const signIn = vi.fn(); await render(null, token, signIn);
  expect(container.querySelector("form")).not.toBeNull();
  expect(resolveAdminMaintenanceQr).not.toHaveBeenCalled();
  await act(async () => [...container.querySelectorAll("button")].find(x => x.textContent === "Sign in").click());
  expect(signIn).toHaveBeenCalledOnce();
});
it.each(["property-admin", "owner"])("routes authorized %s without rendering public intake", async (id) => {
  resolveAdminMaintenanceQr.mockResolvedValue("/441-park/down/");
  await render({ id });
  expect(open).toHaveBeenCalledExactlyOnceWith("/441-park/down/");
  expect(inspectPublicMaintenanceCapability).not.toHaveBeenCalled();
  expect(container.querySelector("form")).toBeNull();
});
it.each(["unassigned-admin", "viewer", "tenant"])("retains public intake for %s", async (id) => {
  await render({ id }); expect(open).not.toHaveBeenCalled();
  expect(container.querySelector("form")).not.toBeNull();
});
it("reevaluates the same QR after sign-in", async () => {
  await render(null); resolveAdminMaintenanceQr.mockResolvedValue("/441-park/down/");
  await render({ id: "admin" });
  expect(resolveAdminMaintenanceQr).toHaveBeenCalledWith(token);
  expect(open).toHaveBeenCalledWith("/441-park/down/");
});
it("withholds the form while resolving and ignores stale signed-in results", async () => {
  let finish; resolveAdminMaintenanceQr.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await render({ id: "admin" });
  expect(container.textContent).toContain("Opening property"); expect(container.querySelector("form")).toBeNull();
  await render(null);
  await act(async () => finish("/441-park/down/"));
  expect(open).not.toHaveBeenCalled(); expect(container.querySelector("form")).not.toBeNull();
});
it("fails safely for malformed and disabled/rotated tokens", async () => {
  await render({ id: "admin" }, "bad");
  expect(container.textContent).toContain("unavailable"); expect(resolveAdminMaintenanceQr).not.toHaveBeenCalled();
  inspectPublicMaintenanceCapability.mockRejectedValue(new Error("Unavailable"));
  await render({ id: "admin" }); expect(open).not.toHaveBeenCalled();
  expect(container.textContent).toContain("unavailable");
});
it("preserves public intake when the authenticated resolver is unavailable", async () => {
  resolveAdminMaintenanceQr.mockRejectedValue(new Error("RPC unavailable")); await render({ id: "admin" });
  expect(open).not.toHaveBeenCalled(); expect(container.querySelector("form")).not.toBeNull();
});
