import { afterEach, beforeEach, expect, it, vi } from "vitest";
import handler from "../supabase/functions/process-maintenance-request/index.ts";
const state = vi.hoisted(() => ({ clients: [], createClient: vi.fn() }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.111.0", () => ({ createClient: (...args) => state.createClient(...args) }));
const requestId = "a0300000-0000-4000-8000-000000000001";
let requester, service;
beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: () => "test-placeholder" } });
  requester = { auth: { getUser: async () => ({ data: { user: { id: "tenant" } }, error: null }) }, rpc: vi.fn() };
  service = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error("synthetic database failure") }) }) }) })) };
  state.createClient.mockReset().mockReturnValueOnce(requester).mockReturnValueOnce(service);
});
afterEach(() => vi.unstubAllGlobals());
function request(body = { maintenanceRequestId: requestId, forceRetry: true }, auth = true) {
  return new Request("https://example.test/process", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer test" } : {}) }, body: JSON.stringify(body) });
}
it("returns 403 for tenant forced reanalysis before touching privileged records", async () => {
  requester.rpc.mockResolvedValue({ error: { code: "42501" } });
  expect((await handler.fetch(request())).status).toBe(403);
  expect(service.from).not.toHaveBeenCalled();
});
it("rejects unauthenticated requests and non-boolean force flags", async () => {
  expect((await handler.fetch(request(undefined, false))).status).toBe(401);
  expect((await handler.fetch(request({ maintenanceRequestId: requestId, forceRetry: "false" }))).status).toBe(400);
  expect(requester.rpc).not.toHaveBeenCalled();
});
it("acknowledges an active lease without starting a duplicate analysis", async () => {
  requester.rpc.mockResolvedValue({ data: { status: "already-processing" }, error: null });
  const response = await handler.fetch(request({ maintenanceRequestId: requestId, forceRetry: false }));
  expect(response.status).toBe(200); expect((await response.json()).status).toBe("already-processing");
  expect(service.from).not.toHaveBeenCalled();
});
it("releases the lease when processing encounters a database failure", async () => {
  requester.rpc.mockResolvedValueOnce({ data: { status: "claimed", token: "lease" }, error: null }).mockResolvedValue({ data: true, error: null });
  expect((await handler.fetch(request({ maintenanceRequestId: requestId, forceRetry: false }))).status).toBe(500);
  expect(requester.rpc).toHaveBeenLastCalledWith("release_maintenance_processing", { target_request_id: requestId, lease_token: "lease" });
});
