// Keep the execution deadline below the database lease, including all network
// calls. An expired worker cannot continue making writes while a retry runs.
export const PROCESSING_DEADLINE_MS = 110_000;
export const AI_CALL_TIMEOUT_MS = 60_000;

export function deadlineFetch(signal: AbortSignal, fetcher: typeof fetch = fetch): typeof fetch {
  return (input, init = {}) => fetcher(input, {
    ...init,
    signal: AbortSignal.any([signal, ...(init.signal ? [init.signal] : []), ...(input instanceof Request ? [input.signal] : [])]),
  });
}

export async function withMaintenanceProcessingLease<T extends Record<string, unknown>>(requester: any, requestId: string, forceRetry: boolean, operation: () => Promise<T>) {
  const { data: claim, error } = await requester.rpc("claim_maintenance_processing", {
    target_request_id: requestId, force_reanalysis: forceRetry,
  });
  if (error) {
    const failure = new Error(error.code === "42501" ? "You do not have permission to process this request." : "Maintenance processing is temporarily unavailable.");
    Object.assign(failure, { status: error.code === "42501" ? 403 : 503 });
    throw failure;
  }
  if (claim?.status === "already-processing") return { status: "already-processing", requestId };
  if (claim?.status !== "claimed" || !claim.token) throw new Error("Could not claim maintenance processing.");
  try { return await operation(); }
  finally {
    // A crash or an unavailable release endpoint is recovered by lease expiry.
    try { await requester.rpc("release_maintenance_processing", { target_request_id: requestId, lease_token: claim.token }); }
    catch { /* Leave the lease to expire. */ }
  }
}
