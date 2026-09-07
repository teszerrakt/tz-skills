#!/usr/bin/env bun
/**
 * `bunx tz-skills` entry point.
 *
 * Bootstraps an installable clone of github.com/teszerrakt/tz-skills, then
 * symlinks each skill into `~/.claude/skills/` and each agent into
 * `~/.claude/agents/`.
 *
 * Clone target:
 *   $TZ_SKILLS_DIR if set, else ~/.local/share/tz-skills
 *
 * Subsequent invocations pull the latest from main, then refresh symlinks.
 *
 * Subcommands:
 *   bunx tz-skills              install or update
 *   bunx tz-skills --uninstall  remove our symlinks (leaves clone in place)
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { $ } from "bun";
import { discover, linkAll, unlinkAll } from "./link.ts";

const REPO_URL = "https://github.com/teszerrakt/tz-skills.git";
const DEFAULT_TARGET = join(homedir(), ".local/share/tz-skills");

function targetDir(): string {
  return process.env.TZ_SKILLS_DIR ?? DEFAULT_TARGET;
}

async function ensureClone(target: string): Promise<void> {
  if (existsSync(target)) {
    if (!existsSync(join(target, ".git"))) {
      console.error(
        `Refusing to update: ${target} exists but is not a git checkout. ` +
          `Remove it or set $TZ_SKILLS_DIR.`
      );
      process.exit(1);
    }
    console.log(`Updating clone at ${target}`);
    await $`git -C ${target} pull --ff-only`.quiet();
    return;
  }

  console.log(`Cloning ${REPO_URL} → ${target}`);
  mkdirSync(dirname(target), { recursive: true });
  await $`git clone --depth=1 ${REPO_URL} ${target}`.quiet();
}

async function install(): Promise<void> {
  const target = targetDir();
  await ensureClone(target);

  const entries = discover(target);
  if (entries.length === 0) {
    console.log(`No skills or agents found in ${target}`);
    return;
  }

  linkAll(entries);
  console.log(`Clone at ${target}.`);
}

async function uninstall(): Promise<void> {
  const target = targetDir();
  if (!existsSync(target)) {
    console.log(`No clone found at ${target}; nothing to unlink.`);
    return;
  }
  unlinkAll(discover(target));
  console.log(`\nDone. Clone left in place at ${target}.`);
}

const action = process.argv.includes("--uninstall") ? uninstall : install;
action().catch((err) => {
  console.error(err);
  process.exit(1);
});
