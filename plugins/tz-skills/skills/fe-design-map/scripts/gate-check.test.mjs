import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runner = join(import.meta.dir, "gate-check.mjs");

const ledger = (fb, title, check, expected) =>
  `FB: ${fb}\n\n- [ ] G1 ${title}\n  CHECK: ${check}\n  EXPECT: ${expected}\n  EVIDENCE: pending\n`;

test("a CHECK re-runs another ledger through $GATE_CHECK, naming no skill directory", () => {
  const fb = mkdtempSync(join(tmpdir(), "gate-check-"));
  writeFileSync(join(fb, "inner.md"), ledger(fb, "inner", "echo READY", "READY"));
  writeFileSync(
    join(fb, "outer.md"),
    ledger(fb, "inner still holds", `node "$GATE_CHECK" "$FB/inner.md" | grep -c '^PASS G1'`, "1"),
  );

  const run = spawnSync("node", [runner, join(fb, "outer.md")], { encoding: "utf8" });

  expect(run.stdout).toContain("PASS G1 inner still holds");
  expect(run.status).toBe(0);
  expect(readFileSync(join(fb, "inner.md"), "utf8")).toContain("- [x] G1");
});
