// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSignedAttachmentUrls } from "../src/hooks/useSignedAttachmentUrls";
let root, container, urls;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); container = document.createElement("div"); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });
function Harness({ paths, signer }) { urls = useSignedAttachmentUrls(paths.map(storage_path => ({ storage_path })), signer); return null; }
async function render(paths, signer) {
  await act(async () => root.render(<Harness paths={paths} signer={signer} />));
}
it("renews private URLs before their thirty-minute expiry", async () => {
  const sign = vi.fn().mockResolvedValueOnce("first").mockResolvedValue("renewed");
  await render(["photo"], sign); expect(urls.photo).toBe("first");
  await act(async () => vi.advanceTimersByTimeAsync(25 * 60_000));
  expect(urls.photo).toBe("renewed"); expect(sign).toHaveBeenCalledTimes(2);
});
it("retries failed paths independently without losing successful attachments", async () => {
  let fail = true;
  const sign = vi.fn(async path => { if (path === "audio" && fail) throw new Error("offline"); return path + "-url"; });
  await render(["photo", "audio"], sign); expect(urls).toEqual({ photo: "photo-url" });
  fail = false; await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(urls).toEqual({ photo: "photo-url", audio: "audio-url" }); expect(sign).toHaveBeenCalledTimes(3);
});
it("refreshes expired links when the tab regains focus", async () => {
  const sign = vi.fn().mockResolvedValueOnce("first").mockResolvedValue("renewed");
  await render(["photo"], sign);
  vi.setSystemTime(Date.now() + 31 * 60_000);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(urls.photo).toBe("renewed");
});
it("ignores a signing response after the scope unmounts", async () => {
  let finish; const sign = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  await render(["photo"], sign);
  await act(async () => root.render(null));
  await act(async () => finish("obsolete")); expect(urls).toEqual({});
});

it("does not publish a late URL from the previous scope", async () => {
  let finish; const sign = vi.fn(path => path === "old" ? new Promise(resolve => { finish = resolve; }) : Promise.resolve("current"));
  await render(["old"], sign); await render(["new"], sign);
  await act(async () => finish("obsolete")); expect(urls).toEqual({ new: "current" });
});
it("keeps a still-valid URL during a failed renewal and removes it after expiry", async () => {
  const sign = vi.fn().mockResolvedValueOnce("first").mockRejectedValue(new Error("offline"));
  await render(["photo"], sign);
  await act(async () => vi.advanceTimersByTimeAsync(25 * 60_000)); expect(urls.photo).toBe("first");
  vi.setSystemTime(Date.now() + 6 * 60_000);
  await act(async () => window.dispatchEvent(new Event("focus"))); expect(urls.photo).toBeUndefined();
  sign.mockResolvedValue("recovered");
  await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(urls.photo).toBe("recovered");
});
