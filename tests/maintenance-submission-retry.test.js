import { beforeEach, expect, it, vi } from "vitest";
import { addMaintenanceInformation, submitMaintenanceRequest } from "../src/lib/maintenance";
const state = vi.hoisted(() => ({ rows: {}, failAi: false, failUpload: false, uncertainInsert: false, invoke: vi.fn(), upload: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: {
  from: table => ({
    insert: row => ({ select: () => ({ single: async () => {
      state.rows[table] ||= new Map();
      const duplicate = state.rows[table].has(row.id);
      state.rows[table].set(row.id, { ...row });
      if (duplicate || state.uncertainInsert) { state.uncertainInsert = false; return { error: new Error("response lost") }; }
      return { data: row, error: null };
    } }) }),
    select: () => ({ eq: (_key, id) => ({ maybeSingle: async () => ({ data: state.rows[table]?.get(id) || null, error: null }) }) }),
  }),
  functions: { invoke: (...args) => state.invoke(...args) },
  storage: { from: () => ({ upload: (...args) => state.upload(...args) }) },
} }));
beforeEach(() => {
  state.rows = {}; vi.clearAllMocks();
  state.invoke.mockResolvedValue({ data: { status: "completed" }, error: null });
  state.upload.mockResolvedValue({ error: null });
});
const input = () => ({ workspaceId: "workspace", propertyId: "property", unitId: "unit", tenantMembershipId: "tenant", user: { id: "user", email: "tenant@example.test" }, description: "Fan rattles", photoFiles: [{ name: "fan.jpg", type: "image/jpeg" }], visibility: "tenant", submission: {} });
it("resumes a saved request after AI failure without duplicating sources", async () => {
  state.invoke.mockResolvedValueOnce({ error: new Error("timeout") }); const args = input();
  await expect(submitMaintenanceRequest(args)).rejects.toThrow("Request saved");
  const requestId = args.submission.request.id;
  expect((await submitMaintenanceRequest(args)).id).toBe(requestId);
  expect(state.rows.maintenance_requests.size).toBe(1); expect(state.rows.maintenance_request_entries.size).toBe(2);
  expect(state.rows.maintenance_attachments.size).toBe(1); expect(state.upload).toHaveBeenCalledTimes(1);
});
it("retries an interrupted photo upload using the same request and entry", async () => {
  state.upload.mockResolvedValueOnce({ error: new Error("offline") }); const args = input();
  await expect(submitMaintenanceRequest(args)).rejects.toThrow("offline"); await submitMaintenanceRequest(args);
  expect(state.rows.maintenance_requests.size).toBe(1); expect(state.rows.maintenance_request_entries.size).toBe(2);
  expect(state.rows.maintenance_attachments.size).toBe(1);
  expect(state.upload.mock.calls[0][0]).toBe(state.upload.mock.calls[1][0]);
});
it("recovers an insert whose successful response was lost", async () => {
  state.uncertainInsert = true; const args = input();
  await submitMaintenanceRequest(args); expect(state.rows.maintenance_requests.size).toBe(1);
});

it("resumes an additional-information retry without creating duplicate notes", async () => {
  state.invoke.mockResolvedValueOnce({ error: new Error("timeout") });
  const args = { request: { id: "existing", workspace_id: "workspace" }, user: { id: "tenant" }, content: "It is louder now", visibility: "tenant", submission: {} };
  await expect(addMaintenanceInformation(args)).rejects.toThrow("timeout");
  await addMaintenanceInformation(args);
  expect(state.rows.maintenance_request_entries.size).toBe(1);
  expect(state.rows.maintenance_requests).toBeUndefined();
});
