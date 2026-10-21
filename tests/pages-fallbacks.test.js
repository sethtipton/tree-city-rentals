import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { INITIAL_PROPERTIES } from "../src/lib/seed";
const getSlug = value => value.trim().replace(/&/g, "and").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
it("generates every canonical lowercase public route and preserves saved mixed-case routes", () => {
  const directory = mkdtempSync(join(tmpdir(), "listing-pages-"));
  try {
    mkdirSync(join(directory, "dist")); writeFileSync(join(directory, "dist/index.html"), '<html><head></head><body><div id="root"><main>app</main></div></body></html>');
    execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/create-pages-fallbacks.mjs", import.meta.url)), "--offline"], { cwd: directory });
    for (const property of INITIAL_PROPERTIES) {
      for (const name of [getSlug(property.name), getSlug(property.name).toLowerCase()]) {
        expect(readFileSync(join(directory, "dist", name, "index.html"), "utf8")).toContain("<main>app");
      }
      for (const unit of property.units) {
        expect(readFileSync(join(directory, "dist", getSlug(property.name).toLowerCase(), getSlug(unit).toLowerCase(), "index.html"), "utf8")).toContain("<main>app");
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
