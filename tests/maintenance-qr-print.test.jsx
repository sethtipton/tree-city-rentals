// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MaintenanceQrControls } from "../src/components/MaintenanceQrControls";
import { generateUnitMaintenanceQr } from "../src/lib/maintenanceQr";
vi.mock("../src/lib/maintenanceQr", async (original) => ({ ...await original(), generateUnitMaintenanceQr: vi.fn() }));
it("saves and reprints the same generated code without rotation and restores the page title", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const token = "A".repeat(43);
  generateUnitMaintenanceQr.mockResolvedValue(token);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const unit = { id: "test-unit", name: "Main Unit", maintenance_access_enabled: false };
  const originalTitle = document.title;
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  let frame;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const click = async text => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent.includes(text)).click());
  try {
    await act(async () => root.render(<MaintenanceQrControls property={{ name: "469 Carthage" }} selectedUnit={unit} propertyUnits={[unit]} />));
    await act(async () => container.querySelector("dialog form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain("Keep a copy for easy reprinting");
    for (let i = 0; i < 2; i++) {
      await click("Save PDF or print this card");
      expect(document.title).toBe("Tree City Rentals - 469 Carthage - Main Unit");
      expect(container.querySelector(".maintenance-qr-print-sheet").textContent).toContain(token);
      frame();
      await act(async () => window.dispatchEvent(new Event("afterprint")));
      expect(document.title).toBe(originalTitle);
      expect(container.querySelector(".maintenance-qr-print-sheet")).toBeNull();
    }
    expect(print).toHaveBeenCalledTimes(2);
    expect(generateUnitMaintenanceQr).toHaveBeenCalledExactlyOnceWith(unit.id);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks();
  }
});
