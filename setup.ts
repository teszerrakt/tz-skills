#!/usr/bin/env bun
/**
 * Link this checkout into `~/.claude/` — skills into `skills/`, agents into
 * `agents/`. Idempotent: skips anything already linked here, warns on conflicts.
 *
 * Usage:
 *   bun run setup              # install
 *   bun run setup --uninstall  # remove our symlinks
 */

import { resolve } from "node:path";
import { discover, linkAll, unlinkAll } from "./bin/link.ts";

const entries = discover(resolve(import.meta.dir));

if (process.argv.includes("--uninstall")) {
  unlinkAll(entries);
  console.log("\ndone.");
} else if (entries.length === 0) {
  console.log("no skills or agents found in repo");
} else {
  linkAll(entries);
}
