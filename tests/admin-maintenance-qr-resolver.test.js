// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
const signIn = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/supabase", () => ({ supabase: { rpc, auth: { signInWithOAuth: signIn } } }));
import { resolveAdminMaintenanceQr } from "../src/lib/maintenanceQr";
import { signInWithGoogle } from "../src/lib/data";
import { restoreAuthReturnPath, getMaintenanceQrTokenFromCurrentPath } from "../src/lib/routing";
const token = "A".repeat(43);
beforeEach(() => vi.clearAllMocks());
afterEach(() => window.history.replaceState({}, "", "/"));
it.each(["UP", "DOWN"])("uses server-verified IDs and names for the %s workspace", async (name) => {
  rpc.mockResolvedValue({ data: [{ property_id: "11111111-1111-4111-8111-111111111111", unit_id: "22222222-2222-4222-8222-222222222222", property_name: "441 Park", unit_name: name }] });
  expect(await resolveAdminMaintenanceQr(token)).toBe(`/441-Park/${name}/`);
  expect(rpc).toHaveBeenCalledWith("resolve_admin_maintenance_qr", { target_token: token });
});
it("does not invent a destination for denied or malformed results", async () => {
  rpc.mockResolvedValue({ data: [] }); expect(await resolveAdminMaintenanceQr(token)).toBeNull();
  rpc.mockResolvedValue({ data: [{ property_id: "bad", unit_id: "bad" }] });
  await expect(resolveAdminMaintenanceQr(token)).rejects.toThrow("Invalid maintenance workspace scope");
  rpc.mockClear(); expect(await resolveAdminMaintenanceQr("bad")).toBeNull(); expect(rpc).not.toHaveBeenCalled();
});

it("preserves the exact QR token through the existing Google OAuth return mechanism", async () => {
  const originalPath = `/maintenance/q/${token}/?source=qr`;
  window.history.replaceState({}, "", originalPath);
  signIn.mockResolvedValue({ error: null });
  await signInWithGoogle();
  const redirect = new URL(signIn.mock.calls[0][0].options.redirectTo);
  expect(signIn.mock.calls[0][0].provider).toBe("google");
  expect(redirect.origin).toBe(window.location.origin);
  expect(redirect.searchParams.get("next")).toBe(originalPath);
  window.history.replaceState({}, "", redirect.pathname + redirect.search);
  expect(restoreAuthReturnPath()).toBe(true);
  expect(getMaintenanceQrTokenFromCurrentPath()).toBe(token);
  expect(window.location.pathname + window.location.search).toBe(originalPath);
});
