import { describe, expect, it, vi } from "vitest";
import { deadlineFetch, withMaintenanceProcessingLease } from "../supabase/functions/_shared/maintenance-processing.ts";

function requester(claim = { status: "claimed", token: "lease-token" }, error = null) {
  return { rpc: vi.fn(async (name) => name === "claim_maintenance_processing" ? { data: claim, error } : { data: true, error: null }) };
}
describe("maintenance processing boundary", () => {
  it("does not run privileged work when authorization denies a forced retry", async () => {
    const db = requester(null, { code: "42501" });
    const work = vi.fn();
    await expect(withMaintenanceProcessingLease(db, "request", true, work)).rejects.toMatchObject({ status: 403 });
    expect(work).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("claim_maintenance_processing", { target_request_id: "request", force_reanalysis: true });
  });
  it("does not start a second worker while the lease is active", async () => {
    const work = vi.fn(); const db = requester({ status: "already-processing" });
    expect(await withMaintenanceProcessingLease(db, "request", false, work)).toEqual({ status: "already-processing", requestId: "request" });
    expect(work).not.toHaveBeenCalled(); expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("releases the exact lease after work fails=%s", async (fail) => {
    const db = requester(); const work = vi.fn(async () => { if (fail) throw new Error("provider timeout"); return "saved"; });
    const result = withMaintenanceProcessingLease(db, "request", false, work);
    if (fail) await expect(result).rejects.toThrow("provider timeout"); else expect(await result).toBe("saved");
    expect(db.rpc).toHaveBeenLastCalledWith("release_maintenance_processing", { target_request_id: "request", lease_token: "lease-token" });
  });
  it("retains caller cancellation and aborts requests at the processing deadline", async () => {
    const deadline = new AbortController(); const caller = new AbortController();
    const fetcher = vi.fn(async (_input, init) => { expect(init.signal.aborted).toBe(false); return init.signal; });
    const signal = await deadlineFetch(deadline.signal, fetcher)("https://example.test", { signal: caller.signal });
    deadline.abort(); expect(signal.aborted).toBe(true);
    const second = await deadlineFetch(new AbortController().signal, fetcher)("https://example.test", { signal: caller.signal });
    caller.abort(); expect(second.aborted).toBe(true);
  });
});
