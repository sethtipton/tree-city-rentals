// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TenantRequestComposer } from "../src/components/TenantMaintenanceApp";
const recorder = vi.hoisted(() => ({ state: "idle", recordings: [{ id: "voice", file: {}, durationMs: 1000, size: 10 }], removeRecording: vi.fn() }));
vi.mock("../src/hooks/useAudioRecorder", () => ({ useAudioRecorder: () => recorder }));
let root, container;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
it("keeps text, photos, audio and retry identity until explicit success", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<TenantRequestComposer title="Report" propertyId="property" unitId="unit" onSubmit={send} submitLabel="Send" />));
  const textarea = container.querySelector("textarea");
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "Fan rattles"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
  const photos = container.querySelector("input[type=file]");
  Object.defineProperty(photos, "files", { configurable: true, value: [new File(["photo"], "fan.jpg", { type: "image/jpeg" })] });
  await act(async () => photos.dispatchEvent(new Event("change", { bubbles: true })));
  async function submit() { await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
  await submit();
  expect(textarea.value).toBe("Fan rattles"); expect(container.textContent).toContain("1 photo ready");
  expect(container.textContent).toContain("Voice message ready"); expect(recorder.removeRecording).not.toHaveBeenCalled();
  expect(container.querySelector("button[type=submit]").textContent).toContain("Retry");
  await submit();
  expect(send.mock.calls[1][0].submission).toBe(send.mock.calls[0][0].submission);
  expect(textarea.value).toBe(""); expect(container.textContent).not.toContain("1 photo ready");
  expect(recorder.removeRecording).toHaveBeenCalledExactlyOnceWith("voice");
});
